import type { Metadata } from "next";
import Link from "next/link";
import { SearchBar } from "@/components/search/search-bar";
import { SearchDock } from "@/components/search/search-dock";
import { FilterBar } from "@/components/search/filter-bar";
import ResultsMap, { type MapMarker } from "@/components/search/results-map";
import { PinStage, type PinPunkt } from "@/components/search/pin-stage";
import { preisSichtFuerZeile, gruppierePreiseNachSchule } from "@/components/search/price-view";
import { VergleichMerker } from "@/components/search/vergleich-merker";
import { VergleichLeiste } from "@/components/search/vergleich-leiste";
import { DataBadge } from "@/components/school/data-badge";
import { RatingStern, QuoteTeaser, ratingFarbClass } from "@/components/school/rating";
import { TrustBadge } from "@/components/trust/trust-badge";
import { JsonLd } from "@/components/seo/json-ld";
import { getTileConfig, type MapTileConfig } from "@/modules/maps";
import { searchSchools, type SearchResult } from "@/modules/schools/search";
import { listPricesForSchools } from "@/modules/schools/prices";
import { formatEuro, type SchoolPriceRow } from "@/lib/preise";
import { ctaLabel } from "@/lib/cta";
import { slugify } from "@/lib/slug";

/**
 * Ergebnisseite /fahrschulen — finales Produkt-Design (Editorial-Zeilen-Dossier).
 * ----------------------------------------------------------------------------
 * Liste als typografisch geführte Editorial-Zeilen (Hairlines statt Karten-Grid),
 * ohne Karten-JS vollständig nutzbar. Je Zeile: Preis-Komponenten-Duo gemäß
 * § 32 FahrlG (Grundbetrag + Fahrstunde NUR bei vollständigem Pflichtangaben-Set
 * herausgestellt, sonst neutraler Hinweis) mit Provenienz-Badge, dazu immer
 * sichtbare CTAs (Label zentral via lib/cta.ts → Profil-Anker; Telefon liefert
 * die Suche nicht — der Anruf-CTA lebt im Profil). Ein aktiver Klassen-Filter
 * reist als ?klasse= in die Profil-Links (Preisaushang-Fokus dort). Vor der
 * Liste eine Lese-Legende
 * (kein Gesamtpreis by design, Kennzeichnung, Prüfgebühren als Drittgebühren).
 * Karte: Leaflet-Island sticky rechts NUR mit Tile-Config; sonst trägt eine
 * SSR-SVG-Lageskizze mit nummerierten Pins (Pin-Nr = Zeilen-Nr) den Überblick.
 * Mobil erscheint der Karten-Toggle NUR, wenn die echte Karte existiert.
 * JSON-LD ItemList bleibt deckungsgleich mit der sichtbaren Liste; Ergebnisse
 * sind parametrisiert und daher noindex (Stadt-Landingpages = eigene Phase).
 */
export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/* Dezente Blau-Tint-Zonen via color-mix (Kernmuster: Weiß ↔ Tint im Wechsel). */
const TINT_SOFT = "bg-[color-mix(in_oklab,var(--brand-sky)_5%,var(--background))]";
const TINT_HOVER =
  "lg:hover:bg-[color-mix(in_oklab,var(--brand-sky)_4%,var(--background))] focus-within:bg-[color-mix(in_oklab,var(--brand-sky)_4%,var(--background))]";

const SPRACHE_LABEL: Record<string, string> = {
  de: "Deutsch",
  en: "Englisch",
  tr: "Türkisch",
  ru: "Russisch",
  ar: "Arabisch",
  it: "Italienisch",
  es: "Spanisch",
  fr: "Französisch",
  el: "Griechisch",
};

/** Google-Rating dezent im deutschen Format („4,7") — Fremdsignal, nie Held. */
const fmtRating = (r: string) => r.replace(".", ",");

/** Distanz in km, de-DE, eine Nachkommastelle. */
const fmtKm = (d: number) => `${d.toLocaleString("de-DE", { maximumFractionDigits: 1 })} km`;

export async function generateMetadata({ searchParams }: { searchParams: Promise<SP> }): Promise<Metadata> {
  const sp = await searchParams;
  const ort = first(sp.ort);
  const klasse = first(sp.klasse);
  const title = ort ? `Fahrschulen nahe ${ort}${klasse ? ` · Klasse ${klasse}` : ""}` : "Fahrschulen finden";
  return { title, robots: { index: false, follow: true } };
}

export default async function FahrschulenPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const cur = (k: string) => first(sp[k]) ?? "";

  let result: SearchResult | null = null;
  let failed = false;
  try {
    result = await searchSchools({
      ort: first(sp.ort), lat: first(sp.lat), lng: first(sp.lng),
      klasse: first(sp.klasse), sprache: first(sp.sprache), partner: first(sp.partner),
      umkreisKm: first(sp.umkreis), sort: first(sp.sort), seite: first(sp.seite),
    });
  } catch {
    failed = true;
  }
  const items = result?.items ?? [];

  // Preisspalte: aktive Filter-Klasse (defensiv validiert) — ohne Filter alle
  // Klassen laden und je Zeile Klasse B (Fallback: erste Zeile) anzeigen.
  const rawKlasse = cur("klasse");
  const klasseFilter = /^[A-Za-z0-9]{1,12}$/.test(rawKlasse) ? rawKlasse : undefined;
  let preiseNachSchule = new Map<string, SchoolPriceRow[]>();
  try {
    const rows = await listPricesForSchools(items.map((s) => s.id), klasseFilter);
    preiseNachSchule = gruppierePreiseNachSchule(rows);
  } catch {
    preiseNachSchule = new Map();
  }

  // Karte: Tile-Config (in Prod fail-closed → SSR-SVG-Lageskizze statt Leaflet).
  let tile: MapTileConfig | null = null;
  try {
    tile = getTileConfig();
  } catch {
    tile = null;
  }
  const markers: MapMarker[] = items
    .filter((s) => s.latitude != null && s.longitude != null)
    .map((s) => ({ id: s.id, name: s.name, lat: s.latitude as number, lng: s.longitude as number, partner: s.isPartner }));
  // Pin-Nr = Zeilen-Nr (1-basiert über die sichtbare Seite, Zeilen ohne Koordinaten ohne Pin).
  const pinPunkte: PinPunkt[] = items
    .map((s, i) => ({ nr: i + 1, lat: s.latitude, lng: s.longitude, partner: s.isPartner }))
    .filter((p): p is PinPunkt => p.lat != null && p.lng != null);
  const hatKarte = tile != null && markers.length > 0;

  // JSON-LD ItemList — exakt die sichtbaren Treffer der aktuellen Seite.
  const itemList =
    result && result.items.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "ItemList",
          numberOfItems: result.items.length,
          itemListElement: result.items.map((s, i) => ({
            "@type": "ListItem",
            position: (result.seite - 1) * result.proSeite + i + 1,
            item: {
              "@type": "DrivingSchool",
              name: s.name,
              ...(s.stadtbezirk ?? s.ort
                ? { address: { "@type": "PostalAddress", addressLocality: s.stadtbezirk ?? s.ort ?? "", addressCountry: "DE" } }
                : {}),
              ...(s.googleRating
                ? {
                    aggregateRating: {
                      "@type": "AggregateRating",
                      ratingValue: s.googleRating,
                      ...(s.googleReviewsCount ? { reviewCount: s.googleReviewsCount } : {}),
                    },
                  }
                : {}),
            },
          })),
        }
      : null;

  const pageHref = (seite: number) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
      const val = first(v);
      if (val) next.set(k, val);
    }
    next.set("seite", String(seite));
    return `/fahrschulen?${next.toString()}`;
  };

  /** Profil-URL (flach: /fahrschulen/{stadt}/{schule}); ohne Ort keine Verlinkung.
   *  Ein aktiver Klassen-Filter reist als ?klasse= mit (Preisaushang-Fokus im Profil). */
  const profilHref = (s: { ort: string | null; slug: string }) =>
    s.ort
      ? `/fahrschulen/${slugify(s.ort)}/${s.slug}${
          klasseFilter ? `?klasse=${encodeURIComponent(klasseFilter)}` : ""
        }`
      : null;

  const ortLabel = cur("ort");
  const sortLabel = result?.zentrum ? "Entfernung" : "Bewertung";

  return (
    /* `group/suche` trägt den Mobil-Kartenschalter (Checkbox-State via :has, ohne JS). */
    <div className="group/suche flex w-full flex-1 flex-col">
      {/* Karten-Toggle: NUR wenn die echte Karte existiert (fail-soft, kein leerer Layer) */}
      {hatKarte && (
        <>
          <input type="checkbox" id="karte-toggle" className="peer sr-only" aria-label="Karte statt Liste anzeigen" />
          {/* bottom rechnet die Höhe der Compare-Bar ein (--vergleich-leiste-h,
              gesetzt von VergleichLeiste; Fallback 0px) — keine Kollision der
              beiden fixed-Elemente am unteren Rand. */}
          <label
            htmlFor="karte-toggle"
            className="fixed bottom-[calc(1.25rem+var(--vergleich-leiste-h,0px))] left-1/2 z-40 inline-flex min-h-12 -translate-x-1/2 cursor-pointer items-center gap-2 rounded-full border border-foreground/15 bg-foreground px-5 text-sm font-semibold text-background shadow-elevation-2 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring lg:hidden"
          >
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 20l-6-2V4l6 2 6-2 6 2v14l-6-2-6 2z" />
              <path d="M9 6v14M15 4v14" />
            </svg>
            <span className="group-has-[#karte-toggle:checked]/suche:hidden">Karte anzeigen</span>
            <span className="hidden group-has-[#karte-toggle:checked]/suche:inline">Liste anzeigen</span>
          </label>
        </>
      )}

      {/* ---- Command-Zone: Suche + Sofort-Filter in einer ruhigen Leiste ---- */}
      <div className="border-b border-border bg-background">
        <div className="mx-auto flex w-full max-w-[90rem] flex-col items-stretch gap-3 px-4 py-4 sm:px-6">
          <div className="flex justify-center">
            <SearchBar compact />
          </div>
          <FilterBar />
        </div>
      </div>

      {/* Search-Dock: Sentinel unter der Command-Zone — beim Scrollen erscheint
          die Mini-Such-Pill im Header (Client-Insel, ohne JS nicht vorhanden). */}
      <SearchDock ort={ortLabel} />

      {itemList && <JsonLd data={itemList} />}

      {failed ? (
        <p className="mx-auto w-full max-w-[90rem] px-4 py-16 text-sm text-muted-foreground sm:px-6">
          Die Suche konnte nicht ausgeführt werden. Bitte Eingabe prüfen.
        </p>
      ) : !result || result.total === 0 ? (
        <div className="mx-auto w-full max-w-[90rem] px-4 py-16 sm:px-6">
          <p className="text-lg font-semibold">
            Keine Fahrschulen gefunden{ortLabel ? ` für „${ortLabel}“` : ""}.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Versuch es mit einem größeren Umkreis oder einem anderen Ort.
          </p>
        </div>
      ) : (
        <div className="mx-auto w-full max-w-[90rem] flex-1">
          {/* ---- Kopf-Zone (Tint): Zählung + offene Sortier-/Bezugspunkt-Deklaration ---- */}
          <header className={`border-b border-border px-4 py-6 sm:px-6 ${TINT_SOFT}`}>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {result.total}{result.hasMore ? "+" : ""} Fahrschule{result.total === 1 && !result.hasMore ? "" : "n"}
              {ortLabel ? ` nahe ${ortLabel}` : ""}
            </h1>
            <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span>
                Sortierung: <span className="font-semibold text-foreground">{first(sp.sort) === "bewertung" ? "Bewertung" : first(sp.sort) === "relevanz" ? "Relevanz" : sortLabel}</span> · ohne bezahlte Platzierung
              </span>
              {result.zentrum && (
                <span>
                  Entfernungen gemessen ab: <span className="font-medium text-foreground">{ortLabel || "gewähltem Kartenpunkt"}</span> (Luftlinie)
                </span>
              )}
            </p>
          </header>

          {/* ---- Lese-Legende VOR der Liste (Weiß): so liest du diese Seite ---- */}
          <section aria-label="Lesehilfe zu Preisen und Kennzeichnung" className="border-b border-border bg-background">
            <div className="grid w-full gap-6 px-4 py-6 sm:px-6 md:grid-cols-3">
              <div>
                <h2 className="text-sm font-semibold tracking-tight">Kein Gesamtpreis — mit Absicht</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Fahrschul-Preise bestehen aus amtlichen Bestandteilen wie Grundbetrag und Fahrstunde
                  (§ 32 FahrlG). Wir zeigen sie einzeln und rechnen nichts hoch — jede Summe wäre eine Schätzung.
                </p>
              </div>
              <div>
                <h2 className="text-sm font-semibold tracking-tight">So liest du die Kennzeichnung</h2>
                <div className="mt-2 flex flex-col items-start gap-1.5">
                  <DataBadge status="recherchiert" />
                  <DataBadge status="bestaetigt" />
                </div>
              </div>
              <div>
                <h2 className="text-sm font-semibold tracking-tight">Immer zusätzlich</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Alle Angaben zzgl. amtlicher Prüfgebühren (TÜV/DEKRA) — das sind Drittgebühren.
                  Der vollständige Preisaushang steht in jedem Profil.
                </p>
              </div>
            </div>
            <p className="px-4 pb-1.5 text-xs text-muted-foreground sm:px-6">
              Mit „Vergleichen“ merkst du dir bis zu vier Fahrschulen und stellst ihre Preisbestandteile nebeneinander — Komponente für Komponente, ohne Gesamtpreis.
            </p>
            <p className="px-4 pb-4 text-xs text-muted-foreground sm:px-6">
              Google-Bewertungen stammen nicht von onelane — wir zeigen sie klein und mit klarer Quelle. Fahrschulen können ihre Position bei uns weder kaufen noch beeinflussen.
            </p>
          </section>

          {/* ---- Split: Editorial-Zeilen links · Karte/Lageskizze sticky rechts ---- */}
          <div className="grid lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_440px]">
            <div className={`min-w-0 ${hatKarte ? "group-has-[#karte-toggle:checked]/suche:max-lg:hidden" : ""}`}>
              {/* Tiefe Seite ohne Treffer (direkt aufgerufene URL): ehrlicher Hinweis statt Leere */}
              {items.length === 0 && (
                <p className="border-b border-border px-4 py-10 text-sm text-muted-foreground sm:px-6">
                  Diese Seite enthält keine weiteren Treffer.{" "}
                  <a href={pageHref(1)} className="text-primary underline-offset-2 hover:underline">
                    Zur ersten Seite
                  </a>
                </p>
              )}
              <ol className="list-none">
                {items.map((s, i) => {
                  const sicht = preisSichtFuerZeile(preiseNachSchule.get(s.id) ?? [], klasseFilter);
                  const href = profilHref(s);
                  // Stadt-Slug für den Vergleichs-Merker — nur mit Ort adressierbar
                  // (gleiche Bedingung wie der Profil-Link).
                  const stadtSlug = s.ort ? slugify(s.ort) : null;
                  const sprachen = s.sprachen.map((c) => SPRACHE_LABEL[c] ?? c.toUpperCase());
                  return (
                    <li key={s.id} className={`group relative border-b border-border transition-colors duration-[var(--motion-duration-fast)] ease-[var(--motion-ease)] ${TINT_HOVER}`}>
                      <article className="flex flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-start lg:gap-6">
                        {/* Laufende Nummer — korrespondiert mit den Pins der Karte/Skizze */}
                        <span aria-hidden="true" className="hidden w-8 shrink-0 pt-1 font-mono text-sm text-muted-foreground/70 lg:block">
                          {String(i + 1).padStart(2, "0")}
                        </span>

                        {/* Name + Meta + Chips + CTAs */}
                        <div className="min-w-0 flex-1">
                          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
                            {href ? (
                              /* Ganze Zeile ist Klickziel (after-Overlay); CTAs liegen mit z-10 darüber */
                              <Link href={href} className="rounded-[3px] outline-offset-4 after:absolute after:inset-0 after:content-['']">
                                {s.name}
                              </Link>
                            ) : (
                              s.name
                            )}
                          </h2>
                          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                            <span className="font-medium text-foreground/80">{s.stadtbezirk ?? s.ort ?? "—"}</span>
                            {s.distanzKm != null && <span className="font-mono tabular-nums">· {fmtKm(s.distanzKm)}</span>}
                            {s.googleRating && (
                              <span
                                className="inline-flex items-center gap-1"
                                title="Bewertung bei Google — nicht von onelane erhoben"
                              >
                                <span aria-hidden="true">·</span>
                                <RatingStern />
                                {/* Zahlwert in Noten-Farbe (ratingFarbClass), Stern bleibt Gold */}
                                <span className={`font-bold tabular-nums ${ratingFarbClass(s.googleRating)}`}>
                                  {fmtRating(s.googleRating)}
                                </span>
                                {s.googleReviewsCount ? <span>({s.googleReviewsCount})</span> : null}
                                <span>· Google</span>
                              </span>
                            )}
                            {s.isPartner && (
                              <span className="inline-flex items-center gap-1 rounded-[4px] border border-primary/40 px-1.5 py-0.5 text-[11px] font-medium text-primary">
                                <span aria-hidden="true" className="size-1 rounded-full bg-accent" />
                                Partner
                              </span>
                            )}
                            {s.isVerified && (
                              <span className="rounded-[4px] border border-border px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                                Verifiziert
                              </span>
                            )}
                            <QuoteTeaser />
                          </p>
                          {s.klassen.length > 0 && (
                            <p className="mt-2 flex flex-wrap gap-1" aria-label="Führerscheinklassen">
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
                          {sprachen.length > 0 && (
                            <p className="mt-1.5 text-sm text-muted-foreground">
                              <span className="font-mono text-[11px] uppercase tracking-[0.1em]">Sprachen</span>{" "}
                              <span className="text-foreground/80">{sprachen.join(" · ")}</span>
                            </p>
                          )}

                          {/* CTAs — IMMER sichtbar; Telefon liefert die Suche nicht (Anruf-CTA im Profil) */}
                          {href && (
                            <div className="relative z-10 mt-3 flex flex-wrap items-center gap-2">
                              <Link
                                href={`${href}#anmeldung`}
                                className="inline-flex min-h-11 items-center rounded-full bg-accent px-5 text-sm font-semibold text-accent-foreground transition-colors duration-[var(--motion-duration-fast)] ease-[var(--motion-ease)] hover:bg-brand-lime"
                              >
                                {ctaLabel({ isPartner: s.isPartner })}
                              </Link>
                              <Link
                                href={href}
                                className="inline-flex min-h-11 items-center rounded-full border border-border bg-background px-5 text-sm font-medium transition-colors duration-[var(--motion-duration-fast)] ease-[var(--motion-ease)] hover:border-primary/50 hover:text-primary"
                              >
                                Profil ansehen
                              </Link>
                              {/* Client-Insel: „Vergleichen“-Toggle (localStorage-Merker,
                                  max. 4) — liegt wie die CTAs mit z-10 über dem
                                  Zeilen-Overlay-Link; ohne JS nicht vorhanden. */}
                              {stadtSlug && (
                                <VergleichMerker stadtSlug={stadtSlug} slug={s.slug} name={s.name} />
                              )}
                            </div>
                          )}
                        </div>

                        {/* Preis-Komponenten-Duo — spaltenbündig (Liste = Vergleichstabelle), §32-Gating */}
                        <div className="shrink-0 lg:w-64">
                          {sicht.kind === "duo" && (
                            <>
                              <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
                                <dt className="text-muted-foreground">Grundbetrag</dt>
                                <dd className="text-right font-mono tabular-nums">{formatEuro(sicht.grundbetrag)}</dd>
                                <dt className="text-muted-foreground">Fahrstunde (45 Min.)</dt>
                                <dd className="text-right font-mono tabular-nums">{formatEuro(sicht.fahrstunde45)}</dd>
                              </dl>
                              <div className="mt-2 flex flex-wrap items-center justify-between gap-1 lg:justify-end">
                                <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                                  Klasse {sicht.klasse}
                                </span>
                                <DataBadge status={sicht.status} stand={sicht.stand} />
                              </div>
                            </>
                          )}
                          {sicht.kind === "teil" && (
                            <div className="flex flex-col gap-1.5 lg:items-end">
                              <p className="text-sm text-muted-foreground lg:text-right">
                                <span className="block font-medium text-foreground/70">Preisaushang unvollständig</span>
                                alle vorliegenden Komponenten im Profil — wir schätzen nicht.
                              </p>
                              <DataBadge status={sicht.status} stand={sicht.stand} />
                            </div>
                          )}
                          {sicht.kind === "none" && (
                            <p className="text-sm text-muted-foreground lg:text-right">
                              <span className="block font-medium text-foreground/70">Keine Preisangabe</span>
                              Preisaushang vor Ort — die Fahrschule kann ihre Daten bei uns bestätigen.
                            </p>
                          )}
                        </div>
                      </article>
                    </li>
                  );
                })}
              </ol>

              {result.seiten > 1 && (
                <nav className="flex items-center justify-between border-b border-border px-4 py-3 text-sm sm:px-6" aria-label="Seiten">
                  {result.seite > 1 ? (
                    <a className="inline-flex min-h-11 items-center rounded-[4px] px-2 underline-offset-2 hover:underline" href={pageHref(result.seite - 1)}>
                      ← Zurück
                    </a>
                  ) : (
                    <span className="inline-flex min-h-11 items-center px-2 text-muted-foreground">← Zurück</span>
                  )}
                  <span className="text-muted-foreground">Seite {result.seite} / {result.seiten}</span>
                  {result.seite < result.seiten ? (
                    <a className="inline-flex min-h-11 items-center rounded-[4px] px-2 underline-offset-2 hover:underline" href={pageHref(result.seite + 1)}>
                      Weiter →
                    </a>
                  ) : (
                    <span className="inline-flex min-h-11 items-center px-2 text-muted-foreground">Weiter →</span>
                  )}
                </nav>
              )}

              {/* ---- Fuß-Zone (Tint): §-32-Transparenz + Markenversprechen ---- */}
              <footer className={`px-4 py-6 sm:px-6 ${TINT_SOFT}`}>
                <p className="font-mono text-[11px] leading-relaxed text-muted-foreground">
                  § 32 FahrlG: Preisdarstellung als Komponenten des amtlichen Preisaushangs — kein Gesamtpreis,
                  keine Kostenschätzung. Recherchierte Angaben gelten ohne Gewähr, bis die Fahrschule sie
                  bestätigt. Amtliche Prüfgebühren (TÜV/DEKRA) fallen zusätzlich als Drittgebühren an.
                </p>
                <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <TrustBadge size="sm" />
                  <span>Deine Anfrage über onelane ist kostenlos &amp; unverbindlich.</span>
                </p>
              </footer>
            </div>

            {/* ---- Karte (Leaflet) ODER SSR-Lageskizze — nie ein leerer Layer ---- */}
            {hatKarte ? (
              <aside
                aria-label="Karte der Suchergebnisse"
                className="hidden border-border group-has-[#karte-toggle:checked]/suche:max-lg:block max-lg:px-4 max-lg:pb-24 max-lg:pt-4 lg:block lg:border-l"
              >
                <div className="lg:sticky lg:top-20 lg:p-3">
                  <ResultsMap markers={markers} center={result.zentrum} tile={tile as MapTileConfig} />
                </div>
              </aside>
            ) : pinPunkte.length > 0 ? (
              <aside aria-label="Stilisierte Lageskizze der Suchergebnisse" className="hidden border-border lg:block lg:border-l">
                <div className="lg:sticky lg:top-20 lg:p-3">
                  <div className="overflow-hidden rounded-md border border-border">
                    <div className="aspect-[4/5] w-full">
                      <PinStage punkte={pinPunkte} zentrum={result.zentrum} />
                    </div>
                  </div>
                  <p className="mt-2 font-mono text-[11px] text-muted-foreground">
                    Pin-Nummer = Zeilen-Nummer · stilisierte Skizze, keine maßstabsgetreue Karte
                  </p>
                </div>
              </aside>
            ) : null}
          </div>
        </div>
      )}

      {/* Sticky Compare-Bar (Client-Insel): erscheint erst ab ≥ 1 gemerkter
          Fahrschule — fixed am unteren Rand, daher kein Layout-Shift. Ohne JS
          existiert der Vergleichs-UI-Layer nicht; /vergleich-URLs funktionieren
          unabhängig davon (SSR). Der aktive Klassen-Filter reist als ?klasse=
          in die Vergleichs-URL. */}
      <VergleichLeiste klasse={klasseFilter ?? null} />
    </div>
  );
}
