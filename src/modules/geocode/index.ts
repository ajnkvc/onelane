import "server-only";
import { getGeocodeAdapter } from "@/server/adapters/geocode";
import type { GeocodeSuggestion } from "@/server/adapters/geocode/port";

/**
 * Geschäftslogik-Wrapper für Geocoding/Autocomplete. Die Präsentation (Route-
 * Handler/Seiten) ruft NUR diese Modul-Funktionen, nie `@/server/*` direkt.
 * Eingaben werden hier minimal validiert/begrenzt.
 */
export type { GeocodeSuggestion };

export async function suggestPlaces(query: string, limit = 6): Promise<GeocodeSuggestion[]> {
  const q = (query ?? "").trim();
  if (q.length < 1 || q.length > 120) return [];
  return getGeocodeAdapter().suggest(q, Math.min(Math.max(limit, 1), 10));
}

export async function geocodePlace(query: string): Promise<GeocodeSuggestion | null> {
  const q = (query ?? "").trim();
  if (!q || q.length > 120) return null;
  return getGeocodeAdapter().geocode(q);
}
