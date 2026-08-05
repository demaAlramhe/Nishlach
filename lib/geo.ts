import type { AddressComponent } from "@/types/google-places";

/** Extract city name from Google Places address_components (prefer locality). */
export function extractCityFromComponents(
  components: AddressComponent[] | undefined
): string | null {
  if (!components?.length) return null;

  const byType = (type: string) =>
    components.find((c) => c.types.includes(type))?.long_name ?? null;

  return (
    byType("locality") ??
    byType("sublocality") ??
    byType("administrative_area_level_2") ??
    byType("postal_town") ??
    null
  );
}

export function emptyToNull(value?: string | null): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}
