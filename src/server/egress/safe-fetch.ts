import "server-only";
import { lookup as dnsLookupCb, type LookupAddress } from "node:dns";
import { Agent, fetch as undiciFetch, type RequestInit as UndiciRequestInit } from "undici";
import { SsrfBlockedError, assertSafeUrl, isPublicIp } from "./ssrf-guard";

/**
 * safe-fetch.ts — SSRF-gehärteter Egress (Phase-0 #8).
 * ----------------------------------------------------------------------------
 * JEDER server-seitige Outbound-Call mit (teilweise) fremd-/nutzerbeeinflusster
 * Ziel-URL MUSS hierüber laufen (ESLint verbietet rohen `fetch` in src/server/*).
 * Schutzschichten (Prüflogik in ./ssrf-guard.ts):
 *  - **https-only**, keine `user:pass@`-Zugangsdaten, optionale Host-**Allowlist**.
 *  - **DNS auflösen + JEDE IP klassifizieren** → nur global routbares Unicast erlaubt;
 *    loopback/privat/link-local (inkl. 169.254.169.254-Metadata)/unique-local/reserved
 *    /6to4/teredo werden geblockt; IPv4-mapped IPv6 wird auf v4 zurückgeführt.
 *  - **IP-Pinning gegen DNS-Rebinding:** der undici-`connect` nutzt denselben validierten
 *    Lookup für die TCP-Verbindung (keine zweite, ungeprüfte Auflösung); TLS-SNI bleibt am Host.
 *  - **Redirects manuell** + je Hop erneut geprüft (Schema/Credentials/Allowlist + IP via connect).
 *  - Timeout; keine automatische Credential-Weitergabe.
 *
 * Grenze: kein Schutz gegen einen kompromittierten DNS-Resolver; eine Host-Allowlist
 * (wo möglich) ist die stärkste Maßnahme.
 */
export { SsrfBlockedError, assertSafeUrl, isPublicIp } from "./ssrf-guard";

const DEFAULT_TIMEOUT_MS = 8000;
const HARD_MAX_TIMEOUT_MS = 30_000; // Obergrenze gegen (user-/tenant-)konfigurierten Socket-/Body-DoS
const MAX_REDIRECTS = 3;

/** Validierender DNS-Lookup für den undici-connect: blockt, wenn IRGENDEINE aufgelöste IP nicht öffentlich ist. */
function safeLookup(
  hostname: string,
  options: { all?: boolean } | undefined,
  callback: (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void,
): void {
  dnsLookupCb(hostname, { all: true, verbatim: true }, (err, addresses) => {
    if (err) return callback(err, "");
    if (!addresses || addresses.length === 0) {
      return callback(new SsrfBlockedError(`keine DNS-Antwort für ${hostname}`), "");
    }
    const blocked = addresses.find((a) => !isPublicIp(a.address));
    if (blocked) {
      return callback(new SsrfBlockedError(`blockierte Ziel-IP ${blocked.address} (${hostname})`), "");
    }
    return options?.all
      ? callback(null, addresses)
      : callback(null, addresses[0].address, addresses[0].family);
  });
}

const safeAgent = new Agent({
  connect: { lookup: safeLookup, timeout: DEFAULT_TIMEOUT_MS },
  headersTimeout: DEFAULT_TIMEOUT_MS,
  bodyTimeout: DEFAULT_TIMEOUT_MS,
  connections: 64, // Verbindungen je Origin begrenzen
  maxOrigins: 256, // Origin-Pool begrenzen (Memory-Wachstum bei user-kontrollierten Hostnamen)
  keepAliveTimeout: 10_000,
});
// Redirects behandeln WIR via `redirect: "manual"` im fetch (jede Hop-URL neu prüfen).

const DEFAULT_MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const HARD_MAX_BYTES = 50 * 1024 * 1024; // 50 MiB (binär) harte Obergrenze (gegen Infinity/NaN-Umgehung)

export interface SafeFetchOptions {
  /** Wenn gesetzt: nur diese Hosts sind erlaubt (stärkste Maßnahme). */
  allowlist?: readonly string[];
  timeoutMs?: number;
  /** Maximale Antwortgröße in Bytes (Schutz gegen Memory-DoS). Default 10 MB. */
  maxBytes?: number;
}

/**
 * F-072: Bei Cross-Origin-Redirect Header aus einer ENGEN ALLOWLIST NEU aufbauen (statt per
 * Denylist zu strippen) + Body verwerfen. So überleben unbekannte Secret-/Tenant-Header
 * (api-key, x-tenant-id, x-webhook-secret, künftige interne Header) einen Cross-Origin-Hop NIE.
 */
export function stripToSafeRedirect(init: UndiciRequestInit): UndiciRequestInit {
  const src = new Headers((init.headers as HeadersInit | undefined) ?? undefined);
  const allowed = new Headers();
  for (const name of ["accept", "accept-language", "user-agent"]) {
    const v = src.get(name);
    if (v !== null) allowed.set(name, v);
  }
  return { ...init, headers: allowed as unknown as UndiciRequestInit["headers"], body: undefined };
}

/** Body-/Content-Header entfernen (bei Methoden-Downgrade GET, wenn kein Body mehr gesendet wird). */
function dropBodyHeaders(init: UndiciRequestInit): UndiciRequestInit {
  const headers = new Headers((init.headers as HeadersInit | undefined) ?? undefined);
  for (const h of ["content-length", "content-type", "content-encoding"]) headers.delete(h);
  return { ...init, headers: headers as unknown as UndiciRequestInit["headers"], body: undefined };
}

/** Antwort auf maxBytes begrenzen: Content-Length vorab + harte Stream-Grenze; bricht Upstream sauber ab. */
export async function capResponse(
  res: Awaited<ReturnType<typeof undiciFetch>>,
  maxBytes: number,
): Promise<Response> {
  const body = res.body as ReadableStream<Uint8Array> | null;
  const cl = res.headers.get("content-length");
  if (cl !== null && Number(cl) > maxBytes) {
    await body?.cancel().catch(() => {}); // Upstream-Socket sauber schließen (awaited, kein unhandled reject)
    throw new SsrfBlockedError(`Antwort zu groß: Content-Length ${cl} > ${maxBytes}`);
  }
  if (!body) return res as unknown as Response;
  const reader = body.getReader();
  let seen = 0;
  const capped = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }
      seen += value.byteLength;
      if (seen > maxBytes) {
        const err = new SsrfBlockedError(`Antwort überschreitet ${maxBytes} Bytes`);
        await reader.cancel(err).catch(() => {}); // Upstream abbrechen (kein Socket-Leak)
        controller.error(err);
        return;
      }
      controller.enqueue(value);
    },
    async cancel(reason) {
      await reader.cancel(reason).catch(() => {}); // Consumer-Abbruch an Upstream weiterreichen
    },
  });
  return new Response(capped, {
    status: res.status,
    statusText: res.statusText,
    headers: res.headers as unknown as HeadersInit,
  });
}

/** SSRF-gehärteter fetch. Wirft `SsrfBlockedError`, wenn das Ziel (oder ein Redirect) unsicher ist. */
export async function safeFetch(
  rawUrl: string,
  init: UndiciRequestInit = {},
  opts: SafeFetchOptions = {},
): Promise<Response> {
  const timeout = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  // timeoutMs streng validieren (wie maxBytes): sonst kann ein extrem großer Wert die
  // Timeout-Schutzannahme in einen langen Socket-/Body-DoS verwandeln.
  if (!Number.isSafeInteger(timeout) || timeout <= 0 || timeout > HARD_MAX_TIMEOUT_MS) {
    throw new SsrfBlockedError(`ungültiges timeoutMs ${timeout} (erlaubt 1..${HARD_MAX_TIMEOUT_MS})`);
  }
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0 || maxBytes > HARD_MAX_BYTES) {
    throw new SsrfBlockedError(`ungültiges maxBytes ${maxBytes} (erlaubt 1..${HARD_MAX_BYTES})`);
  }
  const startOrigin = assertSafeUrl(rawUrl, opts.allowlist).origin;
  let current = rawUrl;
  let currentInit = init;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    assertSafeUrl(current, opts.allowlist); // https/Port/IP-Literal/Allowlist je Hop (IP via connect)
    // Timeout IMMER erzwingen — ein caller-`signal` ergänzt ihn, hebelt ihn aber nicht aus.
    const timeoutSignal = AbortSignal.timeout(timeout);
    const signal = currentInit.signal
      ? AbortSignal.any([currentInit.signal as AbortSignal, timeoutSignal])
      : timeoutSignal;
    const res = await undiciFetch(current, {
      ...currentInit,
      redirect: "manual",
      dispatcher: safeAgent,
      signal,
    });

    const isRedirect = res.status >= 300 && res.status < 400 && res.headers.has("location");
    if (!isRedirect) return await capResponse(res, maxBytes);

    // Redirect: Body verwerfen + Upstream schließen (kein Memory-Auflauf durch riesige Redirect-Bodies).
    await (res.body as ReadableStream<Uint8Array> | null)?.cancel().catch(() => {});
    if (hop === MAX_REDIRECTS) throw new SsrfBlockedError("zu viele Redirects");
    const next = new URL(res.headers.get("location")!, current);

    // Methodensemantik exakt wie die WHATWG-Fetch-Spec (HTTP-redirect fetch):
    //  - 303 → GET (kein Body) für JEDE Nicht-GET/HEAD-Methode;
    //  - 301/302 → GET NUR für POST; alle anderen Methoden (PUT/DELETE/PATCH) bleiben erhalten;
    //  - 307/308 → Methode + Body unverändert.
    const method = (currentInit.method ?? "GET").toUpperCase();
    const downgradeToGet =
      (res.status === 303 && method !== "GET" && method !== "HEAD") ||
      ((res.status === 301 || res.status === 302) && method === "POST");
    if (downgradeToGet) {
      currentInit = dropBodyHeaders({ ...currentInit, method: "GET" });
    }
    // Cross-Origin: Header aus enger Allowlist neu aufbauen + Body verwerfen (kein Credential-/Header-Leak).
    if (next.origin !== startOrigin) currentInit = stripToSafeRedirect(currentInit);
    current = next.toString();
  }
  throw new SsrfBlockedError("Redirect-Limit überschritten");
}
