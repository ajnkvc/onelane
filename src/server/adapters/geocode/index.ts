import "server-only";
import type { GeocodePort, GeocodeSuggestion } from "./port";
import { DEV_PLACES, normalize } from "./dev-data";
import { PhotonAdapter } from "./photon";
import { getServerEnv } from "@/server/config/env";

/**
 * Dev-Adapter: kuratierte Orte, kein externer Call. Aktiv in Phase F / lokal.
 * Präfix-/Teilstring-Suche auf den Labels (eigene CI-Vorschlagsliste).
 */
class DevGeocodeAdapter implements GeocodePort {
  async suggest(query: string, limit = 6): Promise<GeocodeSuggestion[]> {
    const q = normalize(query);
    if (q.length < 1) return [];
    const scored = DEV_PLACES.map((p) => ({ p, idx: normalize(p.label).indexOf(q) }))
      .filter((x) => x.idx >= 0)
      .sort((a, b) => a.idx - b.idx || a.p.label.localeCompare(b.p.label, "de"));
    return scored.slice(0, limit).map((x) => x.p);
  }
  async geocode(query: string): Promise<GeocodeSuggestion | null> {
    const [first] = await this.suggest(query, 1);
    return first ?? null;
  }
}

/**
 * Produktions-Skelett für Google Places. ABSICHTLICH fail-closed: macht KEINEN
 * Netzwerk-Call ohne Consent-Mechanismus (Phase M) + AVV. Wird dort scharf
 * geschaltet (server-proxied, consent-gegated, eigene CI-UI). Bis dahin nicht
 * ausgewählt — exportiert, damit die spätere Verdrahtung daran andocken kann.
 */
export class GooglePlacesAdapter implements GeocodePort {
  async suggest(): Promise<GeocodeSuggestion[]> {
    throw new Error(
      "GooglePlacesAdapter: consent-gegated — erst ab Phase M (Consent-Banner + AVV) aktiv.",
    );
  }
  async geocode(): Promise<GeocodeSuggestion | null> {
    throw new Error(
      "GooglePlacesAdapter: consent-gegated — erst ab Phase M (Consent-Banner + AVV) aktiv.",
    );
  }
}

let instance: GeocodePort | null = null;

/**
 * Liefert den aktiven Geocode-Adapter. Auswahl server-only über GEOCODE_PROVIDER
 * (config/env.ts): 'photon' = server-proxied Photon-API (DSGVO-Docblock in
 * ./photon.ts), Default 'dev' = kuratierte lokale Orte OHNE Netzabhängigkeit
 * (Tests/CI bleiben netzfrei). Fail-soft: Ist die Server-Env (noch) nicht
 * valide, bleibt der Dev-Adapter aktiv. Der Google-Adapter wird erst in
 * Phase M consent-gegated auswählbar.
 */
export function getGeocodeAdapter(): GeocodePort {
  if (!instance) {
    let provider: "dev" | "photon" = "dev";
    try {
      provider = getServerEnv().GEOCODE_PROVIDER;
    } catch {
      provider = "dev";
    }
    instance = provider === "photon" ? new PhotonAdapter() : new DevGeocodeAdapter();
  }
  return instance;
}
