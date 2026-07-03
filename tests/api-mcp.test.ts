import { describe, expect, it, vi } from "vitest";

// mcp.ts ist seit Welle 2 ein Server-Modul (server-only + DAL für die
// DB-Tools plan_katalog/jobs_offen_anzahl) — Nachbarn mocken (Bestandsmuster).
vi.mock("server-only", () => ({}));
vi.mock("@/server/dal", () => ({ withAnonContext: vi.fn() }));

import { withAnonContext } from "@/server/dal";
import type { McpPort } from "@/server/adapters/mcp/port";
import { AllowlistMcpDispatcher, listeMcpTools, mcpDispatcher } from "@/modules/api/mcp";
import {
  MCP_PROTOKOLL_VERSION,
  mcpParseFehler,
  verarbeiteMcpNachricht,
} from "@/modules/api/mcp-protokoll";

/**
 * api-mcp.test.ts — MCP-Allowlist-Dispatcher + JSON-RPC-Schicht (Paket C,
 * Welle 2: DB-Tools plan_katalog + jobs_offen_anzahl).
 * ----------------------------------------------------------------------------
 * Deny-by-default (unbekannte Tools/Methoden), strict-Argumente, kein
 * Detail-Leak, Batch-Ablehnung (Protokollstand 2025-06-18) — plus der
 * VERTRAULICHKEITS-SWEEP: kein internes Vorhaben taucht in Tool-Namen,
 * Beschreibungen oder Ausgaben auf.
 */

const mockAnon = vi.mocked(withAnonContext);

/** Nächster withAnonContext-Aufruf liefert diese Zeilen (Reihenfolge zählt). */
function anonEinmal(rows: unknown[]): void {
  mockAnon.mockImplementationOnce((async (work: (tx: unknown) => Promise<unknown>) =>
    work({ execute: async () => rows })) as typeof withAnonContext);
}

const PLAN_ROWS = [
  {
    code: "start", name: "onelane start", preis_monat_netto_cent: 0,
    seat_preis_monat_netto_cent: null, aktion_preis_monat_netto_cent: null, aktion_monate: null,
  },
  {
    code: "os", name: "onelane os", preis_monat_netto_cent: 9900,
    seat_preis_monat_netto_cent: 2900, aktion_preis_monat_netto_cent: 4900, aktion_monate: 3,
  },
];

const ctx = { actorUserId: "33333333-3333-4333-8333-000000000001" };
const rpc = (method: string, params?: Record<string, unknown>, id: number | string | undefined = 1) => ({
  jsonrpc: "2.0",
  ...(id === undefined ? {} : { id }),
  method,
  ...(params ? { params } : {}),
});

describe("Allowlist-Dispatcher (McpPort-Vertrag)", () => {
  it("führt ping aus (ok + Serverzeit)", async () => {
    const r = await mcpDispatcher.callTool(ctx, { tool: "ping", arguments: {} });
    expect(r.ok).toBe(true);
    expect(r.output).toMatchObject({ ok: true });
  });

  it("führt portal_status aus (statische Betriebsinfo, read-only)", async () => {
    const r = await mcpDispatcher.callTool(ctx, { tool: "portal_status", arguments: {} });
    expect(r.ok).toBe(true);
    expect(r.output).toMatchObject({ dienst: "onelane api", version: "v1", schreibzugriff: false });
  });

  it("führt plan_katalog aus (0031-Definer via anon-DAL, PII-frei)", async () => {
    anonEinmal(PLAN_ROWS);
    const r = await mcpDispatcher.callTool(ctx, { tool: "plan_katalog", arguments: {} });
    expect(r.ok).toBe(true);
    expect(r.output).toMatchObject({
      waehrung: "EUR",
      plaene: [
        { code: "start", preis_monat_netto_cent: 0, aktion: null },
        { code: "os", preis_monat_netto_cent: 9900, aktion: { preis_monat_netto_cent: 4900, monate: 3 } },
      ],
    });
  });

  it("führt jobs_offen_anzahl aus (nur die Zahl, kein Inhalt)", async () => {
    anonEinmal([{ anzahl: 7 }]);
    const r = await mcpDispatcher.callTool(ctx, { tool: "jobs_offen_anzahl", arguments: {} });
    expect(r.ok).toBe(true);
    expect(r.output).toMatchObject({ anzahl: 7 });
    expect(Object.keys(r.output as Record<string, unknown>).sort()).toEqual(["anzahl", "stand"]);
  });

  it("DB-Fehler eines Tools → werkzeug_fehler (kein Detail-Leak)", async () => {
    mockAnon.mockImplementationOnce(async () => {
      throw new Error("connection refused 127.0.0.1:5432");
    });
    const r = await mcpDispatcher.callTool(ctx, { tool: "plan_katalog", arguments: {} });
    expect(r).toEqual({ ok: false, error: "werkzeug_fehler" });
  });

  it("lehnt unbekannte Tools ab (deny-by-default)", async () => {
    const r = await mcpDispatcher.callTool(ctx, { tool: "schule_uebersicht", arguments: {} });
    expect(r).toEqual({ ok: false, error: "unbekanntes_werkzeug" });
  });

  it("lehnt unerwartete Argumente ab (strict-Schema, untrusted args)", async () => {
    const r = await mcpDispatcher.callTool(ctx, { tool: "ping", arguments: { injektion: "x" } });
    expect(r).toEqual({ ok: false, error: "ungueltige_argumente" });
  });
});

describe("tools/list", () => {
  it("listet exakt die Allowlist mit strict-Schemata", () => {
    const tools = listeMcpTools();
    expect(tools.map((t) => t.name)).toEqual([
      "ping",
      "portal_status",
      "plan_katalog",
      "jobs_offen_anzahl",
    ]);
    for (const tool of tools) {
      expect(tool.inputSchema).toMatchObject({ type: "object", additionalProperties: false });
    }
  });
});

describe("JSON-RPC-Schicht (Streamable HTTP V1)", () => {
  it("initialize → Protokollstand + serverInfo", async () => {
    const { antwort, protokoll } = await verarbeiteMcpNachricht(rpc("initialize", { protocolVersion: "2025-03-26" }), mcpDispatcher, ctx);
    expect(protokoll).toEqual({ methode: "initialize", ok: true });
    expect(antwort).toMatchObject({
      jsonrpc: "2.0",
      id: 1,
      result: {
        protocolVersion: MCP_PROTOKOLL_VERSION,
        serverInfo: { name: "onelane" },
        capabilities: { tools: { listChanged: false } },
      },
    });
  });

  it("ping → leeres Resultat", async () => {
    const { antwort } = await verarbeiteMcpNachricht(rpc("ping"), mcpDispatcher, ctx);
    expect(antwort).toEqual({ jsonrpc: "2.0", id: 1, result: {} });
  });

  it("tools/call ping → content mit JSON-Text", async () => {
    const { antwort, protokoll } = await verarbeiteMcpNachricht(
      rpc("tools/call", { name: "ping" }),
      mcpDispatcher,
      ctx,
    );
    expect(protokoll).toEqual({ methode: "tools/call", tool: "ping", ok: true });
    const result = (antwort as { result: { content: Array<{ type: string; text: string }>; isError: boolean } }).result;
    expect(result.isError).toBe(false);
    expect(JSON.parse(result.content[0].text)).toMatchObject({ ok: true });
  });

  it("tools/call mit unbekanntem Tool → -32602 (Invalid params)", async () => {
    const { antwort } = await verarbeiteMcpNachricht(
      rpc("tools/call", { name: "gibt_es_nicht" }),
      mcpDispatcher,
      ctx,
    );
    expect(antwort).toMatchObject({ id: 1, error: { code: -32602 } });
  });

  it("tools/call mit ungültigen Argumenten → -32602", async () => {
    const { antwort } = await verarbeiteMcpNachricht(
      rpc("tools/call", { name: "ping", arguments: { x: 1 } }),
      mcpDispatcher,
      ctx,
    );
    expect(antwort).toMatchObject({ error: { code: -32602 } });
  });

  it("Ausführungsfehler → Tool-Resultat mit isError (kein Detail-Leak)", async () => {
    const kaputt: McpPort = {
      callTool: async () => ({ ok: false, error: "werkzeug_fehler" }),
    };
    const { antwort, protokoll } = await verarbeiteMcpNachricht(
      rpc("tools/call", { name: "ping" }),
      kaputt,
      ctx,
    );
    expect(protokoll.ok).toBe(false);
    const result = (antwort as { result: { isError: boolean; content: Array<{ text: string }> } }).result;
    expect(result.isError).toBe(true);
    expect(result.content[0].text).not.toContain("Error");
  });

  it("unbekannte Methode → -32601 (deny-by-default)", async () => {
    const { antwort } = await verarbeiteMcpNachricht(rpc("resources/list"), mcpDispatcher, ctx);
    expect(antwort).toMatchObject({ error: { code: -32601 } });
  });

  it("Batch-Arrays → -32600 (im Protokollstand 2025-06-18 entfernt)", async () => {
    const { antwort } = await verarbeiteMcpNachricht([rpc("ping")], mcpDispatcher, ctx);
    expect(antwort).toMatchObject({ id: null, error: { code: -32600 } });
  });

  it("kaputte Nachricht (ohne jsonrpc) → -32600", async () => {
    const { antwort } = await verarbeiteMcpNachricht({ method: "ping", id: 1 }, mcpDispatcher, ctx);
    expect(antwort).toMatchObject({ id: null, error: { code: -32600 } });
  });

  it("Notification (ohne id) → keine Antwort (HTTP 202 im Handler)", async () => {
    const { antwort, protokoll } = await verarbeiteMcpNachricht(
      { jsonrpc: "2.0", method: "notifications/initialized" },
      mcpDispatcher,
      ctx,
    );
    expect(antwort).toBeNull();
    expect(protokoll.ok).toBe(true);
  });

  it("mcpParseFehler → -32700 mit id null", () => {
    expect(mcpParseFehler()).toMatchObject({ id: null, error: { code: -32700 } });
  });
});

describe("Vertraulichkeits-Sweep (Plan-Entscheidung 8)", () => {
  it("keine internen Vorhaben in Tools, Beschreibungen oder Ausgaben", async () => {
    const dispatcher = new AllowlistMcpDispatcher();
    const ausgaben: unknown[] = [listeMcpTools()];
    anonEinmal(PLAN_ROWS); // plan_katalog
    anonEinmal([{ anzahl: 3 }]); // jobs_offen_anzahl
    for (const name of ["ping", "portal_status", "plan_katalog", "jobs_offen_anzahl"]) {
      ausgaben.push(await dispatcher.callTool(ctx, { tool: name, arguments: {} }));
    }
    const init = await verarbeiteMcpNachricht(rpc("initialize"), dispatcher, ctx);
    ausgaben.push(init.antwort);
    expect(JSON.stringify(ausgaben)).not.toMatch(/\bpay\b|buchung|booking/i);
  });
});
