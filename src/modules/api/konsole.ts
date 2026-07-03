import "server-only";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { withCurrentUserContext } from "@/server/dal";

/**
 * modules/api/konsole.ts — Datenpfad der Partner-Konsole (OS-P3, Paket C).
 * ============================================================================
 * EINZIGER Datenpfad der /app/partner-api-Seiten (Muster portal/dashboard.ts):
 *  - JEDE Query läuft über withCurrentUserContext → RLS ist die Wahrheit
 *    (0029: Partner-Mitglied liest NUR die Keys des eigenen Partners; admin
 *    liest alle; key_hash ist für app_user UNSICHTBAR — die Liste kann den
 *    Hash konstruktionsbedingt nie enthalten).
 *  - FAIL-SOFT: Fehler → null, die UI zeigt „gerade nicht verfügbar".
 *  - PAGINATION-FÄHIG: { limit } (Cap 50) + getrennter Gesamt-Zähler; das
 *    Cursor-Muster ({ limit, cursor }) wird ergänzt, sobald Listen >20 real
 *    werden (V1: wenige Keys je Partner).
 *  - V1 ist READ-ONLY: Erzeugen/Rotieren/Widerrufen bleibt admin-only über
 *    onelane (0029-Write-Policies) — die Konsole zeigt das ehrlich an.
 */

async function failSoft<T>(name: string, work: () => Promise<T>): Promise<T | null> {
  try {
    return await work();
  } catch (fehler) {
    console.error(
      `[partner-api] ${name} fehlgeschlagen:`,
      fehler instanceof Error ? fehler.message : "unbekannter Fehler",
    );
    return null;
  }
}

type Rows = Array<Record<string, unknown>>;

const schluesselZeileSchema = z.object({
  id: z.string().uuid(),
  prefix: z.string(),
  scopes: z.array(z.enum(["rest_read", "mcp"])),
  status: z.enum(["aktiv", "rotiert", "widerrufen"]),
  partner_name: z.string(),
  erstellt_am: z.string(),
  laeuft_ab_am: z.string().nullable(),
  zuletzt_verwendet_am: z.string().nullable(),
});
export type SchluesselZeile = z.infer<typeof schluesselZeileSchema>;

export interface SchluesselUebersicht {
  anzahlGesamt: number;
  anzahlAktiv: number;
  zeilen: SchluesselZeile[];
}

/**
 * Sichtbare Schlüssel des Aufrufers (RLS-gescoped): Partner-Mitglied sieht den
 * eigenen Partner, admin die Plattform-Sicht. Nur 0029-lesbare Spalten.
 */
export async function getSchluesselUebersicht(
  options: { limit?: number } = {},
): Promise<SchluesselUebersicht | null> {
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 50);
  return failSoft("schluessel-uebersicht", async () =>
    withCurrentUserContext(async (tx) => {
      const zaehler = (await tx.execute(sql`
        select count(*)::int as gesamt,
               count(*) filter (where status = 'aktiv')::int as aktiv
          from public.api_keys
      `)) as unknown as Rows;
      const zeilen = (await tx.execute(sql`
        select k.id, k.prefix, k.scopes, k.status,
               p.name as partner_name,
               to_char(k.created_at at time zone 'Europe/Berlin', 'DD.MM.YYYY') as erstellt_am,
               to_char(k.expires_at at time zone 'Europe/Berlin', 'DD.MM.YYYY') as laeuft_ab_am,
               to_char(k.last_used_at at time zone 'Europe/Berlin', 'DD.MM.YYYY HH24:MI') as zuletzt_verwendet_am
          from public.api_keys k
          join public.api_partners p on p.id = k.partner_id
         order by k.created_at desc
         limit ${limit}
      `)) as unknown as Rows;
      const gesamtRow = zaehler[0] ?? {};
      return {
        anzahlGesamt: z.coerce.number().int().min(0).parse(gesamtRow.gesamt ?? 0),
        anzahlAktiv: z.coerce.number().int().min(0).parse(gesamtRow.aktiv ?? 0),
        zeilen: zeilen.map((r) => schluesselZeileSchema.parse(r)),
      };
    }),
  );
}
