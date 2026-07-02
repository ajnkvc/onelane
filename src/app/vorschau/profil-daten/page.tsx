import type { Metadata } from "next";
import Link from "next/link";
import { RevealOnScroll } from "@/components/home/reveal";
import { DataBadge } from "@/components/school/data-badge";
import { TrustBadge } from "@/components/trust/trust-badge";
import ResultsMap, { type MapMarker } from "@/components/search/results-map";
import { getTileConfig, type MapTileConfig } from "@/modules/maps";
import { getSchoolProfile, type SchoolProfileDetail } from "@/modules/schools/profile";
import { getPricesForSchool } from "@/modules/schools/prices";
import { searchSchools } from "@/modules/schools/search";
import { PREIS_KOMPONENTEN, hatPflichtangabenSet, formatEuro, type SchoolPriceRow } from "@/lib/preise";
import { slugify } from "@/lib/slug";

/**
 * VORSCHAU „Profil · Daten-Dossier" — Prototyp der Fahrschul-Unterseite mit
 * These „data-editorial": Vertrauen durch Präzision statt Dekoration. Der
 * amtliche Preisaushang (Anlage-4-Register, nummeriert 01–08) ist der HELD
 * direkt nach dem Kopf; danach strukturierte Fakten-Blöcke (Wochenraster,
 * Fahrzeug-Specs, Team, FAQ). Ein einziges Akzent-Moment: das trust-Signal
 * am Anmelde-Block. Zonen wechseln Weiß ↔ dezente Token-Tints (color-mix),
 * Kanten bewusst schärfer (rounded-sm/md), Zahlen editorial (tabular-nums).
 *
 * RECHTSRAHMEN (§ 32 FahrlG): Preise NUR als Komponenten-Register mit
 * DataBadge + Stand, kein Gesamtpreis, „zzgl. amtlicher Prüfgebühren".
 * KEINE öffentliche E-Mail der Schule (nur Anmelde-CTA + Telefon).
 *
 * ECHTE DATEN (Demo-Seed): Standard ist muenchen/fahrschule-isarpilot;
 * per ?stadt=…&schule=… zeigt das Dossier jede gelistete Seed-Schule —
 * so ist der Klickfluss aus der Vorschau-Suche durchgängig. Mobil trägt
 * eine Sticky-Bottom-Action-Bar (Anrufen | Anmeldung starten, ≥48 px).
 * SSR, Token-only, keine Inline-Styles, ohne JS lesbar. `noindex`.
 */
export const metadata: Metadata = {
  title: "Vorschau — Fahrschul-Dossier (Datenkonzept)",
  robots: { index: false, follow: false },
};

/* ---------------------------------------------------------------------------
 * Format-Helfer (nur Darstellung)
 * ------------------------------------------------------------------------ */

const fmtRating = (r: string) => r.replace(".", ",");
const telHref = (t: string) => `tel:${t.replace(/[^+\d]/g, "")}`;
const hhmm = (t: string) => t.slice(0, 5);

const TAGE = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"] as const;
const ART_LABEL: Record<string, string> = {
  buero: "Büro",
  theorie: "Theorie",
  praxis: "Fahrpraxis",
};
const GETRIEBE_LABEL: Record<string, string> = {
  automatik: "Automatik",
  schaltung: "Schaltung",
};

/* ---------------------------------------------------------------------------
 * Inline-Hilfskomponenten (bewusst lokal — Prototyp verändert keinen Bestand)
 * ------------------------------------------------------------------------ */

/** Editoriale Sektions-Überschrift mit Mono-Kicker (Dossier-Sprache). */
function DossierHeading({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div>
      <p className="font-mono text-xs font-medium tracking-[0.2em] text-primary uppercase">{kicker}</p>
      <h2 className="mt-2 text-3xl font-semibold tracking-tighter text-balance sm:text-4xl">
        {title}
        <span className="text-primary">.</span>
      </h2>
    </div>
  );
}

/** Fakten-Block mit harter Oberkante (editorialer Register-Look). */
function FaktenBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t-2 border-foreground/80 pt-4">
      <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/**
 * Anlage-4-Register einer Klasse: nummerierte Komponenten-Zeilen mit
 * Punktführung, Betrag rechtsbündig (tabular-nums), Provenienz am Kopf.
 * Fehlende Beträge = ehrliches „keine Angabe" — nie geschätzt.
 */
function PreisRegister({ row }: { row: SchoolPriceRow }) {
  return (
    <article className="flex flex-col rounded-md border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xl font-semibold tracking-tight">
          Klasse <span className="font-mono">{row.klasse}</span>
        </h3>
        <DataBadge status={row.status} stand={row.stand} />
      </div>
      <ol className="mt-4">
        {PREIS_KOMPONENTEN.map((k, i) => {
          const betrag = row.komponenten[k.key];
          return (
            <li key={k.key} className="flex items-baseline gap-3 border-b border-border/70 py-2.5 last:border-b-0">
              <span className="w-6 shrink-0 font-mono text-xs text-muted-foreground" aria-hidden="true">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="text-sm">{k.label}</span>
              <span className="mx-1 flex-1 border-b border-dotted border-border" aria-hidden="true" />
              {betrag != null ? (
                <span className="text-base font-semibold tracking-tight tabular-nums">{formatEuro(betrag)}</span>
              ) : (
                <span className="text-sm text-muted-foreground">keine Angabe</span>
              )}
            </li>
          );
        })}
      </ol>
      {!hatPflichtangabenSet(row) && (
        <p className="mt-3 text-xs text-muted-foreground">
          Für diese Klasse liegen noch nicht alle Pflichtangaben vor — neutrale Übersicht ohne Hervorhebung.
        </p>
      )}
    </article>
  );
}

/* ---------------------------------------------------------------------------
 * Seite
 * ------------------------------------------------------------------------ */

type SP = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
/** Nur harmlose Slugs aus der URL akzeptieren (a–z, 0–9, Bindestrich). */
const cleanSlug = (v: string | undefined): string | null =>
  v && /^[a-z0-9-]{1,120}$/.test(v) ? v : null;

export default async function VorschauProfilDatenPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const stadt = cleanSlug(first(sp.stadt)) ?? "muenchen";
  const schule = cleanSlug(first(sp.schule)) ?? "fahrschule-isarpilot";

  // Profil laden — Fallback-Kette: gewünschte Schule → Seed-Schule Isarpilot
  // → erste Schule der München-Suche. Nie harte Fehlerseite im Prototyp.
  let school: SchoolProfileDetail | null = null;
  try {
    school = await getSchoolProfile(stadt, schule);
  } catch {
    school = null;
  }
  if (!school && (stadt !== "muenchen" || schule !== "fahrschule-isarpilot")) {
    try {
      school = await getSchoolProfile("muenchen", "fahrschule-isarpilot");
    } catch {
      school = null;
    }
  }
  if (!school) {
    try {
      const r = await searchSchools({ ort: "München" });
      const f = r.items[0];
      if (f?.ort) school = await getSchoolProfile(slugify(f.ort), f.slug);
    } catch {
      school = null;
    }
  }

  if (!school) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-20 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tighter">Dossier nicht verfügbar</h1>
        <p className="mt-3 text-muted-foreground">
          Der Demo-Seed (München) ist in dieser Umgebung nicht geladen. Bitte{" "}
          <code className="font-mono text-sm">npm run seed:demo</code> ausführen und neu laden.
        </p>
      </div>
    );
  }

  let preise: SchoolPriceRow[] = [];
  try {
    preise = await getPricesForSchool(school.id);
  } catch {
    preise = [];
  }

  // Karte fail-soft (nur Anfahrt-Block; Dossier funktioniert auch ohne).
  let tile: MapTileConfig | null = null;
  try {
    tile = getTileConfig();
  } catch {
    tile = null;
  }
  const marker: MapMarker[] =
    school.latitude != null && school.longitude != null
      ? [{ id: school.id, name: school.name, lat: school.latitude, lng: school.longitude, partner: school.isPartner }]
      : [];

  const adresse = [school.strasse, [school.plz, school.ort].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
  const ortLabel = [school.ort, school.stadtbezirk && school.stadtbezirk !== school.ort ? school.stadtbezirk : null]
    .filter(Boolean)
    .join(" — ");
  const tel = school.telefon;

  // Wochenraster: nur tatsächlich vorhandene Arten als Spalten.
  const arten = ["buero", "theorie", "praxis"].filter((a) => school.hours.some((h) => h.art === a));
  const zeiten = (tag: number, art: string) =>
    school.hours
      .filter((h) => h.wochentag === tag && h.art === art)
      .map((h) => `${hhmm(h.von)}–${hhmm(h.bis)}`)
      .join(", ");

  const anmeldeHref = school.ort ? `/fahrschulen/${slugify(school.ort)}/${school.slug}` : "/fahrschulen";

  return (
    <div className="flex flex-col pb-24 md:pb-0">
      <RevealOnScroll />

      {/* Demo-Kennzeichnung — ehrlich: Prototyp mit Demo-Datensatz */}
      <p className="border-b border-border bg-secondary px-4 py-1.5 text-center text-xs text-secondary-foreground">
        Design-Vorschau · Demo-Datensatz — keine echte Fahrschule, keine Veröffentlichung
      </p>

      {/* ================= ZONE 1 · Kopf (Weiß) ================= */}
      <header className="bg-background">
        <div className="mx-auto w-full max-w-5xl px-4 pt-10 pb-10 sm:px-6">
          <p className="font-mono text-xs font-medium tracking-[0.2em] text-primary uppercase">
            Fahrschul-Dossier{ortLabel ? ` · ${ortLabel}` : ""}
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tighter text-balance sm:text-6xl">
            {school.name}
            <span className="text-primary">.</span>
          </h1>

          {/* Meta-Zeile: Adresse + Google dezent mit Quellen-Label (Fremdsignal) */}
          <p className="mt-4 text-sm text-muted-foreground">
            {adresse || "Adresse folgt"}
            {school.googleRating && (
              <>
                {" · "}
                <span title="Fremde Quelle — nicht von onelane geprüft.">
                  {fmtRating(school.googleRating)} · Google
                  {school.googleReviewsCount ? `, ${school.googleReviewsCount} Bew.` : ""}
                </span>
              </>
            )}
          </p>

          {/* Klassen + Marker */}
          <p className="mt-3 flex flex-wrap items-center gap-1.5">
            {school.klassen.map((k) => (
              <span key={k} className="rounded-sm bg-secondary px-2 py-0.5 font-mono text-xs text-secondary-foreground">
                {k}
              </span>
            ))}
            {school.isPartner && (
              <span className="rounded-sm bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground">Partner</span>
            )}
            {school.isVerified && (
              <span className="rounded-sm border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground">
                Verifiziert
              </span>
            )}
          </p>

          {/* CTA-Reihe: Anmeldung primär, Telefon prominent daneben, trust-Signal */}
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <a
              href="#anmeldung"
              className="inline-flex min-h-12 items-center justify-center rounded-md bg-primary px-6 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Anmeldung starten
            </a>
            {tel && (
              <a
                href={telHref(tel)}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-primary/40 px-5 text-base font-semibold text-primary transition-colors hover:bg-primary/5"
              >
                <svg viewBox="0 0 24 24" className="size-4 fill-none stroke-current stroke-2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.4 2.1L8.1 10a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.6 2z" />
                </svg>
                {tel}
              </a>
            )}
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              <TrustBadge size="sm" />
              unverbindlich · kostenlos · ohne Konto
            </span>
          </div>
        </div>
      </header>

      {/* ================= ZONE 2 · HELD: Amtlicher Preisaushang (Sky-Tint) ================= */}
      <section className="border-y border-border bg-[color-mix(in_oklch,var(--background),var(--brand-sky)_5%)]">
        <div className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6">
          <div className="reveal flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <DossierHeading kicker="Amtlicher Preisaushang" title="Preisangaben nach § 32 FahrlG" />
            <p className="max-w-sm text-sm text-muted-foreground">
              Acht Bestandteile, einzeln ausgewiesen — so hängt der Aushang auch in der Fahrschule.
              Kein Gesamtpreis, keine Schätzung.
            </p>
          </div>

          {preise.length > 0 ? (
            <div className="reveal-stagger mt-8 grid gap-6 md:grid-cols-2">
              {preise.map((row) => (
                <PreisRegister key={row.klasse} row={row} />
              ))}
            </div>
          ) : (
            <div className="reveal mt-8 rounded-md border border-dashed border-border bg-card px-6 py-10">
              <h3 className="text-lg font-semibold tracking-tight">Noch keine Preisangaben</h3>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                Für diese Fahrschule liegen uns noch keine Bestandteile des Preisaushangs vor.
                Wir schätzen grundsätzlich nicht — frag direkt bei der Fahrschule nach oder starte
                unverbindlich deine Anmeldung.
              </p>
            </div>
          )}

          <p className="mt-6 text-xs text-muted-foreground">
            Alle Beträge sind einzelne Preisbestandteile laut Aushang, zzgl. amtlicher Prüfgebühren
            (TÜV/DEKRA) — diese Drittgebühren erhebt nicht die Fahrschule. Recherchierte Angaben
            ohne Gewähr, bis die Fahrschule sie bestätigt. Deine Fahrschule? Angaben kostenlos
            prüfen und bestätigen.
          </p>
        </div>
      </section>

      {/* ================= ZONE 3 · Fakten-Blöcke (Weiß) ================= */}
      <section className="bg-background">
        <div className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6">
          <div className="reveal">
            <DossierHeading kicker="Strukturierte Fakten" title="Das Dossier" />
          </div>

          <div className="reveal-stagger mt-8 grid gap-x-10 gap-y-10 md:grid-cols-2">
            {/* Öffnungszeiten als Wochenraster */}
            {school.show.zeiten && school.hours.length > 0 && arten.length > 0 && (
              <FaktenBlock title="Zeiten im Wochenraster">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                      <th scope="col" className="py-1.5 pr-2 font-medium">Tag</th>
                      {arten.map((a) => (
                        <th key={a} scope="col" className="py-1.5 pr-2 font-medium">
                          {ART_LABEL[a] ?? a}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {TAGE.map((tag, i) => (
                      <tr key={tag} className="border-b border-border/60 last:border-b-0">
                        <th scope="row" className="py-2 pr-2 text-left font-medium">
                          {tag.slice(0, 2)}
                          <span className="sr-only">{tag.slice(2)}</span>
                        </th>
                        {arten.map((a) => {
                          const z = zeiten(i, a);
                          return (
                            <td key={a} className="py-2 pr-2 tabular-nums">
                              {z || <span className="text-muted-foreground">—</span>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </FaktenBlock>
            )}

            {/* Fahrzeuge als Spec-Liste */}
            {school.show.vehicles && school.vehicles.length > 0 && (
              <FaktenBlock title="Fahrzeuge">
                <ul className="flex flex-col">
                  {school.vehicles.map((v, i) => (
                    <li key={i} className="border-b border-border/60 py-2.5 last:border-b-0">
                      <p className="text-sm font-semibold tracking-tight">
                        {[v.marke, v.modell].filter(Boolean).join(" ") || "Fahrzeug"}
                      </p>
                      <p className="mt-0.5 flex flex-wrap gap-x-2 gap-y-1 text-xs text-muted-foreground">
                        {v.klasse && <span className="font-mono">Klasse {v.klasse}</span>}
                        {v.getriebe && <span>{GETRIEBE_LABEL[v.getriebe] ?? v.getriebe}</span>}
                        {v.besonderheiten.map((b) => (
                          <span key={b} className="rounded-sm bg-secondary px-1.5 py-0.5 text-secondary-foreground">
                            {b}
                          </span>
                        ))}
                      </p>
                    </li>
                  ))}
                </ul>
              </FaktenBlock>
            )}

            {/* Team */}
            {school.show.instructors && school.instructors.length > 0 && (
              <FaktenBlock title="Team">
                <ul className="flex flex-col gap-2.5">
                  {school.instructors.map((p) => (
                    <li key={p.slug} className="flex items-center gap-3">
                      <span
                        className="flex size-9 items-center justify-center rounded-md bg-secondary font-mono text-sm font-semibold text-secondary-foreground"
                        aria-hidden="true"
                      >
                        {p.name.trim().charAt(0).toUpperCase() || "•"}
                      </span>
                      <span className="text-sm font-medium">{p.name}</span>
                    </li>
                  ))}
                </ul>
              </FaktenBlock>
            )}

            {/* Sprachen + Über die Fahrschule */}
            {(school.sprachen.length > 0 || school.beschreibung) && (
              <FaktenBlock title="Über die Fahrschule">
                {school.beschreibung && (
                  <p className="max-w-prose text-sm text-muted-foreground">{school.beschreibung}</p>
                )}
                {school.sprachen.length > 0 && (
                  <p className="mt-3 flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-medium text-muted-foreground">Unterrichtssprachen:</span>
                    {school.sprachen.map((s) => (
                      <span key={s} className="rounded-sm bg-secondary px-1.5 py-0.5 font-mono text-xs text-secondary-foreground uppercase">
                        {s}
                      </span>
                    ))}
                  </p>
                )}
              </FaktenBlock>
            )}
          </div>
        </div>
      </section>

      {/* ================= ZONE 4 · FAQ (Cyan-Tint) ================= */}
      {school.show.faq && school.faq.length > 0 && (
        <section className="border-t border-border bg-[color-mix(in_oklch,var(--background),var(--brand-cyan)_5%)]">
          <div className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6">
            <div className="reveal">
              <DossierHeading kicker="Häufige Fragen" title="Direkt beantwortet" />
            </div>
            <div className="reveal mt-6 border-t-2 border-foreground/80">
              {school.faq.map((f) => (
                <details key={f.frage} className="group border-b border-border">
                  <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-4 py-3 text-sm font-semibold tracking-tight">
                    {f.frage}
                    <span className="font-mono text-primary transition-transform group-open:rotate-45 motion-reduce:transition-none" aria-hidden="true">
                      +
                    </span>
                  </summary>
                  <p className="max-w-prose pb-4 text-sm text-muted-foreground">{f.antwort}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ================= ZONE 5 · Anfahrt (Weiß) ================= */}
      <section className="border-t border-border bg-background">
        <div className="mx-auto grid w-full max-w-5xl gap-8 px-4 py-14 sm:px-6 md:grid-cols-[1fr_1.2fr]">
          <div className="reveal">
            <DossierHeading kicker="Anfahrt" title="Vor Ort" />
            <p className="mt-4 text-sm text-muted-foreground">
              {adresse || "Adresse folgt."}
              {school.stadtbezirk ? ` · ${school.stadtbezirk}` : ""}
            </p>
            {tel && (
              <p className="mt-2 text-sm">
                Telefon:{" "}
                <a href={telHref(tel)} className="font-semibold text-primary underline-offset-4 hover:underline">
                  {tel}
                </a>
              </p>
            )}
          </div>
          <div className="reveal">
            {tile && marker.length > 0 ? (
              <div className="overflow-hidden rounded-md border border-border">
                <ResultsMap markers={marker} center={{ lat: marker[0].lat, lng: marker[0].lng }} tile={tile} />
              </div>
            ) : (
              <p className="rounded-md border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
                Karte in dieser Umgebung nicht verfügbar — Adresse und Telefon stehen links.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ================= ZONE 6 · Anmelde-Block (Lime-Akzent) ================= */}
      <section
        id="anmeldung"
        className="scroll-mt-24 border-t border-border bg-[color-mix(in_oklch,var(--background),var(--brand-lime)_8%)]"
      >
        <div className="reveal mx-auto w-full max-w-5xl px-4 py-16 sm:px-6">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="max-w-xl">
              <DossierHeading kicker="Nächster Schritt" title="Starte deine Anmeldung" />
              <p className="mt-4 text-base text-muted-foreground">
                Unverbindlich und kostenlos — der Ausbildungsvertrag entsteht direkt bei der
                Fahrschule, nicht bei uns. Wir begleiten dich bis zur Bestätigung.
              </p>
            </div>
            <div className="flex flex-col items-start gap-3">
              <div className="flex flex-wrap items-center gap-3">
                {/* Prototyp: Ziel ist die reale Profilroute (dort lebt später der Funnel) */}
                <Link
                  href={anmeldeHref}
                  className="inline-flex min-h-12 items-center justify-center rounded-md bg-primary px-7 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Anmeldung starten
                </Link>
                {tel && (
                  <a
                    href={telHref(tel)}
                    className="inline-flex min-h-12 items-center justify-center rounded-md border border-primary/40 bg-background px-5 text-base font-semibold text-primary transition-colors hover:bg-primary/5"
                  >
                    Anrufen
                  </a>
                )}
              </div>
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                <TrustBadge size="sm" />
                Antwort direkt von der Fahrschule
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Zurück zur Vorschau-Suche */}
      <p className="mx-auto w-full max-w-5xl px-4 py-6 text-sm sm:px-6">
        <Link href="/vorschau/suche-daten" className="text-primary underline-offset-4 hover:underline">
          ← Zurück zur Ergebnisliste (Datenkonzept)
        </Link>
      </p>

      {/* ================= Mobile Sticky-Bottom-Action-Bar (≥48 px Touch) ================= */}
      <nav
        aria-label="Schnellaktionen"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur md:hidden"
      >
        <div className="mx-auto grid max-w-3xl grid-cols-2 gap-2 px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {tel ? (
            <a
              href={telHref(tel)}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-primary/40 bg-background px-4 text-sm font-semibold text-primary"
            >
              <svg viewBox="0 0 24 24" className="size-4 fill-none stroke-current stroke-2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.4 2.1L8.1 10a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.6 2z" />
              </svg>
              Anrufen
            </a>
          ) : (
            <Link
              href="/vorschau/suche-daten"
              className="inline-flex min-h-12 items-center justify-center rounded-md border border-border bg-background px-4 text-sm font-medium text-muted-foreground"
            >
              Zur Liste
            </Link>
          )}
          <a
            href="#anmeldung"
            className="inline-flex min-h-12 items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
          >
            Anmeldung starten
          </a>
        </div>
      </nav>
    </div>
  );
}
