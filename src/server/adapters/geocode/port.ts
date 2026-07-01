import "server-only";

/**
 * geocode/port.ts — anbieterunabhängiger Vertrag für Geocoding & Adress-Autocomplete.
 * ----------------------------------------------------------------------------
 * Die Geschäftslogik kennt nur diesen Port, nie den konkreten Anbieter (kein
 * Lock-in). Phase F: Dev-Adapter (lokal, kuratierte Orte). Produktion: Google
 * Places — aber NUR consent-gegated + AVV (Consent-Mechanismus = Phase M);
 * bis dahin bleibt der Dev-Adapter aktiv (kein externer Call).
 */
export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export type GeocodeKind = "city" | "district" | "plz" | "address";

export interface GeocodeSuggestion extends GeoPoint {
  /** Anzeigetext für die eigene CI-Vorschlagsliste (kein fremdes Widget). */
  label: string;
  kind: GeocodeKind;
}

export interface GeocodePort {
  /** Autocomplete ab dem ersten Zeichen — Vorschläge für die eigene UI. */
  suggest(query: string, limit?: number): Promise<GeocodeSuggestion[]>;
  /** Eine Eingabe zu einem Punkt auflösen (z. B. ausgewählter Vorschlag). */
  geocode(query: string): Promise<GeocodeSuggestion | null>;
}
