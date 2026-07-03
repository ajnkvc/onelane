import "server-only";

import { sql } from "drizzle-orm";
import { z } from "zod";
import { withCurrentUserContext } from "@/server/dal";

/**
 * modules/portal/os-kern.ts — Datenpfad der OS-Kern-Module (OS-P3, Paket A):
 * Anfragen (leads), Bewerbungen (job_applications), Schülerdatenbank V1
 * (enrollments + appointments-Zähler).
 * ============================================================================
 * REGELN (dashboard.ts-Linie, verbindlich):
 *  - JEDE Query läuft über withCurrentUserContext → RLS ist die Wahrheit.
 *    school_id ist nur FILTER (aktive Schule aus der geprüften PortalIdentity),
 *    niemals Autorisierung — fremde IDs liefern durch RLS 0 Zeilen.
 *  - FAIL-SOFT: Lesefunktionen fangen Fehler selbst → null („gerade nicht
 *    verfügbar"-Zustand); Schreibfunktionen → false (kein 500-Leak).
 *  - CURSOR-PAGINATION ({ limit, cursor }): Keyset über (created_at, id) DESC —
 *    stabil bei neuen Einträgen, kein OFFSET. Cursor ist ein base64url-Token
 *    aus created_at::text + id, zod-validiert (kaputte Token → Seite 1).
 *  - SPALTEN-GRANTS beachtet: leads/job_applications OHNE deleted_at (Soft-
 *    Delete filtert die RLS-Policy selbst); appointments ohne preis/abgerechnet.
 *  - STATUS-KONTRAKT Anfragen/Bewerbungen: DB-Allowlist bleibt
 *    neu|gesehen|erledigt (0022/0023, KEINE Migration) — die UI zeigt 'gesehen'
 *    als „kontaktiert" (Tab-Kontrakt). Mapping hier, nie in der DB.
 *  - VERMITTLUNGS-NEUTRALISIERUNG: Quereinsteiger-Bewerbungen sind per RLS für
 *    die Schule sichtbar (job_applications_select filtert nicht nach
 *    bewerber_status) — der Vermittlungsprozess läuft aber über onelane
 *    (modules/jobs/actions.ts). Deshalb neutralisiert dieses Modul solche
 *    Zeilen VOR der Präsentation: keine Kontaktdaten, keine Unterlagen, kein
 *    Name — nur „über onelane vermittelt". Status-Pflege ist für diese Zeilen
 *    ebenfalls gesperrt (SQL-seitig, nicht nur UI).
 *  - SCHÜLER-NAMEN (Welle 2): kommen AUSSCHLIESSLICH über den Definer-Lesepfad
 *    app.schueler_namen(school_id) (Migration 0031) — datenminimiert NUR
 *    vorname/nachname, NUR bei aktivem Enrollment (pending|active), NUR für
 *    Mitglieder der Schule. users bleibt für Schul-Personal weiterhin
 *    unlesbar (keine E-Mail/Telefon); ohne aktives Enrollment fällt die
 *    Anzeige ehrlich auf die ID-Kurzform zurück.
 */

// ----------------------------------------------------------------------------
// Fail-Soft-Gerüst (dashboard.ts-Muster; Fehler ohne Daten loggen).
// ----------------------------------------------------------------------------
async function failSoft<T>(name: string, work: () => Promise<T>): Promise<T | null> {
  try {
    return await work();
  } catch (fehler) {
    console.error(
      `[portal-os-kern] ${name} fehlgeschlagen:`,
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

function begrenze(limit: number | undefined, standard: number): number {
  return Math.min(Math.max(limit ?? standard, 1), 50);
}

// ----------------------------------------------------------------------------
// PURE HELFER (deterministisch, unit-getestet in tests/os-kern.test.ts)
// ----------------------------------------------------------------------------

/** DB-Wahrheit (CHECK-Allowlist 0022/0023) — 'gesehen' heißt in der UI „kontaktiert". */
export const ANFRAGE_STATUS_WERTE = ["neu", "gesehen", "erledigt"] as const;
export type AnfrageStatus = (typeof ANFRAGE_STATUS_WERTE)[number];
export const anfrageStatusSchema = z.enum(ANFRAGE_STATUS_WERTE);

/** Anzeige-Labels des Anfrage-/Bewerbungs-Status (Tab-Kontrakt: gesehen=„kontaktiert"). */
export const ANFRAGE_STATUS_LABEL: Record<AnfrageStatus, string> = {
  neu: "neu",
  gesehen: "kontaktiert",
  erledigt: "erledigt",
};

export const ANMELDUNG_STATUS_WERTE = ["pending", "active", "cancelled", "completed"] as const;
export type AnmeldungStatus = (typeof ANMELDUNG_STATUS_WERTE)[number];
export const anmeldungStatusSchema = z.enum(ANMELDUNG_STATUS_WERTE);

export const ANMELDUNG_STATUS_LABEL: Record<AnmeldungStatus, string> = {
  pending: "offen",
  active: "aktiv",
  cancelled: "beendet",
  completed: "abgeschlossen",
};

export const ZEITRAUM_LABEL: Record<string, string> = {
  sofort: "sofort startklar",
  in_1_3_monaten: "Start in 1–3 Monaten",
  spaeter: "Start später",
};

/** Bewerber-Status (0025) — 'quereinsteiger' wird NIE gelabelt, sondern neutralisiert. */
export const BEWERBER_STATUS_LABEL: Record<string, string> = {
  fahrlehrer: "Fahrlehrer:in",
  anwaerter: "Fahrlehrer-Anwärter:in",
  unbekannt: "ohne Angabe",
};

/** Verfügbarkeits-Label einer Bewerbung ('zum_datum' trägt das Datum bereits formatiert). */
export function verfuegbarLabel(
  status: string | null,
  abFormatiert: string | null,
): string | null {
  if (status === "sofort") return "sofort verfügbar";
  if (status === "flexibel") return "flexibel";
  if (status === "zum_datum") return abFormatiert ? `verfügbar ab ${abFormatiert}` : "nach Absprache";
  return null;
}

/** Exakte Insights-Formulierung der 48-h-Regel (modules/insights) — wiederverwendet. */
export function aelter48hText(anzahl: number): string {
  return anzahl === 1
    ? "1 Anfrage ist älter als 48 h und unbeantwortet"
    : `${anzahl} Anfragen sind älter als 48 h und unbeantwortet`;
}

/**
 * Der Anmelde-Funnel hängt die Wunsch-Rückrufzeit strukturiert an die Nachricht
 * an (modules/leads/actions.ts: "…\n\nRückruf: vormittags") — hier wird sie für
 * die Anzeige wieder abgetrennt (keine Schema-Änderung nötig, Welle-1-Verbot).
 */
export function trenneRueckruf(nachricht: string | null): {
  text: string | null;
  rueckruf: string | null;
} {
  if (!nachricht) return { text: null, rueckruf: null };
  const treffer = nachricht.match(/(?:^|\n)Rückruf: ([^\n]+)\s*$/);
  if (!treffer || treffer.index === undefined) return { text: nachricht, rueckruf: null };
  const text = nachricht.slice(0, treffer.index).trim();
  return { text: text.length > 0 ? text : null, rueckruf: treffer[1].trim() };
}

// --- Cursor (Keyset created_at DESC, id DESC) --------------------------------

/** created_at::text aus Postgres (z. B. "2026-07-03 09:15:02.123456+00"). */
const cursorTsSchema = z
  .string()
  .min(10)
  .max(64)
  .regex(/^[0-9][0-9 :.+\-T]*$/);

const cursorSchema = z.object({ ts: cursorTsSchema, id: z.string().uuid() });
export type SeitenCursor = z.infer<typeof cursorSchema>;

export function cursorKodieren(ts: string, id: string): string {
  return Buffer.from(`${ts}\n${id}`, "utf8").toString("base64url");
}

/** Fail-closed: jede Abweichung (Format, UUID, Zeichenvorrat) → null = Seite 1. */
export function cursorDekodieren(raw: unknown): SeitenCursor | null {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 200) return null;
  let entpackt: string;
  try {
    entpackt = Buffer.from(raw, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const teile = entpackt.split("\n");
  if (teile.length !== 2) return null;
  const parsed = cursorSchema.safeParse({ ts: teile[0], id: teile[1] });
  return parsed.success ? parsed.data : null;
}

/** Baut Listen-Seite + naechsterCursor aus einem limit+1-Fetch (pure). */
export function schneideSeite<T extends { cursorTs: string; id: string }>(
  zeilen: T[],
  limit: number,
): { seite: T[]; naechsterCursor: string | null } {
  if (zeilen.length <= limit) return { seite: zeilen, naechsterCursor: null };
  const seite = zeilen.slice(0, limit);
  const letzte = seite[seite.length - 1];
  return { seite, naechsterCursor: cursorKodieren(letzte.cursorTs, letzte.id) };
}

// ----------------------------------------------------------------------------
// ANFRAGEN (leads) — RLS: Schul-Manager der Ziel-Schule + admin (0022)
// ----------------------------------------------------------------------------

const anfrageZeileSchema = z.object({
  id: z.string().uuid(),
  vorname: z.string(),
  nachname: z.string().nullable(),
  email: z.string().nullable(),
  telefon: z.string().nullable(),
  klasse: z.string(),
  zeitraum: z.enum(["sofort", "in_1_3_monaten", "spaeter"]),
  status: anfrageStatusSchema,
  nachricht: z.string().nullable(),
  wunsch_fahrlehrer: z.string().nullable(),
  ist_minderjaehrig: z.boolean(),
  guardian_name: z.string().nullable(),
  guardian_email: z.string().nullable(),
  guardian_telefon: z.string().nullable(),
  alter_stunden: z.coerce.number().int().min(0),
  eingegangen: z.string(),
  cursor_ts: z.string(),
});

export interface AnfrageEintrag {
  id: string;
  name: string;
  email: string | null;
  telefon: string | null;
  klasse: string;
  zeitraum: string;
  status: AnfrageStatus;
  /** Freitext OHNE die strukturierte Rückruf-Zeile. */
  nachricht: string | null;
  /** Wunsch-Rückrufzeit aus der Nachricht (z. B. „vormittags"), sonst null. */
  rueckruf: string | null;
  wunschFahrlehrer: string | null;
  istMinderjaehrig: boolean;
  guardian: { name: string; email: string | null; telefon: string | null } | null;
  alterStunden: number;
  eingegangen: string;
  cursorTs: string;
}

export interface AnfragenZaehler {
  neu: number;
  kontaktiert: number;
  erledigt: number;
  /** Risiko-Kennzahl (Insights-48-h-Regel): neue Anfragen älter als 48 h. */
  neuAelter48h: number;
}

export interface AnfragenListe {
  zaehler: AnfragenZaehler;
  eintraege: AnfrageEintrag[];
  naechsterCursor: string | null;
}

export async function getAnfragenListe(
  schoolId: string,
  options: { status?: AnfrageStatus; limit?: number; cursor?: SeitenCursor | null } = {},
): Promise<AnfragenListe | null> {
  const limit = begrenze(options.limit, 20);
  const status = options.status ?? null;
  const cursor = options.cursor ?? null;
  return failSoft("anfragen-liste", async () =>
    withCurrentUserContext(async (tx) => {
      const zaehler = (await tx.execute(sql`
        select
          count(*) filter (where status = 'neu')::int as neu,
          count(*) filter (where status = 'gesehen')::int as kontaktiert,
          count(*) filter (where status = 'erledigt')::int as erledigt,
          count(*) filter (where status = 'neu'
                             and created_at < now() - interval '48 hours')::int as neu_alt
          from public.leads
         where school_id = ${schoolId}
      `)) as unknown as Rows;

      const statusFilter = status ? sql` and status = ${status}` : sql``;
      const cursorFilter = cursor
        ? sql` and (created_at, id) < (${cursor.ts}::timestamptz, ${cursor.id}::uuid)`
        : sql``;
      const zeilen = (await tx.execute(sql`
        select id, vorname, nachname, email, telefon, klasse, zeitraum, status,
               nachricht, wunsch_fahrlehrer, ist_minderjaehrig,
               guardian_name, guardian_email, guardian_telefon,
               floor(extract(epoch from now() - created_at) / 3600)::int as alter_stunden,
               to_char(created_at at time zone 'Europe/Berlin', 'DD.MM.YYYY') as eingegangen,
               created_at::text as cursor_ts
          from public.leads
         where school_id = ${schoolId}${statusFilter}${cursorFilter}
         order by created_at desc, id desc
         limit ${limit + 1}
      `)) as unknown as Rows;

      const eintraege: AnfrageEintrag[] = zeilen.map((roh) => {
        const zeile = anfrageZeileSchema.parse(roh);
        const { text, rueckruf } = trenneRueckruf(zeile.nachricht);
        return {
          id: zeile.id,
          name: [zeile.vorname, zeile.nachname].filter(Boolean).join(" "),
          email: zeile.email,
          telefon: zeile.telefon,
          klasse: zeile.klasse,
          zeitraum: ZEITRAUM_LABEL[zeile.zeitraum] ?? zeile.zeitraum,
          status: zeile.status,
          nachricht: text,
          rueckruf,
          wunschFahrlehrer: zeile.wunsch_fahrlehrer,
          istMinderjaehrig: zeile.ist_minderjaehrig,
          guardian:
            zeile.ist_minderjaehrig && zeile.guardian_name
              ? {
                  name: zeile.guardian_name,
                  email: zeile.guardian_email,
                  telefon: zeile.guardian_telefon,
                }
              : null,
          alterStunden: zeile.alter_stunden,
          eingegangen: zeile.eingegangen,
          cursorTs: zeile.cursor_ts,
        };
      });
      const { seite, naechsterCursor } = schneideSeite(eintraege, limit);
      return {
        zaehler: {
          neu: leseZahl(zaehler, "neu"),
          kontaktiert: leseZahl(zaehler, "kontaktiert"),
          erledigt: leseZahl(zaehler, "erledigt"),
          neuAelter48h: leseZahl(zaehler, "neu_alt"),
        },
        eintraege: seite,
        naechsterCursor,
      };
    }),
  );
}

/**
 * Status-Wechsel einer Anfrage. SCHUL-BINDUNG doppelt: die Server Action reicht
 * NUR die aktive Schule der geprüften Identität herein, und das UPDATE bindet
 * `school_id` zusätzlich im WHERE (RLS bleibt letzte Linie; Spalten-Grant der
 * DB erlaubt app_user ohnehin nur `status`, 0022). true = genau 1 Zeile.
 */
export async function anfrageStatusSetzen(
  schoolId: string,
  leadId: string,
  status: AnfrageStatus,
): Promise<boolean> {
  const geprueft = z
    .object({ schoolId: z.string().uuid(), leadId: z.string().uuid(), status: anfrageStatusSchema })
    .safeParse({ schoolId, leadId, status });
  if (!geprueft.success) return false;
  const ergebnis = await failSoft("anfrage-status", async () =>
    withCurrentUserContext(async (tx) => {
      const rows = (await tx.execute(sql`
        update public.leads
           set status = ${geprueft.data.status}
         where id = ${geprueft.data.leadId}
           and school_id = ${geprueft.data.schoolId}
        returning id
      `)) as unknown as Rows;
      return rows.length === 1;
    }),
  );
  return ergebnis === true;
}

// ----------------------------------------------------------------------------
// BEWERBUNGEN (job_applications) — RLS: Schul-Manager via school_jobs + admin
// ----------------------------------------------------------------------------

const bewerbungZeileSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().nullable(),
  telefon: z.string().nullable(),
  nachricht: z.string().nullable(),
  bewerber_status: z.enum(["fahrlehrer", "anwaerter", "quereinsteiger", "unbekannt"]),
  klassen_csv: z.string().nullable(),
  verfuegbar_status: z.string().nullable(),
  verfuegbar_ab: z.string().nullable(),
  cv_dateiname: z.string().nullable(),
  job_titel: z.string(),
  status: anfrageStatusSchema,
  alter_stunden: z.coerce.number().int().min(0),
  eingegangen: z.string(),
  cursor_ts: z.string(),
});
type BewerbungZeile = z.infer<typeof bewerbungZeileSchema>;

export interface BewerbungEintrag {
  id: string;
  /** null bei Vermittlung (Neutralisierung — s. Modulkopf). */
  name: string | null;
  email: string | null;
  telefon: string | null;
  nachricht: string | null;
  cvDateiname: string | null;
  /** true = Quereinsteiger:in, läuft „über onelane vermittelt" (ohne Kontakte). */
  vermittelt: boolean;
  bewerberStatus: string | null;
  klassen: string[];
  verfuegbar: string | null;
  jobTitel: string;
  status: AnfrageStatus;
  alterStunden: number;
  eingegangen: string;
  cursorTs: string;
}

/**
 * NEUTRALISIERUNG (pure, getestet): Quereinsteiger-Bewerbungen laufen über die
 * onelane-Vermittlung (modules/jobs/actions.ts) — die Schule sieht die Zeile
 * nur als „über onelane vermittelt": KEIN Name, KEINE Kontaktdaten, KEINE
 * Nachricht, KEINE Unterlagen-Infos.
 */
export function neutralisiereVermittlung(zeile: BewerbungZeile): BewerbungEintrag {
  const vermittelt = zeile.bewerber_status === "quereinsteiger";
  return {
    id: zeile.id,
    name: vermittelt ? null : zeile.name,
    email: vermittelt ? null : zeile.email,
    telefon: vermittelt ? null : zeile.telefon,
    nachricht: vermittelt ? null : zeile.nachricht,
    cvDateiname: vermittelt ? null : zeile.cv_dateiname,
    vermittelt,
    bewerberStatus: vermittelt ? null : (BEWERBER_STATUS_LABEL[zeile.bewerber_status] ?? null),
    klassen: zeile.klassen_csv ? zeile.klassen_csv.split(",").filter(Boolean) : [],
    verfuegbar: verfuegbarLabel(zeile.verfuegbar_status, zeile.verfuegbar_ab),
    jobTitel: zeile.job_titel,
    status: zeile.status,
    alterStunden: zeile.alter_stunden,
    eingegangen: zeile.eingegangen,
    cursorTs: zeile.cursor_ts,
  };
}

export interface BewerbungenZaehler {
  neu: number;
  kontaktiert: number;
  erledigt: number;
  /** Anzahl neutralisierter Vermittlungs-Zeilen (Info-Chip). */
  vermittelt: number;
}

export interface BewerbungenListe {
  zaehler: BewerbungenZaehler;
  eintraege: BewerbungEintrag[];
  naechsterCursor: string | null;
}

export async function getBewerbungenListe(
  schoolId: string,
  options: { status?: AnfrageStatus; limit?: number; cursor?: SeitenCursor | null } = {},
): Promise<BewerbungenListe | null> {
  const limit = begrenze(options.limit, 20);
  const status = options.status ?? null;
  const cursor = options.cursor ?? null;
  return failSoft("bewerbungen-liste", async () =>
    withCurrentUserContext(async (tx) => {
      const zaehler = (await tx.execute(sql`
        select
          count(*) filter (where b.status = 'neu')::int as neu,
          count(*) filter (where b.status = 'gesehen')::int as kontaktiert,
          count(*) filter (where b.status = 'erledigt')::int as erledigt,
          count(*) filter (where b.bewerber_status = 'quereinsteiger')::int as vermittelt
          from public.job_applications b
          join public.school_jobs j on j.id = b.job_id
         where j.school_id = ${schoolId}
      `)) as unknown as Rows;

      const statusFilter = status ? sql` and b.status = ${status}` : sql``;
      const cursorFilter = cursor
        ? sql` and (b.created_at, b.id) < (${cursor.ts}::timestamptz, ${cursor.id}::uuid)`
        : sql``;
      const zeilen = (await tx.execute(sql`
        select b.id, b.name, b.email, b.telefon, b.nachricht, b.bewerber_status,
               array_to_string(b.klassen, ',') as klassen_csv,
               b.verfuegbar_status,
               to_char(b.verfuegbar_ab, 'DD.MM.YYYY') as verfuegbar_ab,
               b.cv_dateiname,
               j.titel as job_titel, b.status,
               floor(extract(epoch from now() - b.created_at) / 3600)::int as alter_stunden,
               to_char(b.created_at at time zone 'Europe/Berlin', 'DD.MM.YYYY') as eingegangen,
               b.created_at::text as cursor_ts
          from public.job_applications b
          join public.school_jobs j on j.id = b.job_id
         where j.school_id = ${schoolId}${statusFilter}${cursorFilter}
         order by b.created_at desc, b.id desc
         limit ${limit + 1}
      `)) as unknown as Rows;

      const eintraege = zeilen.map((roh) => neutralisiereVermittlung(bewerbungZeileSchema.parse(roh)));
      const { seite, naechsterCursor } = schneideSeite(eintraege, limit);
      return {
        zaehler: {
          neu: leseZahl(zaehler, "neu"),
          kontaktiert: leseZahl(zaehler, "kontaktiert"),
          erledigt: leseZahl(zaehler, "erledigt"),
          vermittelt: leseZahl(zaehler, "vermittelt"),
        },
        eintraege: seite,
        naechsterCursor,
      };
    }),
  );
}

/**
 * Status-Wechsel einer Bewerbung (UPDATE-Grant `status` seit 0023, in 0025
 * bestätigt). Schul-Bindung über school_jobs im WHERE; Vermittlungs-Zeilen
 * (Quereinsteiger) sind vom Status-Wechsel ausgenommen — der Prozess läuft
 * über onelane, die Schule pflegt dort nichts. true = genau 1 Zeile.
 */
export async function bewerbungStatusSetzen(
  schoolId: string,
  bewerbungId: string,
  status: AnfrageStatus,
): Promise<boolean> {
  const geprueft = z
    .object({
      schoolId: z.string().uuid(),
      bewerbungId: z.string().uuid(),
      status: anfrageStatusSchema,
    })
    .safeParse({ schoolId, bewerbungId, status });
  if (!geprueft.success) return false;
  const ergebnis = await failSoft("bewerbung-status", async () =>
    withCurrentUserContext(async (tx) => {
      const rows = (await tx.execute(sql`
        update public.job_applications
           set status = ${geprueft.data.status}
         where id = ${geprueft.data.bewerbungId}
           and bewerber_status <> 'quereinsteiger'
           and job_id in (select j.id from public.school_jobs j
                           where j.school_id = ${geprueft.data.schoolId})
        returning id
      `)) as unknown as Rows;
      return rows.length === 1;
    }),
  );
  return ergebnis === true;
}

// ----------------------------------------------------------------------------
// SCHÜLER (enrollments) — RLS: alle drei Schul-Rollen lesen die eigene Schule
// (0029, Gründer-Entscheid Quer-Routing); bewusst OHNE Namen (Modulkopf).
// ----------------------------------------------------------------------------

/** Führerscheinklasse als Filterwert — Spiegel des DB-CHECKs (0022-Form). */
export const KLASSE_FILTER_REGEX = /^[A-Z][A-Z0-9]{0,5}$/;

const terminHistorieSchema = z.array(
  z.object({
    typ: z.enum(["fahrstunde", "theorie", "fragenkatalog", "pruefung"]),
    status: z.enum(["booked", "cancelled", "completed"]),
    tag: z.string(),
    von: z.string(),
    fahrlehrer_name: z.string().nullable(),
  }),
);
export type TerminHistorieEintrag = z.infer<typeof terminHistorieSchema>[number];

const schuelerZeileSchema = z.object({
  id: z.string().uuid(),
  name: z.string().nullable(),
  klasse: z.string().nullable(),
  status: anmeldungStatusSchema,
  seit_tagen: z.coerce.number().int().min(0),
  fahrstunden_absolviert: z.coerce.number().int().min(0),
  termine_gesamt: z.coerce.number().int().min(0),
  historie: terminHistorieSchema,
  cursor_ts: z.string(),
});

export interface SchuelerEintrag {
  id: string;
  /** Vor-/Nachname via app.schueler_namen (0031) — null ohne aktives Enrollment. */
  name: string | null;
  /** Kurzform der Anmeldungs-ID (Fallback-Anzeige ohne Namen + stabile Referenz). */
  idKurz: string;
  klasse: string | null;
  status: AnmeldungStatus;
  seitTagen: number;
  fahrstundenAbsolviert: number;
  termineGesamt: number;
  /** Kompakte Termin-Historie (neueste zuerst, max. 5). */
  historie: TerminHistorieEintrag[];
  cursorTs: string;
}

export interface SchuelerListe {
  anzahlGesamt: number;
  anzahlAktiv: number;
  /** Distinct-Klassen der Schule für die Filterleiste. */
  klassen: string[];
  eintraege: SchuelerEintrag[];
  naechsterCursor: string | null;
}

export async function getSchuelerListe(
  schoolId: string,
  options: {
    status?: AnmeldungStatus;
    klasse?: string;
    limit?: number;
    cursor?: SeitenCursor | null;
  } = {},
): Promise<SchuelerListe | null> {
  const limit = begrenze(options.limit, 20);
  const status = options.status ?? null;
  // Klasse fail-closed validieren (kommt aus Query-Params): ungültig → kein Filter.
  const klasse =
    options.klasse && KLASSE_FILTER_REGEX.test(options.klasse) ? options.klasse : null;
  const cursor = options.cursor ?? null;
  return failSoft("schueler-liste", async () =>
    withCurrentUserContext(async (tx) => {
      const zaehler = (await tx.execute(sql`
        select count(*)::int as gesamt,
               count(*) filter (where status = 'active')::int as aktiv
          from public.enrollments
         where school_id = ${schoolId}
      `)) as unknown as Rows;
      const klassenRows = (await tx.execute(sql`
        select distinct fuehrerscheinklasse as klasse
          from public.enrollments
         where school_id = ${schoolId} and fuehrerscheinklasse is not null
         order by 1
         limit 30
      `)) as unknown as Rows;

      const statusFilter = status ? sql` and e.status = ${status}` : sql``;
      const klasseFilter = klasse ? sql` and e.fuehrerscheinklasse = ${klasse}` : sql``;
      const cursorFilter = cursor
        ? sql` and (e.created_at, e.id) < (${cursor.ts}::timestamptz, ${cursor.id}::uuid)`
        : sql``;
      const zeilen = (await tx.execute(sql`
        select e.id,
               nullif(trim(coalesce(n.vorname, '') || ' ' || coalesce(n.nachname, '')), '') as name,
               e.fuehrerscheinklasse as klasse, e.status,
               floor(extract(epoch from now() - e.created_at) / 86400)::int as seit_tagen,
               (select count(*)::int from public.appointments a
                 where a.enrollment_id = e.id
                   and a.typ = 'fahrstunde' and a.status = 'completed') as fahrstunden_absolviert,
               (select count(*)::int from public.appointments a
                 where a.enrollment_id = e.id and a.status <> 'cancelled') as termine_gesamt,
               coalesce((
                 select jsonb_agg(t)
                   from (
                     select a.typ, a.status,
                            to_char(a.start at time zone 'Europe/Berlin', 'DD.MM.YY') as tag,
                            to_char(a.start at time zone 'Europe/Berlin', 'HH24:MI') as von,
                            i.name as fahrlehrer_name
                       from public.appointments a
                       left join public.instructors i on i.id = a.instructor_id
                      where a.enrollment_id = e.id
                      order by a.start desc
                      limit 5
                   ) t
               ), '[]'::jsonb) as historie,
               e.created_at::text as cursor_ts
          from public.enrollments e
          -- Namens-Lesepfad 0031: liefert NUR bei Mitgliedschaft + aktivem
          -- Enrollment Zeilen — sonst bleibt name null (ID-Kurzform-Fallback).
          left join app.schueler_namen(${schoolId}) n
            on n.student_user_id = e.student_user_id
         where e.school_id = ${schoolId}${statusFilter}${klasseFilter}${cursorFilter}
         order by e.created_at desc, e.id desc
         limit ${limit + 1}
      `)) as unknown as Rows;

      const eintraege: SchuelerEintrag[] = zeilen.map((roh) => {
        const zeile = schuelerZeileSchema.parse(roh);
        return {
          id: zeile.id,
          name: zeile.name,
          idKurz: zeile.id.slice(0, 8).toUpperCase(),
          klasse: zeile.klasse,
          status: zeile.status,
          seitTagen: zeile.seit_tagen,
          fahrstundenAbsolviert: zeile.fahrstunden_absolviert,
          termineGesamt: zeile.termine_gesamt,
          historie: zeile.historie,
          cursorTs: zeile.cursor_ts,
        };
      });
      const { seite, naechsterCursor } = schneideSeite(eintraege, limit);
      return {
        anzahlGesamt: leseZahl(zaehler, "gesamt"),
        anzahlAktiv: leseZahl(zaehler, "aktiv"),
        klassen: klassenRows
          .map((r) => String(r.klasse ?? ""))
          .filter((k) => KLASSE_FILTER_REGEX.test(k)),
        eintraege: seite,
        naechsterCursor,
      };
    }),
  );
}
