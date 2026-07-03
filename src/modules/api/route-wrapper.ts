import "server-only";
import { createInMemoryRateLimiter } from "@/server/adapters/ratelimit";
import { pruefeApiKey, wwwAuthenticateHeader } from "./auth";
import { LOG_AUDIT_PORT, type ApiAuditPort } from "./audit";
import { resolveKeyAuthPort } from "./db-key";
import type { ApiKeyDatensatz, ApiScope, KeyAuthPort } from "./port";

/**
 * modules/api/route-wrapper.ts — Guard-Kette der Key-Auth-Endpunkte (Paket C).
 * ============================================================================
 * Modul-Schicht-Naht: Route Handler (src/app/api/**) dürfen `@/server` nicht
 * direkt importieren (ESLint-Schichtgrenze, Review-Auflage 10) — /api/v1/* und
 * /api/mcp beziehen ihre komplette Guard-Kette über DIESEN Wrapper:
 *
 *   IP-Rate-Limit → Key-Auth (auth.ts-Kette) → Key-Rate-Limit → Handler
 *   (+ redigiertes Audit für jeden Ausgang, s. audit.ts)
 *
 * BEWUSST OHNE withMutationGuards/Same-Origin: die Endpunkte authentifizieren
 * ausschließlich über Bearer-Header (keine Cookies) — es gibt keine CSRF-
 * Fläche, und Partner-Clients rufen legitim cross-origin auf. Fehler werden
 * zentral gemappt (kein 500-Detail-Leak), jede Antwort ist no-store.
 *
 * RATE-LIMIT-AUFLAGE (Review-Auflage 9, dokumentierter ÜBERGANG): In-Memory
 * (pro Prozess/Instanz) — VOR Launch/Skalierung MUSS die erste Linie an den
 * Edge (Cloudflare-Rate-Limit/WAF) und der Limiter auf einen verteilten
 * Adapter hinter RateLimiterPort wechseln. Persistente Idempotenz für
 * schreibende Endpunkte liegt bereit (api_idempotency, deny-by-default) und
 * wird mit den ersten Write-Scopes (Welle 2) angebunden.
 */

/** IP-Limit (alle Anfragen, auch ohne/mit falschem Key): 120/min je IP. */
const ipLimiter = createInMemoryRateLimiter({ windowMs: 60_000, max: 120 });
/** Key-Limit (nach erfolgreicher Auth): 60/min je Schlüssel (Fair-Use V1). */
const keyLimiter = createInMemoryRateLimiter({ windowMs: 60_000, max: 60 });

const NO_STORE = { "cache-control": "no-store" } as const;

function fehlerAntwort(status: number, code: string, headers: Record<string, string> = {}): Response {
  return Response.json({ error: code }, { status, headers: { ...NO_STORE, ...headers } });
}

/** Client-IP wie im Bestands-Muster (/api/ereignis): nur fürs transiente Limit. */
function clientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "local"
  );
}

export type ApiKeyRouteHandler = (
  request: Request,
  schluessel: ApiKeyDatensatz,
) => Promise<Response> | Response;

export interface ApiKeyRouteOptions {
  /** Pflicht-Scope des Endpunkts (deny-by-default). */
  scope: ApiScope;
  /** Statischer Endpunkt-Pfad fürs Audit, z. B. "/api/v1/me". */
  endpoint: string;
  /** Nur für Tests: Port-/Audit-Injektion statt der Standard-Auflösung. */
  port?: KeyAuthPort;
  audit?: ApiAuditPort;
}

/**
 * Wrapper für Key-Auth-Route-Handler. Der Handler erhält den GEPRÜFTEN
 * Schlüssel-Datensatz als zweites Argument (Scope bereits erzwungen).
 */
export function withApiKeyAuth(
  handler: ApiKeyRouteHandler,
  options: ApiKeyRouteOptions,
): (request: Request) => Promise<Response> {
  const audit = options.audit ?? LOG_AUDIT_PORT;
  return async (request: Request): Promise<Response> => {
    const ipCheck = ipLimiter.check(`${options.endpoint}:${clientIp(request)}`);
    if (!ipCheck.allowed) {
      audit.schreibe({
        ereignis: "api_rate_limit",
        endpoint: options.endpoint,
        ausgang: "abgelehnt",
        grund: "rate_limit_ip",
      });
      return fehlerAntwort(429, "rate_limited", {
        "retry-after": String(Math.ceil(ipCheck.resetMs / 1000)),
      });
    }

    const port = options.port ?? resolveKeyAuthPort();
    const ergebnis = await pruefeApiKey(port, request.headers.get("authorization"), {
      scope: options.scope,
    });
    if (!ergebnis.ok) {
      audit.schreibe({
        ereignis: "api_auth_fehlgeschlagen",
        endpoint: options.endpoint,
        ausgang: "abgelehnt",
        grund: ergebnis.grund,
        // Nur wenn der Schlüssel BEKANNT ist, gibt es eine log-taugliche
        // Kennung (prefix) — für unbekannte Tokens wird NICHTS geloggt.
        schluesselPrefix: ergebnis.schluessel?.prefix,
        partnerName: ergebnis.schluessel?.partnerName,
      });
      return fehlerAntwort(ergebnis.status, ergebnis.code, {
        "www-authenticate": wwwAuthenticateHeader(ergebnis, options.scope),
      });
    }

    const keyCheck = keyLimiter.check(ergebnis.schluessel.id);
    if (!keyCheck.allowed) {
      audit.schreibe({
        ereignis: "api_rate_limit",
        endpoint: options.endpoint,
        ausgang: "abgelehnt",
        grund: "rate_limit_key",
        schluesselPrefix: ergebnis.schluessel.prefix,
        partnerName: ergebnis.schluessel.partnerName,
      });
      return fehlerAntwort(429, "rate_limited", {
        "retry-after": String(Math.ceil(keyCheck.resetMs / 1000)),
      });
    }

    try {
      const antwort = await handler(request, ergebnis.schluessel);
      audit.schreibe({
        ereignis: "api_zugriff",
        endpoint: options.endpoint,
        ausgang: "ok",
        schluesselPrefix: ergebnis.schluessel.prefix,
        partnerName: ergebnis.schluessel.partnerName,
      });
      return antwort;
    } catch (fehler) {
      // Kein Detail-Leak: nur Fehlerklasse ins Log, generische Antwort.
      const klasse = fehler instanceof Error ? fehler.name : "Error";
      audit.schreibe({
        ereignis: "api_zugriff",
        endpoint: options.endpoint,
        ausgang: "fehler",
        grund: klasse.toLowerCase().slice(0, 64),
        schluesselPrefix: ergebnis.schluessel.prefix,
      });
      return fehlerAntwort(500, "internal_error");
    }
  };
}

/** No-Store-JSON-Antwort (gemeinsames Muster der /api/v1-Endpunkte). */
export function apiJson(daten: unknown, init: { status?: number } = {}): Response {
  return Response.json(daten, { status: init.status ?? 200, headers: { ...NO_STORE } });
}
