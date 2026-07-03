import { LOG_AUDIT_PORT } from "@/modules/api/audit";
import { mcpDispatcher } from "@/modules/api/mcp";
import {
  mcpParseFehler,
  verarbeiteMcpNachricht,
} from "@/modules/api/mcp-protokoll";
import { apiJson, withApiKeyAuth } from "@/modules/api/route-wrapper";

/**
 * /api/mcp — Streamable-HTTP-MCP-Endpunkt V1 (Paket C).
 * ----------------------------------------------------------------------------
 * Key-Auth (Scope `mcp`, seit Welle 2 gegen die DB — Migration 0031) über den
 * Modul-Seam; JSON-RPC-2.0-Einzelnachrichten per POST, Antwort immer
 * application/json (SSE-Streams/GET = bewusst nicht in V1 → 405). Tools:
 * READ-ONLY-Allowlist (ping, portal_status, plan_katalog, jobs_offen_anzahl)
 * gegen den McpPort-Vertrag — schulgebundene Tools bleiben Ausbaustufe, bis
 * das Vertragsmodell Key→Schule existiert (s. src/modules/api/mcp.ts). Jeder
 * Tool-Call wird redigiert auditiert + gemessen (mcp_tool_aufruf, dauer_ms —
 * ai_usage-Muster, Tabelle folgt; s. src/modules/api/audit.ts).
 */
export const dynamic = "force-dynamic";

export const POST = withApiKeyAuth(
  async (request, schluessel) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiJson(mcpParseFehler(), { status: 400 });
    }

    const start = Date.now();
    const { antwort, protokoll } = await verarbeiteMcpNachricht(body, mcpDispatcher, {
      // V1: Maschinen-Akteur = Schlüssel-ID (Schul-Scope kommt mit Welle 2).
      actorUserId: schluessel.id,
    });

    if (protokoll.tool) {
      LOG_AUDIT_PORT.schreibe({
        ereignis: "mcp_tool_aufruf",
        endpoint: "/api/mcp",
        ausgang: protokoll.ok ? "ok" : "abgelehnt",
        tool: protokoll.tool,
        schluesselPrefix: schluessel.prefix,
        partnerName: schluessel.partnerName,
        dauerMs: Date.now() - start,
      });
    }

    // Notification (keine id): bestätigen ohne Body (Streamable-HTTP-Muster).
    if (antwort === null) {
      return new Response(null, { status: 202, headers: { "cache-control": "no-store" } });
    }
    return apiJson(antwort);
  },
  { scope: "mcp", endpoint: "/api/mcp" },
);

/** GET (SSE-Server-Stream) ist in V1 bewusst nicht implementiert. */
export function GET(): Response {
  return Response.json(
    { error: "method_not_allowed" },
    { status: 405, headers: { allow: "POST", "cache-control": "no-store" } },
  );
}
