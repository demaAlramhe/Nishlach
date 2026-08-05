import { citiesMatch } from "@/lib/geo";
import { createClient } from "@/lib/supabase/server";

/**
 * Match extracted Google city name(s) against active service_areas.
 * Uses trimmed / hyphen-normalized / case-insensitive comparison.
 */
export async function isActiveServiceArea(
  cityName: string,
  extraCandidates: string[] = []
): Promise<{ available: boolean; matchedCity: string | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("service_areas")
    .select("id, city_name")
    .eq("is_active", true);

  if (error) {
    console.error("service_areas lookup failed", error);
    return { available: false, matchedCity: null };
  }

  if (!data?.length) {
    console.warn(
      "[service-area] no active service_areas rows returned (check RLS / seed data)"
    );
    return { available: false, matchedCity: null };
  }

  const candidates = [cityName, ...extraCandidates]
    .map((c) => c.trim())
    .filter(Boolean);

  console.log("[service-area] candidates:", candidates);
  console.log(
    "[service-area] db cities:",
    data.map((row) => row.city_name)
  );

  for (const candidate of candidates) {
    const match = data.find((row) => citiesMatch(candidate, row.city_name));
    if (match) {
      console.log("[service-area] matched:", candidate, "→", match.city_name);
      return { available: true, matchedCity: match.city_name };
    }
  }

  console.warn("[service-area] no match for candidates", candidates);
  return { available: false, matchedCity: null };
}

export async function findPriceForDistance(
  distanceKm: number | null | undefined
): Promise<number | null> {
  console.log("[pricing] findPriceForDistance input distance_km:", distanceKm);

  if (distanceKm == null || Number.isNaN(distanceKm)) {
    console.warn(
      "[pricing] no rule matched — reason: distance_km is null/undefined/NaN"
    );
    return null;
  }

  // Exact query:
  //   select id, min_km, max_km, price from pricing_rules order by min_km asc
  // Match logic (inclusive range):
  //   min_km <= distance_km && (max_km is null || distance_km <= max_km)
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pricing_rules")
    .select("id, min_km, max_km, price")
    .order("min_km", { ascending: true });

  if (error) {
    console.error("[pricing] pricing_rules lookup failed:", error);
    return null;
  }

  console.log("[pricing] computed distance_km:", distanceKm);
  console.log("[pricing] pricing_rules rows fetched:", data);

  if (!data?.length) {
    console.warn(
      "[pricing] no rule matched — reason: pricing_rules table empty or RLS blocked"
    );
    return null;
  }

  for (const rule of data) {
    const rawMin = rule.min_km;
    const rawMax = rule.max_km;
    const rawPrice = rule.price;
    const min = Number(rawMin);
    const max = rawMax == null ? null : Number(rawMax);
    const price = Number(rawPrice);

    console.log("[pricing] evaluating rule:", {
      id: rule.id,
      raw: { min_km: rawMin, max_km: rawMax, price: rawPrice },
      types: {
        min_km: typeof rawMin,
        max_km: typeof rawMax,
        price: typeof rawPrice,
      },
      coerced: { min, max, price },
      distance_km: distanceKm,
    });

    if (Number.isNaN(min) || (max != null && Number.isNaN(max))) {
      console.warn(
        "[pricing] rule FAILED — min_km/max_km not numeric after Number()",
        { rawMin, rawMax, min, max }
      );
      continue;
    }

    if (distanceKm < min) {
      console.warn(
        `[pricing] rule FAILED — distance_km (${distanceKm}) < min_km (${min})`
      );
      continue;
    }

    if (max != null && distanceKm > max) {
      console.warn(
        `[pricing] rule FAILED — distance_km (${distanceKm}) > max_km (${max})`
      );
      continue;
    }

    console.log(
      `[pricing] rule MATCHED — ${min} <= ${distanceKm}` +
        (max == null ? " (no max)" : ` <= ${max}`) +
        ` → price ${price}`
    );
    return price;
  }

  console.warn(
    "[pricing] no rule matched — every row failed the comparisons above",
    { distance_km: distanceKm }
  );
  return null;
}

export async function getDrivingDistanceKm(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
): Promise<number | null> {
  console.log("[pricing] Distance Matrix origin:", origin);
  console.log("[pricing] Distance Matrix destination:", destination);

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.warn(
      "[pricing] Distance Matrix skipped — GOOGLE_MAPS_API_KEY missing"
    );
    return null;
  }

  const params = new URLSearchParams({
    origins: `${origin.lat},${origin.lng}`,
    destinations: `${destination.lat},${destination.lng}`,
    mode: "driving",
    key: apiKey,
    language: "he",
  });

  const res = await fetch(
    `https://maps.googleapis.com/maps/api/distancematrix/json?${params.toString()}`,
    { cache: "no-store" }
  );

  const rawText = await res.text();
  console.log("[pricing] Distance Matrix HTTP status:", res.status);
  console.log("[pricing] Distance Matrix raw body:", rawText);

  if (!res.ok) {
    console.warn("[pricing] Distance Matrix HTTP error — returning null");
    return null;
  }

  let json: {
    status?: string;
    error_message?: string;
    rows?: {
      elements?: {
        status?: string;
        distance?: { value: number; text?: string };
        duration?: { value: number; text?: string };
      }[];
    }[];
  };

  try {
    json = JSON.parse(rawText) as typeof json;
  } catch (parseError) {
    console.error("[pricing] Distance Matrix JSON parse failed:", parseError);
    return null;
  }

  console.log("[pricing] Distance Matrix top-level status:", json.status);
  if (json.error_message) {
    console.warn("[pricing] Distance Matrix error_message:", json.error_message);
  }

  const element = json.rows?.[0]?.elements?.[0];
  console.log("[pricing] Distance Matrix element:", element);

  if (!element) {
    console.warn(
      "[pricing] Distance Matrix — no element in rows[0].elements[0]"
    );
    return null;
  }

  console.log("[pricing] Distance Matrix element status:", element.status);
  console.log(
    "[pricing] Distance Matrix distance meters:",
    element.distance?.value ?? null
  );

  if (element.status !== "OK" || element.distance?.value == null) {
    console.warn(
      "[pricing] Distance Matrix element not OK / missing distance — returning null",
      { status: element.status, distance: element.distance }
    );
    return null;
  }

  const distanceKm =
    Math.round((element.distance.value / 1000) * 100) / 100;
  console.log("[pricing] computed distance_km:", distanceKm);
  return distanceKm;
}
