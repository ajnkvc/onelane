import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/seo/json-ld";
import type { JsonLdValue } from "@/lib/safe-json-ld";
import ResultsMap, { type MapMarker } from "@/components/search/results-map";
import { getTileConfig, type MapTileConfig } from "@/modules/maps";
import { getSiteUrl } from "@/lib/public-config";
import { getSchoolProfile, type SchoolProfileDetail } from "@/modules/schools/profile";
import { getPricesForSchool } from "@/modules/schools/prices";
import type { SchoolPriceRow } from "@/lib/preise";
import { ctaLabel } from "@/lib/cta";
import { berechneHighlights, type Highlight } from "@/lib/highlights";
import { ergaenzeFaq, type FaqItem } from "@/lib/faq-ergaenzung";
import { Galerie, KartenSkizze } from "@/components/school/galerie";
import { Preisaushang, waehleFokusKlasse } from "@/components/school/preisaushang";
import { RatingStern, QuoteTeaser, ratingFarbClass } from "@/components/school/rating";
import { ZeitenWidget } from "@/components/school/zeiten-widget";
import { GarageSlider } from "@/components/school/garage";
import { AnmeldeRail, MobileActionBar, PhoneIcon } from "@/components/school/anmelde-aktionen";

/**
 * Fahrschul-Detailseite — das DOSSIER (finales Produkt-Design, Jury-Synthese).
 * ----------------------------------------------------------------------------
 * Rückgrat: Editorial-Dossier (Info-First-Kopf statt Hero-Slideshow, Register-
 * Sektionen mit wechselnden Weiß↔Blau-Tint-Zonen, 1px-Hairlines, tabular-nums).
 * Veredelungen: IMMER sichtbare Dual-CTAs (Label zentral via lib/cta.ts +
 * „Anrufen"), §32-Gating im Preisaushang (Komponenten-Register, kein
 * Gesamtpreis, zzgl. amtlicher Prüfgebühren) mit KLASSEN-FOKUS (?klasse= aus
 * der Suche → B → erste; Rest als Aufklapper), ehrliche „Highlights der
 * Fahrschule" (lib/highlights.ts, nur mit Datengrundlage, ab 2 Einträgen),
 * Zeiten-WIDGET statt Wochentags-Listen, SVG-Fallbacks statt leerer Kacheln.
 * Vertrauens-Linien: Google-Rating klein + gelabelt (Gold-Token, Fremdsignal-
 * Satz), Bestehensquoten-Teaser OHNE Werte (amtlich ab 2027), KEINE öffentliche
 * E-Mail und KEIN Website-Link der Schule (interne Vertriebsinfo — öffentliche
 * Kontaktwege sind NUR Telefon + Anfrage-Funnel), Korrektur-Link an UNSER
 * Portal-Postfach. Das FAQ kombiniert gepflegte school_faq_items mit bis zu 4
 * auto-generierten, schul-individuellen Q&A (lib/faq-ergaenzung.ts).
 * INDEXIERBAR mit canonical; JSON-LD (DrivingSchool + FAQPage) deckungsgleich
 * mit dem sichtbaren Inhalt, ohne Schul-E-Mail/-Website.
 * SSR, ohne JS lesbar; Datenzugriff ausschließlich über @/modules (RLS).
 */
export const dynamic = "force-dynamic";

type Params = Promise<{ stadt: string; slug: string }>;
type SP = Promise<Record<string, string | string[] | undefined>>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function siteUrl(): string {
  return getSiteUrl().replace(/\/+$/, "");
}
function abs(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${siteUrl()}${path.startsWith("/") ? "" : "/"}${path}`;
}

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

/* Zonen-Tints: Sektionen wechseln Weiß ↔ dezentes Blau (color-mix, Token-only). */
const TINT_ZONE = "bg-[color-mix(in_oklab,var(--brand-sky)_5%,var(--background))]";
const TINT_HERO = "bg-[color-mix(in_oklab,var(--brand-sky)_8%,var(--background))]";

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { stadt, slug } = await params;
  const school = await getSchoolProfile(stadt, slug).catch(() => null);
  if (!school) return { robots: { index: false, follow: false } };

  const loc = school.stadtbezirk ?? school.ort ?? "";
  const title = `${school.name}${loc ? ` – Fahrschule in ${loc}` : ""}`;
  const description =
    school.beschreibung?.replace(/\s+/g, " ").trim().slice(0, 155) ||
    `Fahrschule ${school.name}${loc ? ` in ${loc}` : ""} – Preisaushang, Klassen, Zeiten und Team im Überblick.`;
  const canonical = `${siteUrl()}/fahrschulen/${school.stadtSlug}/${school.slug}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical, type: "website" },
  };
}

/**
 * JSON-LD deckungsgleich mit dem sichtbaren Inhalt — BEWUSST ohne Schul-E-Mail
 * und ohne Schul-Website (interne Vertriebsinfo, nicht öffentlich). Das FAQ
 * kommt als KOMBINIERTE Liste (gepflegt + auto-ergänzt) — exakt das, was die
 * Seite sichtbar rendert.
 */
function buildJsonLd(school: SchoolProfileDetail, showImages: boolean, faq: FaqItem[]) {
  const loc = school.stadtbezirk ?? school.ort ?? "";
  const drivingSchool: JsonLdValue = {
    "@context": "https://schema.org",
    "@type": "DrivingSchool",
    name: school.name,
    ...(school.beschreibung ? { description: school.beschreibung } : {}),
    ...(school.strasse || school.plz || school.ort
      ? {
          address: {
            "@type": "PostalAddress",
            ...(school.strasse ? { streetAddress: school.strasse } : {}),
            ...(school.plz ? { postalCode: school.plz } : {}),
            ...(loc ? { addressLocality: loc } : {}),
            addressCountry: school.land,
          },
        }
      : {}),
    ...(school.latitude != null && school.longitude != null
      ? { geo: { "@type": "GeoCoordinates", latitude: school.latitude, longitude: school.longitude } }
      : {}),
    ...(school.telefon ? { telephone: school.telefon } : {}),
    ...(school.sprachen.length ? { knowsLanguage: school.sprachen } : {}),
    ...(showImages ? { image: school.images.map((im) => abs(im.url)) } : {}),
    ...(school.googleRating
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: school.googleRating,
            ...(school.googleReviewsCount ? { reviewCount: school.googleReviewsCount } : {}),
          },
        }
      : {}),
  };

  const faqPage: JsonLdValue | null =
    faq.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faq.map((f) => ({
            "@type": "Question",
            name: f.frage,
            acceptedAnswer: { "@type": "Answer", text: f.antwort },
          })),
        }
      : null;

  return { drivingSchool, faqPage };
}

/** Sektions-Kopf im Dossier-Stil: Mono-Kicker-Nummer + Titel, harte Unterkante. */
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

/** Initialen-Monogramm für Team-Kacheln — konsistente Abstraktion statt Foto-Zwang. */
function monogramm(name: string): string {
  const teile = name.trim().split(/\s+/);
  return ((teile[0]?.[0] ?? "") + (teile[teile.length - 1]?.[0] ?? "")).toUpperCase() || "•";
}

/** Strich-Icons der Highlights-Box (rein dekorativ, Token-Farben). */
function HighlightGlyph({ icon }: { icon: Highlight["icon"] }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="mt-0.5 size-4 shrink-0 text-primary"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {icon === "automatik" && (
        <>
          {/* Lenkrad */}
          <circle cx="12" cy="12" r="8.5" />
          <circle cx="12" cy="12" r="2.5" />
          <path d="M3.5 12h6.2M14.3 12h6.2M12 14.5v6" />
        </>
      )}
      {icon === "b197" && (
        <>
          {/* Wechsel-Pfeile: Automatik lernen ↔ Schaltwagen fahren */}
          <path d="M4 8h13l-3.5-3.5" />
          <path d="M20 16H7l3.5 3.5" />
        </>
      )}
      {icon === "abendtheorie" && (
        /* Mond: Abend-Theorie */
        <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" />
      )}
      {icon === "sprachen" && (
        <>
          {/* Sprechblase */}
          <path d="M12 21a9 9 0 1 0-9-9c0 1.8.5 3.4 1.4 4.8L3 21l4.4-1.3A9 9 0 0 0 12 21Z" />
          <path d="M8.5 10.5h7M8.5 14h5" />
        </>
      )}
      {icon === "preise" && (
        <>
          {/* Häkchen-Kreis: von der Fahrschule bestätigt */}
          <circle cx="12" cy="12" r="8.5" />
          <path d="m8.5 12.5 2.3 2.3 4.7-5.3" />
        </>
      )}
    </svg>
  );
}

export default async function SchoolProfilePage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SP;
}) {
  const { stadt, slug } = await params;
  const sp = await searchParams;
  const school = await getSchoolProfile(stadt, slug).catch(() => null);
  if (!school) notFound();

  // Klassen-Wunsch aus der Suche (?klasse=…), defensiv validiert.
  const rawKlasse = first(sp.klasse)?.trim().toUpperCase() ?? "";
  const klasseParam = /^[A-Z0-9]{1,12}$/.test(rawKlasse) ? rawKlasse : null;

  // Preis-Komponenten (fail-soft); Klasse B zuerst — die meistgesuchte Klasse.
  let priceRows: SchoolPriceRow[] = [];
  try {
    priceRows = await getPricesForSchool(school.id);
  } catch {
    priceRows = [];
  }
  priceRows = [...priceRows].sort((a, b) =>
    a.klasse === "B" ? -1 : b.klasse === "B" ? 1 : a.klasse.localeCompare(b.klasse),
  );
  // Fokus-Klasse des Preisaushangs: ?klasse= → B → erste vorhandene.
  const fokusKlasse = waehleFokusKlasse(priceRows, klasseParam);

  // Karte fail-soft: ohne Tile-Anbieter zeigt die Anfahrt die SVG-Skizze — nie Leere.
  let tile: MapTileConfig | null = null;
  try {
    tile = getTileConfig();
  } catch {
    tile = null;
  }
  const hasGeo = school.latitude != null && school.longitude != null;
  const markers: MapMarker[] = hasGeo
    ? [{ id: school.id, name: school.name, lat: school.latitude as number, lng: school.longitude as number, partner: school.isPartner }]
    : [];

  const showImages = school.show.images && school.images.length > 0;
  const showVehicles = school.show.vehicles && school.vehicles.length > 0;
  const showTeam = school.show.instructors && school.instructors.length > 0;
  const showZeiten = school.show.zeiten && school.hours.length > 0;

  const sprachen = school.sprachen.map((c) => SPRACHE_LABEL[c] ?? c.toUpperCase());

  // FAQ: gepflegte Einträge + bis zu 4 auto-generierte, schul-individuelle Q&A
  // (nur mit echter Datengrundlage; Sektionen, die die Schule ausgeblendet hat,
  // liefern KEINE Daten in die Generierung). JSON-LD bleibt deckungsgleich.
  const faqAlle: FaqItem[] = school.show.faq
    ? [
        ...school.faq,
        ...ergaenzeFaq({
          name: school.name,
          klassen: school.klassen,
          sprachen,
          vehicles: school.show.vehicles ? school.vehicles : [],
          theorieZeiten: school.show.zeiten
            ? school.hours.filter((h) => h.art === "theorie")
            : [],
          vorhandeneFragen: school.faq.map((f) => f.frage),
        }),
      ]
    : [];
  const showFaq = faqAlle.length > 0;

  // Ehrliche Highlights (lib/highlights.ts): nur mit Datengrundlage, Box ab 2.
  const theorieAbende = school.hours.some(
    (h) => h.art === "theorie" && /^\d{2}:\d{2}/.test(h.von) && Number(h.von.slice(0, 2)) >= 18,
  );
  const highlights = berechneHighlights({
    klassen: school.klassen,
    sprachen: school.sprachen,
    vehicles: school.show.vehicles ? school.vehicles : [],
    theorieAbende: school.show.zeiten && theorieAbende,
    preiseBestaetigt: priceRows.some((r) => r.status === "bestaetigt"),
  });

  const { drivingSchool, faqPage } = buildJsonLd(school, showImages, faqAlle);

  const tel = school.telefon?.replace(/\s+/g, "") ?? null;
  const bezirk = school.stadtbezirk && school.stadtbezirk !== school.ort ? school.stadtbezirk : null;
  const adresse = [school.strasse, [school.plz, school.ort].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const anmeldenHref = `/fahrschulen/${school.stadtSlug}/${school.slug}/anmeldung`;
  const korrekturMailto = `mailto:kontakt@onelane.de?subject=${encodeURIComponent(
    `Korrektur: /fahrschulen/${school.stadtSlug}/${school.slug}`,
  )}`;
  const jetzt = new Date();

  // Anker-Navigation: max. 5 Register, nur tatsächlich vorhandene Sektionen.
  const anker = [
    priceRows.length > 0 ? { id: "preise", label: "Preise" } : null,
    showZeiten ? { id: "zeiten", label: "Zeiten" } : null,
    showTeam ? { id: "team", label: "Team" } : null,
    showFaq ? { id: "faq", label: "FAQ" } : null,
    { id: "anfahrt", label: "Anfahrt" },
  ]
    .filter((a): a is { id: string; label: string } => a !== null)
    .slice(0, 5);

  let registerNr = 0;
  const nr = () => String(++registerNr).padStart(2, "0");

  return (
    <div className="flex w-full flex-1 flex-col pb-24 lg:pb-0">
      <JsonLd data={drivingSchool} />
      {faqPage && <JsonLd data={faqPage} />}

      {/* ---- Dossier-Kopf (Tint-Zone): Info-First, kein Hero-Slideshow ---- */}
      <header className={`border-b border-border ${TINT_HERO}`}>
        <div className="mx-auto w-full max-w-6xl px-4 pb-6 pt-6 sm:px-6">
          <nav className="text-sm text-muted-foreground" aria-label="Brotkrumen">
            <Link href="/fahrschulen" className="underline-offset-2 hover:underline">
              Fahrschulen
            </Link>
            {school.ort ? <span> · {school.ort}</span> : null}
          </nav>

          <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
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
            {school.klassen.length > 0 && (
              <p className="flex flex-wrap gap-1" aria-label="Führerscheinklassen">
                {school.klassen.map((k) => (
                  <span
                    key={k}
                    className="rounded-[3px] border border-border bg-background px-2 py-1 font-mono text-xs text-foreground/80"
                  >
                    {k}
                  </span>
                ))}
              </p>
            )}
          </div>

          {/* Fakten-Zeile: Wert groß, Label klein — die Quelle (Google) steht
              direkt im Label; auf Jargon wie „Fremdsignal" bewusst verzichtet
              (Gründer 2026-07-02). */}
          <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-4">
            {school.googleRating && (
              <div className="bg-background px-4 py-3">
                <dt className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                  Google{school.googleReviewsCount ? ` · ${school.googleReviewsCount} Bewertungen` : ""}
                </dt>
                <dd className="mt-0.5 flex items-center gap-1.5 text-lg">
                  <RatingStern className="size-4" />
                  {/* Zahlwert in Noten-Farbe (ratingFarbClass), Stern bleibt Gold */}
                  <span className={`font-mono font-bold tabular-nums ${ratingFarbClass(school.googleRating)}`}>
                    {school.googleRating.replace(".", ",")}
                  </span>
                </dd>
              </div>
            )}
            {showVehicles && (
              <div className="bg-background px-4 py-3">
                <dt className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">Fahrzeuge</dt>
                <dd className="mt-0.5 font-mono text-lg tabular-nums">{school.vehicles.length}</dd>
              </div>
            )}
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
          {/* Ausblick-Zeile: Bestehensquoten-Teaser (ohne Werte) + Bewertungs-Slot.
              Der frühere „Fremdquelle"-Satz ist bewusst entfernt (Gründer
              2026-07-02) — die Quelle steht im Fakten-Label, der Herkunfts-
              Hinweis in der Datenherkunft-Fußzeile. */}
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <QuoteTeaser />
            <span className="text-[11px] text-muted-foreground">
              Verifizierte Bewertungen von echten Fahrschülern — kommt.
            </span>
          </p>
        </div>
      </header>

      {/* ---- Mitlaufende Anker-Navigation (Register-Leiste, max. 5) ---- */}
      <nav
        aria-label="Abschnitte des Profils"
        className="sticky top-16 z-30 border-b border-border bg-background/95 supports-[backdrop-filter]:bg-background/85 supports-[backdrop-filter]:backdrop-blur"
      >
        <div className="mx-auto flex w-full max-w-6xl items-center gap-1 overflow-x-auto px-4 py-2 sm:px-6">
          {anker.map((a, i) => (
            <a
              key={a.id}
              href={`#${a.id}`}
              className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-[4px] px-3 font-mono text-xs uppercase tracking-[0.1em] text-muted-foreground transition-colors duration-[var(--motion-duration-fast)] ease-[var(--motion-ease)] hover:bg-secondary hover:text-foreground"
            >
              <span aria-hidden="true" className="text-muted-foreground/60">
                {String(i + 1).padStart(2, "0")}
              </span>
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
        <div className="flex min-w-0 flex-col gap-6">
          {/* Galerie: echtes Grid oder SVG-Karten-Skizze — nie leere Kacheln */}
          <Galerie images={showImages ? school.images : []} schoolName={school.name} bezirk={bezirk} />

          {/* Beschreibung klein und nachgeordnet (strukturierte Daten zuerst) */}
          {school.beschreibung && (
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{school.beschreibung}</p>
          )}

          {/* Register — PREISAUSHANG (Held der Seite, Tint-Zone, §32-Gating,
              Klassen-Fokus: nur EINE Klasse offen, Rest als Aufklapper) */}
          {priceRows.length > 0 && (
            <section id="preise" className={`scroll-mt-32 rounded-md border border-border px-5 py-6 sm:px-6 ${TINT_ZONE}`}>
              <Register nr={nr()} titel="Preisaushang" />
              <Preisaushang rows={priceRows} fokusKlasse={fokusKlasse} />
            </section>
          )}

          {/* Register — ZEITEN (weiße Zone): Status-Pill + nächste Theorie + Wochenraster */}
          {showZeiten && (
            <section id="zeiten" className="scroll-mt-32 rounded-md border border-border bg-background px-5 py-6 sm:px-6">
              <Register nr={nr()} titel="Öffnungs- & Theoriezeiten" />
              <ZeitenWidget hours={school.hours} now={jetzt} />
            </section>
          )}

          {/* Register — GARAGE (Tint-Zone): Fahrzeuge als Snap-Slider */}
          {showVehicles && (
            <section aria-label="Fahrzeuge" className={`rounded-md border border-border px-5 py-6 sm:px-6 ${TINT_ZONE}`}>
              <Register nr={nr()} titel="Garage" />
              <GarageSlider vehicles={school.vehicles} />
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
                {faqAlle.map((f, i) => (
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

          {/* Register — ANFAHRT (weiße Zone): Karte fail-soft, Kontakt = Telefon + Funnel */}
          <section id="anfahrt" className="scroll-mt-32 rounded-md border border-border bg-background px-5 py-6 sm:px-6">
            <Register nr={nr()} titel="Anfahrt & Kontakt" />
            <div className="flex flex-col gap-4">
              <p className="text-sm">
                <span className="font-medium">{adresse || "Adresse folgt"}</span>
                {bezirk && <span className="text-muted-foreground"> · {bezirk}</span>}
              </p>
              {tile && markers.length > 0 ? (
                <ResultsMap
                  markers={markers}
                  center={{ lat: school.latitude as number, lng: school.longitude as number }}
                  tile={tile}
                />
              ) : (
                <KartenSkizze bezirk={bezirk} />
              )}
              {/* Kontakt OHNE öffentliche E-Mail und OHNE Schul-Website (interne
                  Vertriebsinfo): Telefon prominent + unser Anfrage-Funnel. */}
              <div className="flex flex-wrap items-center gap-3">
                {tel && (
                  <a
                    href={`tel:${tel}`}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[4px] border border-border px-4 text-sm font-semibold transition-colors duration-[var(--motion-duration-fast)] ease-[var(--motion-ease)] hover:border-primary/50 hover:text-primary"
                  >
                    <PhoneIcon />
                    {school.telefon}
                  </a>
                )}
                <Link
                  href={anmeldenHref}
                  className="inline-flex min-h-12 items-center justify-center rounded-full bg-accent px-5 text-sm font-semibold text-accent-foreground transition-colors duration-[var(--motion-duration-fast)] ease-[var(--motion-ease)] hover:bg-brand-lime"
                >
                  {ctaLabel({ isPartner: school.isPartner })}
                </Link>
              </div>
            </div>
          </section>

          {/* Datenherkunft + Korrektur-Meldeweg (an UNSER Portal-Postfach) */}
          <footer className="rounded-md border border-border px-5 py-4">
            <p className="font-mono text-[11px] leading-relaxed text-muted-foreground">
              Datenherkunft: strukturierte Angaben der Fahrschule bzw. Recherche — Provenienz je
              Abschnitt gekennzeichnet. Bewertungszahlen stammen von Google.
            </p>
            <p className="mt-2 text-sm">
              <a href={korrekturMailto} className="text-primary underline-offset-2 hover:underline">
                Angabe stimmt nicht? Korrektur melden
              </a>
            </p>
          </footer>
        </div>

        {/* ---- Rechte Spalte: Highlights (ehrlich, ab 2) + sticky Anmelde-Rail ---- */}
        <aside className="mt-6 flex flex-col gap-4 lg:sticky lg:top-32 lg:mt-0">
          {highlights.length >= 2 && (
            <section
              aria-label="Highlights der Fahrschule"
              className="rounded-md border border-border bg-background px-5 py-4 shadow-elevation-1"
            >
              <h2 className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                Highlights der Fahrschule
              </h2>
              <ul className="mt-3 space-y-2.5">
                {highlights.map((h) => (
                  <li key={h.icon} className="flex items-start gap-2.5 text-sm">
                    <HighlightGlyph icon={h.icon} />
                    <span className="leading-snug">{h.text}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <AnmeldeRail
            klassen={school.klassen}
            telefon={school.telefon}
            anmeldenHref={anmeldenHref}
            priceRows={priceRows}
            isPartner={school.isPartner}
            fokusKlasse={klasseParam ?? fokusKlasse}
            slug={school.slug}
            ort={school.ort}
          />
        </aside>
      </div>

      {/* ---- Mobile Sticky-Bottom-Action-Bar: Anrufen | Anfrage-CTA (≥48 px) ---- */}
      <MobileActionBar
        telefon={school.telefon}
        anmeldenHref={anmeldenHref}
        isPartner={school.isPartner}
        slug={school.slug}
        ort={school.ort}
      />
    </div>
  );
}
