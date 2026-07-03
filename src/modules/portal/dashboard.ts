import "server-only";

import { sql } from "drizzle-orm";
import { z } from "zod";
import { withCurrentUserContext } from "@/server/dal";

/**
 * modules/portal/dashboard.ts — Datenquellen der rollenspezifischen Dashboards
 * (OS-P2). EINZIGER Datenpfad der Dashboard-Präsentation.
 * ============================================================================
 * REGELN (für P3-Agenten verbindlich):
 *  - JEDE Query läuft über withCurrentUserContext → RLS ist die Wahrheit.
 *    school_id-Parameter sind nur FILTER (die aktive Schule aus der validierten
 *    PortalIdentity), niemals Autorisierung: Wer eine fremde school_id
 *    übergibt, bekommt durch RLS schlicht 0 Zeilen.
 *  - FAIL-SOFT je Karte: Jede Funktion fängt ihre Fehler selbst und liefert
 *    dann `null` — EINE kaputte Query darf das Dashboard nie töten. Die UI
 *    rendert für `null` einen ehrlichen „gerade nicht verfügbar"-Zustand.
 *  - PAGINATION-FÄHIG: Listen nehmen `{ limit }` (Cap) und liefern Zähler
 *    getrennt von den Zeilen — P3 kann Cursor-Parameter additiv ergänzen.
 *  - ZEIT: Alle „heute/morgen"-Grenzen werden IN SQL in Europe/Berlin
 *    berechnet (Server-TZ-unabhängig); Anzeigezeiten kommen als fertige
 *    'HH:MM'-Strings (Berlin) zurück.
 *  - DATENSCHUTZ: Rückgaben sind zod-validiert und minimal. Schüler-NAMEN
 *    kommen seit Welle 2 AUSSCHLIESSLICH über den geprüften Definer-Pfad
 *    app.schueler_namen (Migration 0031: NUR vorname/nachname, NUR aktives
 *    Enrollment, NUR Schul-Mitglieder) — users bleibt für Schul-Personal
 *    unlesbar; ohne aktives Enrollment bleibt der Name null (ID-Fallback).
 *    Lead-/Bewerbungsdaten sieht nur, wen RLS lässt (Schul-Manager/admin).
 *    Die Insights-Schicht erhält aus diesen Ergebnissen AUSSCHLIESSLICH
 *    Zahlen (src/modules/insights).
 */

/** Kleines Fail-Soft-Gerüst: Fehler loggen (ohne Daten), Karte liefert null. */
async function failSoft<T>(name: string, work: () => Promise<T>): Promise<T | null> {
  try {
    return await work();
  } catch (fehler) {
    console.error(
      `[portal-dashboard] ${name} fehlgeschlagen:`,
      fehler instanceof Error ? fehler.message : "unbekannter Fehler",
    );
    return null;
  }
}

type Rows = Array<Record<string, unknown>>;

/** Anzahl-Zeile (count-Queries) defensiv lesen. */
const countSchema = z.coerce.number().int().min(0);
function leseZahl(rows: Rows, feld: string): number {
  return countSchema.parse(rows[0]?.[feld] ?? 0);
}

// ----------------------------------------------------------------------------
// Anfragen (leads) — Schul-Cockpit (RLS: Schul-Manager + admin)
// ----------------------------------------------------------------------------

const anfrageKompaktSchema = z.object({
  id: z.string().uuid(),
  vorname: z.string(),
  klasse: z.string(),
  status: z.enum(["neu", "gesehen", "erledigt"]),
  alter_stunden: z.coerce.number().int().min(0),
});
export type AnfrageKompakt = z.infer<typeof anfrageKompaktSchema>;

export interface AnfragenUebersicht {
  anzahlNeu: number;
  /** Risiko-Kennzahl: neue Anfragen, die älter als 48 h sind (unbeantwortet). */
  anzahlNeuAelter48h: number;
  letzte: AnfrageKompakt[];
}

export async function getAnfragenUebersicht(
  schoolId: string,
  options: { limit?: number } = {},
): Promise<AnfragenUebersicht | null> {
  const limit = Math.min(Math.max(options.limit ?? 3, 1), 20);
  return failSoft("anfragen-uebersicht", async () =>
    withCurrentUserContext(async (tx) => {
      const zaehler = (await tx.execute(sql`
        select
          count(*) filter (where status = 'neu')::int as neu,
          count(*) filter (where status = 'neu'
                             and created_at < now() - interval '48 hours')::int as neu_alt
          from public.leads
         where school_id = ${schoolId}
      `)) as unknown as Rows;
      const letzte = (await tx.execute(sql`
        select id, vorname, klasse, status,
               floor(extract(epoch from now() - created_at) / 3600)::int as alter_stunden
          from public.leads
         where school_id = ${schoolId}
         order by created_at desc
         limit ${limit}
      `)) as unknown as Rows;
      return {
        anzahlNeu: leseZahl(zaehler, "neu"),
        anzahlNeuAelter48h: leseZahl(zaehler, "neu_alt"),
        letzte: letzte.map((r) => anfrageKompaktSchema.parse(r)),
      };
    }),
  );
}

// ----------------------------------------------------------------------------
// Bewerbungen (job_applications) — Schul-Cockpit (RLS: Schul-Manager + admin)
// ----------------------------------------------------------------------------

const bewerbungKompaktSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  job_titel: z.string(),
  status: z.enum(["neu", "gesehen", "erledigt"]),
  alter_stunden: z.coerce.number().int().min(0),
});
export type BewerbungKompakt = z.infer<typeof bewerbungKompaktSchema>;

export interface BewerbungenUebersicht {
  anzahlNeu: number;
  letzte: BewerbungKompakt[];
}

export async function getBewerbungenUebersicht(
  schoolId: string,
  options: { limit?: number } = {},
): Promise<BewerbungenUebersicht | null> {
  const limit = Math.min(Math.max(options.limit ?? 3, 1), 20);
  return failSoft("bewerbungen-uebersicht", async () =>
    withCurrentUserContext(async (tx) => {
      const zaehler = (await tx.execute(sql`
        select count(*) filter (where b.status = 'neu')::int as neu
          from public.job_applications b
          join public.school_jobs j on j.id = b.job_id
         where j.school_id = ${schoolId}
      `)) as unknown as Rows;
      const letzte = (await tx.execute(sql`
        select b.id, b.name, j.titel as job_titel, b.status,
               floor(extract(epoch from now() - b.created_at) / 3600)::int as alter_stunden
          from public.job_applications b
          join public.school_jobs j on j.id = b.job_id
         where j.school_id = ${schoolId}
         order by b.created_at desc
         limit ${limit}
      `)) as unknown as Rows;
      return {
        anzahlNeu: leseZahl(zaehler, "neu"),
        letzte: letzte.map((r) => bewerbungKompaktSchema.parse(r)),
      };
    }),
  );
}

// ----------------------------------------------------------------------------
// Termine (appointments) — Schul-Cockpit + Fahrlehrer + Schüler
// Spalten-Grant beachtet: KEIN preis/abgerechnet (server-only seit 0029).
// ----------------------------------------------------------------------------

const terminKompaktSchema = z.object({
  id: z.string().uuid(),
  typ: z.enum(["fahrstunde", "theorie", "fragenkatalog", "pruefung"]),
  status: z.enum(["booked", "cancelled", "completed"]),
  von: z.string(),
  bis: z.string().nullable(),
  fahrlehrer_name: z.string().nullable(),
  klasse: z.string().nullable(),
  /** Schüler-Name via app.schueler_namen (0031) — null ohne aktives Enrollment. */
  schueler_name: z.string().nullable(),
});
export type TerminKompakt = z.infer<typeof terminKompaktSchema>;

export interface TermineHeute {
  anzahl: number;
  termine: TerminKompakt[];
}

/** Heutige Termine der Schule (Berlin-Tag), chronologisch. */
export async function getTermineHeute(
  schoolId: string,
  options: { limit?: number } = {},
): Promise<TermineHeute | null> {
  const limit = Math.min(Math.max(options.limit ?? 6, 1), 50);
  return failSoft("termine-heute", async () =>
    withCurrentUserContext(async (tx) => {
      const zaehler = (await tx.execute(sql`
        select count(*)::int as anzahl
          from public.appointments a
          join public.enrollments e on e.id = a.enrollment_id
         where e.school_id = ${schoolId}
           and a.status <> 'cancelled'
           and (a.start at time zone 'Europe/Berlin')::date
               = (now() at time zone 'Europe/Berlin')::date
      `)) as unknown as Rows;
      const termine = (await tx.execute(sql`
        select a.id, a.typ, a.status,
               to_char(a.start at time zone 'Europe/Berlin', 'HH24:MI') as von,
               to_char(a.ende at time zone 'Europe/Berlin', 'HH24:MI') as bis,
               i.name as fahrlehrer_name,
               e.fuehrerscheinklasse as klasse,
               nullif(trim(coalesce(n.vorname, '') || ' ' || coalesce(n.nachname, '')), '') as schueler_name
          from public.appointments a
          join public.enrollments e on e.id = a.enrollment_id
          left join public.instructors i on i.id = a.instructor_id
          left join app.schueler_namen(${schoolId}) n
            on n.student_user_id = e.student_user_id
         where e.school_id = ${schoolId}
           and a.status <> 'cancelled'
           and (a.start at time zone 'Europe/Berlin')::date
               = (now() at time zone 'Europe/Berlin')::date
         order by a.start asc
         limit ${limit}
      `)) as unknown as Rows;
      return {
        anzahl: leseZahl(zaehler, "anzahl"),
        termine: termine.map((r) => terminKompaktSchema.parse(r)),
      };
    }),
  );
}

// ----------------------------------------------------------------------------
// Offene Posten (invoices) — NUR Zähler (Beträge kommen erst mit dem
// P3-Finanzmodul). RLS: Student eigene / inhaber+verwaltung / admin —
// fahrlehrer erhält hier konstruktionsbedingt 0 (Karte wird gar nicht gerendert).
// ----------------------------------------------------------------------------

export interface OffenePosten {
  anzahlOffen: number;
}

export async function getOffenePosten(schoolId: string): Promise<OffenePosten | null> {
  return failSoft("offene-posten", async () =>
    withCurrentUserContext(async (tx) => {
      const rows = (await tx.execute(sql`
        select count(*)::int as anzahl
          from public.invoices i
          join public.enrollments e on e.id = i.enrollment_id
         where e.school_id = ${schoolId}
           and i.status = 'open'
      `)) as unknown as Rows;
      return { anzahlOffen: leseZahl(rows, "anzahl") };
    }),
  );
}

// ----------------------------------------------------------------------------
// Fahrlehrer-Verfügbarkeit heute (instructor_availability, Lesepfad 0030)
// ----------------------------------------------------------------------------

const slotFahrlehrerSchema = z.object({
  fahrlehrer_name: z.string(),
  von: z.string().nullable(),
  bis: z.string().nullable(),
});
export type SlotFahrlehrer = z.infer<typeof slotFahrlehrerSchema>;

export interface SlotsHeute {
  anzahlSlots: number;
  slots: SlotFahrlehrer[];
}

/**
 * Heutige, nicht blockierte Verfügbarkeits-Slots der Schule: konkreter
 * Datums-Eintrag ODER Wochentags-Muster (Konvention 0=Montag, Migration 0001).
 */
export async function getSlotsHeute(
  schoolId: string,
  options: { limit?: number } = {},
): Promise<SlotsHeute | null> {
  const limit = Math.min(Math.max(options.limit ?? 6, 1), 50);
  return failSoft("slots-heute", async () =>
    withCurrentUserContext(async (tx) => {
      const rows = (await tx.execute(sql`
        with heute as (
          select av.von, av.bis, i.name
            from public.instructor_availability av
            join public.instructors i on i.id = av.instructor_id
           where i.school_id = ${schoolId}
             and av.ist_blockiert = false
             and (av.datum = (now() at time zone 'Europe/Berlin')::date
                  or (av.datum is null and av.wochentag =
                      extract(isodow from now() at time zone 'Europe/Berlin')::int - 1))
        )
        select count(*) over ()::int as anzahl,
               name as fahrlehrer_name,
               to_char(von, 'HH24:MI') as von,
               to_char(bis, 'HH24:MI') as bis
          from heute
         order by von asc nulls last
         limit ${limit}
      `)) as unknown as Rows;
      return {
        anzahlSlots: rows.length > 0 ? leseZahl(rows, "anzahl") : 0,
        slots: rows.map((r) => slotFahrlehrerSchema.parse(r)),
      };
    }),
  );
}

// ----------------------------------------------------------------------------
// „Mein Tag" — Fahrlehrer: EIGENE Termine heute/morgen (app.own_instructor_ids,
// Migration 0030 — instructors.user_id bleibt für app_user unselektierbar).
// ----------------------------------------------------------------------------

export interface MeinTag {
  heute: TerminKompakt[];
  morgen: TerminKompakt[];
  /** true, wenn für heute mindestens ein eigener Verfügbarkeits-Eintrag existiert. */
  verfuegbarkeitHeuteGepflegt: boolean;
}

export async function getMeinTag(options: { limitJeTag?: number } = {}): Promise<MeinTag | null> {
  const limit = Math.min(Math.max(options.limitJeTag ?? 8, 1), 50);
  return failSoft("mein-tag", async () =>
    withCurrentUserContext(async (tx) => {
      const lade = async (tagOffset: 0 | 1) =>
        ((await tx.execute(sql`
          select a.id, a.typ, a.status,
                 to_char(a.start at time zone 'Europe/Berlin', 'HH24:MI') as von,
                 to_char(a.ende at time zone 'Europe/Berlin', 'HH24:MI') as bis,
                 null as fahrlehrer_name,
                 e.fuehrerscheinklasse as klasse,
                 -- kein schoolId-Parameter: Namens-Definer LATERAL je Zeile über
                 -- e.school_id aufrufen (Mitgliedschafts-Gate liegt in 0031).
                 (select nullif(trim(coalesce(n.vorname, '') || ' ' || coalesce(n.nachname, '')), '')
                    from app.schueler_namen(e.school_id) n
                   where n.student_user_id = e.student_user_id) as schueler_name
            from public.appointments a
            join public.enrollments e on e.id = a.enrollment_id
           where a.instructor_id in (select app.own_instructor_ids())
             and a.status <> 'cancelled'
             and (a.start at time zone 'Europe/Berlin')::date
                 = (now() at time zone 'Europe/Berlin')::date + ${tagOffset}::int
           order by a.start asc
           limit ${limit}
        `)) as unknown as Rows).map((r) => terminKompaktSchema.parse(r));

      const heute = await lade(0);
      const morgen = await lade(1);
      const verfuegbar = (await tx.execute(sql`
        select count(*)::int as anzahl
          from public.instructor_availability av
         where av.instructor_id in (select app.own_instructor_ids())
           and av.ist_blockiert = false
           and (av.datum = (now() at time zone 'Europe/Berlin')::date
                or (av.datum is null and av.wochentag =
                    extract(isodow from now() at time zone 'Europe/Berlin')::int - 1))
      `)) as unknown as Rows;
      return {
        heute,
        morgen,
        verfuegbarkeitHeuteGepflegt: leseZahl(verfuegbar, "anzahl") > 0,
      };
    }),
  );
}

// ----------------------------------------------------------------------------
// Anmeldungen/Schüler der Schule (enrollments) — kompakt; Namen seit Welle 2
// über den Definer-Pfad app.schueler_namen (0031, siehe Kopf).
// ----------------------------------------------------------------------------

const anmeldungKompaktSchema = z.object({
  id: z.string().uuid(),
  /** Schüler-Name via app.schueler_namen (0031) — null ohne aktives Enrollment. */
  name: z.string().nullable(),
  klasse: z.string().nullable(),
  status: z.enum(["pending", "active", "cancelled", "completed"]),
  seit_tagen: z.coerce.number().int().min(0),
});
export type AnmeldungKompakt = z.infer<typeof anmeldungKompaktSchema>;

export interface AnmeldungenUebersicht {
  anzahlAktiv: number;
  anzahlGesamt: number;
  letzte: AnmeldungKompakt[];
}

export async function getAnmeldungenUebersicht(
  schoolId: string,
  options: { limit?: number } = {},
): Promise<AnmeldungenUebersicht | null> {
  const limit = Math.min(Math.max(options.limit ?? 5, 1), 20);
  return failSoft("anmeldungen-uebersicht", async () =>
    withCurrentUserContext(async (tx) => {
      const zaehler = (await tx.execute(sql`
        select count(*)::int as gesamt,
               count(*) filter (where status = 'active')::int as aktiv
          from public.enrollments
         where school_id = ${schoolId}
      `)) as unknown as Rows;
      const letzte = (await tx.execute(sql`
        select e.id,
               nullif(trim(coalesce(n.vorname, '') || ' ' || coalesce(n.nachname, '')), '') as name,
               e.fuehrerscheinklasse as klasse, e.status,
               floor(extract(epoch from now() - e.created_at) / 86400)::int as seit_tagen
          from public.enrollments e
          left join app.schueler_namen(${schoolId}) n
            on n.student_user_id = e.student_user_id
         where e.school_id = ${schoolId}
         order by e.created_at desc
         limit ${limit}
      `)) as unknown as Rows;
      return {
        anzahlAktiv: leseZahl(zaehler, "aktiv"),
        anzahlGesamt: leseZahl(zaehler, "gesamt"),
        letzte: letzte.map((r) => anmeldungKompaktSchema.parse(r)),
      };
    }),
  );
}

// ----------------------------------------------------------------------------
// „Dein Bereich" — Schüler: eigene Anmeldung + nächste Termine + Fortschritt
// ----------------------------------------------------------------------------

const eigeneAnmeldungSchema = z.object({
  id: z.string().uuid(),
  schul_name: z.string().nullable(),
  klasse: z.string().nullable(),
  status: z.enum(["pending", "active", "cancelled", "completed"]),
});

const naechsterTerminSchema = z.object({
  id: z.string().uuid(),
  typ: z.enum(["fahrstunde", "theorie", "fragenkatalog", "pruefung"]),
  tag: z.string(),
  von: z.string(),
  bis: z.string().nullable(),
  fahrlehrer_name: z.string().nullable(),
});
export type NaechsterTermin = z.infer<typeof naechsterTerminSchema>;

export interface MeinBereich {
  anmeldung: z.infer<typeof eigeneAnmeldungSchema> | null;
  naechsteTermine: NaechsterTermin[];
  absolvierteFahrstunden: number;
}

export async function getMeinBereich(
  options: { limit?: number } = {},
): Promise<MeinBereich | null> {
  const limit = Math.min(Math.max(options.limit ?? 3, 1), 10);
  return failSoft("mein-bereich", async () =>
    withCurrentUserContext(async (tx) => {
      // RLS liefert nur die EIGENEN Enrollments; Schulname über den öffentlichen
      // driving_schools-Lesepfad (gelistete Schule) — sonst null (Anzeige „—").
      const anmeldungen = (await tx.execute(sql`
        select e.id, s.name as schul_name, e.fuehrerscheinklasse as klasse, e.status
          from public.enrollments e
          left join public.driving_schools s on s.id = e.school_id
         order by e.created_at desc
         limit 1
      `)) as unknown as Rows;
      const anmeldung =
        anmeldungen.length > 0 ? eigeneAnmeldungSchema.parse(anmeldungen[0]) : null;

      const termine = (await tx.execute(sql`
        select a.id, a.typ,
               case
                 when (a.start at time zone 'Europe/Berlin')::date
                      = (now() at time zone 'Europe/Berlin')::date then 'heute'
                 when (a.start at time zone 'Europe/Berlin')::date
                      = (now() at time zone 'Europe/Berlin')::date + 1 then 'morgen'
                 else to_char(a.start at time zone 'Europe/Berlin', 'DD.MM.')
               end as tag,
               to_char(a.start at time zone 'Europe/Berlin', 'HH24:MI') as von,
               to_char(a.ende at time zone 'Europe/Berlin', 'HH24:MI') as bis,
               i.name as fahrlehrer_name
          from public.appointments a
          left join public.instructors i on i.id = a.instructor_id
         where a.status = 'booked' and a.start >= now()
         order by a.start asc
         limit ${limit}
      `)) as unknown as Rows;

      const fortschritt = (await tx.execute(sql`
        select count(*)::int as anzahl
          from public.appointments
         where typ = 'fahrstunde' and status = 'completed'
      `)) as unknown as Rows;

      return {
        anmeldung,
        naechsteTermine: termine.map((r) => naechsterTerminSchema.parse(r)),
        absolvierteFahrstunden: leseZahl(fortschritt, "anzahl"),
      };
    }),
  );
}

// ----------------------------------------------------------------------------
// Betreiber-Cockpit — platform_staff (RLS: admin sieht Leads/Bewerbungen aller
// Schulen; andere Plattform-Rollen erhalten 0 — die UI zeigt dann Empty-States).
// ----------------------------------------------------------------------------

export interface PlattformUebersicht {
  leadsHeute: number;
  bewerbungenHeute: number;
  schulenGelistet: number;
}

export async function getPlattformUebersicht(): Promise<PlattformUebersicht | null> {
  return failSoft("plattform-uebersicht", async () =>
    withCurrentUserContext(async (tx) => {
      const rows = (await tx.execute(sql`
        select
          (select count(*)::int from public.leads
            where (created_at at time zone 'Europe/Berlin')::date
                  = (now() at time zone 'Europe/Berlin')::date) as leads_heute,
          (select count(*)::int from public.job_applications
            where (created_at at time zone 'Europe/Berlin')::date
                  = (now() at time zone 'Europe/Berlin')::date) as bewerbungen_heute,
          (select count(*)::int from public.driving_schools
            where is_listed = true) as schulen_gelistet
      `)) as unknown as Rows;
      return {
        leadsHeute: leseZahl(rows, "leads_heute"),
        bewerbungenHeute: leseZahl(rows, "bewerbungen_heute"),
        schulenGelistet: leseZahl(rows, "schulen_gelistet"),
      };
    }),
  );
}

// ----------------------------------------------------------------------------
// API-Partner-Kontext — Mitgliedschaft + aktive Schlüssel (RLS: Partner-Mitglied
// liest den eigenen Partner/Keys). null = kein Partner-Mitglied (bewusst KEINE
// Erweiterung des eingefrorenen PortalIdentity-Shapes).
// ----------------------------------------------------------------------------

const apiPartnerSchema = z.object({
  name: z.string(),
  status: z.enum(["aktiv", "pausiert", "beendet"]),
  aktive_keys: z.coerce.number().int().min(0),
});
export type ApiPartnerKontext = {
  name: string;
  status: "aktiv" | "pausiert" | "beendet";
  aktiveKeys: number;
};

export async function getApiPartnerKontext(): Promise<ApiPartnerKontext | null> {
  return failSoft("api-partner-kontext", async () =>
    withCurrentUserContext(async (tx) => {
      const rows = (await tx.execute(sql`
        select p.name, p.status,
               (select count(*)::int from public.api_keys k
                 where k.partner_id = p.id and k.status = 'aktiv') as aktive_keys
          from public.api_partners p
          join public.api_partner_members m on m.partner_id = p.id
         order by p.created_at asc
         limit 1
      `)) as unknown as Rows;
      if (rows.length === 0) return null;
      const partner = apiPartnerSchema.parse(rows[0]);
      return { name: partner.name, status: partner.status, aktiveKeys: partner.aktive_keys };
    }),
  );
}
