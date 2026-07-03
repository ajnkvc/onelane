import { baueMeAntwort } from "@/modules/api/me";
import { apiJson, withApiKeyAuth } from "@/modules/api/route-wrapper";

/**
 * GET /api/v1/me — Selbstauskunft des API-Schlüssels (Paket C).
 * ----------------------------------------------------------------------------
 * Key-Pflicht (Authorization: Bearer <schlüssel>, Scope rest_read): liefert
 * Partner-Name/-Status, Prefix, Scopes und Ablauf des GEPRÜFTEN Schlüssels.
 * Auth/Rate-Limit/Audit kommen komplett aus dem Modul-Seam (withApiKeyAuth);
 * der Schlüssel-Lookup läuft seit Welle 2 gegen die DB (app.api_key_pruefen,
 * Migration 0031 — s. src/modules/api/db-key.ts).
 */
export const dynamic = "force-dynamic";

export const GET = withApiKeyAuth(
  async (_request, schluessel) => apiJson(baueMeAntwort(schluessel)),
  { scope: "rest_read", endpoint: "/api/v1/me" },
);
