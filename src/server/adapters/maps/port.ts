/**
 * MapPort — Vertrag für Karten-Anbieter (anbieterunabhängig).
 * Bevorzugt: OpenStreetMap/Leaflet (europäisch, kein Tracking, Datenhoheit).
 * Google Maps nur falls zwingend nötig — Abwägung in docs/DEVLOG.md.
 *
 * Hinweis: Die eigentliche Kartendarstellung läuft clientseitig (Leaflet). Dieser
 * Port liefert die (öffentliche) Kachel-Konfiguration und enthält KEINE Secrets.
 */
export interface MapTileConfig {
  tileUrl: string;
  attribution: string;
  maxZoom: number;
}

export interface MapPort {
  getTileConfig(): MapTileConfig;
}
