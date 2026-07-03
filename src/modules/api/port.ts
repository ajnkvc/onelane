import { createHash } from "node:crypto";

/**
 * modules/api/port.ts — Verträge des API-/MCP-Zugangs (OS-P3, Paket C).
 * ============================================================================
 * EIN gemeinsames Zugangs-Fundament für REST (/api/v1) und MCP (/api/mcp):
 * api_keys (Migration 0029) autorisieren beides über Bearer-Token →
 * sha256-Hash → Schlüssel-Datensatz.
 *
 * WARUM EIN PORT (ehrlich dokumentiert):
 * Migration 0029 macht `api_keys.key_hash` für app_user UNSICHTBAR — die Spalte
 * hat bewusst KEINEN SELECT-Grant (Spalten-Minimierung; lesbar sind nur id,
 * partner_id, prefix, scopes, status, expires_at, rotated_at, last_used_at,
 * created_at). Ein `where key_hash = …`-Lookup ist damit über den RLS-Pfad
 * (withCurrentUserContext/withAnonContext) NICHT möglich. Deshalb ist die
 * KOMPLETTE Key-Auth-Schicht gegen dieses schmale Port-Interface gebaut:
 *
 *  - SEIT WELLE 2 (produktiver Pfad): DB-Adapter db-key.ts über die GUC-gated
 *    SECURITY-DEFINER-Funktion app.api_key_pruefen (Migration 0031 — Hash
 *    rein, Datensatz raus, NIE Hash raus) im geschlossenen Maschinen-Auth-
 *    Kontext (src/server/dal apiKeyAuthLookup) + gedrosselte last_used_at-
 *    Fortschreibung (app.api_key_beruehren). Die DB liefert NUR AKTIVE
 *    Schlüssel — rotiert/widerrufen ist von unbekannt nicht unterscheidbar
 *    (kein Orakel); Ablauf/Partner/Scope prüft weiterhin zentral auth.ts.
 *  - In-Memory-Adapter (unten): Test-Double der Unit-Tests — die zentrale
 *    Kette (auth.ts) durchläuft mit JEDEM Adapter dieselben fail-closed-
 *    Regeln (inkl. Status-Check für Adapter, die auch inaktive liefern).
 *  - Ausbaustufe: persistente Idempotenz für die ersten Write-Scopes
 *    (api_idempotency liegt bereit, deny-by-default) + verteiltes Rate-Limit.
 *
 * Der Klartext-Schlüssel und sein Hash tauchen in KEINEM Log/Audit auf —
 * identifiziert wird ausschließlich über `prefix` (Migration-0029-Doktrin).
 */

/** Scope-Allowlist — deckungsgleich mit dem DB-CHECK chk_api_keys_scopes_allowlist. */
export const API_SCOPES = ["rest_read", "mcp"] as const;
export type ApiScope = (typeof API_SCOPES)[number];

export type ApiKeyStatus = "aktiv" | "rotiert" | "widerrufen";
export type ApiPartnerStatus = "aktiv" | "pausiert" | "beendet";

/** Schlüssel-Datensatz, wie ihn ein Adapter liefert (NIE Hash/Klartext). */
export interface ApiKeyDatensatz {
  /** api_keys.id — dient u. a. als Rate-Limit-Schlüssel (nie der Hash). */
  id: string;
  /** Identifikations-Prefix (einzige log-/UI-taugliche Kennung des Schlüssels). */
  prefix: string;
  scopes: ApiScope[];
  status: ApiKeyStatus;
  /** Ablaufzeitpunkt oder null (kein Ablauf). */
  expiresAt: Date | null;
  partnerId: string;
  partnerName: string;
  partnerStatus: ApiPartnerStatus;
}

/**
 * KeyAuthPort — der EINZIGE Weg vom Token-Hash zum Schlüssel-Datensatz.
 * Adapter liefern den Datensatz UNGEPRÜFT (auch rotierte/widerrufene/abgelaufene
 * Schlüssel) — die Status-/Ablauf-/Partner-/Scope-Prüfungen liegen zentral in
 * auth.ts, damit JEDER Adapter (In-Memory, Dev, später DB) dieselben
 * fail-closed-Regeln durchläuft.
 */
export interface KeyAuthPort {
  /** Lookup über den sha256-Hex-Hash des Bearer-Tokens; null = unbekannt. */
  findeSchluessel(keyHash: string): Promise<ApiKeyDatensatz | null>;
}

/** sha256-Hex eines Tokens — dasselbe Format wie api_keys.key_hash (0029-CHECK). */
export function sha256Hex(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Eintrag für das In-Memory-Double: Klartext-Token ODER fertiger Hash. */
export interface InMemoryKeyEintrag {
  token?: string;
  keyHash?: string;
  datensatz: ApiKeyDatensatz;
}

/**
 * In-Memory-Adapter (Test-Double + Basis des Dev-Adapters): hält NUR Hashes,
 * nie Klartext-Tokens (der Token wird beim Anlegen sofort gehasht und
 * verworfen — identisches Sicherheitsmodell wie die spätere DB).
 */
export function erstelleInMemoryKeyAuthPort(eintraege: InMemoryKeyEintrag[]): KeyAuthPort {
  const nachHash = new Map<string, ApiKeyDatensatz>();
  for (const e of eintraege) {
    const hash = e.keyHash ?? (e.token !== undefined ? sha256Hex(e.token) : null);
    if (!hash) throw new Error("InMemoryKeyAuthPort: Eintrag braucht token oder keyHash.");
    nachHash.set(hash, e.datensatz);
  }
  return {
    async findeSchluessel(keyHash: string): Promise<ApiKeyDatensatz | null> {
      return nachHash.get(keyHash) ?? null;
    },
  };
}

/**
 * Fail-closed-Leer-Adapter (Test-Double): kennt KEINEN Schlüssel — jede
 * Key-Auth endet in 401. Der produktive Pfad ist seit Welle 2 der DB-Adapter
 * (db-key.ts); dieser Port bleibt als explizites Deny-Double erhalten.
 */
export const KEIN_KEY_AUTH_PORT: KeyAuthPort = {
  async findeSchluessel(): Promise<null> {
    return null;
  },
};
