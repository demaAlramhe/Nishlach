import { createClient } from "@/lib/supabase/server";

export async function isActiveServiceArea(cityName: string): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("service_areas")
    .select("id")
    .eq("city_name", cityName)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    console.error("service_areas lookup failed", error);
    return false;
  }

  return Boolean(data);
}

export async function findPriceForDistance(
  distanceKm: number
): Promise<number | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pricing_rules")
    .select("min_km, max_km, price")
    .order("min_km", { ascending: true });

  if (error || !data?.length) {
    if (error) console.error("pricing_rules lookup failed", error);
    return null;
  }

  const match = data.find((rule) => {
    const min = Number(rule.min_km);
    const max = rule.max_km == null ? null : Number(rule.max_km);
    if (distanceKm < min) return false;
    if (max == null) return true;
    return distanceKm <= max;
  });

  return match ? Number(match.price) : null;
}

export async function getDrivingDistanceKm(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
): Promise<number | null> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) return null;

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

  if (!res.ok) return null;

  const json = (await res.json()) as {
    rows?: { elements?: { status?: string; distance?: { value: number } }[] }[];
  };

  const element = json.rows?.[0]?.elements?.[0];
  if (!element || element.status !== "OK" || element.distance?.value == null) {
    return null;
  }

  return Math.round((element.distance.value / 1000) * 100) / 100;
}
