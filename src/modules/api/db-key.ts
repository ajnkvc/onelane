import "server-only";
import { z } from "zod";
import { apiKeyAuthLookup } from "@/server/dal";
import { scrubGeheimnisse } from "./audit";
import type { ApiKeyDatensatz, KeyAuthPort } from "./port";

/**
 * modules/api/db-key.ts — DB-Adapter des KeyAuthPort (OS Welle 2).
 * ============================================================================
 * Der EINZIGE produktive Lookup-Pfad: Bearer-Token → sha256 (auth.ts) →
 * apiKeyAuthLookup (src/server/dal, GESCHLOSSENER Maschinen-Auth-Kontext) →
 * GUC-gated SECURITY-DEFINER app.api_key_pruefen (Migration 0031).
 *
 * Eigenschaften (Vertrag port.ts, Welle-2-Fassung):
 *  - Die DB liefert NUR AKTIVE Schlüssel (rotiert/widerrufen = wie unbekannt,
 *    kein Schlüssel-Orakel); Ablauf-/Partner-/Scope-Prüfung bleibt zentral in
 *    auth.ts — deshalb kommen expires_at und der Partner-Status mit.
 *  - last_used_at wird im selben sanktionierten Kontext GEDROSSELT
 *    fortgeschrieben (max. 1 Write je 5 Minuten je Schlüssel — Drossel liegt
 *    in app.api_key_beruehren, nicht hier).
 *  - FAIL-CLOSED: jeder Fehler (DB nicht erreichbar, unerwartete Zeile) wird
 *    zu `null` → die Kette antwortet 401. Fehlermeldungen werden vor dem Log
 *    gescrubbt (nie Hash/Token; identifiziert wird nur über prefix).
 *
 * SICHERHEITS-RIEGEL (Abnahme 2026-07-03, GUC-Frage geklärt): Die GUC
 * `app.api_key_auth` ist NUR Misuse-Hygiene — `app_user` kann sie selbst setzen
 * (wie jede Custom-GUC; identische Eigenschaft wie Supabases request.jwt.claims).
 * Der ECHTE Riegel ist doppelt: (1) `api_keys.key_hash` ist für `app_user` NICHT
 * SELECT-gegrantet (verifiziert) → der Hash ist nicht auslesbar; (2)
 * `app.api_key_pruefen(p_key_hash)` liefert nur Zeilen für einen Hash, den der
 * Aufrufer BEREITS kennt — der Hash (SHA-256 eines ≥256-Bit-Zufallsschlüssels)
 * IST das Geheimnis. Ein SQL-fähiger Angreifer gewinnt dadurch nichts, was er
 * ohne gültigen Schlüssel nicht ohnehin hätte. Textbuch-Härtung „separate
 * NOLOGIN-Maschinen-Rolle mit eigener DSN" = dokumentierte Pre-Launch-Infra-
 * Aufgabe (docs/infra/peaknetworks-deploy-env.md), nicht V1-sicherheitskritisch.
 */

const zeileSchema = z.object({
  key_id: z.string().uuid(),
  prefix: z.string().min(1),
  scopes: z.array(z.enum(["rest_read", "mcp"])),
  status: z.enum(["aktiv", "rotiert", "widerrufen"]),
  expires_at: z.coerce.date().nullable(),
  partner_id: z.string().uuid(),
  partner_name: z.string().min(1),
  partner_status: z.enum(["aktiv", "pausiert", "beendet"]),
});

export const DB_KEY_AUTH_PORT: KeyAuthPort = {
  async findeSchluessel(keyHash: string): Promise<ApiKeyDatensatz | null> {
    try {
      const roh = await apiKeyAuthLookup(keyHash);
      if (!roh) return null;
      const zeile = zeileSchema.parse(roh);
      return {
        id: zeile.key_id,
        prefix: zeile.prefix,
        scopes: zeile.scopes,
        status: zeile.status,
        expiresAt: zeile.expires_at,
        partnerId: zeile.partner_id,
        partnerName: zeile.partner_name,
        partnerStatus: zeile.partner_status,
      };
    } catch (fehler) {
      // Fail-closed (→ 401). Kein Hash/Token im Log — nur die gescrubbte Klasse.
      const text = fehler instanceof Error ? fehler.message : "unbekannter Fehler";
      console.error(`[api-key-auth] Lookup fehlgeschlagen: ${scrubGeheimnisse(text).slice(0, 200)}`);
      return null;
    }
  },
};

/**
 * Standard-Port der Route-Wrapper: seit Welle 2 IMMER der DB-Adapter — der
 * Dev-Seed-Schlüssel (scripts/seed-demo.mjs) funktioniert damit end-to-end
 * über denselben Pfad wie ein Produktions-Schlüssel (Hash in der DB).
 */
export function resolveKeyAuthPort(): KeyAuthPort {
  return DB_KEY_AUTH_PORT;
}
