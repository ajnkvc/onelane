import ipaddr from "ipaddr.js";

/**
 * ssrf-guard.ts — reine, testbare SSRF-Prüflogik (kein `server-only`, kein Netzwerk).
 * Die effektvolle Egress-Funktion `safeFetch` (DNS-Pinning, undici) liegt in `safe-fetch.ts`.
 */
export class SsrfBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SsrfBlockedError";
  }
}

/** Nur global routbares Unicast ist erlaubt — alles andere ist potentielles SSRF-Ziel. */
export function isPublicIp(ip: string): boolean {
  let addr: ipaddr.IPv4 | ipaddr.IPv6;
  try {
    addr = ipaddr.parse(ip);
  } catch {
    return false;
  }
  if (addr.kind() === "ipv6") {
    const v6 = addr as ipaddr.IPv6;
    if (v6.isIPv4MappedAddress()) addr = v6.toIPv4Address(); // ::ffff:127.0.0.1 → 127.0.0.1
  }
  return addr.range() === "unicast";
}

/** URL-Vorprüfung: https-only, keine Zugangsdaten, optionale Host-Allowlist, IP-Literale sofort prüfen. */
export function assertSafeUrl(rawUrl: string, allowlist?: readonly string[]): URL {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    // KEIN Rohwert im Fehlertext — die URL kann Query-Tokens/PII enthalten (landet sonst in Logs).
    throw new SsrfBlockedError("ungültige URL");
  }
  if (u.protocol !== "https:") throw new SsrfBlockedError(`nur https erlaubt (war: ${u.protocol})`);
  if (u.username || u.password) throw new SsrfBlockedError("URL mit Zugangsdaten (user:pass@) nicht erlaubt");
  // Nur Standard-Port (443/leer) — kein Zugriff auf interne Dienste über krumme Ports.
  if (u.port && u.port !== "443") throw new SsrfBlockedError(`nicht-Standard-Port nicht erlaubt: ${u.port}`);

  // IP-Literale als Ziel GENERELL verbieten (auch öffentliche): Aufrufer nutzen Hostnamen; das
  // verhindert Allowlist-/Hostnamen-Umgehung. Hostnamen werden beim connect (DNS) geprüft.
  const literal = u.hostname.replace(/^\[|\]$/g, ""); // IPv6 in URLs ist [..]-geklammert
  if (ipaddr.isValid(literal)) {
    throw new SsrfBlockedError(`IP-Literal als Ziel nicht erlaubt: ${literal}`);
  }

  // F-071 fail-closed: eine GESETZTE Allowlist wird immer erzwungen. Eine LEERE Allowlist
  // bedeutet „kein Host erlaubt" (nicht „alle erlaubt") — sonst wäre eine dynamisch leer
  // gelesene Provider-/Tenant-Allowlist ein stiller fail-open. `undefined` = keine Allowlist.
  if (allowlist !== undefined) {
    if (allowlist.length === 0) {
      throw new SsrfBlockedError("leere Allowlist — kein Host erlaubt (fail-closed)");
    }
    const host = u.hostname.toLowerCase();
    if (!allowlist.some((h) => host === h.toLowerCase())) {
      throw new SsrfBlockedError(`Host nicht auf Allowlist: ${u.hostname}`);
    }
  }
  return u;
}
