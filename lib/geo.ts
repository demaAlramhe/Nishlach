import type { AddressComponent } from "@/types/google-places";

const CITY_COMPONENT_TYPES = [
  "locality",
  "postal_town",
  "sublocality",
  "sublocality_level_1",
  "administrative_area_level_2",
  "administrative_area_level_1",
] as const;

/**
 * Known equivalents so English Google results still match Hebrew service_areas rows.
 * First entry in each group is the preferred display/canonical form.
 */
const CITY_ALIAS_GROUPS: string[][] = [
  [
    "תל אביב-יפו",
    "תל אביב יפו",
    "תל אביב",
    "Tel Aviv-Yafo",
    "Tel Aviv Yafo",
    "Tel Aviv",
    "Tel-Aviv",
    "Yafo",
    "Jaffa",
  ],
];

/** Normalize city strings for resilient comparison (hyphens, spaces, case). */
export function normalizeCityName(name: string): string {
  return name
    .trim()
    .normalize("NFC")
    // Hyphen / en-dash / em-dash / minus / Hebrew maqaf → space
    .replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D\u05BE-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function aliasGroupIndex(normalized: string): number {
  return CITY_ALIAS_GROUPS.findIndex((group) =>
    group.some((alias) => {
      const na = normalizeCityName(alias);
      return (
        na === normalized ||
        (na.length >= 4 &&
          normalized.length >= 4 &&
          (na.includes(normalized) || normalized.includes(na)))
      );
    })
  );
}

export function citiesMatch(a: string, b: string): boolean {
  const na = normalizeCityName(a);
  const nb = normalizeCityName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;

  const ga = aliasGroupIndex(na);
  const gb = aliasGroupIndex(nb);
  return ga !== -1 && ga === gb;
}

/** Pull city-like segments from a formatted address string. */
export function extractCitiesFromFormattedAddress(
  formattedAddress?: string | null
): string[] {
  if (!formattedAddress?.trim()) return [];

  const parts = formattedAddress
    .split(/[,،]/)
    .map((p) => p.trim())
    .filter(Boolean);

  const skip = /^(ישראל|israel|il)$/i;
  return parts.filter((part) => {
    if (skip.test(part)) return false;
    // Skip pure street numbers / house numbers
    if (/^\d+[A-Za-zא-ת]?$/.test(part)) return false;
    return true;
  });
}

/**
 * Collect city-like names from address_components (locality first, then fallbacks),
 * plus segments from formatted_address (often contains the Hebrew city even when
 * components come back in English).
 */
export function extractCityCandidates(
  components: AddressComponent[] | undefined,
  formattedAddress?: string | null
): string[] {
  const seen = new Set<string>();
  const candidates: string[] = [];

  const push = (name: string | null | undefined) => {
    const trimmed = name?.trim();
    if (!trimmed) return;
    const key = normalizeCityName(trimmed);
    if (!key || seen.has(key)) return;
    seen.add(key);
    candidates.push(trimmed);
  };

  if (components?.length) {
    for (const type of CITY_COMPONENT_TYPES) {
      for (const component of components) {
        if (!component.types.includes(type)) continue;
        push(component.long_name);
        push(component.short_name);
      }
    }
  }

  for (const part of extractCitiesFromFormattedAddress(formattedAddress)) {
    push(part);
  }

  return candidates;
}

/** Primary city guess (first candidate). */
export function extractCityFromComponents(
  components: AddressComponent[] | undefined,
  formattedAddress?: string | null
): string | null {
  return extractCityCandidates(components, formattedAddress)[0] ?? null;
}

export function emptyToNull(value?: string | null): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}
