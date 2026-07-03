import {
  sha256Hex,
  type ApiKeyDatensatz,
  type ApiScope,
  type KeyAuthPort,
} from "./port";

/**
 * modules/api/auth.ts — Key-Auth-Kern des API-/MCP-Zugangs (OS-P3, Paket C).
 * ============================================================================
 * Bearer-Token → sha256 → Port-Lookup → zentrale fail-closed-Prüfkette:
 *
 *   1. Authorization-Header vorhanden + Bearer-Schema        → sonst 401
 *   2. Token-Format (Länge/Alphabet, kein Junk an den Hash)  → sonst 401
 *   3. Port-Lookup über den Hash (KeyAuthPort, s. port.ts)   → sonst 401
 *   4. Schlüssel-Status 'aktiv' (rotiert/widerrufen = aus)   → sonst 401
 *   5. Nicht abgelaufen (expires_at)                          → sonst 401
 *   6. Partner-Status 'aktiv' (pausiert/beendet = gesperrt)  → sonst 403
 *   7. Geforderter Scope im Schlüssel (rest_read | mcp)      → sonst 403
 *
 * Die Kette ist PURE (Port + Zeitpunkt injizierbar) und damit vollständig
 * gegen das In-Memory-Double testbar — unabhängig davon, welcher Adapter in
 * welcher Welle dahinter liegt. 401-Antworten unterscheiden nach außen NICHT
 * zwischen unbekannt/rotiert/abgelaufen (kein Schlüssel-Orakel); der genaue
 * Grund landet nur im redigierten Audit.
 *
 * WWW-Authenticate folgt RFC 6750 (Bearer; error="invalid_token" bzw.
 * error="insufficient_scope").
 */

/** Interner Ablehnungs-Grund (nur fürs redigierte Audit — nie in der Antwort). */
export type ApiAuthGrund =
  | "header_fehlt"
  | "token_format"
  | "unbekannt"
  | "schluessel_status"
  | "abgelaufen"
  | "partner_status"
  | "scope_fehlt";

/** Nach außen sichtbarer Fehler-Code (Antwort-Body { error: code }). */
export type ApiAuthCode = "authentication_required" | "partner_inactive" | "insufficient_scope";

export type ApiAuthErgebnis =
  | { ok: true; schluessel: ApiKeyDatensatz }
  | { ok: false; status: 401 | 403; code: ApiAuthCode; grund: ApiAuthGrund; schluessel?: ApiKeyDatensatz };

/**
 * Token-Alphabet/-Länge: hochentropische Keys im olk_-Format (Prefix +
 * Zufallsteil). Alles außerhalb wird VOR dem Hashen abgewiesen (kein
 * Hash-Futter aus beliebigen Headern).
 */
const TOKEN_RE = /^[A-Za-z0-9._-]{20,200}$/;

/** Extrahiert das Bearer-Token aus einem Authorization-Header (oder null). */
export function leseBearerToken(authorization: string | null): string | null {
  if (!authorization) return null;
  const treffer = /^Bearer\s+(\S+)$/i.exec(authorization.trim());
  return treffer?.[1] ?? null;
}

const abgelehnt = (
  status: 401 | 403,
  code: ApiAuthCode,
  grund: ApiAuthGrund,
  schluessel?: ApiKeyDatensatz,
): ApiAuthErgebnis => ({ ok: false, status, code, grund, schluessel });

/**
 * Führt die komplette Prüfkette aus (pure — Port und `jetzt` injizierbar).
 * `scope` ist PFLICHT: es gibt keinen Endpoint ohne expliziten Scope-Anspruch
 * (deny-by-default; /api/v1/me → rest_read, /api/mcp → mcp).
 */
export async function pruefeApiKey(
  port: KeyAuthPort,
  authorization: string | null,
  options: { scope: ApiScope; jetzt?: Date },
): Promise<ApiAuthErgebnis> {
  const token = leseBearerToken(authorization);
  if (!token) return abgelehnt(401, "authentication_required", "header_fehlt");
  if (!TOKEN_RE.test(token)) return abgelehnt(401, "authentication_required", "token_format");

  const schluessel = await port.findeSchluessel(sha256Hex(token));
  if (!schluessel) return abgelehnt(401, "authentication_required", "unbekannt");

  if (schluessel.status !== "aktiv") {
    return abgelehnt(401, "authentication_required", "schluessel_status", schluessel);
  }
  const jetzt = options.jetzt ?? new Date();
  if (schluessel.expiresAt !== null && schluessel.expiresAt.getTime() <= jetzt.getTime()) {
    return abgelehnt(401, "authentication_required", "abgelaufen", schluessel);
  }
  if (schluessel.partnerStatus !== "aktiv") {
    return abgelehnt(403, "partner_inactive", "partner_status", schluessel);
  }
  if (!schluessel.scopes.includes(options.scope)) {
    return abgelehnt(403, "insufficient_scope", "scope_fehlt", schluessel);
  }
  return { ok: true, schluessel };
}

/** RFC-6750-konformer WWW-Authenticate-Header für abgelehnte Anfragen. */
export function wwwAuthenticateHeader(ergebnis: Extract<ApiAuthErgebnis, { ok: false }>, scope: ApiScope): string {
  if (ergebnis.grund === "header_fehlt") return 'Bearer realm="onelane-api"';
  if (ergebnis.code === "insufficient_scope") {
    return `Bearer realm="onelane-api", error="insufficient_scope", scope="${scope}"`;
  }
  return 'Bearer realm="onelane-api", error="invalid_token"';
}
