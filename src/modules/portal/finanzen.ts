import "server-only";

import { sql } from "drizzle-orm";
import { z } from "zod";
import { withCurrentUserContext } from "@/server/dal";

/**
 * modules/portal/finanzen.ts — Datenpfad des Finanz-Moduls V1 (Welle 2).
 * ============================================================================
 * REGELN (dashboard.ts-Linie, verbindlich):
 *  - JEDE Query läuft über withCurrentUserContext → RLS ist die Wahrheit.
 *    school_id ist nur FILTER (aktive Schule der geprüften PortalIdentity).
 *  - ZUGRIFF: invoices-Zeilen sieht per RLS ohnehin nur der Schul-Manager
 *    (inhaber/verwaltung, 0016) bzw. admin; die appointments-Finanzfelder
 *    (preis/abgerechnet) kommen AUSSCHLIESSLICH über den DEFINER
 *    app.termin_finanzen (Migration 0031, DB-hart an app.is_school_manager
 *    gebunden) — das Seiten-Gate istSchulManager ist Komfort, nicht die
 *    Verteidigungslinie. Fahrlehrer/Studenten erhalten konstruktionsbedingt
 *    0 Zeilen.
 *  - FAIL-SOFT: Fehler → null („gerade nicht verfügbar"-Karte).
 *  - BETRÄGE: numeric kommt als String aus Postgres → hier in CENT (integer)
 *    normalisiert; Formatierung (€) macht die Präsentation.
 *  - EHRLICHKEIT: invoices trägt (noch) KEIN Fälligkeitsdatum — die Liste
 *    zeigt „offen seit" (erstellt_am). Ein echtes faellig_am kommt mit dem
 *    Zahlungsmodul (eigene Migration).
 */

async function failSoft<T>(name: string, work: () => Promise<T>): Promise<T | null> {
  try {
    return await work();
  } catch (fehler) {
    console.error(
      `[portal-finanzen] ${name} fehlgeschlagen:`,
      fehler instanceof Error ? fehler.message : "unbekannter Fehler",
    );
    return null;
  }
}

type Rows = Array<Record<string, unknown>>;

const countSchema = z.coerce.number().int().min(0);
function leseZahl(rows: Rows, feld: string): number {
  return countSchema.parse(rows[0]?.[feld] ?? 0);
}

/** Cent (integer) → "1.234,56 €" — deterministisch, ohne Intl-Überraschungen. */
export function centAlsEuro(cent: number): string {
  const negativ = cent < 0;
  const abs = Math.abs(Math.round(cent));
  const euro = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${negativ ? "−" : ""}${euro},${String(abs % 100).padStart(2, "0")} €`;
}

export const RECHNUNG_STATUS_LABEL: Record<string, string> = {
  draft: "Entwurf",
  open: "offen",
  paid: "bezahlt",
  failed: "fehlgeschlagen",
  void: "storniert",
};

// ----------------------------------------------------------------------------
// Offene Posten (invoices, RLS: Manager) — Betrag/Status/offen seit + Kurzref.
// ----------------------------------------------------------------------------

const offenerPostenSchema = z.object({
  id: z.string().uuid(),
  enrollment_id: z.string().uuid(),
  betrag_cent: z.coerce.number().int().nullable(),
  status: z.enum(["draft", "open", "failed"]),
  klasse: z.string().nullable(),
  schueler_name: z.string().nullable(),
  offen_seit_tagen: z.coerce.number().int().min(0),
  erstellt_am: z.string(),
});
export type OffenerPosten = z.infer<typeof offenerPostenSchema> & { enrollmentKurz: string };

export interface OffenePostenListe {
  anzahl: number;
  summeCent: number;
  posten: OffenerPosten[];
}

/** Nicht bezahlte Rechnungen (open/draft/failed), neueste zuerst. */
export async function getOffenePostenListe(
  schoolId: string,
  options: { limit?: number } = {},
): Promise<OffenePostenListe | null> {
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 50);
  return failSoft("offene-posten-liste", async () =>
    withCurrentUserContext(async (tx) => {
      const kopf = (await tx.execute(sql`
        select count(*)::int as anzahl,
               coalesce(sum(round(i.betrag * 100)), 0)::bigint as summe_cent
          from public.invoices i
          join public.enrollments e on e.id = i.enrollment_id
         where e.school_id = ${schoolId}
           and i.status in ('draft', 'open', 'failed')
      `)) as unknown as Rows;

      const zeilen = (await tx.execute(sql`
        select i.id, i.enrollment_id,
               round(i.betrag * 100)::bigint as betrag_cent,
               i.status,
               e.fuehrerscheinklasse as klasse,
               nullif(trim(coalesce(n.vorname, '') || ' ' || coalesce(n.nachname, '')), '') as schueler_name,
               floor(extract(epoch from now() - i.erstellt_am) / 86400)::int as offen_seit_tagen,
               to_char(i.erstellt_am at time zone 'Europe/Berlin', 'DD.MM.YYYY') as erstellt_am
          from public.invoices i
          join public.enrollments e on e.id = i.enrollment_id
          left join app.schueler_namen(${schoolId}) n
            on n.student_user_id = e.student_user_id
         where e.school_id = ${schoolId}
           and i.status in ('draft', 'open', 'failed')
         order by i.erstellt_am desc
         limit ${limit}
      `)) as unknown as Rows;

      return {
        anzahl: leseZahl(kopf, "anzahl"),
        summeCent: countSchema.parse(kopf[0]?.summe_cent ?? 0),
        posten: zeilen.map((roh) => {
          const zeile = offenerPostenSchema.parse(roh);
          return { ...zeile, enrollmentKurz: zeile.enrollment_id.slice(0, 8).toUpperCase() };
        }),
      };
    }),
  );
}

// ----------------------------------------------------------------------------
// Monats-Summen — NUR bezahlte Rechnungen (bezahlt_am, Berlin-Monate).
// ----------------------------------------------------------------------------

const monatsSummeSchema = z.object({
  monat: z.string(),
  summe_cent: z.coerce.number().int().min(0),
  anzahl: z.coerce.number().int().min(0),
});
export type MonatsSumme = z.infer<typeof monatsSummeSchema>;

/** Summen je Monat (neueste zuerst, max. `monate` Monate mit Umsatz). */
export async function getMonatsSummen(
  schoolId: string,
  options: { monate?: number } = {},
): Promise<MonatsSumme[] | null> {
  const monate = Math.min(Math.max(options.monate ?? 6, 1), 24);
  return failSoft("monats-summen", async () =>
    withCurrentUserContext(async (tx) => {
      const zeilen = (await tx.execute(sql`
        select to_char(date_trunc('month', i.bezahlt_am at time zone 'Europe/Berlin'), 'MM.YYYY') as monat,
               sum(round(i.betrag * 100))::bigint as summe_cent,
               count(*)::int as anzahl
          from public.invoices i
          join public.enrollments e on e.id = i.enrollment_id
         where e.school_id = ${schoolId}
           and i.status = 'paid'
           and i.bezahlt_am is not null
         group by date_trunc('month', i.bezahlt_am at time zone 'Europe/Berlin')
         order by date_trunc('month', i.bezahlt_am at time zone 'Europe/Berlin') desc
         limit ${monate}
      `)) as unknown as Rows;
      return zeilen.map((r) => monatsSummeSchema.parse(r));
    }),
  );
}

// ----------------------------------------------------------------------------
// Termin-Abrechnungsliste — Finanzfelder NUR über app.termin_finanzen (0031).
// ----------------------------------------------------------------------------

const abrechnungZeileSchema = z.object({
  id: z.string().uuid(),
  typ: z.enum(["fahrstunde", "theorie", "fragenkatalog", "pruefung"]),
  tag: z.string(),
  von: z.string().nullable(),
  fahrlehrer_name: z.string().nullable(),
  klasse: z.string().nullable(),
  schueler_name: z.string().nullable(),
  preis_cent: z.coerce.number().int().nullable(),
  abgerechnet: z.boolean(),
});
export type AbrechnungZeile = z.infer<typeof abrechnungZeileSchema>;

export interface TerminAbrechnung {
  anzahlOffen: number;
  summeOffenCent: number;
  zeilen: AbrechnungZeile[];
}

/**
 * Abgeschlossene Termine mit Preis, unabgerechnete zuerst (dann neueste).
 * preis/abgerechnet kommen aus dem Manager-Definer; die übrigen Felder aus dem
 * normalen RLS-SELECT (Spalten-Grants 0029 bleiben unangetastet).
 */
export async function getTerminAbrechnung(
  schoolId: string,
  options: { limit?: number } = {},
): Promise<TerminAbrechnung | null> {
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 50);
  return failSoft("termin-abrechnung", async () =>
    withCurrentUserContext(async (tx) => {
      const kopf = (await tx.execute(sql`
        select count(*)::int as anzahl_offen,
               coalesce(sum(round(f.preis * 100)) filter (where f.abgerechnet = false), 0)::bigint as summe_offen_cent
          from app.termin_finanzen(${schoolId}) f
          join public.appointments a on a.id = f.appointment_id
         where a.status = 'completed' and f.preis is not null and f.abgerechnet = false
      `)) as unknown as Rows;

      const zeilen = (await tx.execute(sql`
        select a.id, a.typ,
               to_char(a.start at time zone 'Europe/Berlin', 'DD.MM.YYYY') as tag,
               to_char(a.start at time zone 'Europe/Berlin', 'HH24:MI') as von,
               i.name as fahrlehrer_name,
               e.fuehrerscheinklasse as klasse,
               nullif(trim(coalesce(n.vorname, '') || ' ' || coalesce(n.nachname, '')), '') as schueler_name,
               round(f.preis * 100)::bigint as preis_cent,
               f.abgerechnet
          from app.termin_finanzen(${schoolId}) f
          join public.appointments a on a.id = f.appointment_id
          join public.enrollments e on e.id = a.enrollment_id
          left join public.instructors i on i.id = a.instructor_id
          left join app.schueler_namen(${schoolId}) n
            on n.student_user_id = e.student_user_id
         where a.status = 'completed' and f.preis is not null
         order by f.abgerechnet asc, a.start desc
         limit ${limit}
      `)) as unknown as Rows;

      return {
        anzahlOffen: leseZahl(kopf, "anzahl_offen"),
        summeOffenCent: countSchema.parse(kopf[0]?.summe_offen_cent ?? 0),
        zeilen: zeilen.map((r) => abrechnungZeileSchema.parse(r)),
      };
    }),
  );
}
