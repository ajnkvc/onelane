/**
 * ssrf-check.mjs — SSRF-Vorprüfung für Tooling (.mjs), das externe URLs besucht
 * (z. B. Playwright-Screenshots, robots.txt). Spiegelt die Kernlogik von
 * src/server/egress/ssrf-guard.ts (isPublicIp): nur global routbares Unicast ist erlaubt.
 * (Node-.mjs kann das TS-Modul nicht importieren → bewusste kleine Duplizierung.)
 *
 * Grenze: keine Absicherung gegen DNS-Rebinding pro Subrequest/Redirect-Hop im Browser bzw.
 * gegen die erneute DNS-Auflösung durch fetch/Playwright; die Vorprüfung senkt aber das SSRF-
 * Risiko (kein Navigations-Ziel im internen Netz).
 *
 * BEWUSSTE Tooling-Lockerung ggü. dem App-Guard (src/server/egress/ssrf-guard.ts): hier sind
 * `http:` UND öffentliche IP-Literale erlaubt — das Tooling besucht reale Schul-Websites (oft
 * noch http) und nutzt keine Host-Allowlist. Der App-Egress bleibt strikt https-only + verbietet
 * IP-Literale (Allowlist-Umgehungsschutz). Nur global routbares Unicast ist in BEIDEN Fällen erlaubt.
 */
import dns from "node:dns/promises";
import ipaddr from "ipaddr.js";

/** Nur global routbares Unicast ist erlaubt (blockt loopback/privat/link-local/metadata/reserved). */
export function isPublicIp(ip) {
  let addr;
  try {
    addr = ipaddr.parse(ip);
  } catch {
    return false;
  }
  if (addr.kind() === "ipv6" && addr.isIPv4MappedAddress()) addr = addr.toIPv4Address();
  return addr.range() === "unicast";
}

/**
 * Wirft, wenn `rawUrl` kein http(s) ist oder der Host auf eine NICHT-öffentliche IP auflöst.
 * Gibt bei Erfolg die geparste URL zurück.
 */
export async function assertPublicUrl(rawUrl) {
  let u;
  try {
    u = new URL(rawUrl);
  } catch {
    throw new Error("SSRF-Check: ungültige URL");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error(`SSRF-Check: nur http(s) erlaubt (war: ${u.protocol})`);
  }
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (ipaddr.isValid(host)) {
    if (!isPublicIp(host)) throw new Error(`SSRF-Check: nicht-öffentliche Ziel-IP: ${host}`);
    return u;
  }
  const addrs = await dns.lookup(host, { all: true, verbatim: true });
  if (!addrs || addrs.length === 0) throw new Error(`SSRF-Check: keine DNS-Antwort für ${host}`);
  const bad = addrs.find((a) => !isPublicIp(a.address));
  if (bad) throw new Error(`SSRF-Check: blockierte Ziel-IP ${bad.address} (${host})`);
  return u;
}
