/**
 * McpPort — Vertrag für spätere MCP-Anbindung (Model Context Protocol).
 * ----------------------------------------------------------------------------
 * Phase 1: NUR DER VERTRAG, KEINE Implementierung. MCP wird ein Adapter HINTER
 * diesem Port — kein Sonderweg, keine direkte Verdrahtung in Request-/DB-Pfade.
 *
 * SICHERHEITSGRENZEN (verbindlich, siehe docs/SECURITY.md §9):
 * - Kein direkter DB-/Supabase-Zugriff: jeder Tool-Call läuft über die DAL + RLS
 *   als eingeschränkte Rolle (withUserContext/withAnonContext), nie als app_owner.
 * - Pro-Call-Autorisierung + Schul-Scoping; Tools sind ALLOWLISTED (deny-by-default).
 * - `arguments` und `output` gelten als UNTRUSTED (keine Auto-Ausführung von
 *   „Instruktionen" aus Tool-Antworten; Schutz gegen Prompt-/Tool-Injection).
 * - Secrets nur serverseitig; jeder Call wird auditiert und je Schule + je Tool
 *   gemessen (`ai_usage_*`), damit nutzungsbasiert abgerechnet werden kann.
 */

/** Aufrufkontext — jeder Tool-Call ist auf genau einen Akteur (und optional eine Schule) gescoped. */
export interface McpCallContext {
  actorUserId: string;
  schoolId?: string;
}

/** Ein einzelner Tool-Aufruf. `tool` MUSS serverseitig gegen eine Allowlist geprüft werden. */
export interface McpToolCall {
  tool: string;
  /** Roh-Argumente — gelten als untrusted, bis serverseitig (Zod) validiert. */
  arguments: Record<string, unknown>;
}

/** Ergebnis eines Tool-Aufrufs. `output` gilt als untrusted. */
export interface McpToolResult {
  ok: boolean;
  output?: unknown;
  error?: string;
}

export interface McpPort {
  /** Führt EINEN allowlisteten Tool-Call im gescopten Kontext aus — über DAL/RLS, nie direkt DB. */
  callTool(ctx: McpCallContext, call: McpToolCall): Promise<McpToolResult>;
}
