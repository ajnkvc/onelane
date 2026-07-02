import "server-only";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { withAnonContext } from "@/server/dal";
import { JOB_KLASSEN } from "./schema";

/**
 * queries.ts — öffentliche Lese-Queries der Jobbörse (M5).
 * ----------------------------------------------------------------------------
 * Läuft über den DAL (`withAnonContext` → RLS als `app_user`): anonym sind NUR
 * aktive Anzeigen gelisteter Schulen im Gültigkeitsfenster sichtbar — die DB
 * erzwingt das (Policy 0023/K8), nicht dieser Code. Die WHERE-Bedingungen
 * wiederholen das Fenster als Dokumentation/Defense-in-Depth.
 *
 * SORTIERUNG (offengelegt — deckungsgleich mit /so-sortieren-wir, Abschnitt
 * „Wie wir Stellenanzeigen sortieren"):
 *   1. Relevanz/Ort: die Filter (Was/Wo, Klassen, Beschäftigungsart,
 *      Quereinstieg) grenzen die Treffermenge ein — was nicht passt, erscheint
 *      gar nicht erst.
 *   2. Datenvollständigkeit (Score 0–5): bestätigte Gehaltsspanne +2 (nur eine
 *      komplette, von der Fahrschule bestätigte Spanne EXISTIERT überhaupt in
 *      der DB — Migration 0025, DB-harter CHECK), „geprüft am" gepflegt +1,
 *      Beschreibung vorhanden +1, Klassen gepflegt +1.
 *   3. Aktualität: zuletzt geprüft bzw. veröffentlicht zuerst.
 *   4. Stabiler Tiebreak: Kuratierungs-Position, dann Erstellungsdatum.
 *   ZAHLUNGEN BEEINFLUSSEN DAS RANKING NICHT — es gibt keinen bezahlten Platz
 *   und keinen Partner-Boost; der Gehalts-Bonus ist ein reiner
 *   Datenqualitätsfaktor und wird öffentlich genau so benannt.
 */

/** Beschäftigungsarten (Spiegel chk_school_jobs_beschaeftigungsart, 0023). */
export const BESCHAEFTIGUNGSARTEN = ["vollzeit", "teilzeit", "minijob", "nebenberuflich"] as const;

const emptyToUndef = (v: unknown) => (v === "" ? undefined : v);

/** Filter-Schema für /jobs (Query-Parameter; unbekannte Werte fallen weg). */
export const jobsFilterSchema = z.object({
  /** Freitext: Ort/PLZ/Stadtteil ODER Stichwort im Titel. */
  text: z.preprocess(emptyToUndef, z.string().trim().min(1).max(120).optional()),
  klasse: z.preprocess(emptyToUndef, z.enum(JOB_KLASSEN).optional()),
  beschaeftigungsart: z.preprocess(emptyToUndef, z.enum(BESCHAEFTIGUNGSARTEN).optional()),
  // Nur "1"/"true" aktivieren den Filter (kein coerce-Footgun, 0021-Linie).
  quereinsteiger: z.preprocess(
    (v) => (v === "1" || v === "true" || v === true ? true : undefined),
    z.boolean().optional(),
  ),
});
export type JobsFilter = z.infer<typeof jobsFilterSchema>;

/** Karten-/Detail-Daten einer Anzeige (nur öffentlich Zeig-bares; Kontakt NIE dabei). */
export interface JobListItem {
  id: string;
  slug: string;
  titel: string;
  beschreibung: string | null;
  art: "fahrlehrer" | "anwaerter";
  beschaeftigungsart: string | null;
  arbeitszeitModell: string | null;
  samstagDienst: boolean | null;
  klassen: string[];
  quereinsteigerWillkommen: boolean;
  quereinsteigerFinanzierung: "keine" | "anteilig" | "voll" | "nach_vereinbarung";
  /** Gehalt: entweder KOMPLETT bestätigt (DB-hart, 0025) oder alles null. */
  gehaltVonEuro: string | null;
  gehaltBisEuro: string | null;
  gehaltZeitraum: "monat" | "jahr" | "stunde" | null;
  gehaltBestaetigtAm: string | null;
  verguetungsmodell: string | null;
  tarifHinweis: string | null;
  /** Freitext-Vergütung aus 0023 (Alt-Feld; Anzeige nur, wo kein strukturiertes Gehalt). */
  verguetungText: string | null;
  geprueftAm: string | null;
  erstveroeffentlichtAm: string | null;
  gueltigBis: string | null;
  createdAt: string;
  schule: {
    name: string;
    slug: string;
    ort: string | null;
    stadtbezirk: string | null;
    plz: string | null;
    strasse: string | null;
    hausnummer: string | null;
  };
}

const SLUG_REGEX = /^[a-z0-9-]{1,200}$/;

/** Anzeige-Spalten (eine Quelle für list/detail — hält beide Pfade deckungsgleich). */
const JOB_SELECT = sql`
  j.id, j.slug, j.titel, j.beschreibung, j.art, j.beschaeftigungsart,
  j.arbeitszeit_modell, j.samstag_dienst, j.klassen,
  j.quereinsteiger_willkommen, j.quereinsteiger_finanzierung,
  j.gehalt_von_euro, j.gehalt_bis_euro, j.gehalt_zeitraum, j.gehalt_bestaetigt_am,
  j.verguetungsmodell, j.tarif_hinweis, j.verguetung_text,
  j.geprueft_am, j.erstveroeffentlicht_am, j.gueltig_bis, j.created_at, j.position,
  s.name as schul_name, s.slug as schul_slug, s.ort, s.stadtbezirk, s.plz,
  s.strasse, s.hausnummer`;

/** Öffentliches Gültigkeitsfenster (Spiegel der RLS-Policy — Defense-in-Depth). */
const FENSTER = sql`j.aktiv = true and (j.gueltig_bis is null or j.gueltig_bis >= current_date)`;

/** Datenvollständigkeits-Score — exakt wie im Docblock/auf /so-sortieren-wir benannt. */
const SCORE = sql`(
  (case when j.gehalt_bestaetigt_am is not null then 2 else 0 end)
  + (case when j.geprueft_am is not null then 1 else 0 end)
  + (case when j.beschreibung is not null then 1 else 0 end)
  + (case when coalesce(array_length(j.klassen, 1), 0) > 0 then 1 else 0 end)
)`;

function filterConds(f: JobsFilter) {
  const conds = [FENSTER];
  if (f.text) {
    const like = `%${f.text}%`;
    conds.push(
      sql`(s.ort ilike ${like} or s.stadtbezirk ilike ${like} or s.plz ilike ${like} or j.titel ilike ${like})`,
    );
  }
  if (f.klasse) conds.push(sql`j.klassen @> array[${f.klasse}]::text[]`);
  if (f.beschaeftigungsart) conds.push(sql`j.beschaeftigungsart = ${f.beschaeftigungsart}`);
  if (f.quereinsteiger) conds.push(sql`j.quereinsteiger_willkommen = true`);
  return sql.join(conds, sql` and `);
}

function mapRow(r: Record<string, unknown>): JobListItem {
  return {
    id: String(r.id),
    slug: String(r.slug),
    titel: String(r.titel),
    beschreibung: (r.beschreibung as string | null) ?? null,
    art: r.art === "anwaerter" ? "anwaerter" : "fahrlehrer",
    beschaeftigungsart: (r.beschaeftigungsart as string | null) ?? null,
    arbeitszeitModell: (r.arbeitszeit_modell as string | null) ?? null,
    samstagDienst: typeof r.samstag_dienst === "boolean" ? r.samstag_dienst : null,
    klassen: (r.klassen as string[] | null) ?? [],
    quereinsteigerWillkommen: r.quereinsteiger_willkommen === true,
    quereinsteigerFinanzierung:
      (r.quereinsteiger_finanzierung as JobListItem["quereinsteigerFinanzierung"]) ?? "keine",
    gehaltVonEuro: r.gehalt_von_euro != null ? String(r.gehalt_von_euro) : null,
    gehaltBisEuro: r.gehalt_bis_euro != null ? String(r.gehalt_bis_euro) : null,
    gehaltZeitraum: (r.gehalt_zeitraum as JobListItem["gehaltZeitraum"]) ?? null,
    gehaltBestaetigtAm: r.gehalt_bestaetigt_am != null ? String(r.gehalt_bestaetigt_am) : null,
    verguetungsmodell: (r.verguetungsmodell as string | null) ?? null,
    tarifHinweis: (r.tarif_hinweis as string | null) ?? null,
    verguetungText: (r.verguetung_text as string | null) ?? null,
    geprueftAm: r.geprueft_am != null ? String(r.geprueft_am) : null,
    erstveroeffentlichtAm:
      r.erstveroeffentlicht_am != null ? String(r.erstveroeffentlicht_am) : null,
    gueltigBis: r.gueltig_bis != null ? String(r.gueltig_bis) : null,
    createdAt: String(r.created_at),
    schule: {
      name: String(r.schul_name),
      slug: String(r.schul_slug),
      ort: (r.ort as string | null) ?? null,
      stadtbezirk: (r.stadtbezirk as string | null) ?? null,
      plz: (r.plz as string | null) ?? null,
      strasse: (r.strasse as string | null) ?? null,
      hausnummer: (r.hausnummer as string | null) ?? null,
    },
  };
}

/** Harte Listen-Obergrenze (Phase 1: kuratierter, kleiner Bestand — kein Paging). */
const LIST_LIMIT = 100;

/**
 * Listet öffentliche Stellenanzeigen (gefiltert, sortiert wie oben dokumentiert).
 * `raw` sind ungeprüfte Query-Parameter — Zod validiert an der Modul-Grenze.
 */
export async function listJobs(raw: unknown): Promise<JobListItem[]> {
  const f = jobsFilterSchema.parse(raw);
  return withAnonContext(async (tx) => {
    const rows = (await tx.execute(sql`
      select ${JOB_SELECT}, ${SCORE} as vollstaendigkeit
      from public.school_jobs j
      join public.driving_schools s on s.id = j.school_id
      where ${filterConds(f)}
      order by vollstaendigkeit desc,
               coalesce(j.geprueft_am, j.erstveroeffentlicht_am, j.created_at::date) desc,
               j.position asc, j.created_at desc
      limit ${LIST_LIMIT}
    `)) as unknown as Record<string, unknown>[];
    return rows.map(mapRow);
  });
}

/**
 * Zählt öffentliche Stellenanzeigen zum Filter (Kopfzeile „Neu gestartet ·
 * X geprüfte Stellen"; ohne Filter = Gesamtbestand). Beispiel-/Editorial-Module
 * sind hier NIE enthalten — gezählt wird ausschließlich school_jobs.
 */
export async function countJobs(raw: unknown = {}): Promise<number> {
  const f = jobsFilterSchema.parse(raw);
  return withAnonContext(async (tx) => {
    const rows = (await tx.execute(sql`
      select count(*)::int as total
      from public.school_jobs j
      join public.driving_schools s on s.id = j.school_id
      where ${filterConds(f)}
    `)) as unknown as Array<{ total: number }>;
    return Number(rows[0]?.total ?? 0);
  });
}

/**
 * Detail-Auflösung /jobs/[slug] → Anzeige oder null.
 * HINWEIS (Routen-Bau): RLS verbirgt abgelaufene/ungelistete Anzeigen KOMPLETT —
 * `null` heißt „nicht (mehr) öffentlich", nicht zwingend „hat nie existiert".
 * Die Hinweisseite für abgelaufene Slugs daher generisch formulieren
 * („Diese Stelle ist nicht mehr verfügbar") und KEIN JobPosting-Schema rendern.
 */
export async function getJobBySlug(slug: string): Promise<JobListItem | null> {
  if (typeof slug !== "string" || !SLUG_REGEX.test(slug)) return null;
  return withAnonContext(async (tx) => {
    const rows = (await tx.execute(sql`
      select ${JOB_SELECT}
      from public.school_jobs j
      join public.driving_schools s on s.id = j.school_id
      where j.slug = ${slug} and ${FENSTER}
      limit 1
    `)) as unknown as Record<string, unknown>[];
    return rows[0] ? mapRow(rows[0]) : null;
  });
}
