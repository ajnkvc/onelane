/**
 * db/ingest/siteguard.mjs — REINE Sicherheits-/Domain-Logik für den Site-Fetch (008c).
 * ============================================================================
 * SSRF-sicher: nur http(s), keine IP-Literale/localhost/private/loopback/link-local/
 * Metadaten-Adressen. „Eigene Domain": registrierbare Domain (eTLD+1, vereinfacht für
 * DE/gängige TLDs). Jede Redirect-Stufe wird gegen die erlaubte Site-Grenze geprüft.
 * Kein Netz/DB hier — nur Entscheidungen über URLs.
 */

// Kuratierte Teilmenge der Public-Suffix-Liste (KEINE vollständige PSL — DE-/EU-Fokus).
// F-051: reicht für eigene Schul-Domains; die vollständige PSL (z. B. tldts) ist ein bewusst
// zurückgestellter Folgeschritt (Dependency-Entscheidung, vgl. Werkzeugketten-Politik).
const MULTI_TLDS = new Set([
  "co.uk", "org.uk", "gov.uk", "ac.uk", "com.au", "co.at", "or.at", "ac.at", "co.nz",
]);
// Mandantenfähige Plattform-/Baukasten-Hosts: hier ist die REGISTRIERBARE Einheit die
// Subdomain (Mandant), NICHT die nackte Plattformdomain. Ohne diese Liste würde
// registrableDomain z. B. für "schule-x.jimdosite.com" fälschlich "jimdosite.com" liefern und
// beim Same-Site-Crawl FREMDE Mandanten (schule-y.jimdosite.com) als „gleiche Site" zulassen.
// Behandelt sie wie Public-Suffixe (eTLD+1 = Suffix + eine Mandanten-Label). Kuratiert, nicht erschöpfend.
const PLATFORM_SUFFIXES = new Set([
  "jimdosite.com", "jimdo.com", "wixsite.com", "wordpress.com", "blogspot.com",
  "github.io", "gitlab.io", "netlify.app", "vercel.app", "pages.dev",
  "myshopify.com", "square.site", "webnode.at", "webnode.com", "npage.de",
  "beepworld.de", "jouwweb.nl", "sitew.de", "1and1.website", "site123.me",
]);

const PRIVATE_V4 = [
  /^10\./, /^127\./, /^169\.254\./, /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./, /^0\./, /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
];
const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

/** Registrierbare Domain (eTLD+1), lowercase, ohne www. Null wenn unbrauchbar. */
export function registrableDomain(hostname) {
  if (!hostname || typeof hostname !== "string") return null;
  let host = hostname.toLowerCase().replace(/\.$/, "").replace(/^www\./, "");
  if (!host.includes(".")) return null;
  const parts = host.split(".");
  const last2 = parts.slice(-2).join(".");
  const last3 = parts.slice(-3).join(".");
  // Plattform-Host (mandantenfähig): Suffix = last2, registrierbare Einheit = last3 (Mandant).
  if (parts.length >= 3 && PLATFORM_SUFFIXES.has(last2)) return last3;
  if (parts.length >= 3 && MULTI_TLDS.has(last2)) return last3;
  return last2;
}

function isPrivateOrLocalHost(host) {
  const h = host.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local")) return true;
  if (h === "::1" || h.startsWith("[")) return true; // IPv6-Literal generell ablehnen
  if (h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80")) return true;
  if (IPV4.test(h)) {
    if (PRIVATE_V4.some((re) => re.test(h))) return true;
    return true; // IP-Literale generell ablehnen (nur echte Hostnamen erlaubt)
  }
  return false;
}

/**
 * Darf diese URL überhaupt abgerufen werden? Nur http(s), echter Hostname,
 * keine privaten/lokalen/Metadaten-Ziele.
 * @returns {{ok: boolean, reason?: string}}
 */
export function isSafeFetchUrl(input) {
  let u;
  try {
    u = new URL(input);
  } catch {
    return { ok: false, reason: "invalid_url" };
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return { ok: false, reason: "non_http" };
  if (!u.hostname || isPrivateOrLocalHost(u.hostname)) return { ok: false, reason: "private_or_local" };
  return { ok: true };
}

/** Gehört `url` zur erlaubten registrierbaren Domain (same-site)? */
export function isSameSite(input, allowedRegistrableDomain) {
  if (!allowedRegistrableDomain) return false;
  let u;
  try {
    u = new URL(input);
  } catch {
    return false;
  }
  return registrableDomain(u.hostname) === allowedRegistrableDomain.toLowerCase();
}

/**
 * Prüft eine Fetch-Ziel-URL gegen die erlaubte Site-Grenze + SSRF-Regeln.
 * Für jede Redirect-Stufe erneut aufrufen.
 * @returns {{ok: boolean, reason?: string}}
 */
export function checkFetchTarget(input, allowedRegistrableDomain) {
  const safe = isSafeFetchUrl(input);
  if (!safe.ok) return safe;
  if (!isSameSite(input, allowedRegistrableDomain)) return { ok: false, reason: "off_site" };
  return { ok: true };
}

/**
 * Live-Fetch-Gate: identifizierender, projektbezogener Kontakt nötig.
 * Kontakt darf URL (http/https) ODER `mailto:`-Adresse sein (keine Domain nötig).
 * Blockt Platzhalter UND die EIGENE Marke (roadino = alt, onelane = neu): der
 * Bot-UA/Kontakt nach außen bleibt NEUTRAL und darf die Marke nicht enthalten.
 */
export function isUsableContact(ua, contactUrl) {
  if (!ua || typeof ua !== "string" || ua.trim().length < 5) return false;
  const bad = /(example\.(com|org|net)|localhost|127\.0\.0\.1|your-?domain|changeme|placeholder|roadino|onelane)/i;
  if (bad.test(ua) || (contactUrl && bad.test(contactUrl))) return false;
  if (!contactUrl) return false;
  const isUrl = /^https?:\/\/[^\s]+$/i.test(contactUrl);
  const isMail = /^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(contactUrl);
  if (!isUrl && !isMail) return false;
  return true;
}
