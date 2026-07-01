import type { Metadata } from "next";
import { SearchBar } from "@/components/search/search-bar";
import { FilterBar } from "@/components/search/filter-bar";
import ResultsMap, { type MapMarker } from "@/components/search/results-map";
import { JsonLd } from "@/components/seo/json-ld";
import { getRequestNonce } from "@/lib/nonce";
import { getTileConfig, type MapTileConfig } from "@/modules/maps";
import { searchSchools, type SearchResult } from "@/modules/schools/search";
import { slugify } from "@/lib/slug";
import { Flag } from "@/components/search/flag";

/** Deterministischer Hash (stabil je Schule) für Logo-Farbe + Beispiel-Ø-Preis. */
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}
function monogram(name: string): string {
  const parts = name.replace(/^Fahrschule\s*/i, "").trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "F";
}
const LOGO_GRADS = [
  ["#0ea5e9", "#22d3ee"], ["#22d3ee", "#a3e635"], ["#0369a1", "#0ea5e9"],
  ["#65a30d", "#a3e635"], ["#f59e0b", "#fbbf24"], ["#0ea5e9", "#0369a1"],
];
/** Beispiel-Ø-Preis (zufällig, stabil). Später: aus hinterlegten Schul-Preisen. */
function examplePrice(id: string): number {
  return 1800 + (hashStr(id) % 1100); // 1.800–2.899 €
}

/** Beispiel-Fahrschul-Firmenlogo (Emblem + Monogramm, stabil je Schule). Echte Logos folgen. */
function LogoEmblem({ id, mono }: { id: string; mono: string }) {
  const grad = LOGO_GRADS[hashStr(id) % LOGO_GRADS.length];
  const style = hashStr(id) % 4;
  const gid = `lg-${id}`;
  const label = (fill: string) => (
    <text x="32" y="33" textAnchor="middle" dominantBaseline="central" fontSize="20" fontWeight="700" fill={fill} fontFamily="inherit">{mono}</text>
  );
  let shape;
  if (style === 0) {
    shape = (<><rect x="8" y="8" width="48" height="48" rx="14" fill={`url(#${gid})`} /><path d="M18 48h28" stroke="#fff" strokeOpacity="0.7" strokeWidth="2.5" strokeDasharray="5 5" strokeLinecap="round" />{label("#fff")}</>);
  } else if (style === 1) {
    shape = (<><circle cx="32" cy="32" r="23" fill="none" stroke={`url(#${gid})`} strokeWidth="6" /><circle cx="32" cy="9.5" r="2.6" fill={grad[0]} /><circle cx="32" cy="54.5" r="2.6" fill={grad[1]} /><circle cx="9.5" cy="32" r="2.6" fill={grad[0]} /><circle cx="54.5" cy="32" r="2.6" fill={grad[1]} />{label("#1b3a5c")}</>);
  } else if (style === 2) {
    shape = (<><path d="M32 7l21 7v15c0 13-9 20-21 24-12-4-21-11-21-24V14z" fill={`url(#${gid})`} />{label("#fff")}</>);
  } else {
    shape = (<><path d="M32 6 55 19v26L32 58 9 45V19z" fill={`url(#${gid})`} />{label("#fff")}</>);
  }
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" role="img" aria-label={`Logo ${mono}`}>
      <defs><linearGradient id={gid} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={grad[0]} /><stop offset="1" stopColor={grad[1]} /></linearGradient></defs>
      {shape}
    </svg>
  );
}

/**
 * Ergebnisseite (Phase F + 003b-Politur, SSR). Liste bleibt primär und ohne
 * Karten-JS nutzbar; zusätzlich Filter-/Sortier-UI (GET-Formular, parametererhaltend),
 * eine lazy Leaflet/OSM-Karte mit Markern der sichtbaren Treffer und JSON-LD
 * ItemList — deckungsgleich mit der sichtbaren Liste. Parametrisierte Ergebnisse
 * bleiben noindex (Stadt-Landingpages = Phase L).
 */
export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);


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

  // Karte: Tile-Config (in Prod fail-closed → ohne Karte, Liste bleibt nutzbar).
  let tile: MapTileConfig | null = null;
  try {
    tile = getTileConfig();
  } catch {
    tile = null;
  }
  const markers: MapMarker[] = (result?.items ?? [])
    .filter((s) => s.latitude != null && s.longitude != null)
    .map((s) => ({ id: s.id, name: s.name, lat: s.latitude as number, lng: s.longitude as number, partner: s.isPartner }));

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

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex justify-center">
        <SearchBar />
      </div>

      {/* Sofort-Filter (Client) — wirkt ohne „Filtern"-Klick; Ort/Koordinaten bleiben erhalten. */}
      <FilterBar />

      {itemList && <JsonLd data={itemList} nonce={await getRequestNonce()} />}

      {failed ? (
        <p className="text-sm text-muted-foreground">Die Suche konnte nicht ausgeführt werden. Bitte Eingabe prüfen.</p>
      ) : !result || result.total === 0 ? (
        <p className="text-sm text-muted-foreground">
          Keine Fahrschulen gefunden{cur("ort") ? ` für „${cur("ort")}"` : ""}. Versuch es mit einem größeren Umkreis oder einem anderen Ort.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h1 className="text-xl font-bold tracking-tight">
              {result.total}{result.hasMore ? "+" : ""} Fahrschule{result.total === 1 && !result.hasMore ? "" : "n"}
              {cur("ort") ? ` nahe ${cur("ort")}` : ""}
            </h1>
            <span className="text-sm text-muted-foreground">{result.zentrum ? "nach Entfernung" : "nach Bewertung"}</span>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
            {/* Karte als Sidebar (mobil oben) */}
            {tile && markers.length > 0 && (
              <aside className="order-first lg:order-last">
                <div className="lg:sticky lg:top-20">
                  <ResultsMap markers={markers} center={result.zentrum} tile={tile} />
                </div>
              </aside>
            )}

            <div className="flex flex-col gap-4">
              {result.items.map((s) => {
                const href = s.ort ? `/fahrschulen/${slugify(s.ort)}/${s.slug}` : "#";
                return (
                  <article key={s.id} className="hover-lift overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                    <a href={href} className="flex items-stretch">
                      {/* Logo-Spalte über volle Höhe (Beispiel-Logo; echte Logos folgen) */}
                      <div className="flex w-24 shrink-0 items-center justify-center border-r border-border bg-secondary/60 sm:w-28">
                        <LogoEmblem id={s.id} mono={monogram(s.name)} />
                      </div>

                      <div className="flex min-w-0 flex-1 flex-col gap-2.5 p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h2 className="flex flex-wrap items-center gap-2 text-base font-semibold">
                              {s.name}
                              {s.isPartner && <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">Partner</span>}
                              {s.isVerified && <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">Verifiziert</span>}
                            </h2>
                            <p className="mt-0.5 text-sm text-muted-foreground">
                              {s.stadtbezirk ?? s.ort}
                              {s.distanzKm != null ? ` · ${s.distanzKm} km entfernt` : ""}
                            </p>
                          </div>
                          {s.googleRating && (
                            <div className="shrink-0 text-right">
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-sm font-semibold text-amber-900">★ {s.googleRating}</span>
                              {s.googleReviewsCount ? <p className="mt-0.5 text-xs text-muted-foreground">{s.googleReviewsCount} Bew.</p> : null}
                            </div>
                          )}
                        </div>

                        {(s.klassen.length > 0 || s.sprachen.length > 0) && (
                          <div className="flex flex-wrap items-center gap-1.5">
                            {s.klassen.slice(0, 6).map((k) => (
                              <span key={k} className="rounded-md bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">{k}</span>
                            ))}
                            {s.sprachen.length > 0 && <span aria-hidden="true" className="mx-1 h-4 w-px bg-border" />}
                            {s.sprachen.map((code) => <Flag key={code} code={code} />)}
                          </div>
                        )}

                        <div className="flex items-center justify-between border-t border-border pt-3">
                          <div>
                            <p className="text-xs text-muted-foreground">Ø-Preis {cur("klasse") || "Klasse B"}</p>
                            <p className="font-semibold text-foreground">ca. {examplePrice(s.id).toLocaleString("de-DE")} €</p>
                          </div>
                          <span className="inline-flex items-center rounded-full bg-brand-sky/10 px-4 py-2 text-sm font-medium text-[#0369a1]">
                            Profil ansehen
                          </span>
                        </div>
                      </div>
                    </a>
                  </article>
                );
              })}

              {result.seiten > 1 && (
                <nav className="flex items-center justify-between text-sm" aria-label="Seiten">
                  {result.seite > 1 ? (
                    <a className="underline-offset-2 hover:underline" href={pageHref(result.seite - 1)}>← Zurück</a>
                  ) : (
                    <span className="text-muted-foreground">← Zurück</span>
                  )}
                  <span className="text-muted-foreground">Seite {result.seite} / {result.seiten}</span>
                  {result.seite < result.seiten ? (
                    <a className="underline-offset-2 hover:underline" href={pageHref(result.seite + 1)}>Weiter →</a>
                  ) : (
                    <span className="text-muted-foreground">Weiter →</span>
                  )}
                </nav>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
