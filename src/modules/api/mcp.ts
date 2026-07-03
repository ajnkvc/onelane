import "server-only";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { withAnonContext } from "@/server/dal";
import type { McpCallContext, McpPort, McpToolCall, McpToolResult } from "@/server/adapters/mcp/port";

/**
 * modules/api/mcp.ts — READ-ONLY-Tool-Allowlist + Dispatcher (Paket C, Welle 2).
 * ============================================================================
 * Implementiert den BESTEHENDEN McpPort-Vertrag (src/server/adapters/mcp/port.ts):
 * deny-by-default-Allowlist, untrusted arguments (Zod-strict), untrusted output,
 * DB-Zugriff NUR über die DAL (RLS bzw. geprüfte Definer-Lesepfade).
 *
 * WELLE-2-TOOLS (alle read-only, alle PII-frei):
 *  - `ping` / `portal_status`: statisch, ohne DB.
 *  - `plan_katalog`: aktive saas-Pläne über den Definer app.plan_katalog
 *    (Migration 0031) — veröffentlichte Preisinformation, anon-Pfad.
 *  - `jobs_offen_anzahl`: zählt öffentlich sichtbare Stellenanzeigen über den
 *    anonymen RLS-Pfad (school_jobs_public_select: aktiv + gelistete Schule +
 *    Gültigkeitsfenster) — nur die Zahl, keine Inhalte.
 *
 * BEWUSST OHNE Schul-Bindung: schulgebundene Tools (schule_uebersicht,
 * termine_heute, anfragen_status, schueler_fortschritt_aggregat …) brauchen
 * ein Vertragsmodell Key→Schule (Scope je Schule, Einwilligung der Schule) —
 * das ist die dokumentierte Ausbaustufe; ohne Vertrag KEINE Schuldaten an
 * Partner-Schlüssel, auch nicht aggregiert.
 *
 * Jede Tool-Ausgabe ist minimal; DB-Fehler verlassen den Dispatcher nie roh
 * (interner Fehler-Token, kein Detail-Leak). Auditiert + gemessen wird im
 * Route-Handler (audit.ts, mcp_tool_aufruf inkl. dauer_ms).
 */

/** Interne Fehler-Tokens des Dispatchers (Protokoll-Schicht mappt auf JSON-RPC). */
export const MCP_FEHLER = {
  unbekanntesWerkzeug: "unbekanntes_werkzeug",
  ungueltigeArgumente: "ungueltige_argumente",
  werkzeugFehler: "werkzeug_fehler",
} as const;

interface McpToolDefinition {
  name: string;
  beschreibung: string;
  /** Zod-Schema der Argumente (strict — unbekannte Felder = Ablehnung). */
  argumente: z.ZodType<Record<string, never>>;
  /** JSON-Schema fürs tools/list (statisch, deckungsgleich mit `argumente`). */
  inputSchema: Record<string, unknown>;
  handler: () => unknown | Promise<unknown>;
}

/** V1: alle Tools nehmen KEINE Argumente (strict leeres Objekt). */
const KEINE_ARGUMENTE = z.object({}).strict();
const LEERES_INPUT_SCHEMA = {
  type: "object",
  properties: {},
  additionalProperties: false,
} as const;

// --- DB-Lesepfade (fail-closed: Fehler wirft → Dispatcher mappt auf Token) ---

const planZeileSchema = z.object({
  code: z.string(),
  name: z.string(),
  preis_monat_netto_cent: z.coerce.number().int().min(0).nullable(),
  seat_preis_monat_netto_cent: z.coerce.number().int().min(0).nullable(),
  aktion_preis_monat_netto_cent: z.coerce.number().int().min(0).nullable(),
  aktion_monate: z.coerce.number().int().min(1).nullable(),
});

/** Aktive saas-Pläne über den 0031-Definer (PII-frei, veröffentlichte Preise). */
async function ladePlanKatalog(): Promise<unknown> {
  const rows = await withAnonContext(
    async (tx) =>
      (await tx.execute(sql`
        select code, name, preis_monat_netto_cent, seat_preis_monat_netto_cent,
               aktion_preis_monat_netto_cent, aktion_monate
          from app.plan_katalog()
      `)) as unknown as Array<Record<string, unknown>>,
  );
  return {
    waehrung: "EUR",
    hinweis: "Preise netto je Monat in Cent; Grundgebühr je Fahrschule.",
    plaene: rows.map((roh) => {
      const zeile = planZeileSchema.parse(roh);
      return {
        code: zeile.code,
        name: zeile.name,
        preis_monat_netto_cent: zeile.preis_monat_netto_cent,
        seat_preis_monat_netto_cent: zeile.seat_preis_monat_netto_cent,
        aktion:
          zeile.aktion_preis_monat_netto_cent !== null && zeile.aktion_monate !== null
            ? {
                preis_monat_netto_cent: zeile.aktion_preis_monat_netto_cent,
                monate: zeile.aktion_monate,
              }
            : null,
      };
    }),
  };
}

/** Anzahl öffentlich sichtbarer Stellenanzeigen (anon-RLS zählt nur Public-Zeilen). */
async function ladeJobsOffenAnzahl(): Promise<unknown> {
  const rows = await withAnonContext(
    async (tx) =>
      (await tx.execute(sql`
        select count(*)::int as anzahl
          from public.school_jobs
         where aktiv = true
           and (gueltig_bis is null or gueltig_bis >= current_date)
      `)) as unknown as Array<Record<string, unknown>>,
  );
  return {
    anzahl: z.coerce.number().int().min(0).parse(rows[0]?.anzahl ?? 0),
    stand: new Date().toISOString(),
  };
}

/** ALLOWLIST (deny-by-default): nur diese Tools sind aufrufbar. */
const MCP_TOOLS: readonly McpToolDefinition[] = [
  {
    name: "ping",
    beschreibung: "Verbindungstest — antwortet mit ok und der Serverzeit (UTC, ISO 8601).",
    argumente: KEINE_ARGUMENTE,
    inputSchema: LEERES_INPUT_SCHEMA,
    handler: () => ({ ok: true, zeit: new Date().toISOString() }),
  },
  {
    name: "portal_status",
    beschreibung:
      "Statische Betriebsinfo des onelane-Partnerzugangs: Dienst, Version, verfügbare Werkzeuge (read-only).",
    argumente: KEINE_ARGUMENTE,
    inputSchema: LEERES_INPUT_SCHEMA,
    handler: () => ({
      dienst: "onelane api",
      version: "v1",
      betrieb: "aktiv",
      werkzeuge: MCP_TOOLS.map((t) => t.name),
      schreibzugriff: false,
      hinweis:
        "Schulbezogene Werkzeuge folgen mit der Schul-Bindung deines Schlüssels (Ausbaustufe).",
    }),
  },
  {
    name: "plan_katalog",
    beschreibung:
      "Aktuelle onelane-Tarife (aktive Pläne, Preise netto je Monat in Cent) — veröffentlichte Preisinformation.",
    argumente: KEINE_ARGUMENTE,
    inputSchema: LEERES_INPUT_SCHEMA,
    handler: ladePlanKatalog,
  },
  {
    name: "jobs_offen_anzahl",
    beschreibung:
      "Anzahl der aktuell öffentlich sichtbaren Stellenanzeigen auf der onelane-Jobbörse (nur die Zahl).",
    argumente: KEINE_ARGUMENTE,
    inputSchema: LEERES_INPUT_SCHEMA,
    handler: ladeJobsOffenAnzahl,
  },
] as const;

/** Metadaten fürs tools/list (MCP-Format: name, description, inputSchema). */
export function listeMcpTools(): Array<{
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}> {
  return MCP_TOOLS.map((tool) => ({
    name: tool.name,
    description: tool.beschreibung,
    inputSchema: tool.inputSchema,
  }));
}

/**
 * Allowlist-Dispatcher — implementiert den McpPort-Vertrag. `ctx` trägt die
 * Schlüssel-ID als Akteur (Maschinen-Identität; ctx.schoolId bleibt ungenutzt,
 * bis das Vertragsmodell Key→Schule existiert — s. Kopf).
 */
export class AllowlistMcpDispatcher implements McpPort {
  async callTool(ctx: McpCallContext, call: McpToolCall): Promise<McpToolResult> {
    void ctx; // Schul-Scope = Ausbaustufe (Vertragsmodell), s. Modulkopf.
    const tool = MCP_TOOLS.find((t) => t.name === call.tool);
    if (!tool) return { ok: false, error: MCP_FEHLER.unbekanntesWerkzeug };

    const argumente = tool.argumente.safeParse(call.arguments ?? {});
    if (!argumente.success) return { ok: false, error: MCP_FEHLER.ungueltigeArgumente };

    try {
      return { ok: true, output: await tool.handler() };
    } catch {
      // Kein Detail-Leak über die API-Grenze (Output gilt ohnehin als untrusted).
      return { ok: false, error: MCP_FEHLER.werkzeugFehler };
    }
  }
}

export const mcpDispatcher: McpPort = new AllowlistMcpDispatcher();
