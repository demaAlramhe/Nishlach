import type { AddressComponent } from "@/types/google-places";

/** Only true city-ish Google types — never district/region (admin level 1). */
const CITY_COMPONENT_TYPES = [
  "locality",
  "postal_town",
  "sublocality",
  "sublocality_level_1",
] as const;

export type CityCandidateSource =
  | (typeof CITY_COMPONENT_TYPES)[number]
  | "primary"
  | "formatted_address"
  | (string & {});

export type CityCandidate = {
  name: string;
  source: CityCandidateSource;
};

/**
 * Known equivalents so English Google results still match Hebrew service_areas rows.
 * First entry in each group is the preferred display/canonical form.
 * Matching is exact-after-normalize only (no substring).
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
    group.some((alias) => normalizeCityName(alias) === normalized)
  );
}

/**
 * Exact city match after normalization + known aliases.
 * No substring/contains matching (avoids "מחוז תל אביב" ≈ "תל אביב-יפו").
 */
export function citiesMatch(a: string, b: string): boolean {
  const na = normalizeCityName(a);
  const nb = normalizeCityName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;

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

  const skip = /^(ישראל|israel|il|מחוז\b.*)$/i;
  return parts.filter((part) => {
    if (skip.test(part)) return false;
    // Skip district-style labels
    if (/^מחוז\s/.test(part)) return false;
    // Skip pure street numbers / house numbers
    if (/^\d+[A-Za-zא-ת]?$/.test(part)) return false;
    return true;
  });
}

/**
 * Collect city candidates from address_components (locality / sublocality only).
 * Falls back to formatted_address segments (district labels filtered out).
 * Does NOT use administrative_area_level_1/2 (regions share names with cities).
 */
export function extractCityCandidates(
  components: AddressComponent[] | undefined,
  formattedAddress?: string | null
): CityCandidate[] {
  const seen = new Set<string>();
  const candidates: CityCandidate[] = [];

  const push = (
    name: string | null | undefined,
    source: CityCandidateSource
  ) => {
    const trimmed = name?.trim();
    if (!trimmed) return;
    const key = normalizeCityName(trimmed);
    if (!key || seen.has(key)) return;
    seen.add(key);
    candidates.push({ name: trimmed, source });
  };

  if (components?.length) {
    for (const type of CITY_COMPONENT_TYPES) {
      for (const component of components) {
        if (!component.types.includes(type)) continue;
        push(component.long_name, type);
        push(component.short_name, type);
      }
    }
  }

  // Fallback only when components didn't yield a city (e.g. sparse Places result)
  if (candidates.length === 0) {
    for (const part of extractCitiesFromFormattedAddress(formattedAddress)) {
      push(part, "formatted_address");
    }
  }

  return candidates;
}

/** Primary city guess (first candidate name). */
export function extractCityFromComponents(
  components: AddressComponent[] | undefined,
  formattedAddress?: string | null
): string | null {
  return extractCityCandidates(components, formattedAddress)[0]?.name ?? null;
}

export function candidateNames(candidates: CityCandidate[]): string[] {
  return candidates.map((c) => c.name);
}

export function emptyToNull(value?: string | null): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}
