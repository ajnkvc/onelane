import "server-only";

import { sql } from "drizzle-orm";
import { z } from "zod";
import { withCurrentUserContext } from "@/server/dal";

/**
 * modules/portal/os-betrieb.ts — Datenquellen der OS-Betriebs-Module (OS-P3,
 * Paket B): Kalender, Team, Zeiterfassung, Profil-Pflege, Stellenanzeigen.
 * ============================================================================
 * REGELN (identisch zu modules/portal/dashboard.ts, dem P2-Kontrakt):
 *  - JEDE Query läuft über withCurrentUserContext → RLS ist die Wahrheit.
 *    school_id-/user_id-Parameter sind nur FILTER (aus der validierten
 *    PortalIdentity), niemals Autorisierung — fremde IDs liefern 0 Zeilen.
 *  - FAIL-SOFT je Lesepfad: Fehler werden gefangen → null; die UI rendert
 *    dafür einen ehrlichen „gerade nicht verfügbar"-Zustand.
 *  - ZEIT: „heute"/Wochen-Grenzen werden IN SQL in Europe/Berlin berechnet;
 *    Anzeigezeiten kommen als fertige 'HH:MM'-Strings zurück.
 *  - DATENSCHUTZ: Rückgaben sind zod-validiert und minimal. SCHÜLER-Namen
 *    kommen seit Welle 2 über den Definer-Pfad app.schueler_namen (0031:
 *    NUR vorname/nachname, NUR aktives Enrollment, NUR Schul-Mitglieder) —
 *    users bleibt für Schul-Personal unlesbar. TEAM-Namen (school_members)
 *    tauchen weiterhin NICHT auf (kein Enrollment-Bezug; eigener geprüfter
 *    Pfad wäre eine spätere Migration) — Listen zeigen Rolle + ID-Kurzform.
 *    Fahrlehrer-Namen kommen aus instructors (dort bewusst lesbar, 0016).
 *  - appointments.preis/abgerechnet bleiben server-only (0029) — der Kalender
 *    liest sie NICHT (Finanz-Lesepfad app.termin_finanzen gehört dem
 *    Finanzen-Modul, modules/portal/finanzen.ts).
 *  - SCHREIBPFADE: Zeiterfassung (time_entries, 0029 — Mitglied schreibt
 *    EIGENE Einträge) + seit Welle 2 die Verfügbarkeits-Pflege
 *    (instructor_availability, 0031: Manager schulweit, Fahrlehrer:in NUR
 *    eigene Zeilen; RLS ist die letzte Linie). appointments-SCHREIBEN bleibt
 *    bewusst AUS (Termin-Anlage = eigenes Modul mit Storno-Regeln, P4/V1.1).
 *    Aufruf ausschließlich über withPortalActionGuards-Actions.
 */

/** Kleines Fail-Soft-Gerüst (Muster dashboard.ts): Fehler loggen, null liefern. */
async function failSoft<T>(name: string, work: () => Promise<T>): Promise<T | null> {
  try {
    return await work();
  } catch (fehler) {
    console.error(
      `[portal-os-betrieb] ${name} fehlgeschlagen:`,
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

// ============================================================================
// PURE Helfer (ohne DB) — exportiert für Unit-Tests und die Raster-Geometrie.
// ============================================================================

const ISO_DATUM = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validiert einen ?woche=-Query-Parameter (ISO-Datum, plausibles Jahr).
 * Liefert das Datum oder null (→ SQL fällt auf die aktuelle Berlin-Woche zurück).
 */
export function parseWochenParam(wert: unknown): string | null {
  if (typeof wert !== "string" || !ISO_DATUM.test(wert)) return null;
  const d = new Date(`${wert}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  // Kalender-Sanity: keine absurden Bereiche (Tippfehler/Manipulation).
  const jahr = d.getUTCFullYear();
  if (jahr < 2020 || jahr > 2100) return null;
  // Rück-Normalisierung fängt Überläufe wie 2026-02-31 ab (Date rollt sonst weiter).
  return d.toISOString().slice(0, 10) === wert ? wert : null;
}

/** ISO-Datum um n Tage verschieben (reine UTC-Kalenderarithmetik, DST-frei). */
export function verschiebeTage(isoDatum: string, tage: number): string {
  const d = new Date(`${isoDatum}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + tage);
  return d.toISOString().slice(0, 10);
}

/** „29.06. – 05.07.2026" aus den 7 Tages-ISO-Strings der Woche. */
export function wochenLabel(tage: string[]): string {
  if (tage.length === 0) return "";
  const kurz = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.`;
  const letzte = tage[tage.length - 1];
  return `${kurz(tage[0])} – ${kurz(letzte)}${letzte.slice(0, 4)}`;
}

/** "HH:MM" → Minuten seit 00:00; ungültig → null. */
export function minutenVon(zeit: string | null | undefined): number | null {
  if (!zeit) return null;
  const m = /^(\d{2}):(\d{2})/.exec(zeit);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Minuten → „5 Std. 30 Min." / „45 Min." (Zeiterfassung). */
export function minutenLabel(minuten: number): string {
  const m = Math.max(0, Math.round(minuten));
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h === 0) return `${rest} Min.`;
  if (rest === 0) return `${h} Std.`;
  return `${h} Std. ${rest} Min.`;
}

export interface RasterFenster {
  /** Minuten seit 00:00 (volle Stunde). */
  startMin: number;
  endMin: number;
}

/**
 * Sichtfenster des Wochenrasters: Standard 06:00–20:00, erweitert auf volle
 * Stunden, wenn Termine/Slots außerhalb liegen (nichts wird abgeschnitten).
 */
export function rasterFenster(zeiten: Array<{ von: string | null; bis: string | null }>): RasterFenster {
  let start = 6 * 60;
  let end = 20 * 60;
  for (const z of zeiten) {
    const von = minutenVon(z.von);
    const bis = minutenVon(z.bis);
    if (von !== null) start = Math.min(start, Math.floor(von / 60) * 60);
    // 24:00-Kante: bis < von (über Mitternacht) wird aufs Tagesende geklappt.
    if (bis !== null) {
      const effektiv = von !== null && bis <= von ? 24 * 60 : Math.ceil(bis / 60) * 60;
      end = Math.max(end, effektiv);
    }
    if (von !== null) end = Math.max(end, Math.ceil((von + 30) / 60) * 60);
  }
  return { startMin: Math.max(0, start), endMin: Math.min(24 * 60, Math.max(end, start + 60)) };
}

export interface SpaltenBlock {
  vonMin: number;
  bisMin: number;
}

export interface SpaltenPlatz {
  /** 0-basierte Spur innerhalb der Überlappungs-Gruppe. */
  spur: number;
  /** Spurenzahl der Gruppe (für die Breiten-Geometrie). */
  spuren: number;
}

/**
 * Klassisches Kalender-Spur-Layout für überlappende Blöcke EINER Tagesspalte:
 * greedy die erste freie Spur, Spurenzahl je zusammenhängender Überlappungs-
 * Gruppe. Reihenfolge der Rückgabe = Reihenfolge der Eingabe.
 */
export function spaltenLayout(bloecke: SpaltenBlock[]): SpaltenPlatz[] {
  const reihenfolge = bloecke
    .map((b, index) => ({ ...b, index }))
    .sort((a, b) => a.vonMin - b.vonMin || a.bisMin - b.bisMin);

  const plaetze: SpaltenPlatz[] = bloecke.map(() => ({ spur: 0, spuren: 1 }));
  let gruppe: Array<{ index: number; bisMin: number; spur: number }> = [];
  let gruppenIndizes: number[] = [];
  let gruppenEnde = -1;

  const schliesseGruppe = () => {
    const spuren = Math.max(1, ...gruppe.map((g) => g.spur + 1));
    for (const i of gruppenIndizes) plaetze[i].spuren = spuren;
    gruppe = [];
    gruppenIndizes = [];
    gruppenEnde = -1;
  };

  for (const block of reihenfolge) {
    if (gruppe.length > 0 && block.vonMin >= gruppenEnde) schliesseGruppe();
    // erste Spur, deren letzter Block vor diesem endet
    const belegt = new Set(
      gruppe.filter((g) => g.bisMin > block.vonMin).map((g) => g.spur),
    );
    let spur = 0;
    while (belegt.has(spur)) spur += 1;
    plaetze[block.index].spur = spur;
    gruppe.push({ index: block.index, bisMin: block.bisMin, spur });
    gruppenIndizes.push(block.index);
    gruppenEnde = Math.max(gruppenEnde, block.bisMin);
  }
  if (gruppe.length > 0) schliesseGruppe();
  return plaetze;
}

/** Status einer Stellenanzeige aus aktiv + gueltig_bis (heute = ISO, Berlin). */
export type JobStatus = "aktiv" | "abgelaufen" | "deaktiviert";
export function jobStatusVon(
  aktiv: boolean,
  gueltigBis: string | null,
  heuteIso: string,
): JobStatus {
  if (!aktiv) return "deaktiviert";
  if (gueltigBis !== null && gueltigBis < heuteIso) return "abgelaufen";
  return "aktiv";
}

/** Zeiterfassungs-Kategorien (DB-Allowlist 0029) + Anzeige-Labels. */
export const ZEIT_KATEGORIEN = [
  "fahrstunde",
  "theorie",
  "buero",
  "verwaltung",
  "sonstiges",
] as const;
export type ZeitKategorie = (typeof ZEIT_KATEGORIEN)[number];
export const ZEIT_KATEGORIE_LABEL: Record<ZeitKategorie, string> = {
  fahrstunde: "Fahrstunden",
  theorie: "Theorie-Unterricht",
  buero: "Büro",
  verwaltung: "Verwaltung",
  sonstiges: "Sonstiges",
};

// ============================================================================
// Kalender — Wochenansicht (appointments + instructor_availability, 0029/0030)
// ============================================================================

const kalenderFahrlehrerSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  aktiv: z.boolean(),
  ist_ich: z.boolean(),
});
export type KalenderFahrlehrer = z.infer<typeof kalenderFahrlehrerSchema>;

const kalenderTerminSchema = z.object({
  id: z.string().uuid(),
  instructor_id: z.string().uuid().nullable(),
  typ: z.enum(["fahrstunde", "theorie", "fragenkatalog", "pruefung"]),
  status: z.enum(["booked", "completed"]),
  tag_index: z.coerce.number().int().min(0).max(6),
  von: z.string(),
  bis: z.string().nullable(),
  klasse: z.string().nullable(),
  /** Schüler-Name via app.schueler_namen (0031) — null ohne aktives Enrollment. */
  schueler_name: z.string().nullable(),
});
export type KalenderTermin = z.infer<typeof kalenderTerminSchema>;

const kalenderSlotSchema = z.object({
  /** Zeilen-ID — Referenz für die Verfügbarkeits-Pflege (Löschen, 0031). */
  id: z.string().uuid(),
  instructor_id: z.string().uuid(),
  /** Konkretes Datum (true) oder wiederkehrendes Wochentags-Muster (false). */
  ist_datum: z.boolean(),
  tag_index: z.coerce.number().int().min(0).max(6),
  von: z.string().nullable(),
  bis: z.string().nullable(),
  ist_blockiert: z.boolean(),
});
export type KalenderSlot = z.infer<typeof kalenderSlotSchema>;

export interface KalenderWoche {
  /** Montag der angezeigten Woche (ISO, Europe/Berlin). */
  wochenstart: string;
  /** Die 7 Tages-ISO-Daten Mo–So. */
  tage: string[];
  /** „heute" als ISO (Berlin) — für die Hervorhebung der Tagesspalte. */
  heute: string;
  fahrlehrer: KalenderFahrlehrer[];
  termine: KalenderTermin[];
  slots: KalenderSlot[];
}

/**
 * Wochen-Kalender der Schule: Termine (ohne stornierte, inkl. Schüler-Name via
 * 0031) + Verfügbarkeits-Slots je Fahrlehrer. `wunschWoche` (validiert via
 * parseWochenParam) wählt die Woche, sonst aktuelle Berlin-Woche; alle
 * Tagesgrenzen entstehen IN SQL (Europe/Berlin). Termine bleiben READ-ONLY
 * (Termin-Anlage = eigenes Modul, P4/V1.1); die Verfügbarkeits-PFLEGE läuft
 * über verfuegbarkeitAnlegen/verfuegbarkeitLoeschen (0031-Policies).
 */
export async function getKalenderWoche(
  schoolId: string,
  options: { wunschWoche?: string | null } = {},
): Promise<KalenderWoche | null> {
  const wunsch = options.wunschWoche ?? null;
  return failSoft("kalender-woche", async () =>
    withCurrentUserContext(async (tx) => {
      const kopf = (await tx.execute(sql`
        select to_char(date_trunc('week',
                 coalesce(${wunsch}::date, (now() at time zone 'Europe/Berlin')::date)
               )::date, 'YYYY-MM-DD') as wochenstart,
               to_char((now() at time zone 'Europe/Berlin')::date, 'YYYY-MM-DD') as heute
      `)) as unknown as Rows;
      const wochenstart = z.string().regex(ISO_DATUM).parse(kopf[0]?.wochenstart);
      const heute = z.string().regex(ISO_DATUM).parse(kopf[0]?.heute);

      const fahrlehrer = (await tx.execute(sql`
        select i.id, i.name, i.aktiv,
               (i.id in (select app.own_instructor_ids())) as ist_ich
          from public.instructors i
         where i.school_id = ${schoolId}
         order by ist_ich desc, i.name asc
         limit 50
      `)) as unknown as Rows;

      const termine = (await tx.execute(sql`
        with woche as (
          select date_trunc('week',
                   coalesce(${wunsch}::date, (now() at time zone 'Europe/Berlin')::date)
                 )::date as start
        )
        select a.id, a.instructor_id, a.typ, a.status,
               ((a.start at time zone 'Europe/Berlin')::date - w.start)::int as tag_index,
               to_char(a.start at time zone 'Europe/Berlin', 'HH24:MI') as von,
               to_char(a.ende at time zone 'Europe/Berlin', 'HH24:MI') as bis,
               e.fuehrerscheinklasse as klasse,
               nullif(trim(coalesce(n.vorname, '') || ' ' || coalesce(n.nachname, '')), '') as schueler_name
          from public.appointments a
          join public.enrollments e on e.id = a.enrollment_id
          left join app.schueler_namen(${schoolId}) n
            on n.student_user_id = e.student_user_id
         cross join woche w
         where e.school_id = ${schoolId}
           and a.status <> 'cancelled'
           and (a.start at time zone 'Europe/Berlin')::date >= w.start
           and (a.start at time zone 'Europe/Berlin')::date < w.start + 7
         order by a.start asc
         limit 500
      `)) as unknown as Rows;

      const slots = (await tx.execute(sql`
        with woche as (
          select date_trunc('week',
                   coalesce(${wunsch}::date, (now() at time zone 'Europe/Berlin')::date)
                 )::date as start
        )
        select av.id, av.instructor_id,
               (av.datum is not null) as ist_datum,
               case when av.datum is not null then (av.datum - w.start)::int
                    else av.wochentag end as tag_index,
               to_char(av.von, 'HH24:MI') as von,
               to_char(av.bis, 'HH24:MI') as bis,
               av.ist_blockiert
          from public.instructor_availability av
          join public.instructors i on i.id = av.instructor_id
         cross join woche w
         where i.school_id = ${schoolId}
           and (av.datum is null
                or (av.datum >= w.start and av.datum < w.start + 7))
         order by av.von asc nulls last
         limit 500
      `)) as unknown as Rows;

      return {
        wochenstart,
        tage: Array.from({ length: 7 }, (_, i) => verschiebeTage(wochenstart, i)),
        heute,
        fahrlehrer: fahrlehrer.map((r) => kalenderFahrlehrerSchema.parse(r)),
        termine: termine.map((r) => kalenderTerminSchema.parse(r)),
        // Wochentags-Muster außerhalb 0..6 (defensiv) fallen weg statt zu werfen.
        slots: slots
          .filter((r) => {
            const t = Number(r.tag_index);
            return Number.isInteger(t) && t >= 0 && t <= 6;
          })
          .map((r) => kalenderSlotSchema.parse(r)),
      };
    }),
  );
}

// ============================================================================
// Verfügbarkeits-Pflege (instructor_availability, Schreibpfad Migration 0031)
// RLS: Manager pflegen ALLE Fahrlehrer der Schule, Fahrlehrer:in NUR die
// eigenen Zeilen (app.own_instructor_ids + Mitgliedschaft) — das Modul bindet
// die Schule zusätzlich im SQL (Doppel-Bindung, Muster anfrageStatusSetzen).
// ============================================================================

const ZEIT_HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

const verfuegbarkeitNeuSchema = z
  .object({
    instructorId: z.string().uuid(),
    /** Konkretes Datum (ISO) ODER wiederkehrender Wochentag 0–6 — genau eins. */
    datum: z.string().regex(ISO_DATUM).nullable(),
    wochentag: z.number().int().min(0).max(6).nullable(),
    von: z.string().regex(ZEIT_HHMM),
    bis: z.string().regex(ZEIT_HHMM),
    istBlockiert: z.boolean(),
  })
  .refine((e) => (e.datum === null) !== (e.wochentag === null), {
    message: "genau eins von datum/wochentag",
  })
  .refine((e) => e.von < e.bis, { message: "von < bis" });
export type VerfuegbarkeitNeu = z.infer<typeof verfuegbarkeitNeuSchema>;

/**
 * Legt einen Verfügbarkeits-/Blocker-Eintrag an. true = genau 1 Zeile;
 * false = ungültige Eingabe ODER von RLS/Policy abgelehnt (kein Fehler-Orakel).
 */
export async function verfuegbarkeitAnlegen(
  schoolId: string,
  eintrag: VerfuegbarkeitNeu,
): Promise<boolean> {
  const schule = z.string().uuid().safeParse(schoolId);
  const geprueft = verfuegbarkeitNeuSchema.safeParse(eintrag);
  if (!schule.success || !geprueft.success) return false;
  const e = geprueft.data;
  const ergebnis = await failSoft("verfuegbarkeit-anlegen", async () =>
    withCurrentUserContext(async (tx) => {
      const rows = (await tx.execute(sql`
        insert into public.instructor_availability
          (instructor_id, datum, wochentag, von, bis, ist_blockiert)
        select ${e.instructorId}, ${e.datum}::date, ${e.wochentag}::smallint,
               ${e.von}::time, ${e.bis}::time, ${e.istBlockiert}
         where exists (select 1 from public.instructors i
                        where i.id = ${e.instructorId}
                          and i.school_id = ${schule.data})
        returning id
      `)) as unknown as Rows;
      return rows.length === 1;
    }),
  );
  return ergebnis === true;
}

/** Löscht einen Eintrag (Schul-Bindung doppelt; RLS letzte Linie). true = 1 Zeile. */
export async function verfuegbarkeitLoeschen(schoolId: string, slotId: string): Promise<boolean> {
  const geprueft = z
    .object({ schoolId: z.string().uuid(), slotId: z.string().uuid() })
    .safeParse({ schoolId, slotId });
  if (!geprueft.success) return false;
  const ergebnis = await failSoft("verfuegbarkeit-loeschen", async () =>
    withCurrentUserContext(async (tx) => {
      const rows = (await tx.execute(sql`
        delete from public.instructor_availability av
         where av.id = ${geprueft.data.slotId}
           and av.instructor_id in (select i.id from public.instructors i
                                     where i.school_id = ${geprueft.data.schoolId})
        returning av.id
      `)) as unknown as Rows;
      return rows.length === 1;
    }),
  );
  return ergebnis === true;
}

// ============================================================================
// Team — Mitglieder (school_members) + Fahrlehrer mit Verfügbarkeit heute
// ============================================================================

const teamMitgliedSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  rolle: z.enum(["inhaber", "verwaltung", "fahrlehrer"]),
  seit_tagen: z.coerce.number().int().min(0),
});
export type TeamMitglied = z.infer<typeof teamMitgliedSchema>;

const teamFahrlehrerSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  aktiv: z.boolean(),
  ist_ich: z.boolean(),
  slots_heute: z.coerce.number().int().min(0),
  von: z.string().nullable(),
  bis: z.string().nullable(),
});
export type TeamFahrlehrer = z.infer<typeof teamFahrlehrerSchema>;

export interface TeamUebersicht {
  mitglieder: TeamMitglied[];
  fahrlehrer: TeamFahrlehrer[];
}

/**
 * Team der aktiven Schule. BEWUSST OHNE Personen-Namen der Mitglieder
 * (users-RLS, s. Kopf) — die UI zeigt Rolle + ID-Kurzform und markiert „du"
 * über den user_id-Vergleich mit der PortalIdentity. Fahrlehrer-Namen kommen
 * aus instructors (lesbar) inkl. heutigem Verfügbarkeits-Fenster (Berlin).
 */
export async function getTeamUebersicht(schoolId: string): Promise<TeamUebersicht | null> {
  return failSoft("team-uebersicht", async () =>
    withCurrentUserContext(async (tx) => {
      const mitglieder = (await tx.execute(sql`
        select m.id, m.user_id, m.rolle,
               floor(extract(epoch from now() - m.created_at) / 86400)::int as seit_tagen
          from public.school_members m
         where m.school_id = ${schoolId}
         -- rolle ist ein ENUM → für array_position explizit auf text casten
         order by array_position(array['inhaber','verwaltung','fahrlehrer'], m.rolle::text),
                  m.created_at asc
         limit 100
      `)) as unknown as Rows;

      const fahrlehrer = (await tx.execute(sql`
        select i.id, i.name, i.aktiv,
               (i.id in (select app.own_instructor_ids())) as ist_ich,
               count(av.id) filter (where av.ist_blockiert = false)::int as slots_heute,
               min(to_char(av.von, 'HH24:MI')) filter (where av.ist_blockiert = false) as von,
               max(to_char(av.bis, 'HH24:MI')) filter (where av.ist_blockiert = false) as bis
          from public.instructors i
          left join public.instructor_availability av
            on av.instructor_id = i.id
           and (av.datum = (now() at time zone 'Europe/Berlin')::date
                or (av.datum is null and av.wochentag =
                    extract(isodow from now() at time zone 'Europe/Berlin')::int - 1))
         where i.school_id = ${schoolId}
         group by i.id, i.name, i.aktiv
         order by i.aktiv desc, i.name asc
         limit 100
      `)) as unknown as Rows;

      return {
        mitglieder: mitglieder.map((r) => teamMitgliedSchema.parse(r)),
        fahrlehrer: fahrlehrer.map((r) => teamFahrlehrerSchema.parse(r)),
      };
    }),
  );
}

// ============================================================================
// Zeiterfassung — time_entries (0029): eigene Woche + laufender Eintrag,
// Manager-Sicht Team-Woche (read-only; RLS deckt beides).
// ============================================================================

const zeitEintragSchema = z.object({
  id: z.string().uuid(),
  kategorie: z.enum(ZEIT_KATEGORIEN),
  notiz: z.string().nullable(),
  tag: z.string(),
  von: z.string(),
  bis: z.string().nullable(),
  minuten: z.coerce.number().int().min(0).nullable(),
});
export type ZeitEintrag = z.infer<typeof zeitEintragSchema>;

const laufenderEintragSchema = z.object({
  id: z.string().uuid(),
  kategorie: z.enum(ZEIT_KATEGORIEN),
  notiz: z.string().nullable(),
  seit: z.string(),
  start_epoch_ms: z.coerce.number().int().min(0),
  minuten: z.coerce.number().int().min(0),
});
export type LaufenderEintrag = z.infer<typeof laufenderEintragSchema>;

export interface ZeiterfassungWoche {
  laufend: LaufenderEintrag | null;
  eintraege: ZeitEintrag[];
  summeMinuten: number;
}

/** EIGENE Zeiterfassung der aktuellen Berlin-Woche + laufender Eintrag. */
export async function getZeiterfassungWoche(
  schoolId: string,
  userId: string,
): Promise<ZeiterfassungWoche | null> {
  return failSoft("zeiterfassung-woche", async () =>
    withCurrentUserContext(async (tx) => {
      const laufend = (await tx.execute(sql`
        select t.id, t.kategorie, t.notiz,
               to_char(t.start_at at time zone 'Europe/Berlin', 'HH24:MI') as seit,
               (extract(epoch from t.start_at) * 1000)::bigint as start_epoch_ms,
               greatest(0, floor(extract(epoch from now() - t.start_at) / 60))::int as minuten
          from public.time_entries t
         where t.school_id = ${schoolId}
           and t.member_user_id = ${userId}
           and t.ende_at is null
         order by t.start_at desc
         limit 1
      `)) as unknown as Rows;

      const eintraege = (await tx.execute(sql`
        select t.id, t.kategorie, t.notiz,
               to_char(t.start_at at time zone 'Europe/Berlin', 'DD.MM.') as tag,
               to_char(t.start_at at time zone 'Europe/Berlin', 'HH24:MI') as von,
               to_char(t.ende_at at time zone 'Europe/Berlin', 'HH24:MI') as bis,
               case when t.ende_at is not null
                    then floor(extract(epoch from t.ende_at - t.start_at) / 60)::int
               end as minuten
          from public.time_entries t
         where t.school_id = ${schoolId}
           and t.member_user_id = ${userId}
           and t.start_at >= date_trunc('week', now() at time zone 'Europe/Berlin')
                             at time zone 'Europe/Berlin'
         order by t.start_at desc
         limit 50
      `)) as unknown as Rows;

      const summe = (await tx.execute(sql`
        select coalesce(sum(floor(extract(epoch from t.ende_at - t.start_at) / 60)), 0)::int as minuten
          from public.time_entries t
         where t.school_id = ${schoolId}
           and t.member_user_id = ${userId}
           and t.ende_at is not null
           and t.start_at >= date_trunc('week', now() at time zone 'Europe/Berlin')
                             at time zone 'Europe/Berlin'
      `)) as unknown as Rows;

      return {
        laufend: laufend.length > 0 ? laufenderEintragSchema.parse(laufend[0]) : null,
        eintraege: eintraege.map((r) => zeitEintragSchema.parse(r)),
        summeMinuten: leseZahl(summe, "minuten"),
      };
    }),
  );
}

const teamZeitSchema = z.object({
  id: z.string().uuid(),
  member_user_id: z.string().uuid(),
  rolle: z.enum(["inhaber", "verwaltung", "fahrlehrer"]).nullable(),
  kategorie: z.enum(ZEIT_KATEGORIEN),
  tag: z.string(),
  von: z.string(),
  bis: z.string().nullable(),
  minuten: z.coerce.number().int().min(0).nullable(),
});
export type TeamZeitEintrag = z.infer<typeof teamZeitSchema>;

export interface TeamZeitenWoche {
  eintraege: TeamZeitEintrag[];
  anzahlGesamt: number;
}

/**
 * Team-Einträge der aktuellen Berlin-Woche (Manager-Sicht, read-only).
 * RLS: inhaber/verwaltung lesen die Schule, Fahrlehrer nur sich selbst —
 * die Karte wird ohnehin nur für Schul-Manager gerendert.
 */
export async function getTeamZeitenWoche(
  schoolId: string,
  options: { limit?: number } = {},
): Promise<TeamZeitenWoche | null> {
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);
  return failSoft("team-zeiten-woche", async () =>
    withCurrentUserContext(async (tx) => {
      const zaehler = (await tx.execute(sql`
        select count(*)::int as anzahl
          from public.time_entries t
         where t.school_id = ${schoolId}
           and t.start_at >= date_trunc('week', now() at time zone 'Europe/Berlin')
                             at time zone 'Europe/Berlin'
      `)) as unknown as Rows;
      const eintraege = (await tx.execute(sql`
        select t.id, t.member_user_id, m.rolle, t.kategorie,
               to_char(t.start_at at time zone 'Europe/Berlin', 'DD.MM.') as tag,
               to_char(t.start_at at time zone 'Europe/Berlin', 'HH24:MI') as von,
               to_char(t.ende_at at time zone 'Europe/Berlin', 'HH24:MI') as bis,
               case when t.ende_at is not null
                    then floor(extract(epoch from t.ende_at - t.start_at) / 60)::int
               end as minuten
          from public.time_entries t
          left join public.school_members m
            on m.user_id = t.member_user_id and m.school_id = t.school_id
         where t.school_id = ${schoolId}
           and t.start_at >= date_trunc('week', now() at time zone 'Europe/Berlin')
                             at time zone 'Europe/Berlin'
         order by t.start_at desc
         limit ${limit}
      `)) as unknown as Rows;
      return {
        eintraege: eintraege.map((r) => teamZeitSchema.parse(r)),
        anzahlGesamt: leseZahl(zaehler, "anzahl"),
      };
    }),
  );
}

/**
 * EINSTEMPELN: legt den eigenen laufenden Eintrag an — race-arm per
 * `insert … select … where not exists (offener Eintrag)`. RLS erzwingt
 * member_user_id = eigene sub + Schul-Mitgliedschaft (0029). Rückgabe false,
 * wenn bereits ein offener Eintrag existiert (kein Doppel-Stempeln).
 */
export async function starteZeitEintrag(
  schoolId: string,
  userId: string,
  kategorie: ZeitKategorie,
  notiz: string | null,
): Promise<boolean> {
  const ergebnis = await failSoft("zeit-einstempeln", async () =>
    withCurrentUserContext(async (tx) => {
      const rows = (await tx.execute(sql`
        insert into public.time_entries (school_id, member_user_id, start_at, kategorie, notiz)
        select ${schoolId}, ${userId}, now(), ${kategorie}, ${notiz}
         where not exists (
                 select 1 from public.time_entries
                  where member_user_id = ${userId} and ende_at is null
               )
        returning id
      `)) as unknown as Rows;
      return rows.length > 0;
    }),
  );
  return ergebnis === true;
}

/**
 * AUSSTEMPELN: schließt ALLE eigenen offenen Einträge (defensiv, falls je
 * ein Doppel entstanden ist). start_at < now() schützt den DB-CHECK
 * ende_at > start_at (Uhr-Skew → dann kein Update, ehrlicher no-op).
 */
export async function beendeZeitEintrag(schoolId: string, userId: string): Promise<boolean> {
  const ergebnis = await failSoft("zeit-ausstempeln", async () =>
    withCurrentUserContext(async (tx) => {
      const rows = (await tx.execute(sql`
        update public.time_entries
           set ende_at = now()
         where school_id = ${schoolId}
           and member_user_id = ${userId}
           and ende_at is null
           and start_at < now()
        returning id
      `)) as unknown as Rows;
      return rows.length > 0;
    }),
  );
  return ergebnis === true;
}

// ============================================================================
// Profil-Pflege — READ-Übersicht der öffentlichen Schul-Daten (V1)
// ============================================================================

const profilKopfSchema = z.object({
  name: z.string(),
  slug: z.string(),
  ort: z.string().nullable(),
  beschreibung: z.string().nullable(),
  telefon: z.string().nullable(),
  email: z.string().nullable(),
  website: z.string().nullable(),
  klassen: z.array(z.string()),
});

const oeffnungsZeileSchema = z.object({
  art: z.string(),
  wochentag: z.coerce.number().int().min(0).max(6),
  von: z.string(),
  bis: z.string(),
});
export type OeffnungsZeile = z.infer<typeof oeffnungsZeileSchema>;

const preisStatusSchema = z.object({
  klasse: z.string(),
  status: z.enum(["recherchiert", "bestaetigt"]),
  stand: z.string().nullable(),
});
export type PreisStatus = z.infer<typeof preisStatusSchema>;

export interface ProfilPflege {
  name: string;
  slug: string;
  ort: string | null;
  beschreibung: string | null;
  kontakt: { telefon: boolean; email: boolean; website: boolean };
  klassen: string[];
  /** Strukturierte Zeiten (school_opening_hours) — Quelle für Status/Anzeige. */
  zeiten: OeffnungsZeile[];
  preise: PreisStatus[];
}

/**
 * READ-Übersicht des öffentlichen Portal-Profils der aktiven Schule (V1).
 * Die Zustell-Adressen (bewerbungs_email/anfragen_email, 0025/0028) sind für
 * app_user bewusst UNLESBAR (Spalten-Grants) — die UI zeigt dafür einen
 * ehrlichen „wird vom onelane-Team gepflegt"-Hinweis statt Werten.
 * EDITIEREN kommt in Welle 2/P4 (eigene Schreib-Actions + Review) — V1 rendert
 * bewusst keine toten Formulare.
 */
export async function getProfilPflege(schoolId: string): Promise<ProfilPflege | null> {
  return failSoft("profil-pflege", async () =>
    withCurrentUserContext(async (tx) => {
      const kopf = (await tx.execute(sql`
        select s.name, s.slug, s.ort,
               p.beschreibung, p.telefon, p.email, p.website,
               coalesce(p.fuehrerscheinklassen, '{}') as klassen
          from public.driving_schools s
          left join public.school_profiles p on p.school_id = s.id
         where s.id = ${schoolId}
         limit 1
      `)) as unknown as Rows;
      if (kopf.length === 0) return null;
      const k = profilKopfSchema.parse(kopf[0]);

      const zeiten = (await tx.execute(sql`
        select art, wochentag,
               to_char(von, 'HH24:MI') as von,
               to_char(bis, 'HH24:MI') as bis
          from public.school_opening_hours
         where school_id = ${schoolId} and aktiv = true
         order by wochentag asc, von asc
         limit 100
      `)) as unknown as Rows;

      const preise = (await tx.execute(sql`
        select klasse, status, to_char(stand, 'YYYY-MM-DD') as stand
          from public.school_prices
         where school_id = ${schoolId} and aktiv = true
         order by klasse asc
         limit 50
      `)) as unknown as Rows;

      return {
        name: k.name,
        slug: k.slug,
        ort: k.ort,
        beschreibung: k.beschreibung,
        kontakt: {
          telefon: Boolean(k.telefon),
          email: Boolean(k.email),
          website: Boolean(k.website),
        },
        klassen: k.klassen,
        zeiten: zeiten.map((r) => oeffnungsZeileSchema.parse(r)),
        preise: preise.map((r) => preisStatusSchema.parse(r)),
      };
    }),
  );
}

// ============================================================================
// Stellenanzeigen — school_jobs der Schule + Bewerbungs-Zähler (read-only V1)
// ============================================================================

const jobAnzeigeSchema = z.object({
  id: z.string().uuid(),
  titel: z.string(),
  slug: z.string(),
  aktiv: z.boolean(),
  gueltig_bis: z.string().nullable(),
  seit_tagen: z.coerce.number().int().min(0),
  bewerbungen: z.coerce.number().int().min(0),
  bewerbungen_neu: z.coerce.number().int().min(0),
});
export type JobAnzeige = z.infer<typeof jobAnzeigeSchema>;

export interface JobsUebersicht {
  /** „heute" (Berlin, ISO) — Referenz für jobStatusVon. */
  heute: string;
  anzeigen: JobAnzeige[];
  anzahlAktiv: number;
  bewerbungenGesamt: number;
  bewerbungenNeu: number;
}

/**
 * Eigene Stellenanzeigen der Schule (Mitglieder lesen via 0023-Policy auch
 * abgelaufene/deaktivierte). Bewerbungs-Zähler laufen unter job_applications-
 * RLS (Schul-Manager) — die Seite ist ohnehin Manager-gegated. Pflege bleibt
 * in V1 kuratiert (admin/editor-Write-Policy 0025): die UI verweist auf den
 * kontakt@onelane.de-Weg statt tote Formulare zu zeigen.
 */
export async function getJobsUebersicht(
  schoolId: string,
  options: { limit?: number } = {},
): Promise<JobsUebersicht | null> {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
  return failSoft("jobs-uebersicht", async () =>
    withCurrentUserContext(async (tx) => {
      const kopf = (await tx.execute(sql`
        select to_char((now() at time zone 'Europe/Berlin')::date, 'YYYY-MM-DD') as heute
      `)) as unknown as Rows;
      const heute = z.string().regex(ISO_DATUM).parse(kopf[0]?.heute);

      const anzeigen = (await tx.execute(sql`
        select j.id, j.titel, j.slug, j.aktiv,
               to_char(j.gueltig_bis, 'YYYY-MM-DD') as gueltig_bis,
               floor(extract(epoch from now() - j.created_at) / 86400)::int as seit_tagen,
               (select count(*)::int from public.job_applications b
                 where b.job_id = j.id) as bewerbungen,
               (select count(*)::int from public.job_applications b
                 where b.job_id = j.id and b.status = 'neu') as bewerbungen_neu
          from public.school_jobs j
         where j.school_id = ${schoolId}
         order by j.aktiv desc, j.created_at desc
         limit ${limit}
      `)) as unknown as Rows;

      const rows = anzeigen.map((r) => jobAnzeigeSchema.parse(r));
      return {
        heute,
        anzeigen: rows,
        anzahlAktiv: rows.filter((r) => jobStatusVon(r.aktiv, r.gueltig_bis, heute) === "aktiv")
          .length,
        bewerbungenGesamt: rows.reduce((s, r) => s + r.bewerbungen, 0),
        bewerbungenNeu: rows.reduce((s, r) => s + r.bewerbungen_neu, 0),
      };
    }),
  );
}
