import type { Metadata } from "next";
import Link from "next/link";
import ResultsMap, { type MapMarker } from "@/components/search/results-map";
import { getTileConfig, type MapTileConfig } from "@/modules/maps";
import { searchSchools, type SearchResult } from "@/modules/schools/search";
import { getPricesForSchool } from "@/modules/schools/prices";
import { formatEuro, type SchoolPriceRow } from "@/lib/preise";
import { DataBadge } from "@/components/school/data-badge";
import { slugify } from "@/lib/slug";

/**
 * VORSCHAU „Suche — Split-Command" (klickbarer Prototyp, ECHTE Demo-Daten).
 * ----------------------------------------------------------------------------
 * Konzept: Vollhöhen-Split-View. Links eine typografisch geführte ERGEBNIS-
 * LISTE AUS ZEILEN (editorial rows, Hairline-Trenner statt Karten-Grid) mit
 * Preis-Komponenten-Duo (Grundbetrag + Fahrstunde — § 32 FahrlG: Komponenten,
 * NIE Gesamt-/„ab"-Preise) samt Provenienz-Badge. Rechts sticky die Karte.
 * Oben eine Command-Bar (Suche + Filter-Chips in EINER Leiste).
 * Hover/Fokus expandiert eine Zeile sanft (grid-rows 0fr→1fr, motion-safe)
 * um Details + CTAs; mobil sind die Details immer sichtbar und die Karte ist
 * ein CSS-Toggle-Layer (Checkbox, ohne JS bedienbar).
 * SSR, token-only, keine Inline-Styles/-Skripte. Reiner Design-Test: nicht
 * verlinkt, noindex — ändert die echte /fahrschulen-Route NICHT.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Vorschau — Suche (Split-Command)",
  robots: { index: false, follow: false },
};

type SP = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/* Dezente blaue Zonen-Tints via color-mix (Kernmuster: weiß ↔ Tint im Wechsel). */
const TINT_SOFT = "bg-[color-mix(in_oklab,var(--brand-sky)_5%,var(--background))]";
const TINT_HOVER =
  "lg:hover:bg-[color-mix(in_oklab,var(--brand-sky)_4%,var(--background))] focus-within:bg-[color-mix(in_oklab,var(--brand-sky)_4%,var(--background))]";

const KLASSEN_FILTER = ["B", "B197", "BE", "A", "A2", "A1"] as const;

const SPRACHE_LABEL: Record<string, string> = {
  de: "Deutsch",
  en: "Englisch",
  tr: "Türkisch",
  ru: "Russisch",
  ar: "Arabisch",
  it: "Italienisch",
  es: "Spanisch",
  fr: "Französisch",
};

/** Google-Rating dezent formatieren („4,7"): Fremdsignal, nie Haupt-Held. */
function fmtRating(r: string): string {
  return r.replace(".", ",");
}

/** Passende Preiszeile wählen: aktive Filter-Klasse > Klasse B > erste Zeile. */
function pickPriceRow(rows: SchoolPriceRow[], klasse: string | undefined): SchoolPriceRow | null {
  if (rows.length === 0) return null;
  if (klasse) {
    const exakt = rows.find((r) => r.klasse === klasse);
    if (exakt) return exakt;
  }
  return rows.find((r) => r.klasse === "B") ?? rows[0];
}

/** EUR oder „keine Angabe" — Lücken werden nie versteckt (Ehrlichkeit als Muster). */
function euroOderLuecke(betrag: number | null): string {
  return betrag != null ? formatEuro(betrag) : "keine Angabe";
}

export default async function VorschauSucheSplit({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const ort = first(sp.ort)?.trim() || "München";
  const klasse = first(sp.klasse) || undefined;
  const partner = first(sp.partner) === "true";

  // Suche fail-soft: bei DB-Fehler bleibt die Seite mit leerem Zustand nutzbar.
  let result: SearchResult | null = null;
  try {
    result = await searchSchools({ ort, klasse, partner: partner ? "true" : undefined });
  } catch {
    result = null;
  }
  const items = result?.items ?? [];

  // Preis-Komponenten je Schule (sequenziell, defensiv — Prototyp-Datenlast ist klein).
  const preise = new Map<string, SchoolPriceRow[]>();
  for (const s of items) {
    try {
      preise.set(s.id, await getPricesForSchool(s.id));
    } catch {
      preise.set(s.id, []);
    }
  }

  // Karte fail-soft (Prod ohne Tile-Anbieter → Split ohne Karte, Liste bleibt voll nutzbar).
  let tile: MapTileConfig | null = null;
  try {
    tile = getTileConfig();
  } catch {
    tile = null;
  }
  const markers: MapMarker[] = items
    .filter((s) => s.latitude != null && s.longitude != null)
    .map((s) => ({ id: s.id, name: s.name, lat: s.latitude as number, lng: s.longitude as number, partner: s.isPartner }));

  /** Filter-Link: Parameter erhalten, einen Wert umschalten (GET, ohne JS nutzbar). */
  const hrefWith = (patch: Record<string, string | null>) => {
    const q = new URLSearchParams();
    if (ort) q.set("ort", ort);
    if (klasse) q.set("klasse", klasse);
    if (partner) q.set("partner", "true");
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) q.delete(k);
      else q.set(k, v);
    }
    const s = q.toString();
    return s ? `/vorschau/suche-split?${s}` : "/vorschau/suche-split";
  };

  const profilHref = (s: { ort: string | null; slug: string }) =>
    `/vorschau/profil-split?stadt=${encodeURIComponent(slugify(s.ort ?? ""))}&slug=${encodeURIComponent(s.slug)}`;

  const totalLabel = result ? `${result.total}${result.hasMore ? "+" : ""}` : "–";

  return (
    /* `group/split` trägt den Mobil-Kartenschalter (Checkbox-State via :has, ohne JS). */
    <div className="group/split flex w-full flex-1 flex-col">
      {/* Karten-Toggle (nur mobil sichtbar als schwebende Pill; Checkbox bleibt fokussierbar) */}
      <input type="checkbox" id="karte-toggle" className="peer sr-only" aria-label="Karte statt Liste anzeigen" />
      <label
        htmlFor="karte-toggle"
        className="fixed bottom-5 left-1/2 z-40 inline-flex min-h-12 -translate-x-1/2 cursor-pointer items-center gap-2 rounded-md border border-foreground/15 bg-foreground px-5 text-sm font-semibold text-background shadow-elevation-2 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring lg:hidden"
      >
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 20l-6-2V4l6 2 6-2 6 2v14l-6-2-6 2z" />
          <path d="M9 6v14M15 4v14" />
        </svg>
        <span className="group-has-[#karte-toggle:checked]/split:hidden">Karte anzeigen</span>
        <span className="hidden group-has-[#karte-toggle:checked]/split:inline">Liste anzeigen</span>
      </label>

      {/* ---- Command-Bar: Suche + Filter in EINER Leiste (cmd-k-Ästhetik) ---- */}
      <div className="sticky top-16 z-30 border-b border-border bg-background/95 supports-[backdrop-filter]:bg-background/85 supports-[backdrop-filter]:backdrop-blur">
        <div className="mx-auto w-full max-w-[96rem] px-4 py-3 sm:px-6">
          <form action="/vorschau/suche-split" method="get" role="search" className="flex items-center gap-2 rounded-md border border-border bg-background px-3 shadow-elevation-1 focus-within:border-ring">
            <svg viewBox="0 0 24 24" className="size-4 shrink-0 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.3-4.3" />
            </svg>
            <label htmlFor="ss-ort" className="sr-only">
              Stadt, Bezirk oder PLZ
            </label>
            <input
              id="ss-ort"
              name="ort"
              defaultValue={ort}
              placeholder="Stadt, Bezirk oder PLZ …"
              className="min-h-12 w-full min-w-0 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
            />
            {klasse ? <input type="hidden" name="klasse" value={klasse} /> : null}
            {partner ? <input type="hidden" name="partner" value="true" /> : null}
            <kbd aria-hidden="true" className="hidden shrink-0 rounded-[4px] border border-border px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground md:inline">
              ⌘K
            </kbd>
            <button
              type="submit"
              className="my-1.5 inline-flex min-h-9 shrink-0 items-center rounded-[4px] bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors duration-[var(--motion-duration-fast)] ease-[var(--motion-ease)] hover:bg-primary/90"
            >
              Suchen
            </button>
          </form>

          {/* Filter-Chips in derselben Leiste: Klasse (Varianten-Konsolidierung) + Partner */}
          <div className="mt-2 flex items-center gap-1.5 overflow-x-auto pb-0.5" role="group" aria-label="Filter">
            <span className="shrink-0 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Klasse</span>
            {KLASSEN_FILTER.map((k) => {
              const aktiv = klasse === k;
              return (
                <Link
                  key={k}
                  href={hrefWith({ klasse: aktiv ? null : k })}
                  aria-current={aktiv ? "true" : undefined}
                  className={`inline-flex min-h-8 shrink-0 items-center rounded-full border px-3 font-mono text-xs transition-colors duration-[var(--motion-duration-fast)] ease-[var(--motion-ease)] ${
                    aktiv
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-foreground hover:border-primary/50 hover:text-primary"
                  }`}
                >
                  {k}
                </Link>
              );
            })}
            <span aria-hidden="true" className="mx-1 h-4 w-px shrink-0 bg-border" />
            <Link
              href={hrefWith({ partner: partner ? null : "true" })}
              aria-current={partner ? "true" : undefined}
              className={`inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors duration-[var(--motion-duration-fast)] ease-[var(--motion-ease)] ${
                partner
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-foreground hover:border-primary/50 hover:text-primary"
              }`}
            >
              <span aria-hidden="true" className="size-1.5 rounded-full bg-accent" />
              Partner
            </Link>
          </div>
        </div>
      </div>

      {/* ---- Vollhöhen-Split: Liste (editorial rows) links · Karte sticky rechts ---- */}
      <div className="mx-auto flex w-full max-w-[96rem] flex-1 items-stretch">
        {/* Liste — auf Mobil ausgeblendet, wenn der Karten-Layer aktiv ist */}
        <div className="min-w-0 flex-1 group-has-[#karte-toggle:checked]/split:max-lg:hidden">
          {/* Listen-Kopf (Tint-Zone) */}
          <header className={`border-b border-border px-4 py-6 sm:px-6 ${TINT_SOFT}`}>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Vorschau-Prototyp · Demo-Daten · Index
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">
              Fahrschulen in {ort}
              <span className="ml-3 align-middle font-mono text-sm font-normal text-muted-foreground">
                {totalLabel} Treffer
              </span>
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Preise als Komponenten des amtlichen Preisaushangs (§ 32 FahrlG) — bewusst ohne Gesamt- oder
              „ab“-Preise. Google-Bewertungen sind ein Fremdsignal und entsprechend gekennzeichnet.
            </p>
          </header>

          {/* Ergebnis-Zeilen: scharfe Hairlines, Typografie trägt die Hierarchie */}
          {items.length === 0 ? (
            <div className="px-4 py-16 text-center sm:px-6">
              <p className="text-lg font-semibold">Keine Treffer für „{ort}“</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {result ? "Filter lösen oder anderen Ort probieren." : "Demo-Daten konnten nicht geladen werden."}
              </p>
            </div>
          ) : (
            <ol className="list-none">
              {items.map((s, i) => {
                const row = pickPriceRow(preise.get(s.id) ?? [], klasse);
                const sprachen = s.sprachen.map((c) => SPRACHE_LABEL[c] ?? c.toUpperCase());
                return (
                  <li key={s.id} className={`group relative border-b border-border transition-colors duration-[var(--motion-duration-fast)] ease-[var(--motion-ease)] ${TINT_HOVER}`}>
                    <div className="flex flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-start lg:gap-6">
                      {/* laufende Nummer — korrespondiert mit den Pins rechts */}
                      <span aria-hidden="true" className="hidden w-8 shrink-0 pt-1 font-mono text-sm text-muted-foreground/70 lg:block">
                        {String(i + 1).padStart(2, "0")}
                      </span>

                      {/* Name + Meta-Zeile */}
                      <div className="min-w-0 flex-1">
                        <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
                          {/* Ganze Zeile ist Klickziel (after-Overlay); CTAs unten liegen über dem Overlay */}
                          <Link
                            href={profilHref(s)}
                            className="rounded-sm outline-offset-4 after:absolute after:inset-0 after:content-['']"
                          >
                            {s.name}
                          </Link>
                        </h2>
                        <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                          <span className="font-medium text-foreground/80">{s.stadtbezirk ?? s.ort ?? "—"}</span>
                          {s.distanzKm != null && (
                            <span className="font-mono tabular-nums">· {s.distanzKm.toFixed(1).replace(".", ",")} km</span>
                          )}
                          {s.googleRating && (
                            <span title="Fremdsignal: Bewertung bei Google, nicht von onelane erhoben">
                              · <span aria-hidden="true">★</span> {fmtRating(s.googleRating)} · Google
                              {s.googleReviewsCount ? `, ${s.googleReviewsCount} Bew.` : ""}
                            </span>
                          )}
                          {s.isPartner && (
                            <span className="inline-flex items-center gap-1 rounded-[4px] border border-primary/40 px-1.5 py-0.5 text-[11px] font-medium text-primary">
                              <span aria-hidden="true" className="size-1 rounded-full bg-accent" />
                              Partner
                            </span>
                          )}
                        </p>
                        {/* Klassen-Chips (eine Schule = eine Zeile, Varianten konsolidiert) */}
                        {s.klassen.length > 0 && (
                          <p className="mt-2 flex flex-wrap gap-1">
                            {s.klassen.slice(0, 6).map((k) => (
                              <span key={k} className="rounded-[3px] border border-border px-1.5 py-0.5 font-mono text-[11px] text-foreground/80">
                                {k}
                              </span>
                            ))}
                            {s.klassen.length > 6 && (
                              <span className="px-1 py-0.5 font-mono text-[11px] text-muted-foreground">+{s.klassen.length - 6}</span>
                            )}
                          </p>
                        )}
                      </div>

                      {/* Preis-Komponenten-Duo — spaltenbündig über alle Zeilen (Liste = Vergleichstabelle) */}
                      <div className="shrink-0 lg:w-64">
                        {row ? (
                          <>
                            <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
                              <dt className="text-muted-foreground">Grundbetrag</dt>
                              <dd className="text-right font-mono tabular-nums">{euroOderLuecke(row.komponenten.grundbetrag)}</dd>
                              <dt className="text-muted-foreground">Fahrstunde (45 Min.)</dt>
                              <dd className="text-right font-mono tabular-nums">{euroOderLuecke(row.komponenten.fahrstunde45)}</dd>
                            </dl>
                            <div className="mt-2 flex flex-wrap items-center justify-between gap-1 lg:justify-end">
                              <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                                Klasse {row.klasse}
                              </span>
                              <DataBadge status={row.status} stand={row.stand} />
                            </div>
                          </>
                        ) : (
                          <p className="text-sm text-muted-foreground lg:text-right">
                            <span className="block font-medium text-foreground/70">Keine Preisangabe</span>
                            Preisaushang vor Ort — die Schule kann ihre Daten bei uns bestätigen.
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Expansions-Zone: Desktop bei Hover/Fokus (0fr→1fr, motion-safe), mobil immer offen */}
                    <div className="grid grid-rows-[1fr] motion-safe:transition-[grid-template-rows] motion-safe:duration-[var(--motion-duration-base)] motion-safe:ease-[var(--motion-ease)] lg:grid-rows-[0fr] lg:group-focus-within:grid-rows-[1fr] lg:group-hover:grid-rows-[1fr]">
                      <div className="min-h-0 overflow-hidden">
                        <div className={`relative z-10 mx-4 mb-5 flex flex-col gap-3 rounded-md border border-border/70 px-4 py-3 sm:mx-6 lg:flex-row lg:items-center lg:justify-between ${TINT_SOFT} motion-safe:transition-opacity motion-safe:duration-[var(--motion-duration-base)] motion-safe:ease-[var(--motion-ease)] lg:opacity-0 lg:group-focus-within:opacity-100 lg:group-hover:opacity-100`}>
                          <div className="min-w-0 text-sm text-muted-foreground">
                            {sprachen.length > 0 && (
                              <p>
                                <span className="font-mono text-[11px] uppercase tracking-[0.1em]">Sprachen</span>{" "}
                                <span className="text-foreground/80">{sprachen.join(" · ")}</span>
                              </p>
                            )}
                            <p className="mt-0.5">
                              <span className="font-mono text-[11px] uppercase tracking-[0.1em]">Ort</span>{" "}
                              <span className="text-foreground/80">{[s.ort, s.stadtbezirk].filter(Boolean).join(" — ") || "—"}</span>
                              {markers.some((m) => m.id === s.id) && <span className="ml-1">· als Pin auf der Karte</span>}
                            </p>
                          </div>
                          <div className="flex shrink-0 flex-wrap items-center gap-2">
                            <Link
                              href={profilHref(s)}
                              className="inline-flex min-h-11 items-center rounded-[4px] border border-border bg-background px-4 text-sm font-medium transition-colors duration-[var(--motion-duration-fast)] ease-[var(--motion-ease)] hover:border-primary/50 hover:text-primary"
                            >
                              Dossier ansehen
                            </Link>
                            <Link
                              href={`${profilHref(s)}#anmeldung`}
                              className="inline-flex min-h-11 items-center rounded-[4px] bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors duration-[var(--motion-duration-fast)] ease-[var(--motion-ease)] hover:bg-primary/90"
                            >
                              Anmeldung starten
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}

          {/* Fuß-Zone (Tint): Transparenz-Hinweis als wiederkehrendes Mikro-Muster */}
          <footer className={`px-4 py-6 sm:px-6 ${TINT_SOFT}`}>
            <p className="font-mono text-[11px] leading-relaxed text-muted-foreground">
              § 32 FahrlG: Preisdarstellung als Komponenten des Preisaushangs — kein Gesamtpreis, keine
              Kostenschätzung. „Recherchiert“ = ohne Gewähr bis zur Bestätigung durch die Fahrschule.
              Prüfungsgebühren (TÜV/DEKRA) fallen zusätzlich als Drittgebühren an.
            </p>
            <p className="mt-2">
              <Link href="/vorschau" className="text-sm text-primary underline-offset-2 hover:underline">
                ← Zur Vorschau-Übersicht
              </Link>
            </p>
          </footer>
        </div>

        {/* Karte — Desktop sticky rechts in Vollhöhe; mobil als Toggle-Layer im Fluss */}
        {tile && markers.length > 0 && (
          <aside
            aria-label="Karte der Suchergebnisse"
            className="hidden w-full border-border group-has-[#karte-toggle:checked]/split:block max-lg:pb-24 lg:block lg:w-[42%] lg:shrink-0 lg:border-l xl:w-[45%]"
          >
            <div className="lg:sticky lg:top-[7.75rem] lg:h-[calc(100vh-7.75rem)]">
              <div className="h-[70vh] p-3 lg:h-full [&_.map-ci]:h-full [&_.map-ci]:rounded-md [&_.map-ci]:shadow-none">
                <ResultsMap markers={markers} center={result?.zentrum ?? null} tile={tile} />
              </div>
              <p className="pointer-events-none absolute bottom-6 left-1/2 z-20 hidden -translate-x-1/2 rounded-[4px] border border-border bg-background/90 px-2.5 py-1 font-mono text-[11px] text-muted-foreground lg:block">
                {markers.length} Pins · Zeile ↔ Pin
              </p>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
