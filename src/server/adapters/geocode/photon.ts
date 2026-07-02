import "server-only";
import { safeFetch } from "@/server/egress/safe-fetch";
import type { GeocodeKind, GeocodePort, GeocodeSuggestion } from "./port";

/**
 * photon.ts — Adress-Autocomplete über die offene Photon-API (OSM-basiert).
 * ----------------------------------------------------------------------------
 * DSGVO-BEGRÜNDUNG: Der Aufruf läuft ausschließlich SERVER-seitig als Proxy —
 * der Browser der Nutzer:innen kontaktiert NIE einen Drittanbieter (keine
 * IP-/Header-/Cookie-Weitergabe an den Photon-Betreiber). Verarbeitet wird nur
 * der Suchtext, transient (keine Speicherung, kein Log des Klartexts hier).
 * Koordinaten werden bereits IM ADAPTER auf 3 Dezimalstellen (~110 m) GERUNDET,
 * damit keine haustürgenauen Koordinaten in URLs, Logs oder Referrern landen
 * (Privacy-Direktive). Egress ausschließlich über safeFetch (SSRF-Guard) mit
 * harter Host-Allowlist, kleinem Timeout und knapper Antwortgrenze; JEDER
 * Fehler ist fail-soft ([] statt 500 — die Suche funktioniert dann ohne
 * Vorschläge weiter). Aktivierung nur explizit über GEOCODE_PROVIDER=photon
 * (server-only, siehe config/env.ts) — Default bleibt der netzfreie Dev-Adapter.
 */
const PHOTON_HOST = "photon.komoot.io";
const TIMEOUT_MS = 2500;
const MAX_BYTES = 256 * 1024;

/** Koordinaten-Rundung auf 3 Dezimalstellen (~110 m) — Privacy by design. */
function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function s(props: Record<string, unknown>, key: string): string | null {
  const v = props[key];
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

/** Photon-/OSM-Typen → Port-Kind (konservatives Mapping). */
function kindOf(props: Record<string, unknown>): GeocodeKind {
  if (props.osm_value === "postcode") return "plz";
  const typ = typeof props.type === "string" ? props.type : "";
  if (typ === "city" || typ === "county" || typ === "state" || typ === "country") return "city";
  if (typ === "district" || typ === "locality") return "district";
  return "address"; // house/street/…: adressgenau
}

/** Anzeigetext für die eigene CI-Vorschlagsliste: „Name, Ort" bzw. „Straße Nr, Ort". */
function labelOf(props: Record<string, unknown>): string | null {
  const street = s(props, "street");
  const adresse = street ? [street, s(props, "housenumber")].filter(Boolean).join(" ") : null;
  const name = s(props, "name") ?? adresse;
  const ort = s(props, "city") ?? s(props, "state");
  if (!name) return ort;
  if (!ort || ort === name) return name;
  return `${name}, ${ort}`;
}

/** Ein Photon-GeoJSON-Feature → Port-Vorschlag (null bei unbrauchbaren Daten). */
export function mapPhotonFeature(feature: unknown): GeocodeSuggestion | null {
  if (typeof feature !== "object" || feature === null) return null;
  const f = feature as { geometry?: { coordinates?: unknown }; properties?: Record<string, unknown> };
  const coords = f.geometry?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const lng = Number(coords[0]);
  const lat = Number(coords[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const props = f.properties ?? {};
  const label = labelOf(props);
  if (!label) return null;
  return { label, latitude: round3(lat), longitude: round3(lng), kind: kindOf(props) };
}

export class PhotonAdapter implements GeocodePort {
  async suggest(query: string, limit = 6): Promise<GeocodeSuggestion[]> {
    const q = query.trim();
    if (q.length < 1) return [];
    const n = Math.min(Math.max(limit, 1), 10);
    try {
      const url = `https://${PHOTON_HOST}/api/?q=${encodeURIComponent(q)}&lang=de&limit=${n}`;
      const res = await safeFetch(
        url,
        { headers: { accept: "application/json" } },
        { allowlist: [PHOTON_HOST], timeoutMs: TIMEOUT_MS, maxBytes: MAX_BYTES },
      );
      if (!res.ok) return [];
      const data = (await res.json()) as { features?: unknown[] };
      const features = Array.isArray(data?.features) ? data.features : [];
      const seen = new Set<string>();
      const out: GeocodeSuggestion[] = [];
      for (const feature of features) {
        const sug = mapPhotonFeature(feature);
        if (!sug) continue;
        // Rundung kann Nachbarschafts-Duplikate erzeugen → Label+Punkt dedupen.
        const key = `${sug.label}@${sug.latitude},${sug.longitude}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(sug);
        if (out.length >= n) break;
      }
      return out;
    } catch {
      return []; // fail-soft: Suche läuft ohne Vorschläge weiter
    }
  }

  async geocode(query: string): Promise<GeocodeSuggestion | null> {
    const [first] = await this.suggest(query, 1);
    return first ?? null;
  }
}
