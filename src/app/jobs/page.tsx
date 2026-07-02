import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/seo/json-ld";
import type { JsonLdValue } from "@/lib/safe-json-ld";
import { getSiteUrl } from "@/lib/public-config";
import { JOB_KLASSEN } from "@/modules/jobs/schema";
import {
  listJobs,
  countJobs,
  jobsFilterSchema,
  BESCHAEFTIGUNGSARTEN,
  type JobsFilter,
  type JobListItem,
} from "@/modules/jobs/queries";
import {
  titelMitMwd,
  formatDatum,
  gehaltsBadge,
  finanzierungsLabel,
  BESCHAEFTIGUNGSART_LABEL,
  ARBEITSZEIT_LABEL,
} from "@/lib/jobs-anzeige";

/**
 * /jobs — Jobbörse-Hub (SSR, indexierbar, Editorial-Zeilen wie /fahrschulen).
 * ----------------------------------------------------------------------------
 * Ehrlicher Cold-Start: Kopf „Neu gestartet · X geprüfte Stellen" (X =
 * countJobs, zählt AUSSCHLIESSLICH echte school_jobs). Filter (Was/Wo-Text,
 * Klasse, Beschäftigungsart, Quereinstieg) als reines GET-Formular — ohne JS
 * vollständig nutzbar. Karten mit strukturierten Chips (Klassen, Arbeitszeit,
 * Quereinsteiger-Flag) und Gehalts-Badge NUR bei komplett bestätigter Spanne
 * mit Pflicht-Label (lib/jobs-anzeige.ts — die DB garantiert Vollständigkeit,
 * Migration 0025). Cold-Start-Editorial: MOVING-Branchenreport-2025-Kontext
 * (Quelle + Stand, Zahlen unverändert), Quereinsteiger-Teaser →
 * /jobs/fahrlehrer-werden, B2B-Block „Stelle melden" → kontakt@onelane.de
 * (kuratiert, KEIN Self-Service — school_jobs schreiben nur admin/editor, 0025).
 * GENAU EINE statische Beispiel-Kachel („Fahrschule Muster") mit Label am
 * Blickfang „Beispiel · keine echte Stelle · nicht bewerbbar" — NIE in
 * Trefferzahl, ItemList oder JobPosting, ohne Bewerben-CTA, ohne Gehaltszahlen
 * (keine Gehaltserfindungen). ItemList-JSON-LD NUR echte aktive Anzeigen.
 * Sortierung offengelegt auf /so-sortieren-wir (deckungsgleich mit dem
 * Docblock in modules/jobs/queries.ts).
 */
export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export async function generateMetadata(): Promise<Metadata> {
  let base = "";
  try {
    base = getSiteUrl().replace(/\/+$/, "");
  } catch {
    base = "";
  }
  return {
    title: "Fahrlehrer-Jobs — Stellen von Fahrschulen",
    description:
      "Geprüfte Stellenanzeigen von Fahrschulen: Fahrlehrer:innen, Fahrlehreranwärter:innen und Quereinsteiger:innen. Ehrlich sortiert, ohne bezahlte Platzierung.",
    // Filter-Varianten kanonisieren auf den Hub (parametrisierte Duplikate vermeiden).
    ...(base ? { alternates: { canonical: `${base}/jobs` } } : {}),
  };
}

const TINT_SOFT = "bg-[color-mix(in_oklab,var(--brand-sky)_5%,var(--background))]";
const LABEL_KLASSE =
  "mb-1 block font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground";
const FELD_KLASSE =
  "min-h-11 w-full rounded-[4px] border border-input bg-background px-3 text-sm outline-none placeholder:text-muted-foreground focus:border-ring";

/** Chip in Karten/Fakten-Boxen (mono, Hairline) — gleiche Optik wie /fahrschulen. */
function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-[3px] border border-border px-1.5 py-0.5 font-mono text-[11px] text-foreground/80">
      {children}
    </span>
  );
}

/** Strukturierte Chip-Zeile einer Anzeige (Klassen, Arbeitszeit, Quereinstieg). */
function JobChips({ job }: { job: JobListItem }) {
  return (
    <p className="mt-2 flex flex-wrap items-center gap-1.5" aria-label="Eckdaten der Stelle">
      {job.klassen.map((k) => (
        <Chip key={k}>{k}</Chip>
      ))}
      {job.arbeitszeitModell && <Chip>{ARBEITSZEIT_LABEL[job.arbeitszeitModell] ?? job.arbeitszeitModell}</Chip>}
      {job.samstagDienst === false && <Chip>kein Samstagsdienst</Chip>}
      {job.quereinsteigerWillkommen && (
        <span className="rounded-[3px] border border-primary/40 px-1.5 py-0.5 text-[11px] font-medium text-primary">
          Quereinsteiger:innen willkommen
        </span>
      )}
    </p>
  );
}

export default async function JobsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;

  // Filter defensiv parsen: ungültige Parameter → ungefilterte Liste (kein 500).
  const rawFilter = {
    text: first(sp.text),
    klasse: first(sp.klasse),
    beschaeftigungsart: first(sp.beschaeftigungsart),
    quereinsteiger: first(sp.quereinsteiger),
  };
  const parsedFilter = jobsFilterSchema.safeParse(rawFilter);
  const filter: JobsFilter = parsedFilter.success ? parsedFilter.data : {};
  const filterAktiv = Boolean(
    filter.text || filter.klasse || filter.beschaeftigungsart || filter.quereinsteiger,
  );

  let jobs: JobListItem[] = [];
  let gesamt = 0;
  let failed = false;
  try {
    [jobs, gesamt] = await Promise.all([listJobs(filter), countJobs({})]);
  } catch {
    failed = true;
  }

  let base = "";
  try {
    base = getSiteUrl().replace(/\/+$/, "");
  } catch {
    base = "";
  }

  // ItemList-JSON-LD: NUR echte aktive Anzeigen (nie die Beispiel-Kachel).
  const itemList: JsonLdValue | null =
    jobs.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "ItemList",
          numberOfItems: jobs.length,
          itemListElement: jobs.map((j, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: titelMitMwd(j.titel),
            ...(base ? { url: `${base}/jobs/${j.slug}` } : {}),
          })),
        }
      : null;

  return (
    <div className="flex w-full flex-1 flex-col">
      {itemList && <JsonLd data={itemList} />}

      {/* ================= Kopf: ehrlicher Cold-Start ================= */}
      <header className={`border-b border-border ${TINT_SOFT}`}>
        <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
            Jobbörse · Neu gestartet{failed ? "" : ` · ${gesamt} geprüfte Stelle${gesamt === 1 ? "" : "n"}`}
          </p>
          <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-5xl">
            Arbeiten, wo Fahrschule <span className="text-primary">gebraucht wird.</span>
          </h1>
          <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">
            Stellen von Fahrschulen — für Fahrlehrer:innen, Fahrlehreranwärter:innen und
            Menschen, die es werden wollen. Wir starten bewusst klein: Jede Anzeige hier
            ist von uns kuratiert, keine ist bezahlt platziert.
          </p>
        </div>
      </header>

      {/* ================= Filter: reines GET-Formular (ohne JS nutzbar) ===== */}
      <section aria-label="Stellen filtern" className="border-b border-border bg-background">
        <form method="get" action="/jobs" className="mx-auto grid w-full max-w-5xl gap-4 px-4 py-5 sm:grid-cols-2 sm:px-6 lg:grid-cols-[1fr_repeat(2,minmax(0,180px))_auto_auto]">
          <div>
            <label htmlFor="jobs-text" className={LABEL_KLASSE}>Was oder wo?</label>
            <input
              id="jobs-text"
              name="text"
              type="text"
              maxLength={120}
              defaultValue={filter.text ?? ""}
              placeholder="Ort, PLZ oder Stichwort"
              className={FELD_KLASSE}
            />
          </div>
          <div>
            <label htmlFor="jobs-klasse" className={LABEL_KLASSE}>Klasse</label>
            <select id="jobs-klasse" name="klasse" defaultValue={filter.klasse ?? ""} className={FELD_KLASSE}>
              <option value="">Alle Klassen</option>
              {JOB_KLASSEN.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="jobs-art" className={LABEL_KLASSE}>Beschäftigung</label>
            <select id="jobs-art" name="beschaeftigungsart" defaultValue={filter.beschaeftigungsart ?? ""} className={FELD_KLASSE}>
              <option value="">Alle Arten</option>
              {BESCHAEFTIGUNGSARTEN.map((b) => (
                <option key={b} value={b}>{BESCHAEFTIGUNGSART_LABEL[b] ?? b}</option>
              ))}
            </select>
          </div>
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 self-end rounded-[4px] border border-border bg-background px-3 text-sm transition-colors duration-[var(--motion-duration-fast)] ease-[var(--motion-ease)] has-checked:border-primary has-checked:bg-primary/5 has-checked:text-primary">
            <input
              type="checkbox"
              name="quereinsteiger"
              value="1"
              defaultChecked={filter.quereinsteiger === true}
              className="size-4 accent-[var(--primary)]"
            />
            Quereinstieg
          </label>
          <button
            type="submit"
            className="inline-flex min-h-11 items-center justify-center self-end rounded-full bg-foreground px-6 text-sm font-semibold text-background transition-colors duration-[var(--motion-duration-fast)] ease-[var(--motion-ease)] hover:bg-foreground/85"
          >
            Filtern
          </button>
        </form>
      </section>

      <div className="mx-auto w-full max-w-5xl flex-1 px-4 sm:px-6">
        {/* ================= Trefferliste ================= */}
        {failed ? (
          <p className="py-16 text-sm text-muted-foreground">
            Die Stellenliste konnte gerade nicht geladen werden. Bitte versuch es gleich noch einmal.
          </p>
        ) : (
          <>
            <p className="border-b border-border py-4 text-sm text-muted-foreground">
              {filterAktiv ? (
                <>
                  <span className="font-semibold text-foreground">{jobs.length}</span> Treffer zu deinem
                  Filter ·{" "}
                  <Link href="/jobs" className="text-primary underline-offset-2 hover:underline">
                    Filter zurücksetzen
                  </Link>
                </>
              ) : (
                <>
                  Sortiert nach Datenvollständigkeit und Aktualität — Zahlungen beeinflussen das
                  Ranking nicht.{" "}
                  <Link href="/so-sortieren-wir" className="text-primary underline-offset-2 hover:underline">
                    So sortieren wir
                  </Link>
                </>
              )}
            </p>

            {jobs.length === 0 && (
              <div className="border-b border-border py-12">
                <p className="text-lg font-semibold">
                  {filterAktiv ? "Zu diesem Filter ist gerade nichts offen." : "Gerade ist keine Stelle offen."}
                </p>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  Wir sind neu gestartet und nehmen Anzeigen kuratiert auf — es werden mehr.
                  {filterAktiv ? (
                    <>
                      {" "}Probier es{" "}
                      <Link href="/jobs" className="text-primary underline-offset-2 hover:underline">
                        ohne Filter
                      </Link>
                      {" "}oder schau in ein paar Tagen wieder rein.
                    </>
                  ) : (
                    " Schau in ein paar Tagen wieder rein — oder lies unten, wie der Quereinstieg funktioniert."
                  )}
                </p>
              </div>
            )}

            <ol className="list-none">
              {jobs.map((job) => {
                const badge = gehaltsBadge(job);
                const geprueft = formatDatum(job.geprueftAm);
                const ort = [job.schule.stadtbezirk ?? job.schule.ort, job.schule.plz]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <li key={job.id} className="group relative border-b border-border transition-colors duration-[var(--motion-duration-fast)] ease-[var(--motion-ease)] lg:hover:bg-[color-mix(in_oklab,var(--brand-sky)_4%,var(--background))]">
                    <article className="flex flex-col gap-4 py-6 lg:flex-row lg:items-start lg:gap-8">
                      <div className="min-w-0 flex-1">
                        <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
                          <Link
                            href={`/jobs/${job.slug}`}
                            className="rounded-[3px] outline-offset-4 after:absolute after:inset-0 after:content-['']"
                          >
                            {titelMitMwd(job.titel)}
                          </Link>
                        </h2>
                        <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                          <span className="font-medium text-foreground/80">{job.schule.name}</span>
                          {ort && <span>· {ort}</span>}
                          {job.beschaeftigungsart && (
                            <span>· {BESCHAEFTIGUNGSART_LABEL[job.beschaeftigungsart] ?? job.beschaeftigungsart}</span>
                          )}
                        </p>
                        <JobChips job={job} />
                        {finanzierungsLabel(job.quereinsteigerFinanzierung) && (
                          <p className="mt-2 text-sm font-medium text-primary">
                            {finanzierungsLabel(job.quereinsteigerFinanzierung)}
                          </p>
                        )}
                        {geprueft && (
                          <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                            geprüft am {geprueft}
                          </p>
                        )}
                      </div>

                      {/* Gehalts-Spalte: NUR bestätigte Spannen tragen Zahlen (0025). */}
                      <div className="shrink-0 lg:w-60 lg:text-right">
                        {badge ? (
                          <>
                            <p className="font-mono text-base font-bold tabular-nums">{badge.spanne}</p>
                            <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{badge.label}</p>
                          </>
                        ) : (
                          <p className="text-sm text-muted-foreground">Gehalt: auf Anfrage</p>
                        )}
                        <span className="relative z-10 mt-3 hidden lg:inline-flex">
                          <Link
                            href={`/jobs/${job.slug}/bewerben`}
                            className="inline-flex min-h-11 items-center rounded-full bg-accent px-5 text-sm font-semibold text-accent-foreground transition-colors duration-[var(--motion-duration-fast)] ease-[var(--motion-ease)] hover:bg-brand-lime"
                          >
                            Jetzt bewerben
                          </Link>
                        </span>
                      </div>
                    </article>
                  </li>
                );
              })}

              {/* ===== GENAU EINE statische Beispiel-Kachel (Editorial-Modul) =====
                  NICHT in school_jobs, NICHT in Trefferzahl/ItemList/JSON-LD,
                  KEIN Bewerben-CTA, KEINE Gehaltszahlen (keine Erfindungen). */}
              <li aria-label="Beispiel-Anzeige (keine echte Stelle)" className="border-b border-border">
                <article className="flex flex-col gap-4 py-6 opacity-90 lg:flex-row lg:items-start lg:gap-8">
                  <div className="min-w-0 flex-1">
                    <p className="inline-flex rounded-[3px] border border-dashed border-foreground/40 px-2 py-0.5 font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                      Beispiel · keine echte Stelle · nicht bewerbbar
                    </p>
                    <h2 className="mt-2 text-xl font-bold tracking-tight text-foreground/80 sm:text-2xl">
                      Fahrlehrer:in Klasse B (m/w/d)
                    </h2>
                    <p className="mt-1.5 text-sm text-muted-foreground">
                      Fahrschule Muster · Musterstadt · Vollzeit
                    </p>
                    <p className="mt-2 flex flex-wrap items-center gap-1.5">
                      <Chip>B</Chip>
                      <Chip>B197</Chip>
                      <Chip>Vollzeit</Chip>
                      <span className="rounded-[3px] border border-primary/40 px-1.5 py-0.5 text-[11px] font-medium text-primary">
                        Quereinsteiger:innen willkommen
                      </span>
                    </p>
                    <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
                      So sieht eine vollständige Anzeige bei uns aus: klare Eckdaten, ehrliche
                      Angaben — und wenn die Fahrschule ihre Gehaltsspanne bestätigt, steht sie
                      mit Datum dabei.
                    </p>
                  </div>
                  <div className="shrink-0 lg:w-60 lg:text-right">
                    <p className="font-mono text-sm font-bold text-muted-foreground">Bestätigte Gehaltsspanne</p>
                    <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                      Angabe der Fahrschule · bestätigt am TT.MM.JJJJ
                    </p>
                  </div>
                </article>
              </li>
            </ol>
          </>
        )}

        {/* ================= Cold-Start-Editorial: Kontext mit Quelle ========== */}
        <section aria-labelledby="jobs-kontext-heading" className="border-b border-border py-12">
          <h2 id="jobs-kontext-heading" className="text-2xl font-bold tracking-tight sm:text-3xl">
            Warum sich der Blick hierher lohnt
          </h2>
          <div className="mt-6 grid gap-8 md:grid-cols-3">
            <div>
              <p className="font-mono text-3xl font-bold tabular-nums text-primary">&gt;10.900</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                fehlende Fahrlehrer:innen in Deutschland — die Lücke ist real, nicht gefühlt.
              </p>
            </div>
            <div>
              <p className="font-mono text-3xl font-bold tabular-nums text-primary">~54 Jahre</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Durchschnittsalter im Beruf — in den nächsten Jahren gehen viele in den Ruhestand.
              </p>
            </div>
            <div>
              <p className="font-mono text-3xl font-bold tabular-nums text-primary">307 Tage</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                bleibt eine offene Stelle im Schnitt unbesetzt — Fahrschulen suchen dich wirklich.
              </p>
            </div>
          </div>
          <p className="mt-6 font-mono text-[11px] text-muted-foreground">
            Quelle: MOVING Branchenreport 2025 · Stand 2025 · Zahlen unverändert übernommen
          </p>
        </section>

        {/* ================= Quereinsteiger-Teaser ================= */}
        <section aria-labelledby="jobs-quereinstieg-heading" className="border-b border-border py-12">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <h2 id="jobs-quereinstieg-heading" className="text-2xl font-bold tracking-tight sm:text-3xl">
                Noch kein:e Fahrlehrer:in? <span className="text-primary">Werd es.</span>
              </h2>
              <p className="mt-3 leading-relaxed text-muted-foreground">
                Der Beruf ist ein klassischer Quereinstieg — und manche Fahrschulen beteiligen
                sich an der Ausbildung. Wir zeigen dir in drei Schritten, wie der Weg aussieht.
              </p>
            </div>
            <Link
              href="/jobs/fahrlehrer-werden"
              className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-full bg-accent px-7 text-sm font-semibold text-accent-foreground transition-colors duration-[var(--motion-duration-fast)] ease-[var(--motion-ease)] hover:bg-brand-lime"
            >
              Fahrlehrer:in werden
            </Link>
          </div>
        </section>

        {/* ================= B2B: Stelle melden (kuratiert, kein Self-Service) = */}
        <section aria-labelledby="jobs-melden-heading" className="py-12">
          <h2 id="jobs-melden-heading" className="text-xl font-bold tracking-tight">
            Sie sind Fahrschule und suchen Verstärkung?
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Melden Sie uns Ihre offene Stelle — wir nehmen sie kuratiert und kostenlos auf.
            Eine bestätigte Gehaltsspanne macht Ihre Anzeige vollständiger und damit sichtbarer;
            gekaufte Plätze gibt es bei uns nicht.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-4">
            <a
              href="mailto:kontakt@onelane.de?subject=Stellenanzeige"
              className="inline-flex min-h-12 items-center rounded-full border border-border bg-card px-7 text-sm font-semibold transition-colors duration-[var(--motion-duration-fast)] ease-[var(--motion-ease)] hover:border-primary/50 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Stelle melden
            </a>
            <span className="text-sm text-muted-foreground">kontakt@onelane.de · Betreff „Stellenanzeige“</span>
          </div>
        </section>
      </div>
    </div>
  );
}
