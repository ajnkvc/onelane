import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import ResultsMap, { type MapMarker } from "@/components/search/results-map";
import { getTileConfig, type MapTileConfig } from "@/modules/maps";
import { getSchoolProfile, type SchoolProfileDetail } from "@/modules/schools/profile";
import { searchSchools } from "@/modules/schools/search";
import { getPricesForSchool } from "@/modules/schools/prices";
import { PREIS_KOMPONENTEN, hatPflichtangabenSet, formatEuro, formatStand, type SchoolPriceRow } from "@/lib/preise";
import { DataBadge } from "@/components/school/data-badge";
import { TrustBadge } from "@/components/trust/trust-badge";
import { slugify } from "@/lib/slug";

/**
 * VORSCHAU „Profil — Dossier" (klickbarer Prototyp, ECHTE Demo-Daten).
 * ----------------------------------------------------------------------------
 * Konzept: kein Hero-Slideshow, sondern ein präziser Dossier-Kopf (Kicker,
 * Name, Fakten-Zeile mit klar gelabeltem Google-Fremdsignal) + mitlaufende
 * Anker-Navigation. Sektionen als klar getrennte Register mit WECHSELNDEN
 * Zonen-Hintergründen (weiß ↔ blauer Tint via color-mix). Der Preisaushang ist
 * der Held der Seite — Komponenten-Tabelle nach § 32 FahrlG (KEIN Gesamtpreis)
 * mit Provenienz-Badge und Stand. Rechts sticky die Anmelde-Rail (Desktop),
 * mobil eine Sticky-Bottom-Action-Bar (Anrufen | Anmeldung starten, ≥48 px).
 * Bilder als Collage-Grid statt Karussell; ohne Bilder bleibt der Kopf
 * Info-First. Keine öffentliche E-Mail. SSR, token-only, noindex.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Vorschau — Profil (Dossier)",
  robots: { index: false, follow: false },
};

type SP = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/* Zonen-Tints (Kernmuster: Sektionen wechseln weiß ↔ dezentes Blau). */
const TINT_ZONE = "bg-[color-mix(in_oklab,var(--brand-sky)_5%,var(--background))]";
const TINT_HERO = "bg-[color-mix(in_oklab,var(--brand-sky)_8%,var(--background))]";

const DAYS = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
const hhmm = (t: string) => t.slice(0, 5);
const artLabel = (a: string) => (a === "buero" ? "Büro" : a === "theorie" ? "Theorie" : a === "praxis" ? "Fahrpraxis" : a);
const getriebeLabel = (g: string | null) => (g === "automatik" ? "Automatik" : g === "schaltung" ? "Schaltung" : null);

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

/** Initialen-Monogramm (z. B. Fahrlehrer-Kachel) — konsistente Abstraktion statt Foto-Zwang. */
function monogramm(name: string): string {
  const teile = name.trim().split(/\s+/);
  return ((teile[0]?.[0] ?? "") + (teile[teile.length - 1]?.[0] ?? "")).toUpperCase() || "•";
}

/** Sektions-Kopf im Dossier-Stil: Mono-Kicker + Titel, harte Unterkante. */
function Register({ nr, titel }: { nr: string; titel: string }) {
  return (
    <div className="mb-5 flex items-baseline gap-3 border-b border-border pb-3">
      <span aria-hidden="true" className="font-mono text-xs text-muted-foreground/70">
        {nr}
      </span>
      <h2 className="text-lg font-bold tracking-tight sm:text-xl">{titel}</h2>
    </div>
  );
}

export default async function VorschauProfilSplit({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const stadt = first(sp.stadt)?.trim() || "muenchen";
  const slug = first(sp.slug)?.trim() || "fahrschule-isarpilot";

  // Profil laden; Fallback: erste Demo-Schule aus der München-Suche (fail-soft).
  let school: SchoolProfileDetail | null = await getSchoolProfile(stadt, slug).catch(() => null);
  if (!school) {
    try {
      const res = await searchSchools({ ort: "München" });
      const alt = res.items[0];
      if (alt?.ort) school = await getSchoolProfile(slugify(alt.ort), alt.slug).catch(() => null);
    } catch {
      school = null;
    }
  }

  if (!school) {
    return (
      <div className="mx-auto w-full max-w-2xl px-6 py-20 text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Vorschau-Prototyp</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Demo-Daten nicht verfügbar</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Der Seed für die Vorschau ist in dieser Umgebung nicht geladen.
        </p>
        <p className="mt-4">
          <Link href="/vorschau" className="text-primary underline-offset-2 hover:underline">
            ← Zur Vorschau-Übersicht
          </Link>
        </p>
      </div>
    );
  }

  // Preis-Komponenten (fail-soft); Klasse B zuerst — die meistgesuchte Klasse.
  let priceRows: SchoolPriceRow[] = [];
  try {
    priceRows = await getPricesForSchool(school.id);
  } catch {
    priceRows = [];
  }
  priceRows = [...priceRows].sort((a, b) => (a.klasse === "B" ? -1 : b.klasse === "B" ? 1 : a.klasse.localeCompare(b.klasse)));
  const ankerRow = priceRows[0] ?? null;

  // Karte fail-soft (ohne Tile-Anbieter: Anfahrt nur als Text).
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

  const tel = school.telefon?.replace(/\s+/g, "") ?? null;
  const bezirk = school.stadtbezirk && school.stadtbezirk !== school.ort ? school.stadtbezirk : null;
  const adresse = [school.strasse, [school.plz, school.ort].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const sprachen = school.sprachen.map((c) => SPRACHE_LABEL[c] ?? c.toUpperCase());

  const showImages = school.show.images && school.images.length > 0;
  const showZeiten = school.show.zeiten && school.hours.length > 0;
  const showVehicles = school.show.vehicles && school.vehicles.length > 0;
  const showTeam = school.show.instructors && school.instructors.length > 0;
  const showFaq = school.show.faq && school.faq.length > 0;
  const collage = school.images.slice(0, 3);

  // Zeiten je Wochentag gruppieren (strukturierte von/bis-Zeiten, kein Freitext).
  const tage = DAYS.map((label, wd) => ({ label, slots: school.hours.filter((h) => h.wochentag === wd) }));

  // Anker-Navigation: max. 5 Register, nur vorhandene Sektionen.
  const anker = [
    priceRows.length > 0 ? { id: "preise", label: "Preise" } : null,
    showZeiten ? { id: "zeiten", label: "Zeiten" } : null,
    showTeam ? { id: "team", label: "Team" } : null,
    showFaq ? { id: "faq", label: "FAQ" } : null,
    { id: "anfahrt", label: "Anfahrt" },
  ].filter((a): a is { id: string; label: string } => a !== null);

  let registerNr = 0;
  const nr = () => String(++registerNr).padStart(2, "0");

  return (
    <div className="flex w-full flex-1 flex-col pb-24 lg:pb-0">
      {/* ---- Dossier-Kopf (Tint-Zone): präzise, Info-First — kein Hero-Slideshow ---- */}
      <header className={`border-b border-border ${TINT_HERO}`}>
        <div className="mx-auto w-full max-w-6xl px-4 pb-6 pt-8 sm:px-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Vorschau-Prototyp · Demo-Daten · Dossier
          </p>
          <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">{school.name}</h1>
              <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                <span className="font-medium text-foreground/80">
                  {[school.ort, bezirk].filter(Boolean).join(" — ")}
                </span>
                {school.isPartner && (
                  <span className="inline-flex items-center gap-1 rounded-[4px] border border-primary/40 px-1.5 py-0.5 text-[11px] font-medium text-primary">
                    <span aria-hidden="true" className="size-1 rounded-full bg-accent" />
                    Partner-Fahrschule
                  </span>
                )}
              </p>
            </div>
            {/* Klassen-Chips: konsolidierte Varianten, kantig-mono */}
            {school.klassen.length > 0 && (
              <p className="flex flex-wrap gap-1">
                {school.klassen.map((k) => (
                  <span key={k} className="rounded-[3px] border border-border bg-background px-2 py-1 font-mono text-xs text-foreground/80">
                    {k}
                  </span>
                ))}
              </p>
            )}
          </div>

          {/* Fakten-Zeile (App-Store-Muster): Wert groß, Label klein — Google klar als Fremdquelle */}
          <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-4">
            {school.googleRating && (
              <div className="bg-background px-4 py-3">
                <dt className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                  Google{school.googleReviewsCount ? ` · ${school.googleReviewsCount} Bew.` : ""}
                </dt>
                <dd className="mt-0.5 font-mono text-lg tabular-nums text-foreground/90">
                  <span aria-hidden="true">★</span> {school.googleRating.replace(".", ",")}
                  <span className="ml-1 text-xs font-normal text-muted-foreground">Fremdsignal</span>
                </dd>
              </div>
            )}
            <div className="bg-background px-4 py-3">
              <dt className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">Klassen</dt>
              <dd className="mt-0.5 font-mono text-lg tabular-nums">{school.klassen.length || "—"}</dd>
            </div>
            <div className="bg-background px-4 py-3">
              <dt className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">Sprachen</dt>
              <dd className="mt-0.5 truncate text-lg font-medium">{sprachen.join(" · ") || "—"}</dd>
            </div>
            <div className="bg-background px-4 py-3">
              <dt className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">Datenstand</dt>
              <dd className="mt-0.5 text-lg font-medium">
                {school.isVerified ? "bestätigt" : "recherchiert"}
              </dd>
            </div>
          </dl>
        </div>
      </header>

      {/* ---- Mitlaufende Anker-Navigation (Register-Leiste) ---- */}
      <nav
        aria-label="Abschnitte des Profils"
        className="sticky top-16 z-30 border-b border-border bg-background/95 supports-[backdrop-filter]:bg-background/85 supports-[backdrop-filter]:backdrop-blur"
      >
        <div className="mx-auto flex w-full max-w-6xl items-center gap-1 overflow-x-auto px-4 py-2 sm:px-6">
          {anker.map((a, i) => (
            <a
              key={a.id}
              href={`#${a.id}`}
              className="inline-flex min-h-9 shrink-0 items-center gap-2 rounded-[4px] px-3 font-mono text-xs uppercase tracking-[0.1em] text-muted-foreground transition-colors duration-[var(--motion-duration-fast)] ease-[var(--motion-ease)] hover:bg-secondary hover:text-foreground"
            >
              <span aria-hidden="true" className="text-muted-foreground/60">{String(i + 1).padStart(2, "0")}</span>
              {a.label}
            </a>
          ))}
          <span className="ms-auto hidden shrink-0 font-mono text-[11px] text-muted-foreground/70 lg:inline">
            /{school.stadtSlug}/{school.slug}
          </span>
        </div>
      </nav>

      {/* ---- Inhalt + sticky Anmelde-Rail ---- */}
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:grid lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start lg:gap-8">
        {/* Linke Spalte: Register-Sektionen mit wechselnden Zonen-Hintergründen */}
        <div className="flex min-w-0 flex-col gap-6">
          {/* Bilder als Collage-Grid (kein Karussell); fehlen Bilder, entfällt die Zone ersatzlos */}
          {showImages && (
            <section aria-label={`Bilder von ${school.name}`} className="overflow-hidden rounded-md border border-border">
              <div className={collage.length >= 3 ? "grid grid-cols-3 grid-rows-2 gap-px bg-border" : "grid grid-cols-2 gap-px bg-border"}>
                {collage.map((img, i) => (
                  <div
                    key={img.url}
                    className={`relative bg-muted ${collage.length >= 3 && i === 0 ? "col-span-2 row-span-2 aspect-[4/3]" : "aspect-[4/3]"}`}
                  >
                    <Image
                      src={img.url}
                      alt={img.alt ?? `${school.name} — ${img.kategorie}`}
                      fill
                      unoptimized
                      sizes="(max-width: 1024px) 100vw, 640px"
                      className="object-cover"
                      priority={i === 0}
                    />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Beschreibung klein und nachgeordnet (strukturierte Daten zuerst) */}
          {school.beschreibung && (
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{school.beschreibung}</p>
          )}

          {/* Register 01 — PREISAUSHANG (Held der Seite, Tint-Zone) */}
          {priceRows.length > 0 && (
            <section id="preise" className={`scroll-mt-32 rounded-md border border-border px-5 py-6 sm:px-6 ${TINT_ZONE}`}>
              <Register nr={nr()} titel="Preisaushang" />
              <div className="grid gap-4 md:grid-cols-2">
                {priceRows.map((row) => (
                  <div key={row.klasse} className="rounded-md border border-border bg-background">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
                      <span className="inline-flex items-center gap-2">
                        <span className="rounded-[3px] bg-foreground px-2 py-0.5 font-mono text-xs font-semibold text-background">
                          Klasse {row.klasse}
                        </span>
                        {hatPflichtangabenSet(row) && (
                          <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                            Aushang vollständig
                          </span>
                        )}
                      </span>
                      <DataBadge status={row.status} stand={row.stand} />
                    </div>
                    <dl className="divide-y divide-border/70 px-4">
                      {PREIS_KOMPONENTEN.map((k) => {
                        const wert = row.komponenten[k.key];
                        return (
                          <div key={k.key} className="flex items-baseline justify-between gap-4 py-2.5">
                            <dt className="text-sm text-muted-foreground">{k.label}</dt>
                            <dd className={`text-right font-mono text-sm tabular-nums ${wert != null ? "" : "text-muted-foreground/70"}`}>
                              {wert != null ? formatEuro(wert) : "keine Angabe"}
                            </dd>
                          </div>
                        );
                      })}
                    </dl>
                    {formatStand(row.stand) && (
                      <p className="border-t border-border px-4 py-2 font-mono text-[11px] text-muted-foreground">
                        {formatStand(row.stand)} · Komponenten nach § 32 FahrlG — kein Gesamtpreis
                      </p>
                    )}
                  </div>
                ))}
              </div>
              <p className="mt-4 font-mono text-[11px] leading-relaxed text-muted-foreground">
                Behördliche Prüfgebühren (TÜV/DEKRA) sind Drittgebühren und kommen hinzu. „Recherchiert“ =
                ohne Gewähr, bis die Fahrschule die Angaben bestätigt.
              </p>
            </section>
          )}

          {/* Register — ZEITEN (weiße Zone): strukturierte von/bis-Zeitleiste */}
          {showZeiten && (
            <section id="zeiten" className="scroll-mt-32 rounded-md border border-border bg-background px-5 py-6 sm:px-6">
              <Register nr={nr()} titel="Öffnungs- & Theoriezeiten" />
              <div className="divide-y divide-border/70">
                {tage.map((t) => (
                  <div key={t.label} className="flex flex-col gap-1.5 py-2.5 sm:flex-row sm:items-center sm:gap-4">
                    <span className="w-28 shrink-0 font-mono text-xs uppercase tracking-[0.1em] text-muted-foreground">
                      {t.label}
                    </span>
                    {t.slots.length === 0 ? (
                      <span className="text-sm text-muted-foreground/70">keine Angabe</span>
                    ) : (
                      <span className="flex flex-wrap gap-1.5">
                        {t.slots.map((h, i) => (
                          <span
                            key={i}
                            className={`inline-flex items-center gap-1.5 rounded-[4px] border px-2 py-1 font-mono text-xs tabular-nums ${
                              h.art === "theorie"
                                ? "border-primary/40 bg-primary/5 text-primary"
                                : "border-border text-foreground/80"
                            }`}
                          >
                            {hhmm(h.von)}–{hhmm(h.bis)}
                            <span className="text-[10px] uppercase tracking-[0.08em] opacity-70">{artLabel(h.art)}</span>
                          </span>
                        ))}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Garage-Zeile (Tint-Zone): Fahrzeuge kompakt in einer Reihe */}
          {showVehicles && (
            <section aria-label="Fahrzeuge" className={`rounded-md border border-border px-5 py-6 sm:px-6 ${TINT_ZONE}`}>
              <Register nr={nr()} titel="Garage" />
              <ul className="flex gap-3 overflow-x-auto pb-1">
                {school.vehicles.map((v, i) => (
                  <li key={i} className="min-w-48 shrink-0 rounded-md border border-border bg-background px-4 py-3">
                    <p className="text-sm font-semibold">{[v.marke, v.modell].filter(Boolean).join(" ") || "Fahrzeug"}</p>
                    <p className="mt-1.5 flex flex-wrap gap-1">
                      {v.klasse && (
                        <span className="rounded-[3px] border border-border px-1.5 py-0.5 font-mono text-[11px]">{v.klasse}</span>
                      )}
                      {getriebeLabel(v.getriebe) && (
                        <span className="rounded-[3px] border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground">
                          {getriebeLabel(v.getriebe)}
                        </span>
                      )}
                      {v.besonderheiten.map((b) => (
                        <span key={b} className="rounded-[3px] border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground">
                          {b}
                        </span>
                      ))}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Register — TEAM (weiße Zone): Monogramm-Kacheln statt Foto-Zwang */}
          {showTeam && (
            <section id="team" className="scroll-mt-32 rounded-md border border-border bg-background px-5 py-6 sm:px-6">
              <Register nr={nr()} titel="Team" />
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {school.instructors.map((p) => (
                  <li key={p.slug} className="flex flex-col items-start gap-2 rounded-md border border-border px-3 py-3">
                    <span
                      aria-hidden="true"
                      className="grid size-10 place-items-center rounded-md bg-primary/10 font-mono text-sm font-bold text-primary"
                    >
                      {monogramm(p.name)}
                    </span>
                    <span className="text-sm font-medium leading-tight">{p.name}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Register — FAQ (Tint-Zone): details/summary, ohne JS bedienbar */}
          {showFaq && (
            <section id="faq" className={`scroll-mt-32 rounded-md border border-border px-5 py-6 sm:px-6 ${TINT_ZONE}`}>
              <Register nr={nr()} titel="Fragen & Antworten" />
              <div className="divide-y divide-border/70">
                {school.faq.map((f, i) => (
                  <details key={i} className="group py-1">
                    <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 py-2 text-sm font-medium marker:content-none [&::-webkit-details-marker]:hidden">
                      {f.frage}
                      <svg
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                        className="size-4 shrink-0 text-muted-foreground motion-safe:transition-transform motion-safe:duration-[var(--motion-duration-fast)] motion-safe:ease-[var(--motion-ease)] group-open:rotate-45"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      >
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                    </summary>
                    <p className="pb-3 pr-8 text-sm leading-relaxed text-muted-foreground">{f.antwort}</p>
                  </details>
                ))}
              </div>
            </section>
          )}

          {/* Register — ANFAHRT (weiße Zone): Adresse + Karte fail-soft, Telefon statt E-Mail */}
          <section id="anfahrt" className="scroll-mt-32 rounded-md border border-border bg-background px-5 py-6 sm:px-6">
            <Register nr={nr()} titel="Anfahrt" />
            <div className="flex flex-col gap-4">
              <p className="text-sm">
                <span className="font-medium">{adresse || "Adresse folgt"}</span>
                {bezirk && <span className="text-muted-foreground"> · {bezirk}</span>}
              </p>
              {tile && marker.length > 0 && (
                <div className="[&_.map-ci]:rounded-md [&_.map-ci]:shadow-none">
                  <ResultsMap markers={marker} center={null} tile={tile} />
                </div>
              )}
              {school.telefon && (
                <p className="text-sm text-muted-foreground">
                  Fragen zur Anfahrt? <a href={`tel:${tel}`} className="font-medium text-primary underline-offset-2 hover:underline">{school.telefon}</a>
                </p>
              )}
            </div>
          </section>

          {/* Datenherkunft-Fußzeile: Transparenz als Mikro-Muster */}
          <footer className="rounded-md border border-border px-5 py-4">
            <p className="font-mono text-[11px] leading-relaxed text-muted-foreground">
              Datenherkunft: strukturierte Angaben der Fahrschule bzw. Recherche — Provenienz je Abschnitt
              gekennzeichnet. Bewertungszahlen stammen von Google (Fremdsignal, nicht von onelane erhoben).
            </p>
            <p className="mt-2">
              <Link href="/vorschau/suche-split" className="text-sm text-primary underline-offset-2 hover:underline">
                ← Zurück zur Ergebnisliste
              </Link>
            </p>
          </footer>
        </div>

        {/* ---- Rechte Spalte: sticky Anmelde-Rail (Desktop); mobil im Fluss unter dem Inhalt ---- */}
        <aside id="anmeldung" className="mt-6 scroll-mt-32 lg:sticky lg:top-32 lg:mt-0">
          <div className="rounded-md border border-border bg-background shadow-elevation-1">
            <div className={`border-b border-border px-5 py-4 ${TINT_ZONE}`}>
              <h2 className="text-base font-bold tracking-tight">Anmeldung</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">unverbindlich · kostenlos · direkt bei der Fahrschule</p>
            </div>

            {/* Ehrlicher Preis-Anker: Komponenten-Duo mit Provenienz — NIE ein Gesamtpreis */}
            {ankerRow && (
              <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 border-b border-border px-5 py-4 text-sm">
                <dt className="text-muted-foreground">Grundbetrag (Klasse {ankerRow.klasse})</dt>
                <dd className="text-right font-mono tabular-nums">
                  {ankerRow.komponenten.grundbetrag != null ? formatEuro(ankerRow.komponenten.grundbetrag) : "keine Angabe"}
                </dd>
                <dt className="text-muted-foreground">Fahrstunde (45 Min.)</dt>
                <dd className="text-right font-mono tabular-nums">
                  {ankerRow.komponenten.fahrstunde45 != null ? formatEuro(ankerRow.komponenten.fahrstunde45) : "keine Angabe"}
                </dd>
                <dd className="col-span-2 mt-1.5 justify-self-start">
                  <DataBadge status={ankerRow.status} stand={ankerRow.stand} />
                </dd>
              </dl>
            )}

            {/* Demo-Kurzformular (Prototyp): GET auf dieselbe Seite, sendet nichts an Dritte */}
            <form action="/vorschau/profil-split" method="get" className="flex flex-col gap-3 px-5 py-4">
              <input type="hidden" name="stadt" value={school.stadtSlug} />
              <input type="hidden" name="slug" value={school.slug} />
              <div>
                <label htmlFor="pf-name" className="mb-1 block font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                  Dein Name
                </label>
                <input
                  id="pf-name"
                  name="demoName"
                  autoComplete="name"
                  placeholder="Vor- und Nachname"
                  className="min-h-11 w-full rounded-[4px] border border-input bg-background px-3 text-sm outline-none placeholder:text-muted-foreground focus:border-ring"
                />
              </div>
              <div>
                <label htmlFor="pf-klasse" className="mb-1 block font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                  Führerscheinklasse
                </label>
                <select
                  id="pf-klasse"
                  name="demoKlasse"
                  className="min-h-11 w-full rounded-[4px] border border-input bg-background px-3 text-sm outline-none focus:border-ring"
                  defaultValue={school.klassen[0] ?? "B"}
                >
                  {(school.klassen.length > 0 ? school.klassen : ["B"]).map((k) => (
                    <option key={k} value={k}>
                      Klasse {k}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                className="inline-flex min-h-12 items-center justify-center rounded-[4px] bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors duration-[var(--motion-duration-fast)] ease-[var(--motion-ease)] hover:bg-primary/90"
              >
                Anmeldung starten
              </button>
              {school.telefon && (
                <a
                  href={`tel:${tel}`}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[4px] border border-border px-4 text-sm font-semibold transition-colors duration-[var(--motion-duration-fast)] ease-[var(--motion-ease)] hover:border-primary/50 hover:text-primary"
                >
                  <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                  Anrufen · {school.telefon}
                </a>
              )}
              <div className="mt-1 flex items-center justify-between gap-2">
                <TrustBadge size="sm" />
                <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Prototyp — sendet nichts</span>
              </div>
            </form>
          </div>
        </aside>
      </div>

      {/* ---- Mobile Sticky-Bottom-Action-Bar: Anrufen | Anmeldung starten (Touch ≥48 px) ---- */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background pb-[env(safe-area-inset-bottom)] shadow-elevation-3 lg:hidden">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-2 px-4 py-2.5">
          <span className="hidden sm:block">
            <TrustBadge size="sm" />
          </span>
          {school.telefon && (
            <a
              href={`tel:${tel}`}
              className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-[4px] border border-border px-3 text-sm font-semibold transition-colors duration-[var(--motion-duration-fast)] ease-[var(--motion-ease)] active:bg-secondary"
            >
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
              Anrufen
            </a>
          )}
          <a
            href="#anmeldung"
            className="inline-flex min-h-12 flex-1 items-center justify-center rounded-[4px] bg-primary px-3 text-sm font-semibold text-primary-foreground transition-colors duration-[var(--motion-duration-fast)] ease-[var(--motion-ease)] active:bg-primary/90"
          >
            Anmeldung starten
          </a>
        </div>
      </div>
    </div>
  );
}
