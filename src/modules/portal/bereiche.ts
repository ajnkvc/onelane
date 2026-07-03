import "server-only";

import { sql } from "drizzle-orm";
import { z } from "zod";
import { withCurrentUserContext } from "@/server/dal";
import type { RatgeberGuide } from "@/lib/ratgeber";

/**
 * modules/portal/bereiche.ts — Datenquellen der Bereichs-Module (OS-P3, Paket D):
 * Schüler-Vollausbau (/app/mein-bereich/*), Redaktions-Briefings, Vertriebs-
 * Cockpit und interne Kennzahlen. EINZIGER Datenpfad dieser Seiten.
 * ============================================================================
 * REGELN (identisch zu modules/portal/dashboard.ts, dort begründet):
 *  - JEDE Query läuft über withCurrentUserContext → RLS ist die Wahrheit.
 *    Schüler-Queries filtern NICHT nach school_id — RLS liefert ausschließlich
 *    die EIGENEN Enrollments/Termine; Zähl-Queries (Vertrieb/intern) laufen
 *    über die anon-lesbaren Pfade (driving_schools is_listed / school_profiles
 *    gelisteter Schulen).
 *  - FAIL-SOFT je Karte: Fehler → null (bzw. false beim Flag), die UI rendert
 *    einen ehrlichen „gerade nicht verfügbar"-Zustand.
 *  - LISTEN >20 sind cursor-paginiert ({ limit, cursor }, Keyset über
 *    (start, id)); Cursor sind versionierte, validierte Strings — ungültige
 *    Cursor fallen still auf die erste Seite zurück (reine Lese-Ansicht).
 *  - ZEIT: Grenzen und Anzeigewerte werden IN SQL in Europe/Berlin berechnet.
 *  - DATENSCHUTZ: Rückgaben sind zod-validiert und minimal; Schüler sehen nur
 *    eigene Daten (RLS), Briefings sind vollständig PII-frei (deterministische
 *    Ableitung aus der Ratgeber-Registry — Prinzip des Insights-Mocks: ohne
 *    Netz, ohne Namen, ohne Freitexte von Dritten).
 */

/** Fail-Soft-Gerüst (Muster dashboard.ts): Fehler loggen (ohne Daten) → null. */
async function failSoft<T>(name: string, work: () => Promise<T>): Promise<T | null> {
  try {
    return await work();
  } catch (fehler) {
    console.error(
      `[portal-bereiche] ${name} fehlgeschlagen:`,
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

// ----------------------------------------------------------------------------
// Termin-Cursor (Keyset über (start, id)) — pure Helfer, für Tests exportiert.
// Format `v1.<epoch_ms>.<uuid>` — nur exakt dieses Format ist gültig;
// alles andere (Manipulation, Fremdformat) fällt still auf Seite 1 zurück.
// ----------------------------------------------------------------------------

const CURSOR_VERSION = "v1";
const CURSOR_REGEX =
  /^v1\.(\d{1,15})\.([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;

export interface TerminCursor {
  /** Epoch-Millisekunden des `start`-Zeitpunkts der letzten gesehenen Zeile. */
  startMs: number;
  id: string;
}

export function baueTerminCursor(startMs: number, id: string): string {
  return `${CURSOR_VERSION}.${Math.floor(startMs)}.${id}`;
}

/** null bei jedem Format-/Wertefehler (fail-soft: Liste beginnt dann vorn). */
export function parseTerminCursor(wert: string | null | undefined): TerminCursor | null {
  if (!wert) return null;
  const match = CURSOR_REGEX.exec(wert);
  if (!match) return null;
  const startMs = Number(match[1]);
  if (!Number.isSafeInteger(startMs) || startMs <= 0) return null;
  return { startMs, id: match[2] };
}

// ----------------------------------------------------------------------------
// „Deine Termine" — Schüler: kommende + vergangene EIGENE Termine (RLS).
// Storno-Frist ist REINE INFORMATION (keine Aktion in Welle 1): bis zur Frist
// ist eine Absage bei der Fahrschule kostenfrei möglich.
// ----------------------------------------------------------------------------

const schuelerTerminSchema = z.object({
  id: z.string().uuid(),
  typ: z.enum(["fahrstunde", "theorie", "fragenkatalog", "pruefung"]),
  status: z.enum(["booked", "cancelled", "completed"]),
  /** 'heute' | 'morgen' | 'DD.MM.YYYY' (Berlin). */
  tag: z.string(),
  von: z.string(),
  bis: z.string().nullable(),
  fahrlehrer_name: z.string().nullable(),
  /** 'DD.MM., HH:MM' (Berlin) oder null, wenn keine Frist hinterlegt ist. */
  storno_frist: z.string().nullable(),
  /** true = Frist liegt noch in der Zukunft (kostenfreie Absage möglich). */
  storno_offen: z.boolean(),
});
export type SchuelerTermin = z.infer<typeof schuelerTerminSchema>;

export interface MeineTermine {
  kommende: SchuelerTermin[];
  vergangene: SchuelerTermin[];
  /** Cursor für die nächste Seite der VERGANGENEN Termine; null = Ende. */
  naechsterCursor: string | null;
}

const TERMIN_FELDER = sql`
  a.id, a.typ, a.status,
  case
    when (a.start at time zone 'Europe/Berlin')::date
         = (now() at time zone 'Europe/Berlin')::date then 'heute'
    when (a.start at time zone 'Europe/Berlin')::date
         = (now() at time zone 'Europe/Berlin')::date + 1 then 'morgen'
    else to_char(a.start at time zone 'Europe/Berlin', 'DD.MM.YYYY')
  end as tag,
  to_char(a.start at time zone 'Europe/Berlin', 'HH24:MI') as von,
  to_char(a.ende at time zone 'Europe/Berlin', 'HH24:MI') as bis,
  i.name as fahrlehrer_name,
  to_char(a.storno_frist_bis at time zone 'Europe/Berlin', 'DD.MM., HH24:MI') as storno_frist,
  (a.storno_frist_bis is not null and a.storno_frist_bis > now()) as storno_offen
`;

/**
 * Eigene Termine des Schülers: kommende (geplant, chronologisch) und vergangene
 * (neueste zuerst, cursor-paginiert). RLS liefert ausschließlich eigene Zeilen.
 */
export async function getMeineTermine(
  options: { limitKommend?: number; limit?: number; cursor?: string | null } = {},
): Promise<MeineTermine | null> {
  const limitKommend = Math.min(Math.max(options.limitKommend ?? 20, 1), 50);
  const limit = Math.min(Math.max(options.limit ?? 10, 1), 50);
  const cursor = parseTerminCursor(options.cursor);

  return failSoft("meine-termine", async () =>
    withCurrentUserContext(async (tx) => {
      const kommende = (await tx.execute(sql`
        select ${TERMIN_FELDER}
          from public.appointments a
          left join public.instructors i on i.id = a.instructor_id
         where a.status = 'booked' and a.start >= now()
         order by a.start asc, a.id asc
         limit ${limitKommend}
      `)) as unknown as Rows;

      // Vergangen/abgesagt = liegt zeitlich hinter uns ODER ist nicht mehr
      // geplant (abgesagt/absolviert) — das exakte Komplement zu „kommend".
      const vergangenWo = sql`(a.start < now() or a.status <> 'booked')`;
      const keyset = cursor
        ? sql` and (a.start, a.id) < (to_timestamp(${cursor.startMs / 1000}), ${cursor.id}::uuid)`
        : sql``;
      const vergangene = (await tx.execute(sql`
        select ${TERMIN_FELDER},
               (extract(epoch from a.start) * 1000)::bigint as start_ms
          from public.appointments a
          left join public.instructors i on i.id = a.instructor_id
         where ${vergangenWo}${keyset}
         order by a.start desc, a.id desc
         limit ${limit + 1}
      `)) as unknown as Rows;

      const seite = vergangene.slice(0, limit);
      const letzte = seite[seite.length - 1];
      const naechsterCursor =
        vergangene.length > limit && letzte
          ? baueTerminCursor(
              countSchema.parse(letzte.start_ms),
              z.string().uuid().parse(letzte.id),
            )
          : null;

      return {
        kommende: kommende.map((r) => schuelerTerminSchema.parse(r)),
        vergangene: seite.map((r) => schuelerTerminSchema.parse(r)),
        naechsterCursor,
      };
    }),
  );
}

// ----------------------------------------------------------------------------
// „Dein Fortschritt" — Schüler: absolvierte Einheiten je Termin-Typ (RLS).
// ----------------------------------------------------------------------------

/** Feste Anzeige-Reihenfolge der Typen (pure Konstante, für Tests exportiert). */
export const FORTSCHRITT_TYPEN = [
  "fahrstunde",
  "theorie",
  "pruefung",
  "fragenkatalog",
] as const;
export type FortschrittTyp = (typeof FORTSCHRITT_TYPEN)[number];

export interface FortschrittJeTyp {
  typ: FortschrittTyp;
  absolviert: number;
}

export interface MeinFortschritt {
  jeTyp: FortschrittJeTyp[];
  absolviertGesamt: number;
  /** Kommende geplante Termine (Motivation: „so geht es weiter"). */
  geplant: number;
}

/**
 * Pure Normalisierung (für Tests exportiert): beliebige Zähl-Zeilen → alle
 * Typen in fester Reihenfolge, fehlende = 0, fremde Typen/negative Werte
 * werden verworfen.
 */
export function normalisiereFortschritt(
  rows: Array<{ typ?: unknown; anzahl?: unknown }>,
): FortschrittJeTyp[] {
  const werte = new Map<string, number>();
  for (const row of rows) {
    const parsed = countSchema.safeParse(row.anzahl);
    if (typeof row.typ === "string" && parsed.success) werte.set(row.typ, parsed.data);
  }
  return FORTSCHRITT_TYPEN.map((typ) => ({ typ, absolviert: werte.get(typ) ?? 0 }));
}

export async function getMeinFortschritt(): Promise<MeinFortschritt | null> {
  return failSoft("mein-fortschritt", async () =>
    withCurrentUserContext(async (tx) => {
      const absolviert = (await tx.execute(sql`
        select typ, count(*)::int as anzahl
          from public.appointments
         where status = 'completed'
         group by typ
      `)) as unknown as Rows;
      const geplant = (await tx.execute(sql`
        select count(*)::int as anzahl
          from public.appointments
         where status = 'booked' and start >= now()
      `)) as unknown as Rows;
      const jeTyp = normalisiereFortschritt(
        absolviert as Array<{ typ?: unknown; anzahl?: unknown }>,
      );
      return {
        jeTyp,
        absolviertGesamt: jeTyp.reduce((summe, e) => summe + e.absolviert, 0),
        geplant: leseZahl(geplant, "anzahl"),
      };
    }),
  );
}

// ----------------------------------------------------------------------------
// Schulen-Kennzahlen — Vertrieb + intern/Moderation: echte Zählungen über die
// anon-lesbaren Pfade (RLS: is_listed-Schulen + Profile gelisteter Schulen).
// ----------------------------------------------------------------------------

export interface SchulenKennzahlen {
  gelistet: number;
  /** Gelistete Schulen, deren Preise von der Schule bestätigt wurden (0008). */
  mitBestaetigtenPreisen: number;
}

export async function getSchulenKennzahlen(): Promise<SchulenKennzahlen | null> {
  return failSoft("schulen-kennzahlen", async () =>
    withCurrentUserContext(async (tx) => {
      // GRANT-FALLE (verifiziert): app_user hat auf driving_schools nur
      // Spalten-Allowlists — `count(*)` (Ganz-Zeile) und die Spalte `is_listed`
      // sind NICHT lesbar. Deshalb: count(id) + Policy-Helfer
      // app.is_school_listed(id) (DEFINER, von den RLS-Policies genutzt) —
      // zählt auch für admin korrekt NUR die gelisteten Schulen (admin sieht
      // per RLS zusätzlich ungelistete Zeilen).
      const rows = (await tx.execute(sql`
        select
          count(distinct ds.id) filter (where app.is_school_listed(ds.id))::int
            as gelistet,
          count(distinct ds.id) filter (where app.is_school_listed(ds.id)
                                          and sp.preise_verifiziert = true)::int
            as preise_bestaetigt
          from public.driving_schools ds
          left join public.school_profiles sp on sp.school_id = ds.id
      `)) as unknown as Rows;
      return {
        gelistet: leseZahl(rows, "gelistet"),
        mitBestaetigtenPreisen: leseZahl(rows, "preise_bestaetigt"),
      };
    }),
  );
}

// ----------------------------------------------------------------------------
// Feature-Flag-Lesepfad (global) — fail-closed: JEDER Fehler/fehlende Zeile
// ergibt false. RLS: globale Flags liest jeder Eingeloggte; der aufrufende
// Bereich gated zusätzlich hart über die Rolle (Seiten-Gate).
// ----------------------------------------------------------------------------

export async function istFeatureFlagGlobalAktiv(key: string): Promise<boolean> {
  try {
    return await withCurrentUserContext(async (tx) => {
      const rows = (await tx.execute(sql`
        select aktiv from public.feature_flags
         where scope = 'global' and key = ${key}
         limit 1
      `)) as unknown as Rows;
      return rows[0]?.aktiv === true;
    });
  } catch (fehler) {
    console.error(
      "[portal-bereiche] feature-flag-lesen fehlgeschlagen:",
      fehler instanceof Error ? fehler.message : "unbekannter Fehler",
    );
    return false;
  }
}

// ----------------------------------------------------------------------------
// Redaktions-Briefings — DETERMINISTISCH + PII-FREI (Prinzip des Insights-
// Mocks: feste Templates, keine Netz-Calls, keine Personendaten). Abgeleitet
// wird ausschließlich aus der Ratgeber-Registry (Kategorien-Lücken).
// ----------------------------------------------------------------------------

export interface RedaktionsBriefing {
  schluessel: string;
  arbeitstitel: string;
  kategorie: string;
  /** Deterministische Begründung aus dem Registry-Stand (keine PII). */
  begruendung: string;
  /** Drei Gliederungs-Stichpunkte als Startpunkt für die Redaktion. */
  gliederung: [string, string, string];
}

/**
 * Feste Themen-Kandidaten (ehrlich, zahlenlos, § 32-FahrlG-verträglich: keine
 * Preis-/Quoten-Versprechen). Ein Kandidat gilt als offen, solange seine
 * Kategorie in der Registry nicht vertreten ist.
 */
const BRIEFING_KANDIDATEN: ReadonlyArray<Omit<RedaktionsBriefing, "begruendung">> = [
  {
    schluessel: "anmeldung-ablauf-unterlagen",
    arbeitstitel: "Anmeldung bei der Fahrschule: Ablauf und Unterlagen ohne Stress",
    kategorie: "Erste Schritte",
    gliederung: [
      "Was beim ersten Termin in der Fahrschule wirklich passiert",
      "Welche Unterlagen der Führerscheinantrag verlangt — und wo sie herkommen",
      "Typische Verzögerungen beim Amt und wie man sie früh vermeidet",
    ],
  },
  {
    schluessel: "sehtest-erste-hilfe-pflichttermine",
    arbeitstitel: "Sehtest, Erste-Hilfe-Kurs, Passbild: die Pflichttermine vor dem Antrag",
    kategorie: "Formalitäten",
    gliederung: [
      "Welche Nachweise Pflicht sind und wie lange sie gültig bleiben",
      "Wo Sehtest und Erste-Hilfe-Kurs angeboten werden",
      "In welcher Reihenfolge die Termine am wenigsten Zeit kosten",
    ],
  },
  {
    schluessel: "nervositaet-erste-fahrstunden",
    arbeitstitel: "Nervös vor der ersten Fahrstunde? So wird der Einstieg ruhig",
    kategorie: "Fahrpraxis",
    gliederung: [
      "Was in der ersten Fahrstunde tatsächlich geübt wird",
      "Warum Anspannung normal ist — und was dagegen hilft",
      "Wie man Wünsche und Tempo offen mit der Fahrlehrerin oder dem Fahrlehrer klärt",
    ],
  },
  {
    schluessel: "lernroutine-neben-schule-job",
    arbeitstitel: "Theorie lernen neben Schule oder Job: eine realistische Routine",
    kategorie: "Lernen",
    gliederung: [
      "Kurze, regelmäßige Einheiten statt Lern-Marathons",
      "Wie Theorieunterricht und eigenes Üben ineinandergreifen",
      "Woran man merkt, dass man bereit für die Prüfung ist",
    ],
  },
  {
    schluessel: "eltern-begleiten-fahrausbildung",
    arbeitstitel: "Für Eltern: die Fahrausbildung gut begleiten, ohne Druck zu machen",
    kategorie: "Familie",
    gliederung: [
      "Welche Rolle Eltern in der Ausbildung sinnvoll ausfüllen",
      "Worüber man mit der Fahrschule offen sprechen darf",
      "Wie Unterstützung aussieht, die wirklich hilft",
    ],
  },
  {
    schluessel: "mobilitaet-ohne-eigenes-auto",
    arbeitstitel: "Führerschein ohne eigenes Auto: warum sich die Ausbildung trotzdem lohnt",
    kategorie: "Alltag",
    gliederung: [
      "Fahrpraxis erhalten, wenn kein Auto vor der Tür steht",
      "Carsharing, Familienauto und Co. als Übungsfelder",
      "Wann eine Auffrischungsstunde sinnvoll ist",
    ],
  },
];

/**
 * Leitet deterministisch bis zu drei Briefing-Vorschläge aus der Registry ab:
 * Kandidaten, deren Kategorie noch nicht vertreten ist, in fester Reihenfolge.
 * Pure Funktion — identischer Registry-Stand ⇒ identisches Ergebnis (getestet).
 */
export function erzeugeRedaktionsBriefings(
  guides: ReadonlyArray<Pick<RatgeberGuide, "slug" | "kategorie">>,
  anzahl = 3,
): RedaktionsBriefing[] {
  const vorhandeneKategorien = new Set(guides.map((g) => g.kategorie));
  const vorhandeneSlugs = new Set(guides.map((g) => g.slug));
  return BRIEFING_KANDIDATEN.filter(
    (k) => !vorhandeneKategorien.has(k.kategorie) && !vorhandeneSlugs.has(k.schluessel),
  )
    .slice(0, Math.max(0, anzahl))
    .map((k) => ({
      ...k,
      begruendung: `Die Kategorie „${k.kategorie}" ist unter den ${guides.length} veröffentlichten Ratgebern bisher nicht vertreten.`,
    }));
}
