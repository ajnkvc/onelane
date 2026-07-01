import "server-only";
import type { MapPort, MapTileConfig } from "./port";
import { getMapTileConfig, isProduction } from "@/lib/public-config";

/**
 * Karten-Adapter — anbieterunabhängig (siehe ./port).
 * ----------------------------------------------------------------------------
 * Phase 1: OpenStreetMap-Stil über Leaflet. WICHTIG: Die öffentlichen OSMF-Tiles
 * (tile.openstreetmap.org) sind laut OSMF Tile Usage Policy KEIN Produktionsdienst
 * (Drosselung/Sperrung möglich). Für Produktion daher einen eigenen/bezahlten
 * Tile-Anbieter (MapTiler, Stadia, Protomaps/self-host …) über
 * NEXT_PUBLIC_MAP_TILE_URL konfigurieren. Hier liegen KEINE Secrets.
 */

// DEV-Fallback: policy-konforme Single-Host-URL (kein {s}-Subdomain-Muster mehr),
// korrekte Attribution. NUR für lokale Entwicklung.
const DEV_FALLBACK: MapTileConfig = {
  tileUrl: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-Mitwirkende',
  maxZoom: 19,
};

class LeafletAdapter implements MapPort {
  getTileConfig(): MapTileConfig {
    const configured = getMapTileConfig();
    if (configured) {
      return { tileUrl: configured.tileUrl, attribution: configured.attribution, maxZoom: 19 };
    }
    if (isProduction()) {
      throw new Error(
        "Karten: kein Tile-Anbieter konfiguriert (NEXT_PUBLIC_MAP_TILE_URL). " +
          "OSMF-Public-Tiles sind nicht für Produktion zulässig.",
      );
    }
    return DEV_FALLBACK;
  }
}

export function getMapAdapter(): MapPort {
  return new LeafletAdapter();
}
