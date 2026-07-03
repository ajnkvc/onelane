import "server-only";
import { getAppOrigins, getSiteUrl, isProduction } from "@/lib/public-config";

/**
 * origin-guard.ts — Same-Origin-/CSRF-Schutz für ZUSTANDSÄNDERNDE Requests.
 * ============================================================================
 * OWASP-empfohlene erste Verteidigungslinie: bei jeder mutierenden Route/Server
 * Action den `Origin`- (bevorzugt) bzw. `Referer`-Header gegen eine KANONISCHE
 * Origin-Allowlist prüfen (F-057) — inkl. Scheme/Port, NICHT gegen den manipulierbaren
 * `Host`-Header. Die Allowlist ist die kanonische Seiten-Origin (getSiteUrl());
 * in Dev zusätzlich localhost (beliebiger Port/Scheme), damit lokale Dev-Server passen.
 *
 * VERBINDLICH für alle mutierenden Write-Endpunkte (POST/PUT/PATCH/DELETE, mutierende
 * Server Actions) — zentral erzwungen über withMutationGuards (mutation-guard.ts).
 *
 * GET/HEAD/OPTIONS sind ausgenommen (dürfen keinen Zustand ändern).
 */

export class CsrfOriginError extends Error {
  readonly status = 403;
  readonly code = "csrf_origin";
  constructor(message = "Cross-Origin-Request abgelehnt (Origin/Referer nicht in der Allowlist)") {
    super(message);
    this.name = "CsrfOriginError";
  }
}

/** Origin (scheme://host[:port]) aus Origin (bevorzugt) oder Referer; null, wenn unbrauchbar. */
function requestOrigin(request: Request): string | null {
  const raw = request.headers.get("origin") ?? request.headers.get("referer");
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

/**
 * Reine, testbare Kernprüfung: ist `origin` in der Allowlist? Vergleicht die volle Origin
 * (Scheme+Host+Port). Mit `allowLocalhost` werden zusätzlich localhost/127.0.0.1/::1
 * (beliebiger Port/Scheme) akzeptiert (nur Dev). Deny-by-default (null → false).
 */
export function isOriginAllowed(
  origin: string | null,
  allowedOrigins: string[],
  opts: { allowLocalhost: boolean },
): boolean {
  if (!origin) return false;
  if (allowedOrigins.includes(origin)) return true;
  if (opts.allowLocalhost) {
    try {
      const host = new URL(origin).hostname.toLowerCase().replace(/^\[|\]$/g, "");
      if (host === "localhost" || host === "127.0.0.1" || host === "::1") return true;
    } catch {
      return false;
    }
  }
  return false;
}

/** Kanonische Origin-Allowlist: Seiten-Origin + App-Portal-Origin (APP_HOST, OS-P1). */
function allowedOrigins(): string[] {
  try {
    return [getSiteUrl(), ...getAppOrigins()];
  } catch {
    return []; // fail-closed: ohne kanonische Origin ist nichts same-origin
  }
}

/** true, wenn der Request nachweislich von einer erlaubten Origin stammt. */
export function isSameOrigin(request: Request): boolean {
  return isOriginAllowed(requestOrigin(request), allowedOrigins(), {
    allowLocalhost: !isProduction(),
  });
}

/**
 * Wirft `CsrfOriginError` (403), wenn ein mutierender Request NICHT von einer erlaubten
 * Origin stammt. Für GET/HEAD/OPTIONS ein No-op. Bei allen mutierenden Methoden VOR jeder
 * Verarbeitung aufrufen (deny-by-default: fehlender/fremder Origin/Referer wird abgelehnt).
 */
export function assertSameOrigin(request: Request): void {
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return;
  if (!isSameOrigin(request)) throw new CsrfOriginError();
}
