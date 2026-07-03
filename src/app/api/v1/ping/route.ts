import { apiJson } from "@/modules/api/route-wrapper";

/**
 * GET /api/v1/ping — öffentlicher, versionierter Verbindungstest (Paket C).
 * ----------------------------------------------------------------------------
 * OHNE Auth (bewusst: Partner prüfen Erreichbarkeit vor der Schlüssel-
 * Einrichtung), OHNE Daten: statische Dienst-Info + Serverzeit. Antwort ist
 * no-store (apiJson) und dynamisch (Zeitstempel). Die Guard-Kette der
 * authentifizierten Endpunkte (/api/v1/me, /api/mcp) liegt im Modul-Seam
 * src/modules/api (Route-Handler importieren NIE direkt @/server —
 * ESLint-Schichtgrenze, Review-Auflage 10).
 */
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return apiJson({
    ok: true,
    dienst: "onelane api",
    version: "v1",
    zeit: new Date().toISOString(),
  });
}
