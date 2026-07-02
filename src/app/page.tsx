import type { Metadata } from "next";
import Link from "next/link";
import { SearchDock } from "@/components/search/search-dock";
import { HeroSuche } from "@/components/search/hero-suche";
import { CityIcon } from "@/components/search/city-icons";
import { RevealOnScroll } from "@/components/home/reveal";
import { Wechselwort } from "@/components/home/wechselwort";
import { HeroSlides } from "@/components/home/hero-slides";
import { PartnerMarquee } from "@/components/home/partner-marquee";
import { AbsolventenStimmen } from "@/components/home/absolventen-stimmen";
import { TrustBadge } from "@/components/trust/trust-badge";
import { TrustEmblem } from "@/components/trust/trust-emblem";
import { RatgeberCover } from "@/components/ratgeber/cover";
import { JsonLd } from "@/components/seo/json-ld";
import { FEATURED_GUIDES } from "@/lib/ratgeber";
import { TRUST_ARGUMENTE } from "@/lib/trust-argumente";
import {
  getPortalStats,
  listCityCounts,
  type CityCount,
  type PortalStats,
} from "@/modules/schools/queries";

/**
 * Startseite — Design-Synthese aus den drei Reset-Prototypen (finale Struktur):
 * ----------------------------------------------------------------------------
 *  - HERO: kinetische Bühne (Suche dominiert) mit editorialer Typografie,
 *    Fahrbahn-Ambient („lane"), Mikro-Trust-Bullets direkt am Suchfeld,
 *    Kategorie-Tabs als reine VORAUSWAHL (Client-Insel hero-suche.tsx —
 *    gesucht wird erst mit der Ortseingabe; die Anmelde-Journey ist bewusst
 *    ENTFERNT — Gründer 2026-07-02: „zu viele Elemente"). Bewusst KEIN „false
 *    floor": die Folgesektion ist am Falz sichtbar angerissen.
 *  - NACH DEM HERO: Partner-Marquee (Ehrlichkeits-Gate, s. partner-marquee.tsx)
 *    + DARK-STATEMENT-BAND (Petrol-Ink, rotierendes Mint-Wechselwort — Motel-
 *    One-Muster; § 32: kein Preis-Superlativ) + REFORM-ZITAT (Pull-Quote,
 *    unnummeriert — direkt unter dem Band, Gründer 2026-07-02).
 *  - KAPITEL (editoriale Anatomie): 01 USP „Warum über onelane anmelden?" als
 *    SPLIT (links HeroSlides mit FESTER Höhe, rechts dunkles Panel mit den
 *    5 aufklappbaren trust-Argumenten — nur das Panel wächst beim Öffnen),
 *    02 Drei Schritte (Fahrbahn zeichnet sich EINMAL beim Scrollen),
 *    03 Kosten-Register (+ Vertrags-Checkliste, zahlenlos),
 *    04 „Wir sind für dich da." als Dark-Band (Plakette → /trust),
 *    05 Eltern (hell — mit 04 getauscht, Gründer 2026-07-02),
 *    06 Aus dem Ratgeber (News-Feed-Muster: 3 Featured-Guides aus
 *    lib/ratgeber.ts + Textlink zum Hub /ratgeber),
 *    07 Für Fahrschulen (inverses Ink-Band + Jobbörse-Zeile),
 *    08 Städte-Bento (SEO-Einstiege, Wahrzeichen-Icons, Bild-Slots),
 *    Absolventen-Stimmen (Gate, leer), 09 FAQ + ruhiger Final-CTA (das
 *    zweite Suchmodul am Seitenende ist bewusst entfernt).
 *  - CTA-DISZIPLIN: Primär-CTA (Wortlaut zentral in lib/cta.ts, Phase 1:
 *    „Jetzt anfragen") NUR nach 01, nach 05 und im Final-CTA;
 *    sonst Textlinks. Band behält seinen Sie-CTA.
 *  - FARBFLÄCHEN im Wechsel (Token-Tints via color-mix, nie zwei getönte
 *    Sektionen hintereinander): Statement-Band Ink · Zitat auf Papier ·
 *    01 cyan · 03 sky · 04 Ink-Band · 06 Ratgeber cyan · 07 Ink-Band.
 * Inhaltlich strikt ehrlich: keine erfundenen Zahlen/Testimonials, Kosten nur
 * als Bestandteile ohne Beträge (§ 32 FahrlG), keine Fristen-/Garantie-Zusagen.
 * Echte Kennzahlen kommen fail-soft aus dem Schools-Modul (RLS: nur gelistete).
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  // Root-Segment: das Layout-Template („%s · onelane") greift hier nicht
  // (Next.js wendet title.template nur auf KIND-Segmente an) → Suffix explizit.
  title: "Fahrschulen finden & ehrlich vergleichen · onelane",
  description:
    "Fahrschulen in deiner Nähe finden und ehrlich vergleichen: Preisbestandteile statt Lockangebote, klar gekennzeichnete Angaben, sortiert nach Entfernung — kostenlos und ohne Konto.",
};

/* ---------------------------------------------------------------------------
 * Inhalte (zahlenlos, wahrheitsgetreu)
 * ------------------------------------------------------------------------ */


const STEPS = [
  {
    n: "01",
    title: "Suchen",
    text: "Gib deinen Ort oder deine Adresse ein. Du siehst sofort Fahrschulen in deiner Nähe — sortiert nach Distanz, nicht nach Werbebudget.",
  },
  {
    n: "02",
    title: "Vergleichen",
    text: "Preisbestandteile, Führerscheinklassen, Standorte und Öffnungszeiten — nebeneinander, klar gekennzeichnet, ohne Lockangebote.",
  },
  {
    n: "03",
    title: "Direkt anmelden",
    text: "Frag kostenfrei bei deiner Wunsch-Fahrschule an — ohne Konto, ohne Umweg. Sie meldet sich direkt bei dir.",
  },
] as const;

const COST_PARTS = [
  {
    n: "1",
    title: "Grundbetrag",
    unit: "einmalig",
    text: "Deckt die allgemeine Ausbildung ab — vor allem den Theorieunterricht und die Verwaltung deiner Ausbildung.",
  },
  {
    n: "2",
    title: "Fahrstunde",
    unit: "je Übungsstunde à 45 Min.",
    text: "Die normale Übungsfahrt. Wie viele du brauchst, hängt von deinem Lernfortschritt ab — das entscheidet niemand vorab.",
  },
  {
    n: "3",
    title: "Sonderfahrten",
    unit: "je Fahrtart à 45 Min.",
    text: "Gesetzlich vorgeschriebene Fahrten: Überland, Autobahn und bei Dunkelheit. Sie werden je Fahrtart einzeln ausgewiesen.",
  },
  {
    n: "4",
    title: "Vorstellung zur Theorieprüfung",
    unit: "je Vorstellung",
    text: "Das Entgelt der Fahrschule dafür, dich zur theoretischen Prüfung anzumelden und vorzustellen.",
  },
  {
    n: "5",
    title: "Vorstellung zur praktischen Prüfung",
    unit: "je Vorstellung",
    text: "Das Entgelt der Fahrschule für die praktische Prüfung — inklusive des Fahrzeugs am Prüfungstag.",
  },
] as const;

/** Vertrags-Checkliste (zahlenlos, generisch — keine Rechtsberatung im Einzelfall). */
const VERTRAG_CHECKS = [
  {
    title: "Alle Bestandteile schriftlich",
    text: "Grundbetrag, Fahrstunde, Sonderfahrten und Prüfungsentgelte gehören einzeln in den Vertrag — nicht als Pauschale versteckt.",
  },
  {
    title: "Kündigungsregeln lesen",
    text: "Was gilt, wenn du wechselst oder pausierst? Ein fairer Vertrag regelt das klar, bevor du unterschreibst.",
  },
  {
    title: "Nach Leistung zahlen",
    text: "Zahle möglichst je erbrachter Leistung statt großer Summen im Voraus — so behältst du die Kontrolle.",
  },
] as const;

const FALLBACK_CITIES = [
  "Berlin",
  "Hamburg",
  "Köln",
  "Frankfurt am Main",
  "Stuttgart",
  "Düsseldorf",
  "Leipzig",
  "Nürnberg",
] as const;

/**
 * FAQ — EINE Quelle für sichtbaren Text UND FAQPage-JSON-LD (Antwort-Texte
 * deckungsgleich; optionaler Vertiefungs-Link wird nur sichtbar ergänzt).
 */
const FAQ: ReadonlyArray<{
  q: string;
  a: string;
  link?: { href: string; label: string };
}> = [
  {
    q: "Woher stammen die Daten über die Fahrschulen?",
    a: "Aus öffentlich zugänglichen Quellen und den Websites der Fahrschulen — sorgfältig recherchiert und entsprechend gekennzeichnet. Jede Fahrschule kann ihre Angaben kostenlos korrigieren und bestätigen; erst dann tragen sie das Bestätigt-Zeichen.",
  },
  {
    q: "Was kostet mich onelane?",
    a: "Nichts. Suchen, vergleichen und kostenfrei anfragen ist für dich komplett kostenlos — und du brauchst dafür kein Konto.",
  },
  {
    q: "Wie verdient onelane dann Geld?",
    a: "Über Leistungen für Fahrschulen. Wichtig dabei: Die Sortierung der Suchergebnisse bleibt davon unbeeinflusst — Reihenfolge ist keine Werbefläche.",
  },
  {
    q: "Was bedeutet transparente Sortierung?",
    a: "Weil die Reihenfolge der Suchergebnisse keine Werbefläche ist: Standard ist die Entfernung zu deinem Standort, und Zahlungen von Fahrschulen ändern daran nichts. Wie wir sortieren und kennzeichnen, erklären wir transparent auf einer eigenen Seite.",
    link: { href: "/so-sortieren-wir", label: "So sortieren wir" },
  },
  {
    q: "Warum zeigt ihr keine Gesamtpreise an?",
    a: "Weil es keinen seriösen Gesamtpreis vorab gibt: Wie viele Fahrstunden du brauchst, hängt von dir ab. Fahrschulen weisen ihre Preise gesetzlich nach Bestandteilen aus — genau so zeigen wir sie, statt mit Pauschalen zu werben.",
  },
  {
    q: "Was passiert nach meiner Anfrage?",
    a: "Deine Angaben gehen ausschließlich an deine gewählte Fahrschule — sie meldet sich bei dir. Den Ausbildungsvertrag schließt du direkt mit deiner Fahrschule. Das gehört zu onelane trust, unserem Versprechen an dich: Meldet sich deine Fahrschule nicht zeitnah, haken wir für dich nach. Und gibt es später Probleme, kannst du dich an uns wenden — wir helfen zu vermitteln, und wenn es gar nicht passt, findest du über uns eine neue Fahrschule.",
  },
  {
    q: "Wie geht ihr mit meinen Daten um?",
    a: "Sparsam und ohne Tracking: Unsere Karten basieren auf OpenStreetMap statt Google, die Seite läuft auf Servern in Deutschland, und wir setzen keine Tracking-Cookies — deshalb gibt es hier auch keinen Cookie-Banner. Für deine Anmeldung fragen wir nur ab, was wirklich nötig ist.",
  },
  {
    q: "Muss ich mich registrieren?",
    a: "Nein. Die Suche funktioniert ohne Konto, ohne Cookie-Banner und ohne Tracking-Profile. Du gibst nur an, was für deine Anmeldung wirklich nötig ist.",
  },
  {
    q: "Was ändert die Reform 2027?",
    a: "Eine geplante Gesetzesreform soll ab 2027 Preise und praktische Bestehensquoten von Fahrschulen öffentlich machen. Sobald diese amtlichen Daten verfügbar sind, bereiten wir sie hier vergleichbar auf — bis dahin zeigen wir nur gekennzeichnete, nachvollziehbare Angaben.",
  },
];

/* ---------------------------------------------------------------------------
 * Editoriale Hilfskomponenten (server-tauglich, nur Typografie + Token)
 * ------------------------------------------------------------------------ */

/** Einheitlicher Fokus-Stil (WCAG 2.2: sichtbarer Fokus) für alle Interaktiven. */
const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/** Fokus-Stil für Interaktive auf DUNKLEN Petrol-Flächen (Ring weiß, sichtbar). */
const focusRingDark =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-foreground";

/** Kapitel-Zeile (zentriert): Hairlines beidseitig, Lime-Punkt als Marker. */
function Kicker({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center gap-4">
      <span aria-hidden="true" className="h-px w-10 bg-border sm:w-16" />
      <span aria-hidden="true" className="size-1.5 shrink-0 bg-accent" />
      <span className="shrink-0 font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
        {n} · {children}
      </span>
      <span aria-hidden="true" className="h-px w-10 bg-border sm:w-16" />
    </div>
  );
}

/** Zentrierter Kapitel-Kopf: Kicker + Display-Headline + optionaler Lead. */
function SectionHead({
  n,
  kicker,
  id,
  title,
  lead,
}: {
  n: string;
  kicker: string;
  id: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
}) {
  return (
    <div className="reveal mx-auto max-w-3xl text-center">
      <Kicker n={n}>{kicker}</Kicker>
      <h2 id={id} className="mt-8 text-4xl font-light tracking-tight text-balance sm:text-5xl">
        {title}
      </h2>
      {lead ? (
        <p className="mx-auto mt-6 max-w-2xl leading-relaxed text-muted-foreground">{lead}</p>
      ) : null}
    </div>
  );
}

/** Pfeil-Glyphe für Links/Buttons (rein dekorativ). */
function Arrow() {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 transition-transform duration-[var(--motion-duration-fast)] ease-[var(--motion-ease)] motion-safe:group-hover:translate-x-1"
    >
      <path d="M5 12h14m-6-6 6 6-6 6" />
    </svg>
  );
}

/** Lead-Button — primär (Ink-Blau) oder sekundär (Hairline). Sparsam einsetzen. */
function CtaButton({
  href,
  variant = "primary",
  children,
}: {
  href: string;
  variant?: "primary" | "secondary";
  children: React.ReactNode;
}) {
  const look =
    variant === "primary"
      ? // Mint-Pop für Konversions-CTAs (Gründer 2026-07-02): fällt maximal auf,
        // dunkler Text hält AA; Sekundär-Aktionen bleiben ruhig (Hierarchie).
        "bg-accent text-accent-foreground hover:bg-brand-lime"
      : "border border-border bg-card text-foreground hover:border-brand-sky/60 hover:text-primary";
  return (
    <Link
      href={href}
      className={`group inline-flex min-h-12 items-center gap-2 rounded-full px-7 py-3 text-base font-semibold transition-transform duration-[var(--motion-duration-fast)] ease-[var(--motion-ease)] motion-safe:hover:scale-[1.02] motion-safe:active:scale-[0.98] ${look} ${focusRing}`}
    >
      {children}
      <Arrow />
    </Link>
  );
}

/** Knappe Microcopy an allen Anmelde-CTAs (Vermittler-Klarstellung nur im FAQ). */
function AnmeldeHinweis({ className = "" }: { className?: string }) {
  return (
    <p className={`text-xs text-muted-foreground ${className}`}>kostenlos &amp; unverbindlich</p>
  );
}

/** Drei Mikro-Trust-Bullets — direkt am Suchfeld (Hero + Abschluss-Suchmodul). */
function MicroTrust() {
  return (
    <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
      {/* Wording Gründer 2026-07-02 (2. Fassung): Bullets bewusst weicher —
          „transparente Sortierung" statt „Rangliste nicht kaufbar", „wir
          betreuen dich" statt „wir haken für dich nach". Die konkreten
          Formulierungen bleiben im trust-Block/Fließtext erhalten. */}
      {["transparente Sortierung", "kostenlos & unverbindlich", "wir betreuen dich"].map(
        (t) => (
          <li key={t} className="flex items-center gap-2">
            <span aria-hidden="true" className="size-1 bg-accent" />
            {t}
          </li>
        ),
      )}
    </ul>
  );
}

/** Handgesetzte Lime-Unterstreichung für EIN Akzentwort in der Headline. */
function AccentStroke() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 220 12"
      preserveAspectRatio="none"
      className="absolute -bottom-1 left-0 h-2.5 w-full text-accent sm:-bottom-2 sm:h-3"
      fill="none"
    >
      <path
        d="M3 9C60 3.5 150 2.5 217 5.5"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ----------------------- Hero-Hintergrund („lane") ------------------------ */
/**
 * Abstrakte Fahrbahn-Grafik als Marken-Signatur hinter Headline/Suche: zwei
 * geschwungene Bahnen (breite, sehr helle Spur + gestrichelter Mittelstreifen)
 * in gedeckten Token-Tönen. Rein dekorativ, statisch (kein CLS), skaliert über
 * preserveAspectRatio="slice" mit dem Viewport.
 */
function HeroLanes() {
  return (
    <svg
      viewBox="0 0 1440 800"
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 h-full w-full"
      aria-hidden="true"
      focusable="false"
      fill="none"
    >
      {/* Bahn 1 — großer Schwung unten, läuft hinter der Suche durch */}
      <path
        d="M-80 640 C 240 540, 480 720, 760 580 S 1280 400, 1520 480"
        className="stroke-brand-sky/10"
        strokeWidth="88"
        strokeLinecap="round"
      />
      <path
        d="M-80 640 C 240 540, 480 720, 760 580 S 1280 400, 1520 480"
        className="stroke-brand-sky/25"
        strokeWidth="2.5"
        strokeDasharray="14 22"
        strokeLinecap="round"
      />
      {/* Bahn 2 — Gegenschwung oben, hinter der Headline */}
      <path
        d="M-60 190 C 320 280, 640 120, 980 200 S 1360 280, 1520 220"
        className="stroke-brand-cyan/8"
        strokeWidth="60"
        strokeLinecap="round"
      />
      <path
        d="M-60 190 C 320 280, 640 120, 980 200 S 1360 280, 1520 220"
        className="stroke-brand-cyan/20"
        strokeWidth="2"
        strokeDasharray="10 18"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ------------------ Fahrbahn (Kapitel „Drei Schritte") --------------------- */
/**
 * Die Route zeichnet sich EINMAL beim Scrollen (stroke-dashoffset 1→0) — ruhig,
 * keine Loop-Animation. Der
 * versteckte Startzustand gilt NUR bei aktivem JS-Reveal (html.reveal-on) —
 * ohne JS oder bei prefers-reduced-motion ist die Linie sofort vollständig da.
 */
const ROAD_D = "M20 100 H200 C340 100 460 40 600 40 C740 40 860 100 1000 100 H1180";

function RoadDraw() {
  return (
    <svg viewBox="0 0 1200 140" className="hidden w-full md:block" aria-hidden="true" focusable="false">
      {/* Basis-Spur (Straße) */}
      <path d={ROAD_D} className="text-border" stroke="currentColor" strokeWidth="10" strokeLinecap="round" fill="none" />
      {/* Mittellinie (gestrichelt, statisch) */}
      <path d={ROAD_D} className="text-background" stroke="currentColor" strokeWidth="1.5" strokeDasharray="10 14" fill="none" />
      {/* Gezeichnete Route (Sky) — rastet beim Scrollen ein */}
      <path
        d={ROAD_D}
        pathLength={1}
        className="text-brand-sky [stroke-dasharray:1] [html.reveal-on_&]:[stroke-dashoffset:1] [html.reveal-on_.in_&]:[stroke-dashoffset:0] motion-safe:transition-[stroke-dashoffset] motion-safe:duration-[1600ms] motion-safe:ease-[var(--motion-ease)] motion-safe:delay-150"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
      {/* Drei Stationen — exakt über den drei Schritten darunter */}
      {[
        { cx: 200, cy: 100 },
        { cx: 600, cy: 40 },
        { cx: 1000, cy: 100 },
      ].map((p, i) => (
        <g key={i}>
          <circle cx={p.cx} cy={p.cy} r="13" className="text-background" fill="currentColor" />
          <circle cx={p.cx} cy={p.cy} r="12" className="text-brand-sky" fill="none" stroke="currentColor" strokeWidth="3" />
          <circle cx={p.cx} cy={p.cy} r="4" className="text-brand-sky" fill="currentColor" />
        </g>
      ))}
    </svg>
  );
}

/* --------------------- Illustration (duotone, Token) ----------------------- */

/** Eltern-Sektion: Elternteil und Jugendliche:r Seite an Seite (duotone). */
function ParentsIllustration() {
  return (
    <svg viewBox="0 0 300 220" className="w-full" fill="none" aria-hidden="true" focusable="false">
      <circle cx="150" cy="108" r="88" className="fill-brand-sky/10" />
      {/* gemeinsamer Weg */}
      <path d="M24 192 H276" className="stroke-border" strokeWidth="2" strokeDasharray="6 9" strokeLinecap="round" />
      {/* Elternteil */}
      <circle cx="122" cy="62" r="16" className="fill-primary" />
      <rect x="102" y="82" width="40" height="76" rx="18" className="fill-brand-sky/80" />
      <rect x="108" y="156" width="10" height="38" rx="5" className="fill-foreground/70" />
      <rect x="126" y="156" width="10" height="38" rx="5" className="fill-foreground/70" />
      {/* Arm um die Schulter — warme Geste */}
      <path d="M138 96 Q162 82 178 102" className="stroke-brand-sky/80" strokeWidth="10" strokeLinecap="round" />
      {/* Jugendliche:r */}
      <circle cx="188" cy="86" r="13" className="fill-brand-cyan/90" />
      <rect x="172" y="102" width="32" height="58" rx="15" className="fill-brand-cyan/45" />
      <rect x="177" y="158" width="9" height="36" rx="4.5" className="fill-foreground/70" />
      <rect x="190" y="158" width="9" height="36" rx="4.5" className="fill-foreground/70" />
      {/* Lime-Moment: gemeinsames Ziel */}
      <circle cx="246" cy="176" r="6" className="fill-accent" />
      <circle cx="246" cy="176" r="12" className="stroke-brand-lime/50" strokeWidth="2" />
    </svg>
  );
}

/* ---------------------------------------------------------------------------
 * Seite
 * ------------------------------------------------------------------------ */

export default async function HomePage() {
  // Echte Kennzahlen — fail-soft: bei DB-Fehlern erzählt die Seite die
  // qualitative Wahrheit statt einer Zahl (kein 500, kein Skeleton).
  let stats: PortalStats | null = null;
  try {
    stats = await getPortalStats();
  } catch {
    stats = null;
  }
  let cityCounts: CityCount[] = [];
  try {
    cityCounts = await listCityCounts(9);
  } catch {
    cityCounts = [];
  }

  // Zahl NUR ab belastbarer Größe (≥ 100), gerundet formuliert; sonst die
  // qualitative Wahrheit (Fallback-Text).
  const statsLine =
    stats && stats.schulen >= 100
      ? `Über ${(Math.floor(stats.schulen / 100) * 100).toLocaleString("de-DE")} Fahrschulen in ${stats.staedte.toLocaleString("de-DE")} Städten — wir starten in München und bauen Stadt für Stadt aus.`
      : "Fahrschulen in ganz Deutschland — wir starten in München und bauen Stadt für Stadt aus.";

  const muenchen = cityCounts.find((c) => c.ort === "München") ?? null;
  const echteStaedte = cityCounts.filter((c) => c.ort !== "München").slice(0, 8);
  const cityTiles: Array<{ ort: string; anzahl: number | null }> =
    echteStaedte.length > 0
      ? echteStaedte.map((c) => ({ ort: c.ort, anzahl: c.anzahl }))
      : FALLBACK_CITIES.map((ort) => ({ ort, anzahl: null }));
  // Kompakte Städte-Schnellwahl im Hero: München zuerst, dann echte Top-Städte.

  // FAQPage-JSON-LD — Antwort-Texte EXAKT deckungsgleich mit details/summary.
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <div className="overflow-x-clip bg-background text-foreground">
      <RevealOnScroll />

      {/* ================= HERO — kinetische Bühne, editoriale Stimme ======== */}
      <section aria-labelledby="hero-heading" className="relative">
        {/* Ambient: Token-Verläufe + Fahrbahn-Signatur + weiche Farbkörper */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(46%_52%_at_16%_10%,color-mix(in_oklab,var(--brand-sky)_14%,transparent),transparent_64%),radial-gradient(40%_46%_at_86%_6%,color-mix(in_oklab,var(--brand-cyan)_11%,transparent),transparent_62%),radial-gradient(52%_58%_at_50%_112%,color-mix(in_oklab,var(--brand-lime)_9%,transparent),transparent_58%)]" />
          <HeroLanes />
          <div className="float-slower absolute -left-28 top-16 size-96 rounded-full bg-brand-sky/15 blur-3xl" />
          <div className="float-slow absolute -right-24 top-40 size-80 rounded-full bg-brand-cyan/10 blur-3xl" />
        </div>

        {/* min-h bewusst UNTER einem vollen Viewport: die Folgesektion bleibt
            am Falz sichtbar angerissen (kein „false floor"). */}
        <div className="mx-auto flex min-h-[calc(100svh-10rem)] w-full max-w-4xl flex-col items-center justify-center gap-6 px-6 py-14 text-center">
          {/* Kicker „onelane · Fahrschulvergleich" entfernt (Gründer 2026-07-02):
              doppelt nur Wortmarke + Header-Tagline — Headline rückt dadurch
              optisch höher, alles bleibt zentriert. */}
          <h1
            id="hero-heading"
            className="reveal text-5xl font-light leading-[1.05] tracking-tight sm:text-7xl"
          >
            Welche Fahrschule
            <br />
            <span className="relative inline-block font-semibold">
              passt zu dir
              <AccentStroke />
            </span>
            <span className="text-muted-foreground">?</span>
          </h1>

          <p className="reveal max-w-xl text-lg leading-relaxed text-muted-foreground">
            Wir zeigen dir Fahrschulen in deiner Nähe — mit ehrlichen Preisen statt
            Lockangeboten.
          </p>

          {/* Die Bühne: Kategorie-Tabs + Suche als EIN Modul (Client-Insel):
              Tab-Klick ist reine VORAUSWAHL der Gruppe, gesucht wird erst mit
              der Ortseingabe (Semantik „Gruppe = Leitklasse", s. hero-suche.tsx). */}
          <div className="reveal flex w-full flex-col items-center gap-3">
            <HeroSuche />
            <MicroTrust />
          </div>

          {/* Anmelde-Journey (SUCHEN → ANMELDEN → LOSFAHREN) bewusst ENTFERNT
              (Gründer 2026-07-02: „zu viele Elemente im Hero") — die drei
              Schritte erklärt weiterhin Kapitel 02. */}

          {/* Klassen-Chips + Städte-Zeile bewusst ENTFERNT (Gründer 2026-07-02:
              Hero schlanker — die Kategorie-Tabs decken die Klassen-Wahl ab,
              Detail-Klassen + Städte übernehmen Suche/Filter bzw. die
              Städte-Sektion am Seitenende; Wahrzeichen-Vorschläge erscheinen
              beim Suchfeld-Fokus). */}

          {/* Marken-Versprechen — Badge zentriert, Claim ZENTRIERT DARUNTER
              (Gründer 2026-07-02: „immer zentriert unterhalb des trust-Widgets") */}
          <div className="reveal flex flex-col items-center gap-2 text-center">
            <TrustBadge size="sm" />
            <p className="text-sm text-muted-foreground">Wir bleiben an deiner Seite.</p>
          </div>
        </div>
      </section>

      {/* Search-Dock: Sentinel unter dem Hero — beim Scrollen erscheint die
          Mini-Such-Pill im Header (Client-Insel, ohne JS nicht vorhanden). */}
      <SearchDock />

      {/* Partner-Logos („In Zusammenarbeit mit"): Endlosschleife auf der
          Marken-Fahrbahn. ⚠️ Einträge aktuell NUR für den lokalen Test
          freigegeben (Freigaben ausstehend) — Warnhinweis + Ehrlichkeits-Gate
          in partner-marquee.tsx beachten. */}
      <PartnerMarquee />

      {/* ============ DARK-STATEMENT-BAND (Motel-One-Muster, 2. Fassung) =====
          EINGERÜCKTES Petrol-Ink-Band (rounded-3xl im Container — Gründer
          2026-07-02: „Hintergründe nie ganz durchziehen") mit LINKSBÜNDIGER
          Statement-Typo wie beim Vorbild. Das rotierende Wechselwort steht am
          ZEILENENDE seiner Zeile und wächst frei nach rechts — kein Breiten-
          Phantom, kein Layout-Shift (wechselwort.tsx); danach harter Umbruch.
          § 32 FahrlG: KEIN Preis-Superlativ („günstigste" verboten). */}
      <section aria-labelledby="statement-heading" className="py-10 sm:py-14">
        <div className="mx-auto w-full max-w-6xl px-6">
          <div className="rounded-3xl bg-foreground px-8 py-16 text-background sm:px-14 sm:py-20">
            <h2
              id="statement-heading"
              className="text-4xl font-light leading-[1.15] tracking-tight sm:text-6xl"
            >
              Finde die <Wechselwort />
              <br />
              Fahrschule deiner Stadt.
            </h2>
            <p className="mt-8 max-w-2xl leading-relaxed text-background/75">
              onelane vergleicht Fahrschulen mit ehrlichen Preis-Bausteinen statt Lockangeboten.
              Du fragst kostenlos und ohne Konto an, deine Daten gehen nur an deine gewählte
              Fahrschule — und wir bleiben an deiner Seite, bis es mit deiner Fahrschule passt.
            </p>
            <p className="mt-6">
              <Link
                href="/trust"
                className={`group inline-flex min-h-11 items-center gap-1.5 font-medium text-accent underline-offset-4 hover:text-brand-lime hover:underline ${focusRingDark} rounded-md`}
              >
                Wie das funktioniert
                <Arrow />
              </Link>
            </p>
            {/* Dezente Ehrlichkeits-Zeile: Nicht-Käuflichkeit (Gründer-Wunsch)
                + Quellen-Hinweis zu „bestbewertete" — bewusst STATISCH statt
                ans rotierende Wort gekoppelt (kein Text-Flackern). */}
            <p className="mt-8 text-xs text-background/50">
              Fahrschulen können ihre Position bei uns weder kaufen noch beeinflussen — die
              Bewertungs-Sortierung nutzt öffentliche Google-Daten.
            </p>
          </div>
        </div>
      </section>

      {/* ============== AUSBLICK — editoriale Pull-Quote ===================== */}
      {/* DIREKT unter dem Statement-Band (Gründer 2026-07-02) — inhaltliche
          Fortsetzung: das Band verspricht ehrliche Sortierung, das Zitat den
          amtlichen Daten-Ausblick. Bewusst OHNE Karte/Fläche und OHNE
          Kapitel-Nummer (gehört zur Intro-Zone vor Kapitel 01). Konjunktiv
          „sollen" bleibt Pflicht — geplante Reform, kein Versprechen. */}
      <section aria-labelledby="reform-heading" className="py-20 sm:py-28">
        <div className="mx-auto w-full max-w-3xl px-6 text-center">
          <h2 id="reform-heading" className="sr-only">
            Ausblick: Gesetzesreform 2027
          </h2>
          <p className="reveal font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Ausblick
          </p>
          <p className="reveal mt-6 text-2xl font-light leading-snug tracking-tight text-foreground sm:text-4xl">
            Ab 2027 sollen Preise und Bestehensquoten aller Fahrschulen{" "}
            <span className="relative inline-block">
              amtlich veröffentlicht
              <AccentStroke />
            </span>{" "}
            werden.
          </p>
          <p className="reveal mt-6 text-sm leading-relaxed text-muted-foreground">
            Sobald diese Daten verfügbar sind, bereiten wir sie hier auf — bis dahin zeigen wir
            nur gekennzeichnete, nachvollziehbare Angaben.
          </p>
          <p className="reveal mt-3 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Stand: Juli 2026 — wird laufend aktualisiert
          </p>
        </div>
      </section>

      {/* ============ 01 · WARUM ÜBER ONELANE ANMELDEN? (USP, Cyan-Tint) =====
          SPLIT-LAYOUT exakt nach Motel-One-Vorbild („Switch on. BeOne."):
          LINKS das helle rotierende Marken-Visual (HeroSlides, bildfertig),
          RECHTS ein DUNKLES Petrol-Panel (bg-foreground, gleiche Rundung/Höhe)
          mit weißer Headline und den 6 trust-Argumenten als AUFKLAPPBARE
          native <details>-Punkte (kein JS; Texte aus lib/trust-argumente.ts —
          deckungsgleich mit /trust, KEINE neuen Versprechen). Chevron in
          Mint-Teal rotiert motion-safe bei open; Hairlines white/15; erster
          Punkt default-open (Einladung zum Klicken). Darunter Mint-CTA +
          weißer Textlink auf /trust. Die praktischen Kurz-Vorteile stehen als
          kompakte helle Zeile ÜBER dem Split (Urteil: im Panel würden sie
          die 6 Punkte erdrücken — die Sektion bleibt ruhig).
          Mobil stapelt der Grid: Bild oben, Panel volle Breite darunter. */}
      <section
        aria-labelledby="warum-heading"
        className="bg-[color-mix(in_oklch,var(--background),var(--brand-cyan)_6%)] py-20 sm:py-28"
      >
        <div className="mx-auto w-full max-w-6xl px-6">
          {/* Sektions-Kopf ÜBER dem Split (Gründer 2026-07-02: Kurz-Vorteile-
              Zeile entfernt — „passt nicht"; die Frage wird zur Überschrift,
              das Panel antwortet mit „Deine Vorteile"). */}
          <SectionHead
            n="01"
            kicker="Deine Anmeldung"
            id="warum-heading"
            title={
              <>
                Warum über <span className="font-semibold">onelane</span> anmelden?
              </>
            }
          />

          {/* items-START + FESTE Bildhöhe links (Gründer 2026-07-02): Das linke
              Visual darf sich beim Aufklappen rechts NIE mitdehnen — nur das
              rechte Panel wächst nach unten (min-h hält die Ruhe-Balance). */}
          <div className="mt-12 grid items-start gap-6 lg:grid-cols-2">
            {/* LINKS (mobil: oben): helles rotierendes Marken-Visual, fixe Höhe */}
            <div className="reveal">
              <HeroSlides className="lg:h-[34rem]" />
            </div>

            {/* RECHTS (mobil: darunter): dunkles trust-Panel mit Aufklappern */}
            <div className="reveal flex flex-col rounded-3xl bg-foreground p-7 text-left text-background shadow-elevation-2 sm:p-10 lg:min-h-[34rem]">
              <h3 className="text-2xl font-light tracking-tight sm:text-3xl">
                Deine <span className="font-semibold">Vorteile</span>
              </h3>

              {/* 5 trust-Argumente als native Aufklapper — kompakt gesetzt
                  (Gründer 2026-07-02: „lieber 5 Punkte, dafür kleiner"),
                  Touch-Ziel bleibt ≥44 px */}
              <div className="mt-6 flex-1">
                {TRUST_ARGUMENTE.map((a, i) => (
                  <details
                    key={a.title}
                    open={i === 0 ? true : undefined}
                    className="group border-b border-white/15 last:border-b-0"
                  >
                    <summary
                      className={`flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 py-3 text-[15px] font-semibold [&::-webkit-details-marker]:hidden ${focusRingDark} rounded-md`}
                    >
                      {a.title}
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        className="size-5 shrink-0 text-brand-lime transition-transform duration-[var(--motion-duration-base)] ease-[var(--motion-ease)] group-open:rotate-180 motion-reduce:transition-none"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </summary>
                    <p className="pb-4 pr-8 text-sm leading-relaxed text-background/80">{a.text}</p>
                  </details>
                ))}
              </div>

              {/* Panel-Abschluss: Mint-CTA + weißer Textlink (kein Button-Stapel) */}
              <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-4">
                <Link
                  href="/fahrschulen"
                  className={`group inline-flex min-h-12 items-center gap-2 rounded-full bg-accent px-7 py-3 text-base font-semibold text-accent-foreground transition-colors duration-[var(--motion-duration-fast)] ease-[var(--motion-ease)] hover:bg-brand-lime ${focusRingDark}`}
                >
                  Jetzt anfragen
                  <Arrow />
                </Link>
                <Link
                  href="/trust"
                  className={`group inline-flex min-h-11 items-center gap-1.5 font-medium text-background underline-offset-4 hover:underline ${focusRingDark} rounded-md`}
                >
                  Mehr über onelane trust
                  <Arrow />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= 02 · SO FUNKTIONIERT’S (weiß) ===================== */}
      <section aria-labelledby="steps-heading" className="py-20 sm:py-28">
        <div className="mx-auto w-full max-w-6xl px-6">
          <SectionHead
            n="02"
            kicker="So funktioniert’s"
            id="steps-heading"
            title={
              <>
                Drei Schritte. <span className="font-semibold">Kein Kleingedrucktes.</span>
              </>
            }
          />

          {/* Fahrbahn-Motiv: zeichnet sich EINMAL beim Scrollen (keine Loop) */}
          <div className="reveal mx-auto mt-12 max-w-5xl">
            <RoadDraw />
          </div>

          <ol className="reveal-stagger mx-auto mt-4 grid max-w-5xl gap-10 md:grid-cols-3 md:gap-8">
            {STEPS.map((s) => (
              <li key={s.n} className="border-l-2 border-brand-sky/30 pl-5 text-left md:border-l-0 md:pl-0 md:text-center">
                <p className="font-mono text-xs tracking-[0.2em] text-primary">{s.n}</p>
                <h3 className="mt-2 text-xl font-semibold tracking-tight">{s.title}</h3>
                <p className="mt-2 leading-relaxed text-muted-foreground md:mx-auto md:max-w-[30ch]">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ================= 03 · KOSTEN-REGISTER (Sky-Tint) =================== */}
      <section
        aria-labelledby="cost-heading"
        className="bg-[color-mix(in_oklch,var(--background),var(--brand-sky)_5%)] py-20 sm:py-28"
      >
        <div className="mx-auto w-full max-w-6xl px-6">
          <SectionHead
            n="03"
            kicker="Kosten verstehen"
            id="cost-heading"
            title={
              <>
                Was kostet der Führerschein? <span className="font-semibold">Fünf Bestandteile.</span>
              </>
            }
            lead="Einen ehrlichen Gesamtpreis gibt es vorab nicht — wie viele Fahrstunden du brauchst, hängt von dir ab. Fahrschulen weisen ihre Preise deshalb nach Bestandteilen aus. Diese fünf solltest du kennen:"
          />

          {/* Typografisches Preis-Register: schmale Spalte, Zeilen lesen links. */}
          <dl className="reveal mx-auto mt-14 max-w-2xl">
            {COST_PARTS.map((c) => (
              <div key={c.n} className="grid gap-x-6 gap-y-2 border-t border-border py-7 text-left sm:grid-cols-[3.5rem_1fr]">
                <span aria-hidden="true" className="text-4xl font-light tabular-nums text-muted-foreground/40">
                  {c.n}
                </span>
                <div>
                  <dt className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="text-xl font-semibold tracking-tight">{c.title}</span>
                    <span className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      {c.unit}
                    </span>
                  </dt>
                  <dd className="mt-2 leading-relaxed text-muted-foreground">{c.text}</dd>
                </div>
              </div>
            ))}
          </dl>

          <p className="reveal mx-auto mt-10 max-w-2xl border-l-2 border-accent pl-6 text-left leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground">Dazu kommen amtliche Gebühren</span> — für
            die Prüforganisation (z.&nbsp;B. TÜV oder DEKRA) und die Führerscheinbehörde. Sie sind
            gesetzlich festgelegt und kein Teil des Fahrschulpreises.
          </p>

          {/* Vertrags-Checkliste (zahlenlos) */}
          <div className="reveal mx-auto mt-14 max-w-2xl text-left">
            <h3 className="text-xl font-semibold tracking-tight">
              Worauf du im Fahrschulvertrag achten solltest
            </h3>
            <ul className="mt-6 space-y-5">
              {VERTRAG_CHECKS.map((c) => (
                <li key={c.title} className="flex gap-3.5">
                  <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 bg-accent" />
                  <p className="leading-relaxed text-muted-foreground">
                    <span className="font-semibold text-foreground">{c.title}.</span> {c.text}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ========== 04 · WIR SIND FÜR DICH DA (dunkles Petrol-Band) ==========
          Dark-Band (Motel-One-Muster): ruhiger Betreuungs-Moment auf
          Petrol-Ink — Plakette (verlinkt auf /trust), wenige Sätze, ZWEI
          Mint-Textlinks statt Buttons (CTA-Disziplin, kein Button-Overload).
          Eingerückt statt vollbreit. Mit der Eltern-Sektion GETAUSCHT
          (Gründer 2026-07-02: zwei dunkle Bänder direkt um den 2027-Ausblick
          wirkten zu dominant — jetzt dunkel · hell · Zitat · dunkel). */}
      <section aria-labelledby="team-heading" className="py-10 sm:py-14">
        <div className="mx-auto w-full max-w-6xl px-6">
          <div className="rounded-3xl bg-foreground px-6 py-16 text-background sm:px-14 sm:py-24">
            <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6 text-center">
              <p className="font-mono text-xs uppercase tracking-[0.22em] text-background/60">
                04 · Persönliche Betreuung
              </p>
              <h2 id="team-heading" className="text-4xl font-light tracking-tight text-balance sm:text-5xl">
                <span className="font-semibold">Wir sind für dich da.</span>
              </h2>
              <div className="reveal flex flex-col items-center gap-6">
                <TrustEmblem size="md" />
                <p className="font-mono text-xs uppercase tracking-[0.22em] text-background/60">
                  Dein onelane-Team
                </p>
                <p className="leading-relaxed text-background/75">
                  Du bist unsicher, welche Fahrschule passt? Hol dir vor deiner Entscheidung eine
                  ehrliche Zweitmeinung von uns. Nach deiner Anmeldung fassen wir nach, wenn sich
                  deine Fahrschule nicht meldet — und wenn es gar nicht passt, helfen wir dir beim
                  Wechsel.
                </p>
                <p className="flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
                  <a
                    href="mailto:kontakt@onelane.de"
                    className={`group inline-flex min-h-11 items-center gap-1.5 font-semibold text-accent underline-offset-4 hover:text-brand-lime hover:underline ${focusRing} rounded-md`}
                  >
                    Schreib uns
                    <Arrow />
                  </a>
                  <Link
                    href="/trust"
                    className={`group inline-flex min-h-11 items-center gap-1.5 font-semibold text-accent underline-offset-4 hover:text-brand-lime hover:underline ${focusRing} rounded-md`}
                  >
                    Wie unsere Betreuung funktioniert
                    <Arrow />
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= 05 · ELTERN (weiß) ================================ */}
      <section aria-labelledby="parents-heading" className="py-20 sm:py-28">
        <div className="mx-auto w-full max-w-6xl px-6">
          <SectionHead
            n="05"
            kicker="Unter 18?"
            id="parents-heading"
            title={
              <>
                Deine Eltern sind <span className="font-semibold">mit an Bord.</span>
              </>
            }
            lead="Wenn du minderjährig bist, gehört der Führerschein euch gemeinsam: Deine Sorgeberechtigten müssen dem Ausbildungsvertrag zustimmen — und meistens zahlen sie auch mit. Deshalb ist onelane so gebaut, dass ihr es gemeinsam nutzen könnt."
          />

          <div className="mt-14 grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div className="reveal mx-auto w-full max-w-sm">
              <ParentsIllustration />
            </div>
            <ul className="reveal-stagger space-y-8 text-left">
              <li className="border-t border-border pt-5">
                <h3 className="font-semibold tracking-tight">Gemeinsam vergleichen</h3>
                <p className="mt-2 leading-relaxed text-muted-foreground">
                  Alles ist ohne Konto einsehbar — schick deinen Eltern einfach den Link zu deiner
                  Auswahl, statt Screenshots zu sammeln.
                </p>
              </li>
              <li className="border-t border-border pt-5">
                <h3 className="font-semibold tracking-tight">Kostenbestandteile statt Bauchgefühl</h3>
                <p className="mt-2 leading-relaxed text-muted-foreground">
                  Die fünf Preisbestandteile machen das Familiengespräch leichter: Ihr seht, worüber
                  ihr wirklich sprecht — ohne Pauschalversprechen.
                </p>
              </li>
              <li className="border-t border-border pt-5">
                <h3 className="font-semibold tracking-tight">Datenminimierung</h3>
                <p className="mt-2 leading-relaxed text-muted-foreground">
                  Wir fragen nur ab, was für deine Anmeldung nötig ist — gerade bei Minderjährigen
                  gilt: so wenig Daten wie möglich.
                </p>
              </li>
            </ul>
          </div>

          {/* CTA führt zur ELTERN-Ratgeberseite (Gründer 2026-07-02) — bewusst
              SEKUNDÄRER Stil: Mint bleibt den Konversions-CTAs vorbehalten
              (CTA-Disziplin). Dezenter Textlink zur Suche bleibt daneben. */}
          <div className="reveal mt-14 flex flex-col items-center gap-4">
            <CtaButton href="/eltern" variant="secondary">
              Tipps für Eltern
            </CtaButton>
            <p className="text-sm text-muted-foreground">
              oder direkt{" "}
              <Link
                href="/fahrschulen"
                className={`font-medium text-primary underline-offset-4 hover:underline ${focusRing} rounded-md`}
              >
                Fahrschulen vergleichen
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* ============ 06 · AUS DEM RATGEBER (Cyan-Tint, News-Feed) ===========
          Motel-One-News-Muster: die drei FEATURED-Guides aus der GEMEINSAMEN
          Registry (lib/ratgeber.ts — Feed und Hub bleiben deckungsgleich, kein
          Text-Drift). Karte = Cover (Inline-SVG) + Kategorie-Chip + Titel +
          Teaser + Lesezeit, GANZE Karte klickbar mit sanftem Lift; darunter
          EIN zentrierter Textlink zum Hub (CTA-Disziplin: kein Button). */}
      <section
        aria-labelledby="ratgeber-heading"
        className="bg-[color-mix(in_oklch,var(--background),var(--brand-cyan)_5%)] py-20 sm:py-28"
      >
        <div className="mx-auto w-full max-w-6xl px-6">
          <SectionHead
            n="06"
            kicker="Aus dem Ratgeber"
            id="ratgeber-heading"
            title={
              <>
                Wissen, das dich <span className="font-semibold">weiterbringt.</span>
              </>
            }
            lead="Ehrlich recherchiert statt schöngeredet: unsere Guides zu Kosten, Fahrschulwahl und Prüfungen — laufend erweitert."
          />

          <div className="reveal-stagger mt-14 grid gap-6 md:grid-cols-3">
            {FEATURED_GUIDES.map((g) => (
              <Link
                key={g.slug}
                href={`/ratgeber/${g.slug}`}
                className={`hover-lift group flex flex-col overflow-hidden rounded-3xl border border-border/60 bg-card text-left shadow-elevation-1 ${focusRing}`}
              >
                {/* Cover — rund macht der Karten-Container (overflow-hidden) */}
                <span className="block overflow-hidden">
                  <RatgeberCover
                    id={g.cover}
                    className="transition-transform duration-[var(--motion-duration-slow)] ease-[var(--motion-ease)] motion-safe:group-hover:scale-[1.03]"
                  />
                </span>
                <span className="flex flex-1 flex-col p-6">
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
                      {g.kategorie}
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      {g.lesezeit} Min. Lesezeit
                    </span>
                  </span>
                  <span className="mt-4 text-xl font-semibold tracking-tight text-balance transition-colors duration-[var(--motion-duration-base)] ease-[var(--motion-ease)] group-hover:text-primary">
                    {g.titel}
                  </span>
                  <span className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {g.teaser}
                  </span>
                </span>
              </Link>
            ))}
          </div>

          <p className="reveal mt-12 text-center">
            <Link
              href="/ratgeber"
              className={`group inline-flex min-h-11 items-center gap-1.5 font-medium text-primary underline-offset-4 hover:underline ${focusRing} rounded-md`}
            >
              Alle Ratgeber-Artikel
              <Arrow />
            </Link>
          </p>
        </div>
      </section>

      {/* ====== 07 · FÜR FAHRSCHULEN (inverses Ink-Band + Jobbörse-Zeile) ==== */}
      <section aria-labelledby="schools-heading" className="py-10 sm:py-14">
        <div className="mx-auto w-full max-w-6xl px-6">
          <div className="reveal rounded-3xl bg-foreground px-8 py-16 text-background sm:px-14 sm:py-20">
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-background/60">
              07 · Für Fahrschulen
            </p>
            <h2
              id="schools-heading"
              className="mt-8 max-w-3xl text-4xl font-light tracking-tight sm:text-5xl"
            >
              Ihr Eintrag ist <span className="font-semibold">kostenlos.</span>
            </h2>
            <p className="mt-6 max-w-2xl leading-relaxed text-background/70">
              Ihre Fahrschule ist vermutlich schon gelistet — mit recherchierten Angaben. Prüfen
              Sie Ihre Daten, korrigieren Sie sie und bestätigen Sie sie. Bestätigte Einträge
              tragen eine sichtbare Kennzeichnung, der Fahrschüler vertrauen können.
            </p>
            <div className="mt-10">
              <Link
                href="/fuer-fahrschulen"
                className={`group inline-flex min-h-12 items-center gap-2 rounded-full bg-accent px-7 py-3 font-semibold text-accent-foreground transition-transform duration-[var(--motion-duration-fast)] ease-[var(--motion-ease)] motion-safe:hover:-translate-y-0.5 motion-safe:active:translate-y-0 ${focusRing}`}
              >
                Eintrag prüfen und bestätigen
                <Arrow />
              </Link>
            </div>
            {/* dezente zweite Zeile: Weg in die Jobbörse */}
            <div className="mt-12 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-background/20 pt-6 text-sm text-background/70">
              <span>Du willst Fahrlehrer:in werden?</span>
              <Link
                href="/jobs"
                className={`group inline-flex min-h-11 items-center gap-1.5 font-semibold text-background underline-offset-4 hover:underline ${focusRing} rounded-md`}
              >
                Zur Jobbörse
                <Arrow />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ================= 08 · STÄDTE-BENTO (weiß, SEO-Einstiege) =========== */}
      <section aria-labelledby="cities-heading" className="py-20 sm:py-28">
        <div className="mx-auto w-full max-w-6xl px-6">
          <SectionHead
            n="08"
            kicker="Dein Einstieg"
            id="cities-heading"
            title={
              <>
                Starte in <span className="font-semibold">deiner Stadt.</span>
              </>
            }
            lead={statsLine}
          />

          <div className="reveal-stagger mt-14 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {/* München — Fokus-Zelle mit GROSSEM Wahrzeichen (Frauenkirche aus
                city-icons.tsx, groß skaliert). BILD-SLOT vorbereitet: sobald
                echte Stadt-Fotos in public/images/staedte/ liegen, ersetzt ein
                next/image (fill, object-cover, alt="") das Icon als Hintergrund
                — Text-Overlay + Layout bleiben unverändert. */}
            <Link
              href={`/fahrschulen?ort=${encodeURIComponent("München")}`}
              className={`hover-lift group relative col-span-2 row-span-2 flex min-h-64 flex-col justify-end overflow-hidden rounded-3xl border border-border/60 bg-card/80 p-7 text-left shadow-elevation-2 backdrop-blur-md ${focusRing}`}
            >
              <span
                aria-hidden="true"
                className="absolute -right-4 -top-6 transition-transform duration-[var(--motion-duration-slow)] ease-[var(--motion-ease)] motion-safe:group-hover:-translate-y-1 sm:right-2 sm:top-0"
              >
                <CityIcon city="München" className="size-44 opacity-80 sm:size-56" />
              </span>
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Im Fokus</span>
              <span className="mt-1 text-2xl font-bold text-foreground">München</span>
              <span className="mt-1 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                {muenchen
                  ? `${muenchen.anzahl.toLocaleString("de-DE")} Fahrschulen — in allen Stadtbezirken`
                  : "Fahrschulen in allen Stadtbezirken entdecken"}
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-primary transition-transform duration-[var(--motion-duration-base)] ease-[var(--motion-ease)] motion-safe:group-hover:translate-x-1">
                  <path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </Link>

            {/* Stadt-Kacheln: farbiges Wahrzeichen (city-icons.tsx, Fallback-
                Silhouette für Städte ohne eigenes Icon) + Name + echter Count.
                BILD-SLOT vorbereitet: künftige Stadt-Fotos ersetzen das Icon
                als Kachel-Hintergrund (next/image, fill) — Struktur bleibt. */}
            {cityTiles.map((t) => (
              <Link
                key={t.ort}
                href={`/fahrschulen?ort=${encodeURIComponent(t.ort)}`}
                className={`hover-lift group flex min-h-28 flex-col justify-between gap-3 rounded-3xl border border-border/60 bg-card/75 p-5 text-left shadow-elevation-1 backdrop-blur-md ${focusRing}`}
              >
                <CityIcon city={t.ort} className="size-9" />
                <span>
                  <span className="block font-semibold text-foreground transition-colors duration-[var(--motion-duration-base)] ease-[var(--motion-ease)] group-hover:text-primary">
                    {t.ort}
                  </span>
                  {t.anzahl != null && (
                    <span className="mt-0.5 block font-mono text-xs text-muted-foreground">
                      {t.anzahl === 1 ? "1 Fahrschule" : `${t.anzahl.toLocaleString("de-DE")} Fahrschulen`}
                    </span>
                  )}
                </span>
              </Link>
            ))}
          </div>

          <p className="reveal mt-8 text-center text-sm text-muted-foreground">
            … und viele weitere Orte über die Suche.
          </p>
        </div>
      </section>

      {/* Absolventen-Stimmen (Video-Karten): Ehrlichkeits-Gate — rendert NUR
          mit echten, schriftlich eingewilligten Stimmen; aktuell leeres Array
          → unsichtbar (s. absolventen-stimmen.tsx). */}
      <AbsolventenStimmen />

      {/* ============ 09 · FAQ (weiß) + ruhiger Final-CTA ==================== */}
      <section aria-labelledby="faq-heading" className="py-20 sm:py-28">
        <div className="mx-auto w-full max-w-6xl px-6">
          <SectionHead
            n="09"
            kicker="Häufige Fragen"
            id="faq-heading"
            title={
              <>
                Ehrliche Antworten, <span className="font-semibold">bevor du fragst.</span>
              </>
            }
          />

          <JsonLd data={faqJsonLd} />

          <div className="reveal mx-auto mt-14 max-w-3xl text-left">
            {FAQ.map((f) => (
              <details key={f.q} className="group border-t border-border last:border-b">
                <summary
                  className={`flex min-h-11 cursor-pointer list-none items-center justify-between gap-6 py-6 text-lg font-medium tracking-tight [&::-webkit-details-marker]:hidden ${focusRing} rounded-md`}
                >
                  {f.q}
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="size-5 shrink-0 text-muted-foreground transition-transform duration-[var(--motion-duration-base)] ease-[var(--motion-ease)] group-open:rotate-45 motion-reduce:transition-none"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  >
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </summary>
                <div className="max-w-2xl pb-8">
                  <p className="leading-relaxed text-muted-foreground">{f.a}</p>
                  {f.link ? (
                    <Link
                      href={f.link.href}
                      className={`group/link mt-4 inline-flex min-h-11 items-center gap-1.5 font-medium text-primary underline-offset-4 hover:underline ${focusRing} rounded-md`}
                    >
                      {f.link.label}
                      <svg
                        aria-hidden="true"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="shrink-0 transition-transform duration-[var(--motion-duration-fast)] ease-[var(--motion-ease)] motion-safe:group-hover/link:translate-x-1"
                      >
                        <path d="M5 12h14m-6-6 6 6-6 6" />
                      </svg>
                    </Link>
                  ) : null}
                </div>
              </details>
            ))}
          </div>

          {/* Abschluss: EIN ruhiger Final-CTA mit Plakette — das zweite
              Suchmodul ist bewusst ENTFERNT (Gründer 2026-07-02: die Suche
              dockt beim Scrollen ohnehin im Header an, der Footer trägt die
              Vertrauens-Leiste — keine doppelte Suchleiste am Seitenende). */}
          {/* Gründer 2026-07-02: Abschluss führt zur SUCHE → Label „Jetzt suchen"
              (ehrlich zum Ziel), ohne Plakette darüber (trust hat seine Bühnen
              weiter oben — der Ausklang bleibt pur). */}
          <div className="reveal mx-auto mt-20 flex max-w-3xl flex-col items-center gap-5 text-center">
            <h3 className="text-3xl font-light tracking-tight text-balance sm:text-4xl">
              Bereit? <span className="font-semibold">Finde deine Fahrschule.</span>
            </h3>
            <CtaButton href="/fahrschulen">Jetzt suchen</CtaButton>
            <AnmeldeHinweis />
          </div>
        </div>
      </section>
    </div>
  );
}
