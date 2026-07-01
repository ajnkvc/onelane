/**
 * db/ingest/normalize.mjs — REINE Normalisierungs-/Hilfslogik für den OSM-Import.
 * ============================================================================
 * Bewusst pures JS ohne DB/Netz/server-only, damit Runner (scripts/import-osm.mjs)
 * UND Tests (vitest) es importieren können. KEINE Halluzination: es wird nur
 * abgeleitet/normalisiert, nie geraten oder erfunden.
 *
 * `slugify` MUSS identisch zu src/lib/slug.ts bleiben (Profil-Lookup/Verlinkung) —
 * ein Paritätstest sichert das ab (tests/ingest.test.ts).
 */
import { createHash } from "node:crypto";

const COMBINING_MARKS = /[̀-ͯ]/g;

/** Deterministische Slugifizierung — identisch zu src/lib/slug.ts. */
export function slugify(input) {
  return String(input)
    .toLowerCase()
    // Deutsche Umlaute/ß ausschreiben VOR dem Entfernen der Diakritika (muenchen, koeln, strasse).
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Name-/Pattern-Vergleichsschlüssel: alphanumerisch, ohne Trenner (für Exclusion). */
export function normName(input) {
  return String(input ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "");
}

/** Stabiler Kurz-Hash (für deterministische Slug-Kollisionssuffixe). */
export function shortHash(input) {
  return createHash("sha1").update(String(input)).digest("hex").slice(0, 6);
}

/** Registrierbare Domain aus einer URL (lowercase, ohne www). Null wenn unbrauchbar. */
export function extractDomain(url) {
  if (!url || typeof url !== "string") return null;
  let s = url.trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = "http://" + s;
  let host;
  try {
    host = new URL(s).hostname;
  } catch {
    return null;
  }
  host = host.toLowerCase().replace(/^www\./, "");
  if (!host.includes(".")) return null;
  return host;
}

/** Quell-Identität eines OSM-Objekts, z. B. "node/123". */
export function osmSourceRef(el) {
  return `${el.type}/${el.id}`;
}

/** OSM-Objektlink. */
export function osmSourceUrl(el) {
  return `https://www.openstreetmap.org/${el.type}/${el.id}`;
}

function firstNonEmpty(...vals) {
  for (const v of vals) {
    if (typeof v === "string" && v.trim() !== "") return v.trim();
  }
  return null;
}

/** Koordinaten: Node hat lat/lon; Way/Relation haben `center`. */
function coords(el) {
  if (typeof el.lat === "number" && typeof el.lon === "number") {
    return { lat: el.lat, lng: el.lon };
  }
  if (el.center && typeof el.center.lat === "number" && typeof el.center.lon === "number") {
    return { lat: el.center.lat, lng: el.center.lon };
  }
  return { lat: null, lng: null };
}

/**
 * Normalisiert ein Overpass-Element zu einem Import-Kandidaten.
 * Gibt `null` zurück, wenn kein verwertbarer Name existiert (→ Aufrufer: reject).
 */
export function normalizeOsmElement(el) {
  const t = el.tags ?? {};
  const name = firstNonEmpty(t.name, t["official_name"], t["operator"]);
  if (!name) return null;

  const street = firstNonEmpty(t["addr:street"]);
  const hnr = firstNonEmpty(t["addr:housenumber"]);
  const strasse = street ? (hnr ? `${street} ${hnr}` : street) : null;
  const plzRaw = firstNonEmpty(t["addr:postcode"]);
  const plz = plzRaw && /^\d{5}$/.test(plzRaw) ? plzRaw : null; // DE-PLZ; sonst nicht raten
  const ort = firstNonEmpty(t["addr:city"], t["addr:town"], t["addr:village"]);
  const website = firstNonEmpty(t.website, t["contact:website"]);
  const phone = firstNonEmpty(t.phone, t["contact:phone"]);
  const email = firstNonEmpty(t.email, t["contact:email"]);
  const { lat, lng } = coords(el);

  return {
    sourceRef: osmSourceRef(el),
    sourceUrl: osmSourceUrl(el),
    name,
    strasse,
    plz,
    ort: ort || null,
    bundesland: null, // OSM liefert das nicht zuverlässig → nicht raten (008c/Geo später)
    land: "DE",
    lat,
    lng,
    // Kontakte: NUR Staging (008c verifiziert) — nie in school_profiles in 008b.
    phone: phone || null,
    website: website || null,
    email: email || null,
    domain: extractDomain(website),
    operator: firstNonEmpty(t.operator),
    osmType: el.type,
    osmId: el.id,
  };
}

/** Adress-/Identitätsschlüssel (PLZ + slugifizierter Name) für konservativen Abgleich. */
export function identityKey(cand) {
  return `${cand.land}|${cand.plz ?? ""}|${slugify(cand.name)}`;
}

/**
 * Dedupe-Schlüssel (Migration 0006), zwei Granularitäten:
 *  - clusterKey: BREITER Verdacht (Land|PLZ|Name) — fasst Filialen UND echte Dupes;
 *    dient der Review-Gruppierung (Mensch entscheidet).
 *  - dedupeKey: STRIKTE Identität (… + Straße/Hausnr.) — für den DB-Unique-Riegel.
 * Land default DE. Leere Bestandteile bleiben leer (kein Raten).
 */
export function clusterKey(cand) {
  return `${cand.land ?? "DE"}|${cand.plz ?? ""}|${normName(cand.name)}`;
}
export function dedupeKey(cand) {
  return `${cand.land ?? "DE"}|${cand.plz ?? ""}|${normName(cand.name)}|${normName(cand.strasse)}`;
}

/** Grobe Geo-Nähe (~150 m) ohne externe Lib. */
export function geoNear(aLat, aLng, bLat, bLng, deg = 0.0015) {
  if (aLat == null || aLng == null || bLat == null || bLng == null) return false;
  return Math.abs(aLat - bLat) <= deg && Math.abs(aLng - bLng) <= deg;
}
