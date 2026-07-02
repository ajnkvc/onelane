import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import ResultsMap from "@/components/search/results-map";
import { DataBadge } from "@/components/school/data-badge";
import { TrustBadge } from "@/components/trust/trust-badge";
import { RevealOnScroll } from "@/components/home/reveal";
import { getTileConfig, type MapTileConfig } from "@/modules/maps";
import { getSchoolProfile, type SchoolProfileDetail } from "@/modules/schools/profile";
import { getPricesForSchool, type SchoolPriceRow } from "@/modules/schools/prices";
import { PREIS_KOMPONENTEN, hatPflichtangabenSet, formatEuro, formatStand } from "@/lib/preise";

/**
 * VORSCHAU „Canvas · Profil" — Story-Scroll: die Fahrschul-Seite als Bühne in AKTEN.
 * ----------------------------------------------------------------------------
 * Jeder Akt ist eine Zone mit wechselndem Hintergrund (weiß ↔ dezente Blau-Tints
 * via color-mix); eine durchgehende gestrichelte FAHRBAHN-LINIE führt als
 * Scroll-Faden durch die Seite (md+). Widgets: interaktiver Preisaushang
 * (native <details>, ohne JS bedienbar), Theorie-Zeitleiste aus strukturierten
 * von/bis-Zeiten, Garage als Snap-Slider, Anfahrt mit Mini-Karte (fail-soft).
 * Mobil: Sticky-Bottom-Action-Bar (Anrufen | Anmeldung starten, Touch ≥48px).
 *
 * ECHTE DATEN: getSchoolProfile (Seed München, ?s=<slug>, Fallback Isarpilot) +
 * getPricesForSchool. §32 FahrlG: Preise ausschließlich als Komponenten-Tabelle
 * des Aushangs (kein Gesamt-/„ab"-Preis, keine Schätzung), Provenienz-Badge +
 * Stand an jeder Klasse. Keine öffentliche E-Mail der Schule (nur Telefon +
 * Formular-CTA). Google-Rating nur dezent mit Quellen-Label.
 */
export const metadata: Metadata = {
  title: "Vorschau — Canvas · Profil (Story-Scroll)",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

/** Marienplatz als fixer Demo-Bezugspunkt für die Anfahrts-Entfernung. */
const ZENTRUM = { lat: 48.1374, lng: 11.5755 };
const DAYS_SHORT = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const KATEGORIE_LABEL: Record<string, string> = {
  gebaeude: "Gebäude",
  theorie: "Theorieraum",
  fahrzeug: "Fahrzeug",
};

type SP = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const hhmm = (t: string) => t.slice(0, 5);

/** Exakte Haversine-Distanz in km (nur fürs Anfahrts-Widget der Demo). */
function distanceKm(lat: number, lng: number): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const a =
    Math.sin(rad(lat - ZENTRUM.lat) / 2) ** 2 +
    Math.cos(rad(ZENTRUM.lat)) * Math.cos(rad(lat)) * Math.sin(rad(lng - ZENTRUM.lng) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Telefon-Glyphe (inline, currentColor — kein externes Asset). */
function PhoneIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`shrink-0 ${className}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.08 4.18 2 2 0 0 1 4.06 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

/** Position der Fahrbahn-Linie: 2rem in den zentrierten Inhalt (max-w-5xl) hinein. */
const LANE_LEFT = "left-[max(2rem,calc(50vw-30rem))]";

/**
 * Akt-Rahmen des Story-Scrolls: Zonen-Hintergrund, Kicker in Mono-Uppercase,
 * Markierungs-Punkt auf der Fahrbahn-Linie (md+), Anker-Ziel mit scroll-mt.
 */
function Akt({
  nr,
  id,
  kicker,
  titel,
  tint,
  children,
}: {
  nr: string;
  id?: string;
  kicker: string;
  titel: string;
  tint?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={`relative scroll-mt-36 py-14 sm:py-18 ${tint ?? "bg-background"}`}>
      <span
        aria-hidden="true"
        className={`absolute top-[4.1rem] hidden size-3 -translate-x-[calc(50%-1px)] rounded-full bg-primary ring-4 ring-primary/15 md:block ${LANE_LEFT}`}
      />
      <div className="mx-auto max-w-5xl px-5 sm:px-8 md:pl-24">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-primary">
          Akt {nr} · {kicker}
        </p>
        <h2 className="mt-1.5 text-2xl font-bold tracking-tight text-balance sm:text-3xl">{titel}</h2>
        <div className="mt-6">{children}</div>
      </div>
    </section>
  );
}

/** Bildlos-Fallback: stilisierter Karten-Hero (Pin + Fahrbahn), reine Token-Farben. */
function KartenHero({ bezirk }: { bezirk: string | null }) {
  return (
    <div className="relative overflow-hidden rounded-md border border-border">
      <svg viewBox="0 0 800 260" className="h-auto w-full" role="img" aria-label={`Stilisierte Karte${bezirk ? ` — ${bezirk}` : ""}`}>
        <rect width="800" height="260" className="fill-[color-mix(in_srgb,var(--brand-sky)_6%,var(--background))]" />
        <g className="fill-muted stroke-border" strokeWidth="1">
          <rect x="40" y="30" width="130" height="80" />
          <rect x="220" y="50" width="110" height="90" />
          <rect x="520" y="40" width="140" height="70" />
          <rect x="80" y="160" width="120" height="70" />
          <rect x="560" y="150" width="150" height="80" />
        </g>
        <path d="M 0 190 C 200 170 340 120 460 110 C 580 100 700 60 800 50" className="stroke-border" strokeWidth="18" fill="none" />
        <path d="M 0 190 C 200 170 340 120 460 110 C 580 100 700 60 800 50" className="stroke-background" strokeWidth="2.5" strokeDasharray="10 12" fill="none" />
        <circle cx="430" cy="112" r="16" className="fill-primary stroke-background" strokeWidth="3" />
        <circle cx="430" cy="112" r="5" className="fill-primary-foreground" />
      </svg>
      {bezirk && (
        <span className="absolute bottom-3 left-3 rounded-sm border border-border bg-background px-2 py-1 font-mono text-[11px] font-semibold uppercase tracking-wide">
          {bezirk}
        </span>
      )}
    </div>
  );
}

export default async function ProfilCanvasPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const rawSlug = first(sp.s) ?? "";
  const slug = /^[a-z0-9-]{1,80}$/.test(rawSlug) ? rawSlug : "fahrschule-isarpilot";

  // Profil laden (Fallback-Kaskade: gewünschter Slug → Seed-Schule Isarpilot).
  let school: SchoolProfileDetail | null = null;
  try {
    school = await getSchoolProfile("muenchen", slug);
  } catch {
    school = null;
  }
  if (!school && slug !== "fahrschule-isarpilot") {
    school = await getSchoolProfile("muenchen", "fahrschule-isarpilot").catch(() => null);
  }

  if (!school) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-24">
        <h1 className="text-2xl font-bold tracking-tight">Profil derzeit nicht verfügbar</h1>
        <p className="mt-3 text-muted-foreground">
          Die Demo-Datenbank ist gerade nicht erreichbar. Bitte später erneut versuchen.
        </p>
        <p className="mt-6">
          <Link href="/vorschau" className="text-primary underline-offset-2 hover:underline">← Zu den Vorschauen</Link>
        </p>
      </main>
    );
  }

  const prices: SchoolPriceRow[] = await getPricesForSchool(school.id).catch(() => []);
  // Anzeige-Reihenfolge: Klasse B zuerst (häufigster Fall), sonst alphabetisch.
  const sortedPrices = [...prices].sort((a, b) => (a.klasse === "B" ? -1 : b.klasse === "B" ? 1 : a.klasse.localeCompare(b.klasse)));
  const ankerRow = sortedPrices.find((r) => hatPflichtangabenSet(r)) ?? null;

  let tile: MapTileConfig | null = null;
  try {
    tile = getTileConfig();
  } catch {
    tile = null;
  }

  const tel = school.telefon?.replace(/\s+/g, "") ?? null;
  const theorie = school.hours.filter((h) => h.art === "theorie").sort((a, b) => a.wochentag - b.wochentag || a.von.localeCompare(b.von));
  const buero = school.hours.filter((h) => h.art === "buero").sort((a, b) => a.wochentag - b.wochentag || a.von.localeCompare(b.von));
  const bueroByDay = new Map<number, string[]>();
  for (const h of buero) {
    const list = bueroByDay.get(h.wochentag) ?? [];
    list.push(`${hhmm(h.von)}–${hhmm(h.bis)}`);
    bueroByDay.set(h.wochentag, list);
  }
  const images = school.show.images ? school.images : [];
  const vehicles = school.show.vehicles ? school.vehicles : [];
  const faq = school.show.faq ? school.faq : [];
  const anfahrtKm = school.latitude != null && school.longitude != null ? distanceKm(school.latitude, school.longitude) : null;
  const adresse = [school.strasse, [school.plz, school.ort].filter(Boolean).join(" ")].filter(Boolean).join(", ");

  // Akt-Nummern laufen dynamisch mit (nur vorhandene Sektionen zählen).
  let aktNr = 1;
  const nr = () => String(aktNr++).padStart(2, "0");

  const tintSky = "bg-[color-mix(in_srgb,var(--brand-sky)_6%,var(--background))]";
  const tintCyan = "bg-[color-mix(in_srgb,var(--brand-cyan)_8%,var(--background))]";
  const tintFinale = "bg-[color-mix(in_srgb,var(--primary)_10%,var(--background))]";

  return (
    // Kein eigenes <main>: die globale Shell (layout.tsx) stellt das main-Landmark.
    <div className="relative bg-background pb-36 md:pb-0">
      <RevealOnScroll />
      {/* ---- Durchgehende Fahrbahn-Linie (Scroll-Faden, md+) ---- */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-y-0 z-10 hidden border-l-2 border-dashed border-primary/20 md:block ${LANE_LEFT}`}
      />

      {/* ---- Sticky-Leiste (Desktop): Name + Preis-Anker + CTA immer erreichbar (unter dem SiteHeader, h-16) ---- */}
      <div className="sticky top-16 z-40 hidden border-b border-border bg-background/95 md:block">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-4 px-5 sm:px-8">
          <Link href="/vorschau/suche-canvas" className="shrink-0 text-sm text-muted-foreground hover:text-foreground">← Suche</Link>
          <span className="truncate font-bold tracking-tight">{school.name}</span>
          {ankerRow && (
            <span className="ml-auto hidden shrink-0 font-mono text-xs tabular-nums text-muted-foreground lg:inline">
              Kl. {ankerRow.klasse}: Grundbetrag {formatEuro(ankerRow.komponenten.grundbetrag as number)} · Fahrstunde (45 Min.) {formatEuro(ankerRow.komponenten.fahrstunde45 as number)}
            </span>
          )}
          <span className={ankerRow ? "flex shrink-0 items-center gap-2" : "ml-auto flex shrink-0 items-center gap-2"}>
            {tel && (
              <a href={`tel:${tel}`} aria-label={`Anrufen: ${school.telefon}`} className="inline-flex h-10 items-center gap-2 rounded-md border border-primary/40 px-3 text-sm font-medium text-primary hover:bg-primary/5">
                <PhoneIcon className="size-4" />
                Anrufen
              </a>
            )}
            <a href="#anmeldung" className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90">
              Anmeldung starten
            </a>
          </span>
        </div>
      </div>

      {/* ================= AKT: AUFTRITT ================= */}
      <header className="relative">
        <span
          aria-hidden="true"
          className={`absolute top-24 hidden size-3 -translate-x-[calc(50%-1px)] rounded-full bg-primary ring-4 ring-primary/15 md:block ${LANE_LEFT}`}
        />
        <div className="mx-auto max-w-5xl px-5 pt-6 pb-14 sm:px-8 sm:pb-18 md:pl-24">
          <div className="flex flex-wrap items-center gap-2 md:hidden">
            <Link href="/vorschau/suche-canvas" className="text-sm text-muted-foreground hover:text-foreground">← Suche</Link>
            <span className="ml-auto rounded-full border border-warning/40 px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-wide text-warning">
              Prototyp · Demo-Daten
            </span>
          </div>

          <div className="mt-6 grid gap-10 lg:grid-cols-[1fr_22rem]">
            <div className="reveal">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-primary">
                Fahrschul-Profil · Canvas-Prototyp
              </p>
              <h1 className="mt-2 text-4xl font-bold tracking-tight text-balance sm:text-5xl">{school.name}</h1>
              <p className="mt-3 text-lg text-muted-foreground">
                {[school.stadtbezirk, school.ort].filter(Boolean).join(" · ")}
                {school.isPartner && <span className="ml-2 rounded-sm border border-primary/30 bg-primary/5 px-1.5 py-0.5 align-middle font-mono text-[11px] font-semibold uppercase tracking-wide text-primary">Partner</span>}
              </p>

              {/* Fakten-Zeile (App-Store-Muster): Wert groß, Label klein — Fremd-Rating als klar gelabelte Zelle */}
              <div className="mt-6 flex divide-x divide-border overflow-x-auto rounded-md border border-border">
                {school.googleRating && school.googleReviewsCount != null && (
                  <div className="min-w-28 shrink-0 px-4 py-3">
                    <p className="text-base font-bold tabular-nums">{school.googleRating.replace(".", ",")} ★</p>
                    <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Google · {school.googleReviewsCount} Bew.</p>
                  </div>
                )}
                <div className="min-w-28 shrink-0 px-4 py-3">
                  <p className="text-base font-bold tabular-nums">{school.klassen.length}</p>
                  <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Klassen</p>
                </div>
                {theorie.length > 0 && (
                  <div className="min-w-28 shrink-0 px-4 py-3">
                    <p className="text-base font-bold tabular-nums">{theorie.length}×/Woche</p>
                    <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Theorie</p>
                  </div>
                )}
                {vehicles.length > 0 && (
                  <div className="min-w-28 shrink-0 px-4 py-3">
                    <p className="text-base font-bold tabular-nums">{vehicles.length}</p>
                    <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Fahrzeuge</p>
                  </div>
                )}
                {school.sprachen.length > 0 && (
                  <div className="min-w-28 shrink-0 px-4 py-3">
                    <p className="text-base font-bold uppercase">{school.sprachen.join(" · ")}</p>
                    <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Sprachen</p>
                  </div>
                )}
              </div>
              {school.googleRating && (
                <p className="mt-2 text-[11px] text-muted-foreground">★ Google-Bewertungen sind eine Fremdquelle und nicht von onelane geprüft.</p>
              )}

              {school.klassen.length > 0 && (
                <p className="mt-4 flex flex-wrap gap-1.5" aria-label="Führerscheinklassen">
                  {school.klassen.map((k) => (
                    <span key={k} className="rounded-sm bg-secondary px-2 py-1 font-mono text-xs font-medium text-secondary-foreground">{k}</span>
                  ))}
                </p>
              )}

              {/* Bilder: Grid/Collage statt Slideshow — bildlos = eleganter Karten-Hero */}
              <div className="mt-8">
                {images.length >= 3 ? (
                  /* feste Collage-Höhe: fill-Images brauchen dimensionierte Zellen */
                  <div className="grid h-64 grid-cols-3 grid-rows-2 gap-2 sm:h-80">
                    {images.slice(0, 5).map((img, i) => (
                      <div key={img.url} className={`relative overflow-hidden rounded-md border border-border ${i === 0 ? "col-span-2 row-span-2" : ""}`}>
                        <Image
                          src={img.url}
                          alt={img.alt ?? `${school.name} – ${KATEGORIE_LABEL[img.kategorie] ?? img.kategorie}`}
                          fill
                          unoptimized
                          sizes="(min-width: 1024px) 40vw, 90vw"
                          className="object-cover"
                        />
                      </div>
                    ))}
                  </div>
                ) : images.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {images.map((img) => (
                      <div key={img.url} className="relative aspect-[4/3] overflow-hidden rounded-md border border-border">
                        <Image
                          src={img.url}
                          alt={img.alt ?? `${school.name} – ${KATEGORIE_LABEL[img.kategorie] ?? img.kategorie}`}
                          fill
                          unoptimized
                          sizes="(min-width: 1024px) 30vw, 45vw"
                          className="object-cover"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <KartenHero bezirk={school.stadtbezirk} />
                )}
              </div>
            </div>

            {/* Anmelde-Karte (Desktop sticky): Preis-Anker als DUO + CTA + Telefon */}
            <aside className="reveal lg:sticky lg:top-36 lg:self-start">
              <div className="rounded-lg border border-border bg-background p-5 shadow-elevation-2">
                <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Preis-Anker · Aushang</p>
                {ankerRow ? (
                  <>
                    <dl className="mt-3 grid grid-cols-2 gap-x-4">
                      <div>
                        <dt className="text-xs text-muted-foreground">Grundbetrag · Kl. {ankerRow.klasse}</dt>
                        <dd className="font-mono text-xl font-bold tabular-nums">{formatEuro(ankerRow.komponenten.grundbetrag as number)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Fahrstunde (45 Min.)</dt>
                        <dd className="font-mono text-xl font-bold tabular-nums">{formatEuro(ankerRow.komponenten.fahrstunde45 as number)}</dd>
                      </div>
                    </dl>
                    <div className="mt-3">
                      <DataBadge status={ankerRow.status} stand={ankerRow.stand} />
                    </div>
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      Komponenten des Preisaushangs — <a href="#preise" className="underline underline-offset-2 hover:text-foreground">alle ansehen</a>. Kein Gesamtpreis: der hängt vom persönlichen Übungsbedarf ab.
                    </p>
                  </>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">Noch keine Preisangabe — Preisaushang direkt bei der Fahrschule erfragen.</p>
                )}
                <div className="mt-5 flex flex-col gap-2">
                  <a href="#anmeldung" className="inline-flex h-12 items-center justify-center rounded-md bg-primary px-4 text-base font-semibold text-primary-foreground transition-opacity duration-[var(--motion-duration-fast)] hover:opacity-90">
                    Anmeldung starten
                  </a>
                  {tel && (
                    <a href={`tel:${tel}`} className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-primary/40 px-4 text-base font-medium text-primary hover:bg-primary/5">
                      <PhoneIcon className="size-5" />
                      {school.telefon}
                    </a>
                  )}
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <TrustBadge size="sm" />
                  <span className="text-[11px] text-muted-foreground">unverbindlich · kostenlos</span>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </header>

      {/* ================= AKT: PREISAUSHANG ================= */}
      <Akt nr={nr()} id="preise" kicker="Preisaushang" titel="Preise — offen, als Komponenten, mit Herkunft" tint={tintSky}>
        {sortedPrices.length === 0 ? (
          <div className="reveal rounded-lg border border-border bg-background p-6">
            <p className="font-semibold">Noch keine Preisangabe</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Diese Fahrschule hat ihren Preisaushang noch nicht hinterlegt — die Komponenten gibt es direkt vor Ort oder telefonisch.
            </p>
          </div>
        ) : (
          <div className="reveal-stagger flex flex-col gap-3">
            {sortedPrices.map((row, i) => (
              <details key={row.klasse} open={i === 0} className="group rounded-lg border border-border bg-background open:shadow-elevation-1">
                <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-5 py-3 [&::-webkit-details-marker]:hidden">
                  <span className="rounded-sm bg-secondary px-2 py-1 font-mono text-sm font-bold text-secondary-foreground">Klasse {row.klasse}</span>
                  <DataBadge status={row.status} stand={row.stand} />
                  <svg viewBox="0 0 24 24" className="ml-auto size-5 shrink-0 text-muted-foreground transition-transform duration-[var(--motion-duration-base)] ease-[var(--motion-ease)] group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </summary>
                <dl className="border-t border-border px-5 py-2">
                  {PREIS_KOMPONENTEN.map((k) => {
                    const wert = row.komponenten[k.key];
                    return (
                      <div key={k.key} className="flex items-baseline justify-between gap-4 border-b border-dashed border-border py-2.5 last:border-b-0">
                        <dt className="text-sm">{k.label}</dt>
                        <dd className={`font-mono text-sm tabular-nums ${wert == null ? "text-muted-foreground" : "font-semibold"}`}>
                          {wert == null ? "keine Angabe" : formatEuro(wert)}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
                {formatStand(row.stand) && (
                  <p className="px-5 pb-3 font-mono text-[11px] text-muted-foreground">{formatStand(row.stand)}</p>
                )}
              </details>
            ))}
            <p className="mt-1 text-xs text-muted-foreground">
              Darstellung nach § 32 FahrlG als Komponenten des amtlichen Preisaushangs — bewusst ohne Gesamt- oder Schätzpreis.
              Behördliche Prüfgebühren (TÜV/DEKRA) kommen separat hinzu und sind keine Fahrschul-Entgelte.
            </p>
          </div>
        )}
      </Akt>

      {/* ================= AKT: THEORIE-ZEITLEISTE ================= */}
      {school.show.zeiten && (theorie.length > 0 || buero.length > 0) && (
        <Akt nr={nr()} id="theorie" kicker="Theorie & Büro" titel="Der Wochen-Takt der Fahrschule">
          {theorie.length > 0 && (
            <div className="reveal">
              <h3 className="text-sm font-semibold">Theorieunterricht — feste Termine jede Woche</h3>
              <ol className="mt-4 grid grid-cols-7 gap-1.5 sm:gap-2" aria-label="Theorie-Wochenübersicht">
                {DAYS_SHORT.map((day, d) => {
                  const slots = theorie.filter((h) => h.wochentag === d);
                  const active = slots.length > 0;
                  return (
                    <li key={day} className={`flex min-h-24 flex-col items-center gap-1.5 rounded-md border p-2 text-center ${active ? "border-primary/40 bg-[color-mix(in_srgb,var(--brand-sky)_8%,var(--background))]" : "border-border"}`}>
                      <span className={`font-mono text-xs font-bold uppercase ${active ? "text-primary" : "text-muted-foreground"}`}>{day}</span>
                      <span aria-hidden="true" className={`size-2 rounded-full ${active ? "bg-primary" : "bg-border"}`} />
                      {slots.map((h) => (
                        <span key={`${h.von}-${h.bis}`} className="font-mono text-[10px] leading-tight tabular-nums sm:text-[11px]">
                          {hhmm(h.von)}
                          <span className="block text-muted-foreground">–{hhmm(h.bis)}</span>
                        </span>
                      ))}
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
          {bueroByDay.size > 0 && (
            <div className="reveal mt-8">
              <h3 className="text-sm font-semibold">Büro-Zeiten</h3>
              <dl className="mt-3 grid gap-x-8 gap-y-1.5 sm:grid-cols-2">
                {[...bueroByDay.entries()].map(([d, zeiten]) => (
                  <div key={d} className="flex items-baseline justify-between gap-4 border-b border-dashed border-border py-1.5">
                    <dt className="text-sm">{["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"][d] ?? `Tag ${d}`}</dt>
                    <dd className="font-mono text-sm tabular-nums">{zeiten.join(" · ")}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </Akt>
      )}

      {/* ================= AKT: GARAGE (Snap-Slider) ================= */}
      {vehicles.length > 0 && (
        <Akt nr={nr()} id="garage" kicker="Garage" titel="Womit du fahren lernst" tint={tintCyan}>
          <ul className="reveal -mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-2 sm:-mx-8 sm:px-8" tabIndex={0} aria-label="Fahrzeuge">
            {vehicles.map((v, i) => {
              const zweirad = (v.klasse ?? "").startsWith("A");
              return (
                <li key={`${v.marke}-${v.modell}-${i}`} className="w-64 shrink-0 snap-start">
                  <article className="flex h-full flex-col rounded-lg border border-border bg-background p-4">
                    <svg viewBox="0 0 96 40" className="h-12 w-auto self-start" aria-hidden="true">
                      {zweirad ? (
                        <g className="stroke-primary" strokeWidth="2.5" fill="none" strokeLinecap="round">
                          <circle cx="20" cy="30" r="8" />
                          <circle cx="72" cy="30" r="8" />
                          <path d="M20 30 38 14h14l8 10M50 14l6-6h8M38 14l8 16h18" />
                        </g>
                      ) : (
                        <g className="stroke-primary" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M10 28h-4v-6l8-4 6-8h28l10 10h20a6 6 0 0 1 6 6v2h-6" />
                          <circle cx="26" cy="30" r="6" />
                          <circle cx="70" cy="30" r="6" />
                          <path d="M32 30h32" />
                        </g>
                      )}
                    </svg>
                    <h3 className="mt-2 font-bold tracking-tight">{[v.marke, v.modell].filter(Boolean).join(" ") || "Fahrzeug"}</h3>
                    <p className="mt-2 flex flex-wrap gap-1.5">
                      {v.klasse && <span className="rounded-sm bg-secondary px-1.5 py-0.5 font-mono text-[11px] font-medium">Klasse {v.klasse}</span>}
                      {v.getriebe && (
                        <span className="rounded-sm bg-secondary px-1.5 py-0.5 font-mono text-[11px] font-medium">
                          {v.getriebe === "automatik" ? "Automatik" : v.getriebe === "schaltung" ? "Schaltung" : v.getriebe}
                        </span>
                      )}
                    </p>
                    {v.besonderheiten.length > 0 && (
                      <p className="mt-2 text-xs text-muted-foreground">{v.besonderheiten.join(" · ")}</p>
                    )}
                  </article>
                </li>
              );
            })}
          </ul>
        </Akt>
      )}

      {/* ================= AKT: TEAM (nur mit Daten — nie leere Platzhalter) ================= */}
      {school.show.instructors && school.instructors.length > 0 && (
        <Akt nr={nr()} id="team" kicker="Team" titel="Wer neben dir sitzt">
          <ul className="reveal-stagger grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {school.instructors.map((p) => (
              <li key={p.slug} className="flex items-center gap-3 rounded-lg border border-border bg-background p-4">
                <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--brand-sky)_15%,var(--background))] font-bold text-primary">
                  {p.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="font-medium">{p.name}</span>
              </li>
            ))}
          </ul>
        </Akt>
      )}

      {/* ================= AKT: ANFAHRT ================= */}
      {(adresse || (school.latitude != null && school.longitude != null)) && (
        <Akt nr={nr()} id="anfahrt" kicker="Anfahrt" titel="So findest du hin" tint={tintSky}>
          <div className="reveal grid items-start gap-6 md:grid-cols-[minmax(14rem,1fr)_1.4fr]">
            <div className="rounded-lg border border-border bg-background p-5">
              {adresse && (
                <>
                  <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Adresse</p>
                  <p className="mt-1.5 font-medium">{adresse}</p>
                </>
              )}
              {school.stadtbezirk && <p className="mt-1 text-sm text-muted-foreground">Stadtbezirk {school.stadtbezirk}</p>}
              {anfahrtKm != null && (
                <p className="mt-4 flex items-baseline gap-2">
                  <span className="font-mono text-2xl font-bold tabular-nums">{(Math.round(anfahrtKm * 10) / 10).toLocaleString("de-DE", { minimumFractionDigits: 1 })} km</span>
                  <span className="text-sm text-muted-foreground">ab Marienplatz (Demo-Bezugspunkt)</span>
                </p>
              )}
            </div>
            <div>
              {tile && school.latitude != null && school.longitude != null ? (
                <div className="[&>div]:rounded-md! [&>div]:shadow-none!">
                  <ResultsMap
                    markers={[{ id: school.id, name: school.name, lat: school.latitude, lng: school.longitude, partner: school.isPartner }]}
                    center={{ lat: school.latitude, lng: school.longitude }}
                    tile={tile}
                  />
                </div>
              ) : (
                <KartenHero bezirk={school.stadtbezirk} />
              )}
            </div>
          </div>
        </Akt>
      )}

      {/* ================= AKT: FAQ ================= */}
      {faq.length > 0 && (
        <Akt nr={nr()} id="faq" kicker="Fragen" titel="Häufige Fragen, ehrliche Antworten">
          <div className="reveal-stagger flex flex-col gap-2">
            {faq.map((f) => (
              <details key={f.frage} className="group rounded-md border border-border bg-background">
                <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 px-4 py-2.5 text-sm font-medium [&::-webkit-details-marker]:hidden">
                  {f.frage}
                  <svg viewBox="0 0 24 24" className="ml-auto size-4 shrink-0 text-muted-foreground transition-transform duration-[var(--motion-duration-base)] ease-[var(--motion-ease)] group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </summary>
                <p className="border-t border-border px-4 py-3 text-sm leading-relaxed text-muted-foreground">{f.antwort}</p>
              </details>
            ))}
          </div>
        </Akt>
      )}

      {/* ================= FINALE: ANMELDUNG ================= */}
      <Akt nr={nr()} id="anmeldung" kicker="Ziel" titel="Anmeldung starten — in drei Schritten" tint={tintFinale}>
        <ol className="reveal-stagger grid gap-3 sm:grid-cols-3" aria-label="Ablauf der Anmeldung">
          {[
            ["1", "Wunschklasse wählen", "Klasse und Wunsch-Start angeben — dauert unter einer Minute."],
            ["2", "Kontakt hinterlassen", "Die Fahrschule meldet sich direkt bei dir. Keine Kosten, keine Bindung."],
            ["3", "Termin vor Ort", "Kennenlernen, Vertrag bei der Fahrschule — und los geht die erste Stunde."],
          ].map(([n, t, d]) => (
            <li key={n} className="rounded-lg border border-border bg-background p-4">
              <span className="font-mono text-xs font-bold text-primary">Schritt {n}</span>
              <p className="mt-1 font-semibold">{t}</p>
              <p className="mt-1 text-sm text-muted-foreground">{d}</p>
            </li>
          ))}
        </ol>
        <div className="reveal mt-6 flex flex-col gap-3 rounded-lg border border-border bg-background p-5 sm:flex-row sm:items-center">
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <TrustBadge size="sm" />
              <span className="text-xs text-muted-foreground">unverbindlich · kostenlos · Antwort direkt von der Fahrschule</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Prototyp: Die geführte Anmeldestrecke folgt — hier beginnt sie.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            {tel && (
              <a href={`tel:${tel}`} className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-primary/40 px-5 text-base font-medium text-primary hover:bg-primary/5">
                <PhoneIcon className="size-5" />
                Anrufen
              </a>
            )}
            <button
              type="button"
              aria-describedby="anmeldung-hinweis"
              className="inline-flex h-12 items-center justify-center rounded-md bg-primary px-6 text-base font-semibold text-primary-foreground transition-opacity duration-[var(--motion-duration-fast)] hover:opacity-90"
            >
              Anmeldung starten
            </button>
          </div>
        </div>
        <p id="anmeldung-hinweis" className="mt-3 text-[11px] text-muted-foreground">
          Demo-Prototyp mit echten Seed-Daten · Preisangaben ohne Gewähr, bis die Fahrschule sie bestätigt.
        </p>
      </Akt>
      {/* schließt den Seiten-Wrapper (globale Shell liefert das main-Landmark) */}

      {/* ---- MOBILE Sticky-Bottom-Action-Bar (Anrufen | Anmeldung starten) ---- */}
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background px-4 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-elevation-3 md:hidden">
        <p className="flex items-center justify-center gap-2 pb-2">
          <TrustBadge size="sm" className="scale-90" />
          <span className="text-[11px] text-muted-foreground">unverbindlich · kostenlos</span>
        </p>
        <div className="flex gap-2">
          {tel && (
            <a href={`tel:${tel}`} className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-md border border-primary/40 text-base font-medium text-primary">
              <PhoneIcon className="size-5" />
              Anrufen
            </a>
          )}
          <a href="#anmeldung" className="inline-flex h-12 flex-[1.4] items-center justify-center gap-2 rounded-md bg-primary text-base font-semibold text-primary-foreground">
            {/* dezenter Puls als Aufmerksamkeits-Punkt (nur Opacity, motion-safe) */}
            <span aria-hidden="true" className="size-2 rounded-full bg-accent motion-safe:animate-pulse [animation-duration:2.4s]" />
            Anmeldung starten
          </a>
        </div>
      </div>
    </div>
  );
}
