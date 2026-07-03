/**
 * modules/api/audit.ts — redigiertes Audit des API-/MCP-Zugangs (OS-P3, Paket C).
 * ============================================================================
 * PFLICHT: Jeder API-/MCP-Zugriff wird auditiert und gemessen — aber IMMER
 * redigiert: identifiziert wird ein Schlüssel AUSSCHLIESSLICH über `prefix`;
 * Klartext-Token und key_hash tauchen NIE in Ereignissen auf (Defense-in-Depth:
 * zusätzlich Wert-Scrubbing unten).
 *
 * LOG-ADAPTER (ehrlich dokumentiert): Ereignisse gehen als strukturierte,
 * PII-freie Server-Logs raus (Log-Adapter unten). Der security_events-Adapter
 * bleibt auch nach Welle 2 bewusst offen: die 0000-RLS-Policy
 * `security_events_insert` (`actor_user_id = app.current_user_id()`) verlangt
 * einen NUTZER-Kontext — API-Key-Aufrufe haben keinen (Maschine, kein Login).
 * Welle 2 hat den key_hash-Lookup als GUC-gated DEFINER geliefert (0031);
 * ein Maschinen-Schreibpfad für security_events (actor NULL, gleiches
 * GUC-Muster) ist die dokumentierte Ausbaustufe — bis dahin ist das Log der
 * Audit-Kanal. Das ai_usage-Metering-Muster (McpPort-Vertrag) hat noch keine
 * Tabelle — bis dahin zählt mcp_tool_aufruf (tool + dauer_ms) als Messpunkt.
 *
 * Ereignis-Typen folgen bereits der security_events-Token-Konvention
 * (^[a-z][a-z0-9_]{1,63}$), damit der Welle-2-Adapter sie 1:1 übernimmt.
 */

export type ApiAuditEreignisTyp =
  | "api_zugriff"
  | "api_auth_fehlgeschlagen"
  | "api_rate_limit"
  | "mcp_tool_aufruf";

export interface ApiAuditEreignis {
  ereignis: ApiAuditEreignisTyp;
  /** Pfad des Endpunkts, z. B. "/api/v1/me" (statisch, nie Nutzereingabe). */
  endpoint: string;
  ausgang: "ok" | "abgelehnt" | "fehler";
  /** interner Ablehnungs-Grund (Token-Konvention, kein Freitext). */
  grund?: string;
  /** EINZIGE Schlüssel-Kennung im Audit — nie Token, nie Hash. */
  schluesselPrefix?: string;
  partnerName?: string;
  /** MCP: aufgerufenes Tool (Allowlist-Name). */
  tool?: string;
  /** Messung (Metering-Grundlage bis ai_usage existiert). */
  dauerMs?: number;
}

export interface ApiAuditPort {
  schreibe(ereignis: ApiAuditEreignis): void;
}

/** 64-Hex (sha256/key_hash), Bearer-Token und JWT-artige Werte — nie ausgeben. */
const GEHEIMNIS_WERT_RE =
  /[0-9a-f]{64}|Bearer\s+[A-Za-z0-9._-]{8,}|eyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}/gi;

/** Scrubbt Secret-Muster aus einem String-Wert (Defense-in-Depth). */
export function scrubGeheimnisse(wert: string): string {
  return wert.replace(GEHEIMNIS_WERT_RE, "[redigiert]");
}

/**
 * Redigiert ein Ereignis feld-weise (typisierte Allowlist — es gibt keine
 * freien Metadaten) und scrubbt zusätzlich jeden String-Wert gegen bekannte
 * Secret-Muster. Ein versehentlich durchgereichter Hash/Token wird so selbst
 * dann unkenntlich, wenn ein Aufrufer ihn in `grund`/`tool` einschleusen würde.
 */
export function redigiereEreignis(ereignis: ApiAuditEreignis): ApiAuditEreignis {
  const kopie: ApiAuditEreignis = { ...ereignis };
  for (const feld of ["endpoint", "grund", "schluesselPrefix", "partnerName", "tool"] as const) {
    const wert = kopie[feld];
    if (typeof wert === "string") kopie[feld] = scrubGeheimnisse(wert).slice(0, 200);
  }
  return kopie;
}

/**
 * Welle-1-Adapter: strukturierte Single-Line-Logs (PII-frei, redigiert).
 * `console.info` ist hier bewusst der bestehenden Logging-Konvention der
 * Module (z. B. portal-dashboard) gleichgestellt — kein eigener Logger in V1.
 */
export const LOG_AUDIT_PORT: ApiAuditPort = {
  schreibe(ereignis: ApiAuditEreignis): void {
    console.info(`[api-audit] ${JSON.stringify(redigiereEreignis(ereignis))}`);
  },
};

/** Test-Double: sammelt Ereignisse (bereits redigiert) in einem Array. */
export function erstelleSammelAuditPort(): ApiAuditPort & { ereignisse: ApiAuditEreignis[] } {
  const ereignisse: ApiAuditEreignis[] = [];
  return {
    ereignisse,
    schreibe(ereignis: ApiAuditEreignis): void {
      ereignisse.push(redigiereEreignis(ereignis));
    },
  };
}
