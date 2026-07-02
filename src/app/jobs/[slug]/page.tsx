import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/seo/json-ld";
import type { JsonLdValue } from "@/lib/safe-json-ld";
import { getSiteUrl } from "@/lib/public-config";
import { slugify } from "@/lib/slug";
import { getJobBySlug, type JobListItem } from "@/modules/jobs/queries";
import {
  titelMitMwd,
  formatDatum,
  gehaltsBadge,
  finanzierungsLabel,
  BESCHAEFTIGUNGSART_LABEL,
  ARBEITSZEIT_LABEL,
  VERGUETUNGSMODELL_LABEL,
  EMPLOYMENT_TYPE_SCHEMA,
  SALARY_UNIT_SCHEMA,
  FAHRLG_VORAUSSETZUNGEN,
  FAHRLG_STAND_HINWEIS,
} from "@/lib/jobs-anzeige";

/**
 * /jobs/[slug] — Stellen-Detailseite (SSR, indexierbar bei aktiver Anzeige).
 * ----------------------------------------------------------------------------
 * Fakten-Box above the fold (Gehalt NUR bei komplett bestätigter Spanne mit
 * Pflicht-Label „Angabe der Fahrschule · bestätigt am <Datum>", sonst neutral
 * „Gehalt: auf Anfrage"; Klassen; Arbeitszeit/Samstag; Beschäftigungsart;
 * Quereinstiegs-Finanzierung im erlaubten Flag-Wording; „geprüft am").
 * Titel automatisch AGG-neutral „… (m/w/d)" (lib/jobs-anzeige.ts). Optionaler
 * §-2-FahrlG-Gesetzesblock mit Stand-Hinweis, Beschreibung, Anfahrt/Schul-Bezug
 * (Link aufs Profil — KEINE Schul-E-Mail/-Website), Sticky-Apply (Desktop-Rail
 * + mobile Bottom-Bar). JobPosting-JSON-LD NUR für gültige aktive Anzeigen;
 * `validThrough` aus dem Gültigkeitsfenster (nur wenn gesetzt — wir erfinden
 * kein Ablaufdatum); baseSalary nur bei bestätigter Spanne.
 *
 * ABGELAUFEN/UNBEKANNT: Die RLS-Policy (0023/0025) verbirgt abgelaufene und
 * ungelistete Anzeigen KOMPLETT — `getJobBySlug` liefert dann null und kann
 * „abgelaufen" nicht von „nie existiert" unterscheiden. Deshalb rendert diese
 * Route eine GENERISCHE, ehrliche Hinweisseite statt 404 („Diese Stelle ist
 * nicht mehr verfügbar") — ohne Existenz-Bestätigung, OHNE JobPosting-Schema,
 * ohne Bewerben-CTA, noindex.
 */
export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;

function siteBase(): string {
  try {
    return getSiteUrl().replace(/\/+$/, "");
  } catch {
    return "";
  }
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const job = await getJobBySlug(slug).catch(() => null);
  if (!job) {
    return {
      title: "Stelle nicht mehr verfügbar",
      robots: { index: false, follow: true },
    };
  }
  const base = siteBase();
  return {
    title: `${titelMitMwd(job.titel)} — ${job.schule.name}`,
    description: `Stellenanzeige von ${job.schule.name}${job.schule.ort ? ` in ${job.schule.ort}` : ""}: ${titelMitMwd(job.titel)}. Kuratiert auf onelane — Bewerbung geht direkt an die Fahrschule.`,
    ...(base ? { alternates: { canonical: `${base}/jobs/${job.slug}` } } : {}),
  };
}

/** Zeile der Fakten-Box: mono-Label + Wert. */
function Fakt({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-border py-3 first:border-t-0 first:pt-0">
      <dt className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-medium">{children}</dd>
    </div>
  );
}

/** JobPosting-JSON-LD — deckungsgleich mit dem sichtbaren Inhalt. */
function jobPostingLd(job: JobListItem, beschreibung: string, base: string): JsonLdValue {
  const badge = gehaltsBadge(job);
  return {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: titelMitMwd(job.titel),
    description: beschreibung,
    datePosted: job.erstveroeffentlichtAm ?? job.createdAt.slice(0, 10),
    // Nur ein ECHTES Gültigkeitsende wird ausgegeben — kein erfundenes Datum.
    ...(job.gueltigBis ? { validThrough: job.gueltigBis } : {}),
    ...(job.beschaeftigungsart && EMPLOYMENT_TYPE_SCHEMA[job.beschaeftigungsart]
      ? { employmentType: EMPLOYMENT_TYPE_SCHEMA[job.beschaeftigungsart] }
      : {}),
    hiringOrganization: { "@type": "Organization", name: job.schule.name },
    jobLocation: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        ...(job.schule.strasse
          ? {
              streetAddress: `${job.schule.strasse}${job.schule.hausnummer ? ` ${job.schule.hausnummer}` : ""}`,
            }
          : {}),
        ...(job.schule.plz ? { postalCode: job.schule.plz } : {}),
        ...(job.schule.ort ? { addressLocality: job.schule.ort } : {}),
        addressCountry: "DE",
      },
    },
    // baseSalary NUR bei komplett bestätigter Spanne (DB-hart, Migration 0025).
    ...(badge && job.gehaltVonEuro && job.gehaltBisEuro && job.gehaltZeitraum
      ? {
          baseSalary: {
            "@type": "MonetaryAmount",
            currency: "EUR",
            value: {
              "@type": "QuantitativeValue",
              minValue: Number.parseFloat(job.gehaltVonEuro),
              maxValue: Number.parseFloat(job.gehaltBisEuro),
              unitText: SALARY_UNIT_SCHEMA[job.gehaltZeitraum],
            },
          },
        }
      : {}),
    directApply: true,
    ...(base ? { url: `${base}/jobs/${job.slug}` } : {}),
  };
}

export default async function JobDetailPage({ params }: { params: Params }) {
  const { slug } = await params;
  const job = await getJobBySlug(slug).catch(() => null);

  // ===== Ehrliche Hinweisseite (abgelaufen ODER nie existiert — generisch,
  // ohne Existenz-Bestätigung, ohne Schema, ohne Bewerben-CTA) ================
  if (!job) {
    return (
      <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-16 sm:px-6">
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
          Jobbörse
        </p>
        <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
          Diese Stelle ist nicht mehr verfügbar.
        </h1>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          Unter dieser Adresse ist aktuell keine offene Stelle ausgeschrieben — Anzeigen
          verschwinden bei uns, sobald sie ablaufen oder besetzt sind. Ehrlicher können wir
          es nicht sagen.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/jobs"
            className="inline-flex min-h-12 items-center rounded-full bg-accent px-6 text-sm font-semibold text-accent-foreground transition-colors duration-[var(--motion-duration-fast)] ease-[var(--motion-ease)] hover:bg-brand-lime"
          >
            Offene Stellen ansehen
          </Link>
          <Link
            href="/jobs/fahrlehrer-werden"
            className="inline-flex min-h-12 items-center rounded-full border border-border bg-background px-6 text-sm font-medium transition-colors duration-[var(--motion-duration-fast)] ease-[var(--motion-ease)] hover:border-primary/50 hover:text-primary"
          >
            Fahrlehrer:in werden
          </Link>
        </div>
      </div>
    );
  }

  const base = siteBase();
  const badge = gehaltsBadge(job);
  const geprueft = formatDatum(job.geprueftAm);
  const finanzierung = finanzierungsLabel(job.quereinsteigerFinanzierung);
  const bewerbenHref = `/jobs/${job.slug}/bewerben`;
  const profilHref = job.schule.ort
    ? `/fahrschulen/${slugify(job.schule.ort)}/${job.schule.slug}`
    : null;
  const adresse = [
    job.schule.strasse ? `${job.schule.strasse}${job.schule.hausnummer ? ` ${job.schule.hausnummer}` : ""}` : null,
    [job.schule.plz, job.schule.ort].filter(Boolean).join(" ") || null,
  ].filter((z): z is string => Boolean(z));

  // Sichtbarer Beschreibungstext = JSON-LD-description (Deckungsgleichheit).
  const beschreibung =
    job.beschreibung ??
    `${job.schule.name} sucht Verstärkung: ${titelMitMwd(job.titel)}. Details klärst du direkt mit der Fahrschule — deine Bewerbung geht ohne Umweg an sie.`;

  return (
    <div className="flex w-full flex-1 flex-col pb-24 lg:pb-0">
      <JsonLd data={jobPostingLd(job, beschreibung, base)} />

      <div className="mx-auto w-full max-w-5xl flex-1 px-4 sm:px-6">
        <nav className="pt-6 text-sm text-muted-foreground" aria-label="Brotkrumen">
          <Link href="/jobs" className="underline-offset-2 hover:underline">← Alle Stellen</Link>
        </nav>

        <div className="mt-4 grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
          {/* ================= Hauptspalte ================= */}
          <div className="min-w-0">
            <header>
              <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
                {job.art === "anwaerter" ? "Ausbildung · Fahrlehreranwärter:in" : "Stelle · Fahrlehrer:in"}
              </p>
              <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                {titelMitMwd(job.titel)}
              </h1>
              <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                <span className="font-medium text-foreground/80">{job.schule.name}</span>
                {(job.schule.stadtbezirk ?? job.schule.ort) && (
                  <span>· {job.schule.stadtbezirk ?? job.schule.ort}</span>
                )}
                {geprueft && (
                  <span className="font-mono text-[11px] uppercase tracking-[0.1em]">
                    · geprüft am {geprueft}
                  </span>
                )}
              </p>
            </header>

            <section aria-labelledby="job-beschreibung-heading" className="mt-10">
              <h2 id="job-beschreibung-heading" className="text-xl font-bold tracking-tight">
                Die Stelle
              </h2>
              <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground">{beschreibung}</p>
              {job.tarifHinweis && !badge && (
                <p className="mt-3 text-sm text-muted-foreground">{job.tarifHinweis}</p>
              )}
            </section>

            {/* §-2-FahrlG-Block nur bei Fahrlehrer-Stellen (Anwärter:innen sind
                ja gerade auf dem Weg dorthin — dort wäre er irreführend). */}
            {job.art === "fahrlehrer" && (
              <section aria-labelledby="job-fahrlg-heading" className="mt-10 rounded-md border border-border bg-[color-mix(in_oklab,var(--brand-sky)_5%,var(--background))] px-5 py-5">
                <h2 id="job-fahrlg-heading" className="text-base font-bold tracking-tight">
                  Gesetzliche Voraussetzungen (§ 2 FahrlG)
                </h2>
                <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                  {FAHRLG_VORAUSSETZUNGEN.map((v) => (
                    <li key={v} className="flex gap-2">
                      <span aria-hidden="true" className="mt-2 size-1 shrink-0 rounded-full bg-accent" />
                      {v}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 font-mono text-[11px] text-muted-foreground">{FAHRLG_STAND_HINWEIS}</p>
              </section>
            )}

            {job.quereinsteigerWillkommen && (
              <section aria-labelledby="job-quereinstieg-heading" className="mt-10">
                <h2 id="job-quereinstieg-heading" className="text-xl font-bold tracking-tight">
                  Quereinsteiger:innen willkommen
                </h2>
                <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground">
                  Diese Fahrschule heißt Menschen ohne Fahrlehrerlaubnis ausdrücklich willkommen.
                  {finanzierung && (
                    <>
                      {" "}Zur Ausbildung gilt: <span className="font-medium text-foreground">{finanzierung}</span> —
                      die Details vereinbarst du direkt mit der Fahrschule.
                    </>
                  )}{" "}
                  Wie der Weg in den Beruf aussieht, liest du auf{" "}
                  <Link href="/jobs/fahrlehrer-werden" className="text-primary underline-offset-2 hover:underline">
                    Fahrlehrer:in werden
                  </Link>
                  .
                </p>
              </section>
            )}

            {/* Anfahrt/Schul-Bezug: Adresse + Profil-Link (keine E-Mail/Website). */}
            <section aria-labelledby="job-anfahrt-heading" className="mt-10 border-t border-border pt-8">
              <h2 id="job-anfahrt-heading" className="text-xl font-bold tracking-tight">
                Dein künftiger Arbeitsplatz
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                <span className="font-medium text-foreground">{job.schule.name}</span>
                {adresse.map((z) => (
                  <span key={z} className="block">{z}</span>
                ))}
              </p>
              {profilHref && (
                <p className="mt-3 text-sm">
                  <Link href={profilHref} className="font-medium text-primary underline-offset-2 hover:underline">
                    Zum Fahrschul-Profil auf onelane →
                  </Link>
                </p>
              )}
            </section>
          </div>

          {/* ================= Sticky-Rail: Fakten-Box + Apply ================= */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-md border border-border bg-background px-5 py-5">
              <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Auf einen Blick
              </h2>
              <dl className="mt-4">
                <Fakt label="Gehalt">
                  {badge ? (
                    <>
                      <span className="font-mono font-bold tabular-nums">{badge.spanne}</span>
                      <span className="mt-1 block text-[11px] font-normal leading-snug text-muted-foreground">
                        {badge.label}
                      </span>
                    </>
                  ) : (
                    <span className="font-normal text-muted-foreground">auf Anfrage</span>
                  )}
                </Fakt>
                {!badge && job.verguetungsmodell && VERGUETUNGSMODELL_LABEL[job.verguetungsmodell] && (
                  <Fakt label="Vergütungsmodell">{VERGUETUNGSMODELL_LABEL[job.verguetungsmodell]}</Fakt>
                )}
                {/* Alt-Freitext (0023) NUR ohne strukturiertes Gehalt zeigen — und
                    wie die bestätigte Spanne klar als SCHUL-Angabe gelabelt
                    (Sicherheits-Abnahme: kein ungelabelter Vergütungs-Altpfad). */}
                {!badge && job.verguetungText && (
                  <Fakt label="Vergütung">
                    {job.verguetungText}{" "}
                    <span className="text-xs font-normal text-muted-foreground">· Angabe der Fahrschule, unbestätigt</span>
                  </Fakt>
                )}
                {job.klassen.length > 0 && (
                  <Fakt label="Klassen">
                    <span className="flex flex-wrap gap-1.5">
                      {job.klassen.map((k) => (
                        <span key={k} className="rounded-[3px] border border-border px-1.5 py-0.5 font-mono text-[11px]">
                          {k}
                        </span>
                      ))}
                    </span>
                  </Fakt>
                )}
                {job.beschaeftigungsart && (
                  <Fakt label="Beschäftigung">
                    {BESCHAEFTIGUNGSART_LABEL[job.beschaeftigungsart] ?? job.beschaeftigungsart}
                  </Fakt>
                )}
                {(job.arbeitszeitModell || job.samstagDienst != null) && (
                  <Fakt label="Arbeitszeit">
                    {[
                      job.arbeitszeitModell ? ARBEITSZEIT_LABEL[job.arbeitszeitModell] ?? job.arbeitszeitModell : null,
                      job.samstagDienst == null ? null : job.samstagDienst ? "mit Samstagsdienst" : "kein Samstagsdienst",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </Fakt>
                )}
                {finanzierung && <Fakt label="Quereinstieg">{finanzierung}</Fakt>}
                {geprueft && (
                  <Fakt label="Geprüft am">
                    <span className="font-mono tabular-nums">{geprueft}</span>
                  </Fakt>
                )}
                {job.gueltigBis && formatDatum(job.gueltigBis) && (
                  <Fakt label="Anzeige gültig bis">
                    <span className="font-mono tabular-nums">{formatDatum(job.gueltigBis)}</span>
                  </Fakt>
                )}
              </dl>
              <Link
                href={bewerbenHref}
                className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-accent px-6 text-sm font-semibold text-accent-foreground transition-colors duration-[var(--motion-duration-fast)] ease-[var(--motion-ease)] hover:bg-brand-lime"
              >
                Jetzt bewerben
              </Link>
              <p className="mt-3 text-center text-[11px] leading-snug text-muted-foreground">
                Deine Bewerbung geht direkt an die Fahrschule — wir speichern deine Unterlagen nicht.
              </p>
            </div>
          </aside>
        </div>
      </div>

      {/* Mobile Sticky-Apply (Bottom-Bar) — Desktop trägt die Rail den CTA. */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-4 py-3 supports-[backdrop-filter]:bg-background/85 supports-[backdrop-filter]:backdrop-blur lg:hidden">
        <Link
          href={bewerbenHref}
          className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground"
        >
          Jetzt bewerben
        </Link>
      </div>
    </div>
  );
}
