import type { Metadata } from "next";
import Link from "next/link";
import { SearchBar } from "@/components/search/search-bar";
import { RevealOnScroll } from "@/components/home/reveal";
import { DataBadge } from "@/components/school/data-badge";

/**
 * VORSCHAU „reset-spatial" — Design-These „Räumliche Tiefe":
 * Weiche, geschichtete Räumlichkeit statt flacher Karten. Ein helles Ambient
 * (Token-Verläufe via color-mix), darüber schwebende Glass-Ebenen
 * (bg-card/…, backdrop-blur, shadow-elevation-2/3) und Bento-Kompositionen
 * mit bewusst UNTERSCHIEDLICH großen Zellen. Die Suche schwebt als zentrales
 * Glass-Objekt über dem Ambient; Sektionen fließen ohne harte Kanten
 * ineinander. Motion: nur opacity/transform, reveal/hover-lift/pulse-ring aus
 * globals.css — alles reduced-motion-sicher. SSR, ohne JS voll lesbar.
 * Inhaltlich strikt ehrlich: keine erfundenen Zahlen, keine Pauschalpreise,
 * Kosten nur als Komponenten (§32 FahrlG), Demo-Werte klar markiert.
 */
export const metadata: Metadata = {
  title: "Vorschau — Reset (Räumliche Tiefe)",
  robots: { index: false, follow: false },
};

/* ---------------------------------------------------------------------------
 * Kleine Inline-Bausteine (self-contained, server-tauglich)
 * ------------------------------------------------------------------------- */

/** Uppercase-Sektionslabel. */
function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
      {children}
    </p>
  );
}

/** Schwebende Glass-Ebene — die Grundfläche dieser Seite. */
function Glass({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-3xl border border-border/60 bg-card/75 shadow-elevation-2 backdrop-blur-md ${className}`}
    >
      {children}
    </div>
  );
}

/** Weicher Icon-Sockel in Markenton. */
function IconWell({
  tone = "sky",
  children,
}: {
  tone?: "sky" | "cyan" | "lime";
  children: React.ReactNode;
}) {
  const tones = {
    sky: "bg-brand-sky/12 text-primary",
    cyan: "bg-brand-cyan/15 text-primary",
    lime: "bg-brand-lime/20 text-accent-foreground",
  } as const;
  return (
    <span
      aria-hidden="true"
      className={`grid size-11 shrink-0 place-items-center rounded-2xl ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

/** Häkchen-Zeile für Trust-/Fakten-Listen. */
function CheckLine({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-sm text-muted-foreground">
      <svg
        aria-hidden="true"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        className="mt-0.5 shrink-0 text-primary"
      >
        <path d="m5 13 4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>{children}</span>
    </li>
  );
}

/** Ambient-Schicht: sehr weiche Token-Verläufe hinter einer Sektion. */
function Ambient({ variant }: { variant: "hero" | "mid" | "calm" | "close" }) {
  const layers: Record<typeof variant, string> = {
    hero: "bg-[radial-gradient(46%_52%_at_16%_10%,color-mix(in_oklab,var(--brand-sky)_18%,transparent),transparent_64%),radial-gradient(40%_46%_at_86%_4%,color-mix(in_oklab,var(--brand-cyan)_14%,transparent),transparent_62%),radial-gradient(52%_58%_at_50%_112%,color-mix(in_oklab,var(--brand-lime)_10%,transparent),transparent_58%)]",
    mid: "bg-[radial-gradient(44%_50%_at_84%_16%,color-mix(in_oklab,var(--brand-cyan)_10%,transparent),transparent_62%),radial-gradient(46%_52%_at_8%_82%,color-mix(in_oklab,var(--brand-sky)_10%,transparent),transparent_60%)]",
    calm: "bg-[radial-gradient(50%_56%_at_12%_10%,color-mix(in_oklab,var(--brand-sky)_8%,transparent),transparent_60%),radial-gradient(44%_48%_at_90%_88%,color-mix(in_oklab,var(--brand-lime)_8%,transparent),transparent_58%)]",
    close: "bg-[radial-gradient(48%_54%_at_50%_0%,color-mix(in_oklab,var(--brand-sky)_10%,transparent),transparent_62%)]",
  };
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className={`aurora absolute inset-0 bg-[length:170%_170%] ${layers[variant]}`} />
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Daten (ehrlich: nur Struktur/Links, keine erfundenen Kennzahlen)
 * ------------------------------------------------------------------------- */

const KLASSEN_QUICK = ["B", "B197", "BE", "B96", "A", "A2", "A1", "AM"];

const STAEDTE = [
  "Berlin",
  "Hamburg",
  "Köln",
  "Frankfurt am Main",
  "Stuttgart",
  "Düsseldorf",
  "Leipzig",
  "Nürnberg",
];

const FAQ = [
  {
    q: "Woher stammen die Daten über die Fahrschulen?",
    a: "Aus öffentlichen Quellen und eigener Recherche. Jede Angabe trägt eine sichtbare Kennzeichnung: „recherchiert · ohne Gewähr“, bis die Fahrschule sie selbst geprüft und bestätigt hat — erst dann erscheint das grüne Abzeichen.",
  },
  {
    q: "Warum ist onelane für mich kostenlos?",
    a: "Weil du hier nichts kaufst. Suchen, vergleichen und anfragen kostet dich nichts und erfordert kein Konto — dein Vertrag entsteht später direkt mit der Fahrschule.",
  },
  {
    q: "Wie verdient onelane dann Geld?",
    a: "Über Leistungen für Fahrschulen. Wichtig dabei: Die Sortierung der Suchergebnisse bleibt davon unbeeinflusst — Position lässt sich bei uns nicht kaufen.",
  },
  {
    q: "Warum zeigt ihr keinen Gesamtpreis für den Führerschein?",
    a: "Weil es ihn seriös nicht gibt: Wie viele Fahrstunden du brauchst, ist individuell. Fahrschulen weisen ihre Preise gesetzlich als einzelne Bausteine aus — genau diese Bausteine machen wir vergleichbar, statt eine Pauschale zu erfinden.",
  },
  {
    q: "Brauche ich ein Konto?",
    a: "Nein. Du kannst ohne Anmeldung suchen, vergleichen und Fahrschulen direkt kontaktieren. Wir fragen nur ab, was für deine Anfrage wirklich nötig ist.",
  },
];

/* ---------------------------------------------------------------------------
 * Seite
 * ------------------------------------------------------------------------- */

export default function ResetSpatialPreview() {
  return (
    <div className="overflow-x-clip">
      <RevealOnScroll />

      <div className="mx-auto max-w-6xl px-6 pt-4 text-right">
        <Link href="/vorschau" className="text-sm text-muted-foreground underline-offset-2 hover:underline">
          ← Vorschauen
        </Link>
      </div>

      {/* =================================================================
          1 · HERO — die Suche als zentrales Glass-Objekt über dem Ambient
          ================================================================= */}
      <section className="relative" aria-labelledby="hero-heading">
        <Ambient variant="hero" />
        {/* Tiefen-Schicht: weiche, driftende Farbkörper hinter dem Glas */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="float-slower absolute -left-28 top-16 size-96 rounded-full bg-brand-sky/15 blur-3xl" />
          <div className="float-slow absolute -right-24 top-40 size-80 rounded-full bg-brand-cyan/15 blur-3xl" />
          <div className="mbg-2 absolute left-[38%] top-[62%] size-72 rounded-full bg-brand-lime/10 blur-3xl" />
          {/* Fahrbahn-Linie als leise Marken-Signatur */}
          <svg
            className="absolute inset-x-0 bottom-0 h-40 w-full text-brand-sky/20"
            viewBox="0 0 1200 160"
            preserveAspectRatio="none"
            fill="none"
            aria-hidden="true"
          >
            <path d="M-20 140 C 260 40, 560 190, 860 80 S 1180 60, 1240 110" stroke="currentColor" strokeWidth="2" strokeDasharray="2 14" strokeLinecap="round" />
          </svg>
        </div>

        <div className="relative mx-auto max-w-6xl px-6 pb-28 pt-16 sm:pt-24">
          <div className="mx-auto max-w-3xl text-center">
            <h1 id="hero-heading" className="text-4xl font-bold leading-[1.06] tracking-tight text-foreground sm:text-6xl">
              Der klare Weg zu
              <br />
              <span className="text-gradient-brand">deiner Fahrschule.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
              onelane zeigt dir Fahrschulen in deiner Nähe — mit ehrlichen
              Preis-Bausteinen statt Pauschalversprechen. Vergleiche in Ruhe
              und frag direkt an.
            </p>
          </div>

          {/* Das zentrale Glass-Objekt: Suche + Klassen-Schnellwahl */}
          <div className="relative mx-auto mt-10 max-w-3xl">
            {/* dekorative Neben-Ebenen (nur Desktop, rein visuell) */}
            <div aria-hidden="true" className="pointer-events-none absolute -left-44 top-6 hidden xl:block">
              <div className="float-slow flex items-center gap-2 rounded-2xl border border-border/60 bg-card/70 px-4 py-3 shadow-elevation-2 backdrop-blur-md">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-primary">
                  <path d="M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                  <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="2" />
                </svg>
                <span className="text-sm font-medium text-foreground">Nach Nähe sortiert</span>
              </div>
            </div>
            <div aria-hidden="true" className="pointer-events-none absolute -right-48 bottom-2 hidden xl:block">
              <div className="float-slower rounded-2xl border border-border/60 bg-card/70 px-4 py-3 shadow-elevation-2 backdrop-blur-md">
                <DataBadge status="bestaetigt" />
              </div>
            </div>

            <div className="rounded-[2rem] border border-border/60 bg-card/70 p-5 shadow-elevation-3 backdrop-blur-xl sm:p-8">
              <p className="mb-4 text-center text-sm font-medium text-muted-foreground">
                Wo willst du fahren lernen?
              </p>
              <div className="flex justify-center">
                {/* pulse-ring = sanft pulsierender Ring um das Such-Objekt (reduced-motion-sicher) */}
                <div className="pulse-ring w-full max-w-2xl rounded-full">
                  <SearchBar compact />
                </div>
              </div>

              {/* Klassen-Schnellwahl — echte SSR-Links, funktioniert ohne JS */}
              <nav aria-label="Führerscheinklasse wählen" className="mt-5">
                <ul className="flex flex-wrap items-center justify-center gap-2">
                  <li className="mr-1 text-xs text-muted-foreground">Direkt zur Klasse:</li>
                  {KLASSEN_QUICK.map((k) => (
                    <li key={k}>
                      <Link
                        href={`/fahrschulen?klasse=${encodeURIComponent(k)}`}
                        className="inline-flex min-h-11 items-center rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors duration-[var(--motion-duration-base)] ease-[var(--motion-ease)] hover:border-brand-sky/50 hover:text-primary"
                      >
                        {k}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>

            {/* Wahre Trust-Zeile */}
            <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
              {["unabhängig", "für Fahrschüler kostenlos", "ohne Konto"].map((t) => (
                <li key={t} className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" className="text-accent-foreground">
                    <circle cx="12" cy="12" r="10" className="fill-accent" />
                    <path d="m8 12.5 2.5 2.5L16 9.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* =================================================================
          2 · SO FUNKTIONIERT’S — drei ehrliche Schritte auf einer Ebene
          ================================================================= */}
      <section className="relative" aria-labelledby="steps-heading">
        <Ambient variant="mid" />
        <div className="mx-auto max-w-6xl px-6 py-24">
          <div className="reveal max-w-2xl">
            <Kicker>So funktioniert’s</Kicker>
            <h2 id="steps-heading" className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Drei Schritte. Kein Kleingedrucktes.
            </h2>
          </div>

          <div className="relative mt-12">
            {/* verbindende Fahrbahn hinter den Karten (Tiefe statt Trennlinie) */}
            <div aria-hidden="true" className="road-line absolute inset-x-8 top-1/2 hidden h-2 -translate-y-1/2 opacity-40 lg:block" />
            <div className="reveal-stagger relative grid gap-5 lg:grid-cols-3">
              {[
                {
                  t: "Suchen",
                  d: "Ort oder Adresse eingeben, Klasse wählen. Wir zeigen dir Fahrschulen in deiner Nähe — sortiert nach Distanz.",
                  icon: (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                      <path d="m20 20-3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  ),
                  tone: "sky" as const,
                },
                {
                  t: "Vergleichen",
                  d: "Preis-Bausteine, Entfernung und Angebote nebeneinander — mit klarer Kennzeichnung, welche Angaben die Fahrschule bestätigt hat.",
                  icon: (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M6 20V10M12 20V4M18 20v-7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                    </svg>
                  ),
                  tone: "cyan" as const,
                },
                {
                  t: "Direkt anfragen",
                  d: "Du kontaktierst die Fahrschule direkt und unverbindlich. Kein Konto, keine Zwischenstufe, keine Kosten für dich.",
                  icon: (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="m4 12 16-7-5 16-3.5-6L4 12Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                    </svg>
                  ),
                  tone: "lime" as const,
                },
              ].map((s, i) => (
                <Glass key={s.t} className="hover-lift relative p-7">
                  <span aria-hidden="true" className="absolute right-6 top-6 text-4xl font-bold text-brand-sky/15">
                    {i + 1}
                  </span>
                  <IconWell tone={s.tone}>{s.icon}</IconWell>
                  <h3 className="mt-5 text-lg font-semibold text-foreground">{s.t}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.d}</p>
                </Glass>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* =================================================================
          3 · KOSTEN-BENTO — fünf Bausteine, ungleich groß, ehrlich erklärt
          ================================================================= */}
      <section className="relative" aria-labelledby="kosten-heading">
        <Ambient variant="calm" />
        <div className="mx-auto max-w-6xl px-6 py-24">
          <div className="reveal max-w-2xl">
            <Kicker>Kosten verstehen</Kicker>
            <h2 id="kosten-heading" className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Was kostet der Führerschein?
            </h2>
            <p className="mt-4 text-muted-foreground">
              Keine Pauschale — fünf Bausteine. Wie viel jeder Baustein
              ausmacht, ist individuell: Es hängt vor allem davon ab, wie viele
              Fahrstunden du brauchst. Deshalb erfinden wir keinen
              Gesamtpreis, sondern machen die Bausteine je Fahrschule sichtbar.
            </p>
          </div>

          <div className="reveal-stagger mt-12 grid grid-cols-1 gap-4 sm:grid-cols-6">
            {/* große Zelle: Grundbetrag */}
            <Glass className="hover-lift p-7 sm:col-span-4 sm:row-span-2 sm:p-9">
              <IconWell tone="sky">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="2" />
                  <path d="M8 10h8M8 14h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </IconWell>
              <h3 className="mt-5 text-xl font-semibold text-foreground">Grundbetrag</h3>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                Deckt Anmeldung, theoretische Ausbildung und Verwaltung ab —
                fällt einmalig an und unterscheidet sich je Fahrschule. Der
                erste Baustein, den du vergleichen solltest.
              </p>
              {/* Bausteine-Stapel als räumliche Illustration (rein dekorativ) */}
              <svg className="mt-8 h-32 w-full max-w-sm" viewBox="0 0 320 130" fill="none" aria-hidden="true">
                <rect x="10" y="86" width="300" height="34" rx="10" className="fill-brand-sky/20" />
                <rect x="34" y="56" width="220" height="26" rx="9" className="fill-brand-cyan/25" />
                <rect x="58" y="30" width="150" height="22" rx="8" className="fill-brand-lime/30" />
                <rect x="82" y="8" width="90" height="18" rx="7" className="fill-brand-sky/30" />
              </svg>
              <p className="mt-2 text-xs text-muted-foreground">
                Schema: Die Bausteine stapeln sich individuell — nicht maßstäblich.
              </p>
            </Glass>

            {/* Fahrstunde */}
            <Glass className="hover-lift p-6 sm:col-span-2">
              <IconWell tone="cyan">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="2" />
                  <path d="M12 7v5l3.5 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </IconWell>
              <h3 className="mt-4 font-semibold text-foreground">Fahrstunde (45 Min.)</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                Preis je Übungsstunde. Wie viele du brauchst, ist individuell —
                niemand kann dir das seriös vorab garantieren.
              </p>
            </Glass>

            {/* Sonderfahrten */}
            <Glass className="hover-lift p-6 sm:col-span-2">
              <IconWell tone="sky">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M4 19 12 4l8 15" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                  <path d="M12 10v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </IconWell>
              <h3 className="mt-4 font-semibold text-foreground">Sonderfahrten</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                Überland, Autobahn, bei Dunkelheit — gesetzlich vorgeschrieben,
                mit eigenem Preis je Fahrtart.
              </p>
            </Glass>

            {/* Prüfungs-Vorstellung */}
            <Glass className="hover-lift p-6 sm:col-span-3">
              <IconWell tone="lime">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M7 3h8l4 4v14H7V3Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                  <path d="m10 14 2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </IconWell>
              <h3 className="mt-4 font-semibold text-foreground">Prüfungs-Vorstellung</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                Die Fahrschule stellt dich zur Theorie- und Praxisprüfung vor —
                je Vorstellung fällt ein eigener Betrag an.
              </p>
            </Glass>

            {/* Lernmaterial */}
            <Glass className="hover-lift p-6 sm:col-span-3">
              <IconWell tone="cyan">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15.5H6.5A2.5 2.5 0 0 0 4 21V5.5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                  <path d="M8 8h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </IconWell>
              <h3 className="mt-4 font-semibold text-foreground">Lernmaterial</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                Lehrbuch oder Lern-App für die Theorie — wird je nach
                Fahrschule unterschiedlich angeboten und berechnet.
              </p>
            </Glass>

            {/* breite Hinweis-Zelle: amtliche Gebühren */}
            <div className="rounded-3xl border border-border/60 bg-secondary/70 p-6 backdrop-blur-md sm:col-span-6 sm:p-7">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <IconWell tone="sky">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M5 21V8l7-5 7 5v13" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                    <path d="M9 21v-6h6v6" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                  </svg>
                </IconWell>
                <div>
                  <h3 className="font-semibold text-foreground">Zuzüglich amtlicher Gebühren</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    Prüforganisation (z.&nbsp;B. TÜV oder DEKRA) und
                    Führerscheinstelle erheben eigene Gebühren — unabhängig von
                    der Fahrschule und bei allen gleich. Sie gehören in jede
                    ehrliche Rechnung.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =================================================================
          4 · TRANSPARENZ — Sortierung, Kennzeichnung, Bewertungs-Ehrlichkeit
          ================================================================= */}
      <section className="relative" aria-labelledby="transparenz-heading">
        <Ambient variant="mid" />
        <div className="mx-auto max-w-6xl px-6 py-24">
          <div className="grid items-start gap-10 lg:grid-cols-2">
            <div className="reveal">
              <Kicker>Transparenz</Kicker>
              <h2 id="transparenz-heading" className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                So sortieren wir. Und so kennzeichnen wir.
              </h2>
              <ul className="mt-8 space-y-5">
                <CheckLine>
                  <strong className="font-semibold text-foreground">Distanz statt bezahltem Ranking.</strong>{" "}
                  Die Reihenfolge der Ergebnisse richtet sich nach der
                  Entfernung zu deinem Standort — Position lässt sich bei uns
                  nicht kaufen.
                </CheckLine>
                <CheckLine>
                  <strong className="font-semibold text-foreground">Jede Angabe trägt ihren Status.</strong>{" "}
                  Recherchierte Daten bleiben sichtbar als „ohne Gewähr“
                  markiert, bis die Fahrschule sie bestätigt — erst dann gibt
                  es das grüne Abzeichen.
                </CheckLine>
                <CheckLine>
                  <strong className="font-semibold text-foreground">Keine gekauften Sterne.</strong>{" "}
                  Bewertungen zeigen wir erst, wenn wir sie verlässlich
                  verifizieren können — daran arbeiten wir, statt Sterne zu
                  erfinden.
                </CheckLine>
              </ul>
              <div className="mt-8 flex flex-wrap gap-3">
                <DataBadge status="recherchiert" />
                <DataBadge status="bestaetigt" />
              </div>
            </div>

            {/* Demo-Ansicht: schwebende Ergebnis-Ebene */}
            <div className="reveal relative">
              <div aria-hidden="true" className="pointer-events-none absolute -inset-6 -z-10 rounded-[2.5rem] bg-brand-sky/8 blur-2xl" />
              <Glass className="p-6 shadow-elevation-3 sm:p-7">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-muted-foreground">Sortiert nach Nähe</p>
                  <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
                    Demo-Ansicht
                  </span>
                </div>
                <div className="mt-4 space-y-3">
                  {[
                    { name: "Fahrschule Beispiel Nord", dist: "0,8 km", status: "bestaetigt" as const },
                    { name: "Fahrschule Beispiel Mitte", dist: "1,4 km", status: "recherchiert" as const },
                    { name: "Fahrschule Beispiel Süd", dist: "2,1 km", status: "recherchiert" as const },
                  ].map((r, i) => (
                    <div
                      key={r.name}
                      className={`rounded-2xl border border-border/60 bg-card p-4 shadow-elevation-1 ${i === 0 ? "sm:-translate-x-2" : i === 2 ? "sm:translate-x-2" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-foreground">{r.name}</p>
                          <p className="mt-0.5 text-sm text-muted-foreground">{r.dist} entfernt · Klasse B</p>
                        </div>
                        <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-sky/10 text-primary">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                            <path d="M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                          </svg>
                        </span>
                      </div>
                      <div className="mt-2.5">
                        <DataBadge status={r.status} />
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-xs text-muted-foreground">
                  Beispieldaten zur Veranschaulichung der Sortier- und Kennzeichnungslogik.
                </p>
              </Glass>
            </div>
          </div>
        </div>
      </section>

      {/* =================================================================
          5 · STÄDTE — München im Fokus, weitere Einstiege als Bento
          ================================================================= */}
      <section className="relative" aria-labelledby="staedte-heading">
        <Ambient variant="calm" />
        <div className="mx-auto max-w-6xl px-6 py-24">
          <div className="reveal max-w-2xl">
            <Kicker>Städte</Kicker>
            <h2 id="staedte-heading" className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Starte in deiner Stadt.
            </h2>
            <p className="mt-4 text-muted-foreground">
              Fahrschulen in ganz Deutschland — wir beginnen mit München und
              bauen Stadt für Stadt aus.
            </p>
          </div>

          <div className="reveal-stagger mt-12 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {/* München — große Zelle */}
            <Link
              href={`/fahrschulen?ort=${encodeURIComponent("München")}`}
              className="hover-lift group relative col-span-2 row-span-2 flex min-h-64 flex-col justify-end overflow-hidden rounded-3xl border border-border/60 bg-card/80 p-7 shadow-elevation-2 backdrop-blur-md"
            >
              {/* abstrakte Silhouette (Inline-SVG, Token-Farben) */}
              <svg
                className="absolute inset-x-0 top-0 h-2/3 w-full"
                viewBox="0 0 400 160"
                preserveAspectRatio="xMidYMax meet"
                fill="none"
                aria-hidden="true"
              >
                <g className="transition-transform duration-[var(--motion-duration-slow)] ease-[var(--motion-ease)] group-hover:-translate-y-1">
                  <rect x="40" y="80" width="34" height="80" rx="4" className="fill-brand-sky/15" />
                  <rect x="86" y="52" width="26" height="108" rx="4" className="fill-brand-sky/25" />
                  <path d="M99 20v32" className="stroke-brand-sky/40" strokeWidth="3" strokeLinecap="round" />
                  <circle cx="99" cy="46" r="9" className="fill-brand-cyan/30" />
                  <rect x="126" y="52" width="26" height="108" rx="4" className="fill-brand-sky/25" />
                  <path d="M139 20v32" className="stroke-brand-sky/40" strokeWidth="3" strokeLinecap="round" />
                  <circle cx="139" cy="46" r="9" className="fill-brand-cyan/30" />
                  <rect x="166" y="90" width="60" height="70" rx="4" className="fill-brand-sky/15" />
                  <rect x="240" y="70" width="30" height="90" rx="4" className="fill-brand-sky/20" />
                  <rect x="284" y="100" width="48" height="60" rx="4" className="fill-brand-sky/12" />
                  <rect x="346" y="84" width="22" height="76" rx="4" className="fill-brand-sky/18" />
                </g>
              </svg>
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Im Fokus</span>
              <span className="mt-1 text-2xl font-bold text-foreground">München</span>
              <span className="mt-1 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                Fahrschulen in allen Stadtbezirken entdecken
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-primary transition-transform duration-[var(--motion-duration-base)] ease-[var(--motion-ease)] group-hover:translate-x-1">
                  <path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </Link>

            {STAEDTE.map((stadt) => (
              <Link
                key={stadt}
                href={`/fahrschulen?ort=${encodeURIComponent(stadt)}`}
                className="hover-lift group flex min-h-28 flex-col justify-between rounded-3xl border border-border/60 bg-card/75 p-5 shadow-elevation-1 backdrop-blur-md"
              >
                <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-brand-sky/70">
                  <path d="M4 21V8l7-4 7 4v13M9 21v-5h6v5" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                </svg>
                <span className="font-semibold text-foreground transition-colors duration-[var(--motion-duration-base)] ease-[var(--motion-ease)] group-hover:text-primary">
                  {stadt}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* =================================================================
          6+7 · ELTERN & DATENSCHUTZ — zwei ruhige Vertrauens-Ebenen
          ================================================================= */}
      <section className="relative" aria-labelledby="eltern-heading">
        <Ambient variant="mid" />
        <div className="mx-auto max-w-6xl px-6 py-24">
          <div className="grid gap-5 lg:grid-cols-5">
            {/* Eltern (U18) */}
            <Glass className="reveal p-8 lg:col-span-3 sm:p-10">
              <Kicker>Unter 18?</Kicker>
              <h2 id="eltern-heading" className="mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Deine Eltern sind mit an Bord.
              </h2>
              <p className="mt-4 max-w-xl leading-relaxed text-muted-foreground">
                Mit BF17 kannst du früh starten — und bei Minderjährigen
                gehört die Zustimmung der Eltern einfach dazu. onelane bindet
                sie von Anfang an ein, statt sie am Ende zu überraschen.
              </p>
              <ul className="mt-6 space-y-3.5">
                <CheckLine>
                  Deine Eltern sehen denselben ehrlichen Vergleich wie du —
                  dieselben Preis-Bausteine, dieselbe Kennzeichnung.
                </CheckLine>
                <CheckLine>
                  Wir fragen nur die Daten ab, die für deine Anfrage wirklich
                  nötig sind — Datenminimierung ist bei uns Prinzip, kein
                  Feigenblatt.
                </CheckLine>
                <CheckLine>
                  Der Vertrag entsteht direkt mit der Fahrschule — transparent
                  für dich und deine Eltern.
                </CheckLine>
              </ul>
            </Glass>

            {/* Datenschutz-Trust */}
            <Glass className="reveal p-8 lg:col-span-2 sm:p-10">
              <Kicker>Datenschutz</Kicker>
              <h2 className="mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Deine Daten bleiben deine.
              </h2>
              <ul className="mt-6 space-y-5">
                {[
                  {
                    t: "Karten ohne Google-Tracking",
                    d: "Unsere Karten basieren auf OpenStreetMap — kein Google-Dienst schaut dir über die Schulter.",
                  },
                  {
                    t: "Hosting in Deutschland",
                    d: "Die Plattform läuft auf Servern in Deutschland, nach europäischem Datenschutzrecht.",
                  },
                  {
                    t: "Keine Tracking-Cookies",
                    d: "Du kannst suchen und vergleichen, ohne dass ein Cookie-Banner um deine Daten feilscht.",
                  },
                ].map((p) => (
                  <li key={p.t} className="flex gap-3.5">
                    <IconWell tone="lime">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6l-7-3Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                        <path d="m9 12 2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </IconWell>
                    <div>
                      <h3 className="font-semibold text-foreground">{p.t}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{p.d}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </Glass>
          </div>
        </div>
      </section>

      {/* =================================================================
          8 · REFORM 2027 — vorsichtiger Ausblick auf amtliche Daten
          ================================================================= */}
      <section className="relative" aria-labelledby="reform-heading">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="reveal relative overflow-hidden rounded-[2rem] border border-border/60 bg-card/70 p-8 shadow-elevation-3 backdrop-blur-xl sm:p-12">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_80%_at_85%_20%,color-mix(in_oklab,var(--brand-cyan)_12%,transparent),transparent_60%),radial-gradient(50%_70%_at_10%_90%,color-mix(in_oklab,var(--brand-sky)_10%,transparent),transparent_60%)]"
            />
            <div className="grid items-center gap-8 lg:grid-cols-[1fr_auto]">
              <div className="max-w-2xl">
                <Kicker>Ausblick</Kicker>
                <h2 id="reform-heading" className="mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  Amtliche Preisdaten und Bestehensquoten — sobald es sie gibt.
                </h2>
                <p className="mt-4 leading-relaxed text-muted-foreground">
                  Eine geplante Gesetzesreform soll ab 2027 Preise und
                  praktische Bestehensquoten von Fahrschulen öffentlich
                  machen. Wir bereiten diese amtlichen Daten für dich auf,
                  sobald sie verfügbar sind — direkt vergleichbar, direkt hier.
                </p>
              </div>
              {/* Zeitachse als räumliches Objekt */}
              <svg className="mx-auto h-24 w-64" viewBox="0 0 260 100" fill="none" aria-hidden="true">
                <path d="M10 60 C 80 20, 180 20, 250 60" className="stroke-brand-sky/40" strokeWidth="2" strokeDasharray="2 10" strokeLinecap="round" />
                <circle cx="10" cy="60" r="7" className="fill-brand-sky/30" />
                <circle cx="250" cy="60" r="9" className="fill-brand-lime/70" />
                <text x="10" y="86" textAnchor="middle" className="fill-muted-foreground text-[11px] font-medium">heute</text>
                <text x="250" y="86" textAnchor="middle" className="fill-foreground text-[11px] font-semibold">2027</text>
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* =================================================================
          9 · JOBBÖRSE — zwei Pfade auf zwei Ebenen
          ================================================================= */}
      <section className="relative" aria-labelledby="jobs-heading">
        <Ambient variant="calm" />
        <div className="mx-auto max-w-6xl px-6 py-24">
          <div className="reveal max-w-2xl">
            <Kicker>Jobbörse</Kicker>
            <h2 id="jobs-heading" className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Vor der Tafel statt hinterm Steuer?
            </h2>
            <p className="mt-4 text-muted-foreground">
              Fahrschulen suchen Verstärkung — und bilden aus. Zwei Wege, ein
              Berufsfeld mit Zukunft.
            </p>
          </div>

          <div className="reveal-stagger mt-12 grid gap-5 md:grid-cols-2">
            <Link
              href="/jobs"
              className="hover-lift group flex flex-col rounded-3xl border border-border/60 bg-card/80 p-8 shadow-elevation-2 backdrop-blur-md"
            >
              <IconWell tone="sky">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <rect x="3" y="7" width="18" height="13" rx="3" stroke="currentColor" strokeWidth="2" />
                  <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" stroke="currentColor" strokeWidth="2" />
                </svg>
              </IconWell>
              <h3 className="mt-5 text-xl font-semibold text-foreground">
                Offene Stellen für Fahrlehrer:innen
              </h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                Du hast die Fahrlehrerlaubnis? Finde Fahrschulen, die gerade
                einstellen — mit direktem Draht, ohne Umwege.
              </p>
              <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                Stellen ansehen
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" className="transition-transform duration-[var(--motion-duration-base)] ease-[var(--motion-ease)] group-hover:translate-x-1">
                  <path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </Link>

            <Link
              href="/jobs"
              className="hover-lift group flex flex-col rounded-3xl border border-border/60 bg-card/80 p-8 shadow-elevation-2 backdrop-blur-md"
            >
              <IconWell tone="lime">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M12 4 3 8.5 12 13l9-4.5L12 4Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                  <path d="M7 11v5c0 1.5 2.2 3 5 3s5-1.5 5-3v-5" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                </svg>
              </IconWell>
              <h3 className="mt-5 text-xl font-semibold text-foreground">
                Fahrlehrer:in werden
              </h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                Neu im Berufsfeld? Viele Fahrschulen finanzieren die
                Ausbildung zur Fahrlehrerin oder zum Fahrlehrer — der Einstieg
                in einen gefragten Beruf.
              </p>
              <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                Ausbildungswege entdecken
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" className="transition-transform duration-[var(--motion-duration-base)] ease-[var(--motion-ease)] group-hover:translate-x-1">
                  <path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* =================================================================
          10 · FÜR FAHRSCHULEN — Sie-Form, kostenloser Eintrag
          ================================================================= */}
      <section className="relative" aria-labelledby="schulen-heading">
        <Ambient variant="mid" />
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="reveal relative overflow-hidden rounded-[2rem] border border-border/60 bg-card/75 shadow-elevation-3 backdrop-blur-xl">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(55%_75%_at_90%_10%,color-mix(in_oklab,var(--brand-lime)_10%,transparent),transparent_60%)]"
            />
            <div className="grid gap-10 p-8 sm:p-12 lg:grid-cols-[1.3fr_1fr] lg:items-center">
              <div>
                <Kicker>Für Fahrschulen</Kicker>
                <h2 id="schulen-heading" className="mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  Ihr Eintrag ist kostenlos — und gehört Ihnen.
                </h2>
                <p className="mt-4 max-w-xl leading-relaxed text-muted-foreground">
                  Ihre Fahrschule ist vermutlich schon gelistet. Prüfen Sie
                  Ihre Daten, korrigieren Sie, was nicht stimmt, und
                  bestätigen Sie Ihre Angaben — bestätigte Daten erhalten das
                  grüne Abzeichen und schaffen Vertrauen bei Fahrschülerinnen
                  und Fahrschülern.
                </p>
                <div className="mt-7">
                  <Link
                    href="/fahrschulen"
                    className="inline-flex min-h-12 items-center gap-2 rounded-full bg-primary px-7 py-3 text-base font-semibold text-primary-foreground shadow-elevation-2 transition-transform duration-[var(--motion-duration-base)] ease-[var(--motion-ease)] hover:scale-[1.02] active:scale-[0.98]"
                  >
                    Eintrag finden und prüfen
                    <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none">
                      <path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </Link>
                </div>
              </div>
              {/* Vorher/Nachher der Kennzeichnung als gestapelte Ebenen */}
              <div aria-hidden="true" className="relative mx-auto w-full max-w-xs">
                <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-elevation-1 sm:-rotate-2">
                  <p className="text-sm font-semibold text-foreground">Ihr Eintrag heute</p>
                  <div className="mt-2.5">
                    <DataBadge status="recherchiert" />
                  </div>
                </div>
                <div className="relative z-10 -mt-3 ml-6 rounded-2xl border border-border/60 bg-card p-5 shadow-elevation-3 sm:rotate-1">
                  <p className="text-sm font-semibold text-foreground">Nach Ihrer Bestätigung</p>
                  <div className="mt-2.5">
                    <DataBadge status="bestaetigt" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =================================================================
          11 · FAQ — ehrliche Antworten, ohne JS bedienbar (details/summary)
          ================================================================= */}
      <section className="relative pb-28" aria-labelledby="faq-heading">
        <Ambient variant="close" />
        <div className="mx-auto max-w-3xl px-6 pt-16">
          <div className="reveal text-center">
            <Kicker>Häufige Fragen</Kicker>
            <h2 id="faq-heading" className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Ehrliche Antworten.
            </h2>
          </div>

          <div className="reveal-stagger mt-10 space-y-3">
            {FAQ.map((f) => (
              <details
                key={f.q}
                className="group rounded-2xl border border-border/60 bg-card/80 shadow-elevation-1 backdrop-blur-md transition-shadow duration-[var(--motion-duration-base)] ease-[var(--motion-ease)] open:shadow-elevation-2"
              >
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 px-6 py-4 font-semibold text-foreground [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <svg
                    aria-hidden="true"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    className="shrink-0 text-primary transition-transform duration-[var(--motion-duration-base)] ease-[var(--motion-ease)] group-open:rotate-180"
                  >
                    <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </summary>
                <p className="px-6 pb-5 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>

          {/* Abschluss: zurück zur einen Aktion */}
          <div className="reveal mt-16 text-center">
            <p className="text-lg font-semibold text-foreground">Bereit für den ersten Schritt?</p>
            <div className="mt-5 flex justify-center">
              <Link
                href="/fahrschulen"
                className="inline-flex min-h-12 items-center gap-2 rounded-full bg-accent px-8 py-3.5 text-base font-semibold text-accent-foreground shadow-elevation-2 transition-transform duration-[var(--motion-duration-base)] ease-[var(--motion-ease)] hover:scale-[1.03] active:scale-[0.97]"
              >
                Fahrschulen in deiner Nähe ansehen
                <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none">
                  <path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
