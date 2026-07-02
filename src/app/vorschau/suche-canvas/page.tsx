import type { Metadata } from "next";
import Link from "next/link";
import ResultsMap, { type MapMarker } from "@/components/search/results-map";
import { DataBadge } from "@/components/school/data-badge";
import { TrustBadge } from "@/components/trust/trust-badge";
import { getTileConfig, type MapTileConfig } from "@/modules/maps";
import { searchSchools, type SearchResult, type SearchResultItem } from "@/modules/schools/search";
import { getPricesForSchool, type SchoolPriceRow } from "@/modules/schools/prices";
import { getSchoolProfile } from "@/modules/schools/profile";
import { hatPflichtangabenSet, formatEuro } from "@/lib/preise";
import { slugify } from "@/lib/slug";

/**
 * VORSCHAU „Canvas · Suche" — die Karte ist die BÜHNE.
 * ----------------------------------------------------------------------------
 * Konzept: vollflächige Karte als Grundfläche (Leaflet-Island als Enhancement;
 * ohne Tile-Config UND ohne JS trägt eine stilisierte SVG-Stadtfläche mit echten,
 * projizierten Pins die Szene). Die Ergebnisse liegen als snappendes KARTEN-DECK
 * darüber: mobil unten (daumen-nah, horizontaler Snap mit Peek), auf Desktop als
 * vertikale Spalte über der Karte. Filter schweben als Pill-Leiste oben.
 *
 * ECHTE DATEN: searchSchools (Geo-Umkreis ab München/Marienplatz, Sortierung
 * Entfernung) + getPricesForSchool je Treffer + Profil (nur für die Telefon-
 * nummer der Karten-CTA). §32 FahrlG: Preise NUR als Komponenten-Duo
 * (Grundbetrag + Fahrstunde zusammen) und NUR bei vollständigem Pflichtangaben-
 * Set herausgestellt — sonst neutraler Verweis; Schulen ohne Preise werden
 * elegant („keine Preisangabe") gezeigt, nie ausgeblendet.
 */
export const metadata: Metadata = {
  title: "Vorschau — Canvas · Suche (Karte als Bühne)",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

/** Marienplatz als ehrlicher, fixer Bezugspunkt der Demo (Entfernungs-Anker). */
const ZENTRUM = { lat: 48.1374, lng: 11.5755 };

const KLASSEN_FILTER = ["B", "B197", "A1", "A"] as const;

type SP = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** km im deutschen Format („5,6 km"); unter 100 m → „vor Ort". */
function fmtKm(km: number | null): string | null {
  if (km == null || !Number.isFinite(km)) return null;
  if (km < 0.1) return "vor Ort";
  return `${(Math.round(km * 10) / 10).toLocaleString("de-DE", { minimumFractionDigits: 1 })} km`;
}

/** Preis-Sicht einer Schule fürs Deck (Duo nur bei vollständigem Pflicht-Set). */
type PriceView =
  | { kind: "duo"; klasse: string; grund: number; stunde: number; status: SchoolPriceRow["status"]; stand: string | null }
  | { kind: "teil"; status: SchoolPriceRow["status"]; stand: string | null }
  | { kind: "none" };

function priceView(rows: SchoolPriceRow[], aktiveKlasse: string | undefined): PriceView {
  if (rows.length === 0) return { kind: "none" };
  const row =
    (aktiveKlasse ? rows.find((r) => r.klasse === aktiveKlasse) : undefined) ??
    rows.find((r) => r.klasse === "B") ??
    rows[0];
  const grund = row.komponenten.grundbetrag;
  const stunde = row.komponenten.fahrstunde45;
  // §32: herausgestellte Darstellung nur mit vollständigem Pflichtangaben-Set.
  if (hatPflichtangabenSet(row) && grund != null && stunde != null) {
    return { kind: "duo", klasse: row.klasse, grund, stunde, status: row.status, stand: row.stand };
  }
  return { kind: "teil", status: row.status, stand: row.stand };
}

/** Telefon-Glyphe (inline, stroke=currentColor — kein externes Asset). */
function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.08 4.18 2 2 0 0 1 4.06 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

/**
 * Stilisierte SVG-Stadtfläche (Fallback-Bühne, immer SSR): abstrakte Blöcke,
 * Straßenraster, Isar-Band — plus die ECHTEN Treffer als nummerierte Pins
 * (lat/lng linear in die viewBox projiziert; Nummer = Karte im Deck).
 * Nur Token-Farben (fill-/stroke-Utilities bzw. var()-Werte), keine Roh-Hex.
 */
function CityStage({ items }: { items: SearchResultItem[] }) {
  const pts = items
    .map((s, i) => ({ lat: s.latitude, lng: s.longitude, nr: i + 1, partner: s.isPartner }))
    .filter((p): p is { lat: number; lng: number; nr: number; partner: boolean } => p.lat != null && p.lng != null);
  const lats = pts.map((p) => p.lat);
  const lngs = pts.map((p) => p.lng);
  const minLat = Math.min(...lats, ZENTRUM.lat);
  const maxLat = Math.max(...lats, ZENTRUM.lat);
  const minLng = Math.min(...lngs, ZENTRUM.lng);
  const maxLng = Math.max(...lngs, ZENTRUM.lng);
  const dLat = Math.max(maxLat - minLat, 1e-6);
  const dLng = Math.max(maxLng - minLng, 1e-6);
  const px = (lng: number) => 90 + ((lng - minLng) / dLng) * 820;
  const py = (lat: number) => 90 + ((maxLat - lat) / dLat) * 470;

  return (
    <svg viewBox="0 0 1000 650" preserveAspectRatio="xMidYMid slice" className="h-full w-full" aria-hidden="true" focusable="false">
      {/* Grundfläche in dezentem Blau-Tint (color-mix aus Token) */}
      <rect x="0" y="0" width="1000" height="650" className="fill-[color-mix(in_srgb,var(--brand-sky)_5%,var(--background))]" />
      {/* Stadtblöcke */}
      <g className="fill-muted stroke-border" strokeWidth="1">
        <rect x="60" y="60" width="150" height="100" />
        <rect x="250" y="40" width="120" height="140" />
        <rect x="430" y="70" width="170" height="110" />
        <rect x="680" y="50" width="140" height="130" />
        <rect x="870" y="80" width="120" height="100" />
        <rect x="80" y="250" width="160" height="120" />
        <rect x="300" y="270" width="130" height="110" />
        <rect x="500" y="260" width="150" height="130" />
        <rect x="710" y="270" width="130" height="110" />
        <rect x="60" y="450" width="150" height="110" />
        <rect x="290" y="470" width="160" height="100" />
        <rect x="520" y="450" width="130" height="120" />
        <rect x="730" y="460" width="160" height="110" />
      </g>
      {/* Straßenraster */}
      <g className="stroke-border" strokeWidth="10" strokeLinecap="round" fill="none">
        <line x1="0" y1="215" x2="1000" y2="215" />
        <line x1="0" y1="420" x2="1000" y2="420" />
        <line x1="230" y1="0" x2="230" y2="650" />
        <line x1="660" y1="0" x2="660" y2="650" />
      </g>
      {/* Isar-Band (diagonal, Brand-Ton als dezenter Mix) */}
      <path
        d="M 560 650 C 600 480 640 360 700 240 C 740 160 790 80 850 0"
        className="stroke-[color-mix(in_srgb,var(--brand-sky)_30%,var(--background))]"
        strokeWidth="26"
        fill="none"
        strokeLinecap="round"
      />
      {/* Bezugspunkt Zentrum */}
      <g>
        <circle cx={px(ZENTRUM.lng)} cy={py(ZENTRUM.lat)} r="6" className="fill-brand-cyan" />
        <circle cx={px(ZENTRUM.lng)} cy={py(ZENTRUM.lat)} r="12" className="fill-none stroke-brand-cyan" strokeWidth="2" strokeDasharray="3 3" />
      </g>
      {/* Echte Treffer als nummerierte Pins (Nummer = Deck-Karte) */}
      {pts.map((p) => (
        <g key={p.nr}>
          {p.partner && (
            <circle cx={px(p.lng)} cy={py(p.lat)} r="18" className="fill-none stroke-accent" strokeWidth="3" />
          )}
          <circle cx={px(p.lng)} cy={py(p.lat)} r="13" className="fill-primary stroke-background" strokeWidth="2.5" />
          <text
            x={px(p.lng)}
            y={py(p.lat)}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="12"
            fontWeight="700"
            className="fill-primary-foreground font-mono"
          >
            {p.nr}
          </text>
        </g>
      ))}
    </svg>
  );
}

/** Filter-Pill (GET-Link, ohne JS funktionsfähig). */
function Pill({ href, active, children }: { href: string; active?: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={`inline-flex h-9 items-center rounded-full border px-3.5 text-sm font-medium transition-colors duration-[var(--motion-duration-fast)] ease-[var(--motion-ease)] ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background/95 text-foreground hover:border-primary/50"
      }`}
    >
      {children}
    </Link>
  );
}

export default async function SucheCanvasPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const rawKlasse = first(sp.klasse) ?? "";
  // Nur bekannte Klassen-Kürzel durchlassen (defensiv, hält URLs sauber).
  const klasse = /^[A-Z0-9]{1,6}$/.test(rawKlasse) ? rawKlasse : undefined;
  const partner = first(sp.partner) === "true";

  // Suche: Geo-Umkreis ab Marienplatz → echte Entfernungen, Sortierung Entfernung.
  let result: SearchResult | null = null;
  try {
    result = await searchSchools({
      lat: ZENTRUM.lat,
      lng: ZENTRUM.lng,
      umkreisKm: 25,
      sort: "distanz",
      klasse,
      partner: partner ? "true" : undefined,
    });
  } catch {
    result = null;
  }
  const items = result?.items ?? [];

  // Preise + Telefon je Treffer (echte Daten; fail-soft je Schule).
  const [priceRows, profiles] = await Promise.all([
    Promise.all(items.map((s) => getPricesForSchool(s.id).catch(() => [] as SchoolPriceRow[]))),
    Promise.all(items.map((s) => getSchoolProfile(slugify(s.ort ?? ""), s.slug).catch(() => null))),
  ]);

  // Karte (Leaflet) nur mit Tile-Config — sonst trägt die SVG-Stadtfläche allein.
  let tile: MapTileConfig | null = null;
  try {
    tile = getTileConfig();
  } catch {
    tile = null;
  }
  const markers: MapMarker[] = items
    .filter((s) => s.latitude != null && s.longitude != null)
    .map((s) => ({ id: s.id, name: s.name, lat: s.latitude as number, lng: s.longitude as number, partner: s.isPartner }));

  const filterHref = (k?: string, p?: boolean) => {
    const q = new URLSearchParams();
    if (k) q.set("klasse", k);
    if (p) q.set("partner", "true");
    const qs = q.toString();
    return `/vorschau/suche-canvas${qs ? `?${qs}` : ""}`;
  };

  return (
    // Kein eigenes <main>: die globale Shell (layout.tsx) stellt das main-Landmark.
    // Höhe = Viewport minus Sticky-SiteHeader (h-16) → Bühne füllt den Rest exakt.
    <div className="relative isolate h-[calc(100dvh-4rem)] overflow-hidden bg-background">
      <h1 className="sr-only">Fahrschulen in München — Canvas-Prototyp (Karte als Bühne)</h1>

      {/* ---- BÜHNE: SVG-Stadtfläche (SSR-Basis) + Leaflet-Island darüber ---- */}
      <div className="absolute inset-0 z-0" aria-hidden="true">
        <CityStage items={items} />
      </div>
      {tile && markers.length > 0 && (
        <div className="absolute inset-0 z-0 [&>div]:h-full! [&>div]:rounded-none! [&>div]:border-0! [&>div]:shadow-none!">
          <ResultsMap markers={markers} center={ZENTRUM} tile={tile} />
        </div>
      )}
      {/* Lesbarkeits-Schleier oben/unten (nur Verlauf aus Token) */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 z-10 h-28 bg-gradient-to-b from-background/90 to-transparent" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-40 bg-gradient-to-t from-background/80 to-transparent md:hidden" />

      {/* ---- SCHWEBENDE FILTER-LEISTE ---- */}
      <nav aria-label="Filter" className="absolute inset-x-3 top-3 z-40 flex flex-wrap items-center gap-2 sm:inset-x-5">
        <Link
          href="/vorschau"
          className="inline-flex h-9 items-center rounded-full border border-border bg-background/95 px-3.5 text-sm text-muted-foreground hover:text-foreground"
        >
          ← Vorschauen
        </Link>
        <span className="inline-flex h-9 items-center rounded-full border border-border bg-background/95 px-3.5 text-sm font-extrabold lowercase tracking-tight">
          onelane<span className="ml-1.5 font-mono text-[11px] font-semibold uppercase text-primary">canvas</span>
        </span>
        <span className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-background/95 px-3.5 text-sm text-muted-foreground">
          <span className="size-2 rounded-full bg-brand-cyan" aria-hidden="true" />
          München · ab Marienplatz
        </span>
        <span className="hidden h-5 w-px bg-border sm:block" aria-hidden="true" />
        <Pill href={filterHref(undefined, partner)} active={!klasse}>Alle Klassen</Pill>
        {KLASSEN_FILTER.map((k) => (
          <Pill key={k} href={filterHref(k, partner)} active={klasse === k}>{k}</Pill>
        ))}
        <Pill href={filterHref(klasse, !partner)} active={partner}>Partner</Pill>
        <span className="ml-auto hidden h-9 items-center rounded-full border border-warning/40 bg-background/95 px-3.5 font-mono text-[11px] font-semibold uppercase tracking-wide text-warning sm:inline-flex">
          Prototyp · Demo-Daten
        </span>
      </nav>

      {/* ---- KARTEN-DECK: mobil unten (horizontaler Snap), Desktop als Spalte ---- */}
      <section
        aria-label={`${items.length} Fahrschulen, sortiert nach Entfernung`}
        className="absolute inset-x-0 bottom-0 z-30 md:inset-x-auto md:top-20 md:bottom-4 md:left-4 md:w-[26.5rem]"
      >
        <p className="px-4 pb-2 font-mono text-[11px] font-semibold uppercase tracking-wide text-foreground md:px-1">
          {result ? `${items.length} Fahrschulen · nach Entfernung` : "Suche derzeit nicht verfügbar"}
          <span className="ml-2 font-sans normal-case text-muted-foreground">Nummer = Pin auf der Karte</span>
        </p>

        {!result && (
          <div className="mx-4 rounded-lg border border-border bg-background p-5 text-sm text-muted-foreground shadow-elevation-2 md:mx-0">
            Die Suche ist gerade nicht erreichbar. Bitte später erneut versuchen.
          </div>
        )}
        {result && items.length === 0 && (
          <div className="mx-4 rounded-lg border border-border bg-background p-5 text-sm shadow-elevation-2 md:mx-0">
            <p className="font-semibold">Keine Treffer für diesen Filter.</p>
            <p className="mt-1 text-muted-foreground">
              <Link href="/vorschau/suche-canvas" className="text-primary underline-offset-2 hover:underline">Filter zurücksetzen</Link>
            </p>
          </div>
        )}

        {items.length > 0 && (
          <ul
            className="flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-4 pb-4 md:h-[calc(100%-1.75rem)] md:snap-y md:snap-proximity md:flex-col md:overflow-x-hidden md:overflow-y-auto md:px-1 md:pb-1"
            tabIndex={0}
          >
            {items.map((s, i) => {
              const pv = priceView(priceRows[i] ?? [], klasse);
              const telefon = profiles[i]?.telefon ?? null;
              const tel = telefon?.replace(/\s+/g, "");
              const km = fmtKm(s.distanzKm);
              const profilHref = `/vorschau/profil-canvas?s=${encodeURIComponent(s.slug)}`;
              return (
                <li key={s.id} className="w-[min(21rem,86vw)] shrink-0 snap-center md:w-auto md:snap-start">
                  <article className="group relative flex h-full flex-col rounded-lg border border-border bg-background p-4 shadow-elevation-2 transition-[transform,box-shadow,border-color] duration-[var(--motion-duration-base)] ease-[var(--motion-ease)] hover:border-primary/40 hover:shadow-elevation-3 motion-safe:hover:-translate-y-0.5">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-mono text-xs font-bold text-primary">{String(i + 1).padStart(2, "0")}</span>
                      <span className="flex items-center gap-1.5">
                        {s.isPartner && (
                          <span className="rounded-sm border border-primary/30 bg-primary/5 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-primary">
                            Partner
                          </span>
                        )}
                        {km && <span className="font-mono text-xs tabular-nums text-muted-foreground">{km}</span>}
                      </span>
                    </div>

                    <h2 className="mt-1 text-lg leading-snug font-bold tracking-tight">
                      {/* Ganze Karte klickbar (stretched link) — CTAs unten liegen mit z-10 darüber. */}
                      <Link href={profilHref} className="after:absolute after:inset-0 after:content-['']">
                        {s.name}
                      </Link>
                    </h2>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {[s.stadtbezirk, s.ort].filter(Boolean).join(" · ") || "München"}
                      {/* Fremd-Rating dezent + klar gelabelt (nie Haupt-Held) */}
                      {s.googleRating && s.googleReviewsCount != null && (
                        <span className="mt-0 block text-xs text-muted-foreground">
                          {s.googleRating.replace(".", ",")} · Google, {s.googleReviewsCount} Bew.
                        </span>
                      )}
                    </p>

                    {s.klassen.length > 0 && (
                      <p className="mt-2 flex flex-wrap gap-1" aria-label="Führerscheinklassen">
                        {s.klassen.slice(0, 5).map((k) => (
                          <span key={k} className="rounded-sm bg-secondary px-1.5 py-0.5 font-mono text-[11px] font-medium text-secondary-foreground">
                            {k}
                          </span>
                        ))}
                        {s.klassen.length > 5 && (
                          <span className="px-1 py-0.5 text-[11px] text-muted-foreground">+{s.klassen.length - 5}</span>
                        )}
                      </p>
                    )}

                    {/* Preiszone: Komponenten-Duo (§32: immer zusammen, mit Provenienz + Stand) */}
                    <div className="mt-3 rounded-sm bg-[color-mix(in_srgb,var(--brand-sky)_7%,var(--background))] p-3">
                      {pv.kind === "duo" && (
                        <>
                          <dl className="grid grid-cols-2 gap-x-3">
                            <div>
                              <dt className="text-[11px] text-muted-foreground">Grundbetrag · Kl. {pv.klasse}</dt>
                              <dd className="font-mono text-base font-bold tabular-nums">{formatEuro(pv.grund)}</dd>
                            </div>
                            <div>
                              <dt className="text-[11px] text-muted-foreground">Fahrstunde (45 Min.)</dt>
                              <dd className="font-mono text-base font-bold tabular-nums">{formatEuro(pv.stunde)}</dd>
                            </div>
                          </dl>
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            <DataBadge status={pv.status} stand={pv.stand} />
                            <span className="text-[11px] text-muted-foreground">alle Komponenten im Profil</span>
                          </div>
                        </>
                      )}
                      {pv.kind === "teil" && (
                        <div className="flex flex-col gap-1.5">
                          <p className="text-sm text-muted-foreground">Preisaushang unvollständig — alle Komponenten im Profil.</p>
                          <DataBadge status={pv.status} stand={pv.stand} />
                        </div>
                      )}
                      {pv.kind === "none" && (
                        <p className="text-sm text-muted-foreground">
                          Noch keine Preisangabe<span className="block text-[11px]">Preisaushang direkt bei der Fahrschule erfragen.</span>
                        </p>
                      )}
                    </div>

                    {/* CTA-Zeile: Anmeldung primär + Telefon prominent daneben */}
                    <div className="relative z-10 mt-3 flex items-center gap-2">
                      <Link
                        href={`${profilHref}#anmeldung`}
                        className="inline-flex h-11 flex-1 items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity duration-[var(--motion-duration-fast)] hover:opacity-90"
                      >
                        Anmeldung starten
                      </Link>
                      {tel ? (
                        <a
                          href={`tel:${tel}`}
                          aria-label={`Anrufen: ${telefon}`}
                          className="inline-flex size-11 items-center justify-center rounded-md border border-primary/40 text-primary transition-colors duration-[var(--motion-duration-fast)] hover:bg-primary/5"
                        >
                          <PhoneIcon />
                        </a>
                      ) : (
                        <Link
                          href={profilHref}
                          aria-label={`Profil von ${s.name} ansehen`}
                          className="inline-flex h-11 items-center justify-center rounded-md border border-border px-3 text-sm text-muted-foreground hover:border-primary/40 hover:text-primary"
                        >
                          Profil
                        </Link>
                      )}
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <TrustBadge size="sm" className="scale-90 origin-left" />
                      <span className="text-[11px] text-muted-foreground">unverbindlich</span>
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
