import "server-only";
import { getMapAdapter } from "@/server/adapters/maps";
import type { MapTileConfig } from "@/server/adapters/maps/port";

/**
 * Maps-Modul-Wrapper: liefert die öffentliche Tile-Konfiguration an die
 * Präsentation, ohne dass diese `@/server/*` importiert. In Produktion wirft der
 * Adapter ohne konfigurierten Tile-Anbieter (kein stiller OSMF-Public-Fallback) —
 * die Aufrufer behandeln das (Karte weglassen, Liste bleibt nutzbar).
 */
export type { MapTileConfig };

export function getTileConfig(): MapTileConfig {
  return getMapAdapter().getTileConfig();
}
