import "server-only";
import type { GeocodeSuggestion } from "./port";

/**
 * dev-data.ts — kuratierte Orte (München-Bezirke + DACH-Städte) für den lokalen
 * Dev-Geocoder. KEINE Straßen-Genauigkeit (das liefert in Produktion Google
 * Places). Reicht, um Adress-/Standort-Autocomplete + Umkreissuche lokal ohne
 * externen Dienst zu betreiben.
 */
export const DEV_PLACES: GeocodeSuggestion[] = [
  // München-Stadtbezirke (Koordinaten ~ Bezirkszentrum)
  { label: "Altstadt-Lehel, München", latitude: 48.1359, longitude: 11.583, kind: "district" },
  { label: "Schwabing, München", latitude: 48.1612, longitude: 11.586, kind: "district" },
  { label: "Maxvorstadt, München", latitude: 48.151, longitude: 11.5665, kind: "district" },
  { label: "Au-Haidhausen, München", latitude: 48.13, longitude: 11.601, kind: "district" },
  { label: "Sendling, München", latitude: 48.118, longitude: 11.545, kind: "district" },
  { label: "Sendling-Westpark, München", latitude: 48.12, longitude: 11.53, kind: "district" },
  { label: "Neuhausen-Nymphenburg, München", latitude: 48.1551, longitude: 11.535, kind: "district" },
  { label: "Bogenhausen, München", latitude: 48.1535, longitude: 11.622, kind: "district" },
  { label: "Obergiesing, München", latitude: 48.1085, longitude: 11.596, kind: "district" },
  { label: "Pasing-Obermenzing, München", latitude: 48.1466, longitude: 11.4613, kind: "district" },
  { label: "Moosach, München", latitude: 48.18, longitude: 11.512, kind: "district" },
  { label: "Laim, München", latitude: 48.138, longitude: 11.503, kind: "district" },
  { label: "Trudering-Riem, München", latitude: 48.118, longitude: 11.665, kind: "district" },
  { label: "Milbertshofen-Am Hart, München", latitude: 48.195, longitude: 11.568, kind: "district" },
  { label: "Berg am Laim, München", latitude: 48.126, longitude: 11.628, kind: "district" },
  { label: "Ramersdorf-Perlach, München", latitude: 48.11, longitude: 11.628, kind: "district" },
  { label: "Allach-Untermenzing, München", latitude: 48.201, longitude: 11.468, kind: "district" },
  { label: "Feldmoching-Hasenbergl, München", latitude: 48.212, longitude: 11.538, kind: "district" },
  { label: "Ludwigsvorstadt-Isarvorstadt, München", latitude: 48.13, longitude: 11.56, kind: "district" },
  // PLZ-Beispiele München
  { label: "80331 München (Altstadt)", latitude: 48.1359, longitude: 11.583, kind: "plz" },
  { label: "80802 München (Schwabing)", latitude: 48.1612, longitude: 11.586, kind: "plz" },
  // DACH-Städte
  { label: "München", latitude: 48.1374, longitude: 11.5755, kind: "city" },
  { label: "Augsburg", latitude: 48.3705, longitude: 10.8978, kind: "city" },
  { label: "Nürnberg", latitude: 49.4521, longitude: 11.0767, kind: "city" },
  { label: "Berlin", latitude: 52.52, longitude: 13.405, kind: "city" },
  { label: "Hamburg", latitude: 53.5511, longitude: 9.9937, kind: "city" },
  { label: "Köln", latitude: 50.9375, longitude: 6.9603, kind: "city" },
  { label: "Frankfurt am Main", latitude: 50.1109, longitude: 8.6821, kind: "city" },
  { label: "Stuttgart", latitude: 48.7758, longitude: 9.1829, kind: "city" },
  { label: "Wien", latitude: 48.2082, longitude: 16.3738, kind: "city" },
  { label: "Zürich", latitude: 47.3769, longitude: 8.5417, kind: "city" },
];

/** Diakritika entfernen + lowercase für robusten Präfix-/Teilstring-Vergleich. */
export function normalize(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}
