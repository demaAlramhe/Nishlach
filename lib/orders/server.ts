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

/**
 * Load formula constants from pricing_config (single row).
 * Falls back to 50 / 5 / 5 if the table is empty or unreadable.
 */
export async function getPricingConfig(): Promise<{
  base_price: number;
  free_km: number;
  price_per_km: number;
}> {
  const defaults = { base_price: 50, free_km: 5, price_per_km: 5 };
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("pricing_config")
      .select("base_price, free_km, price_per_km")
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      console.warn("[pricing] pricing_config unavailable — using defaults", error);
      return defaults;
    }

    return {
      base_price: Number.isFinite(Number(data.base_price))
        ? Number(data.base_price)
        : defaults.base_price,
      free_km: Number.isFinite(Number(data.free_km))
        ? Number(data.free_km)
        : defaults.free_km,
      price_per_km: Number.isFinite(Number(data.price_per_km))
        ? Number(data.price_per_km)
        : defaults.price_per_km,
    };
  } catch (err) {
    console.warn("[pricing] getPricingConfig failed — using defaults", err);
    return defaults;
  }
}

/**
 * Formula pricing (₪):
 *   base_price for first free_km inclusive
 *   + price_per_km per extra km beyond free_km, rounded UP to whole km
 *   price = base + ceil(max(0, distance_km - free_km)) * per_km
 *
 * Returns null when distance is unknown → "יחושב ידנית".
 * Constants come from pricing_config (admin-editable).
 */
export async function findPriceForDistance(
  distanceKm: number | null | undefined
): Promise<number | null> {
  console.log("[pricing] findPriceForDistance input distance_km:", distanceKm);

  if (distanceKm == null || Number.isNaN(distanceKm)) {
    console.warn(
      "[pricing] no price — distance_km is null/undefined/NaN (manual quote)"
    );
    return null;
  }

  const config = await getPricingConfig();
  const extraKm = Math.ceil(Math.max(0, distanceKm - config.free_km));
  const price = config.base_price + extraKm * config.price_per_km;

  console.log("[pricing] formula:", {
    distance_km: distanceKm,
    ...config,
    extra_km_ceil: extraKm,
    price,
  });

  return price;
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
