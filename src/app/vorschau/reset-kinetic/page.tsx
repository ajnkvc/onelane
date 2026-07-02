import type { Metadata } from "next";
import Link from "next/link";
import { SearchBar } from "@/components/search/search-bar";
import { RevealOnScroll } from "@/components/home/reveal";
import { DataBadge } from "@/components/school/data-badge";
import { Wordmark } from "@/components/ui/wordmark";

/**
 * VORSCHAU „reset-kinetic" — Kinetischer Minimalismus.
 * ----------------------------------------------------------------------------
 * These: Radikal reduziert — jede Sektion EIN Gedanke, EIN visuelles Element.
 * Die Suche ist eine Command-Bar-artige Bühne und dominiert den Viewport.
 * Bewegung ist das Gestaltungsmittel: choreografierte Staffel-Reveals
 * (RevealOnScroll + .reveal/.reveal-stagger aus globals.css), eine Fahrbahn
 * als Inline-SVG, die sich beim Scrollen zeichnet (stroke-dashoffset per CSS,
 * nur aktiv wenn JS + Motion erlaubt — ohne JS/bei reduced-motion vollständig
 * sichtbar), federnde Chip-Micro-Interactions (nur transform, motion-safe).
 * Farbfläche: Weiß + Ink, Sky als einziger aktiver Ton, Lime AUSSCHLIESSLICH
 * für den Bestätigt-Badge-Moment. SSR, keine externen Assets, nur Token-Farben.
 * Inhaltlich ehrlich: keine erfundenen Zahlen, keine Pauschal-/„ab"-Preise,
 * Kosten nur als Komponenten (§ 32 FahrlG), Demo-Werte sichtbar markiert.
 */
export const metadata: Metadata = {
  title: "Vorschau — reset-kinetic",
  robots: { index: false, follow: false },
};

/* ============================== Bausteine ================================= */

/** Nummerierter Sektions-Kopf — EIN Gedanke pro Sektion, immer gleiche Anatomie. */
function SectionHead({
  no,
  kicker,
  title,
  lead,
  id,
}: {
  no: string;
  kicker: string;
  title: string;
  lead?: string;
  id?: string;
}) {
  return (
    <div className="reveal flex max-w-2xl flex-col gap-4">
      <p className="flex items-baseline gap-3 font-mono text-xs tracking-[0.2em] text-primary uppercase">
        <span aria-hidden="true">{no}</span>
        {kicker}
      </p>
      <h2 id={id} className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{title}</h2>
      {lead ? <p className="text-base leading-relaxed text-muted-foreground sm:text-lg">{lead}</p> : null}
    </div>
  );
}

/** Kleines „Demo"-Etikett für illustrative Werte (rechtlich: nichts Erfundenes als echt ausgeben). */
function DemoTag() {
  return (
    <span className="inline-flex items-center rounded-full border border-border px-2 py-0.5 font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
      Demo
    </span>
  );
}

/** Pfeil-Glyphe für Links (rein dekorativ). */
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

/** Einheitlicher Fokus-Stil (WCAG 2.2: sichtbarer Fokus) für alle Interaktiven. */
const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/** Text-Link mit Pfeil, ≥44px Touch-Ziel. */
function ArrowLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`group inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary underline-offset-4 hover:underline ${focusRing} rounded-md`}
    >
      {children}
      <Arrow />
    </Link>
  );
}

/* ------------------------- Fahrbahn (Signatur-SVG) ------------------------ */
/**
 * Die Fahrbahn zeichnet sich beim Scrollen: Basis-Spur in Border-Grau, darüber
 * die Sky-Linie mit pathLength=1 und stroke-dashoffset 1→0. Der versteckte
 * Startzustand gilt NUR bei aktivem JS-Reveal (html.reveal-on) — ohne JS oder
 * bei prefers-reduced-motion ist die Linie sofort vollständig da (kein CLS,
 * nichts geht verloren). Übergang ausschließlich motion-safe.
 */
const ROAD_D = "M20 100 H200 C340 100 460 40 600 40 C740 40 860 100 1000 100 H1180";

function RoadDraw() {
  return (
    <svg
      viewBox="0 0 1200 140"
      className="hidden w-full md:block"
      aria-hidden="true"
      focusable="false"
    >
      {/* Basis-Spur (Straße) */}
      <path d={ROAD_D} className="text-border" stroke="currentColor" strokeWidth="10" strokeLinecap="round" fill="none" />
      {/* Mittellinie (gestrichelt, statisch — ruhige Textur, keine Ablenkung) */}
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
      {/* Drei Stationen — exakt auf der Route, unter ihnen stehen die Schritte */}
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

/* ================================ Seite =================================== */

const STAEDTE = ["Berlin", "Hamburg", "Köln", "Frankfurt am Main", "Stuttgart", "Düsseldorf", "Leipzig", "Nürnberg"];

const KOSTEN_BAUSTEINE = [
  {
    n: "1",
    t: "Grundbetrag",
    d: "Einmalig — deckt Anmeldung, Verwaltung und den Theorieunterricht deiner Fahrschule.",
    w: "md:basis-[24%]",
    tone: "bg-brand-sky/15",
  },
  {
    n: "2",
    t: "Übungsfahrten",
    d: "Je Fahrstunde à 45 Minuten. Wie viele du brauchst, hängt von dir ab — deshalb gibt es keinen seriösen Gesamtpreis vorab.",
    w: "md:basis-[30%]",
    tone: "bg-brand-sky/30",
  },
  {
    n: "3",
    t: "Sonderfahrten",
    d: "Überland, Autobahn, Nachtfahrt — gesetzlich vorgeschrieben, mit eigenem Satz je Fahrtart.",
    w: "md:basis-[22%]",
    tone: "bg-brand-sky/50",
  },
  {
    n: "4",
    t: "Vorstellung zur Theorieprüfung",
    d: "Das Entgelt der Fahrschule dafür, dich zur theoretischen Prüfung vorzustellen.",
    w: "md:basis-[11%]",
    tone: "bg-brand-sky/70",
  },
  {
    n: "5",
    t: "Vorstellung zur praktischen Prüfung",
    d: "Das Entgelt der Fahrschule für die Vorstellung zur praktischen Prüfung.",
    w: "md:basis-[13%]",
    tone: "bg-brand-sky",
  },
];

const FAQ = [
  {
    q: "Woher stammen die Daten?",
    a: "Aus öffentlichen Quellen und den Websites der Fahrschulen — sorgfältig recherchiert und klar gekennzeichnet: „recherchiert · ohne Gewähr“, bis die Fahrschule ihre Angaben selbst bestätigt hat. Erst dann erscheint das grüne Abzeichen.",
  },
  {
    q: "Was kostet mich onelane?",
    a: "Nichts. Suchen, vergleichen und anfragen ist für Fahrschüler:innen kostenlos — und funktioniert ohne Konto.",
  },
  {
    q: "Wie verdient onelane dann Geld?",
    a: "Über Leistungen für Fahrschulen. Wichtig dabei: Die Reihenfolge der Suchergebnisse bleibt davon unbeeinflusst — sortiert wird nach Distanz zu dir, nicht nach Bezahlung.",
  },
  {
    q: "Sind die angezeigten Angaben verbindlich?",
    a: "Nein. Verbindlich ist immer erst der Ausbildungsvertrag mit deiner Fahrschule. Wir zeigen dir die Kostenbausteine und den Stand der Angaben — entscheiden und abschließen tust du direkt bei der Schule.",
  },
  {
    q: "Kann ich hier direkt buchen oder bezahlen?",
    a: "Nein — und das ist Absicht. Du fragst direkt bei der Fahrschule an, ohne Umweg über uns. Kein Konto, keine Zwischenschritte, keine versteckten Gebühren.",
  },
];

export default function VorschauResetKinetic() {
  return (
    <div className="bg-background text-foreground">
      <RevealOnScroll />

      {/* ============================ 00 · HERO ============================ */}
      {/* EIN Gedanke: die Suche. Command-Bar-Bühne, dominiert den Viewport. */}
      <section aria-labelledby="hero-title" className="relative">
        <div className="mx-auto flex min-h-[calc(100svh-10rem)] w-full max-w-3xl flex-col items-center justify-center gap-10 px-6 py-24 text-center">
          <p className="reveal font-mono text-xs tracking-[0.2em] text-primary uppercase">
            Fahrschulvergleich, neu gedacht
          </p>

          {/* Wörter rasten nacheinander ein (Staffel-Reveal, reduced-motion-sicher) */}
          <h1 id="hero-title" className="reveal-stagger text-5xl font-bold tracking-tight text-balance sm:text-7xl">
            <span className="inline-block">Suchen.</span>{" "}
            <span className="inline-block">Verstehen.</span>{" "}
            <span className="inline-block text-primary">Losfahren.</span>
          </h1>

          <p className="reveal max-w-xl text-lg leading-relaxed text-muted-foreground">
            Fahrschulen in deiner Nähe, Kosten ehrlich als Bausteine erklärt — und du fragst direkt an. Mehr braucht es
            nicht.
          </p>

          {/* Die Bühne: Suche + Klassen-Schnellwahl (Chips in der SearchBar) */}
          <div id="suche" className="reveal flex w-full scroll-mt-28 justify-center">
            <SearchBar />
          </div>

          {/* Wahre Trust-Zeile — keine erfundenen Zahlen */}
          <p className="reveal text-sm text-muted-foreground">
            unabhängig <span aria-hidden="true">·</span> für Fahrschüler kostenlos <span aria-hidden="true">·</span> ohne
            Konto
          </p>

          <div aria-hidden="true" className="reveal mt-2 text-muted-foreground motion-safe:animate-bounce">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14m-6-6 6 6 6-6" />
            </svg>
          </div>
        </div>
      </section>

      {/* ===================== 01 · SO FUNKTIONIERT’S ===================== */}
      {/* EIN Visual: die Fahrbahn, die sich beim Scrollen zeichnet. */}
      <section aria-labelledby="s1-title" className="border-t border-border">
        <div className="mx-auto w-full max-w-5xl px-6 py-24 sm:py-32">
          <SectionHead
            id="s1-title"
            no="01"
            kicker="So funktioniert’s"
            title="Drei Schritte. Kein Kleingedrucktes."
            lead="Kein Konto, keine Buchungsstrecke, kein Haken — du bleibst in der Hand, die Fahrschule auch."
          />

          {/* Fahrbahn (Desktop) — die drei Stationen stehen exakt über den Schritten */}
          <div className="reveal mt-14">
            <RoadDraw />
          </div>

          <ol className="reveal-stagger mt-4 grid gap-10 md:grid-cols-3 md:gap-8">
            {[
              {
                n: "01",
                t: "Suchen",
                d: "Ort oder Adresse eingeben — du siehst Fahrschulen in deiner Nähe, sortiert nach Distanz.",
              },
              {
                n: "02",
                t: "Vergleichen",
                d: "Leistungen, Kostenbausteine und den Stand jeder Angabe nebeneinander — in Ruhe, ohne Druck.",
              },
              {
                n: "03",
                t: "Direkt anfragen",
                d: "Deine Anfrage geht direkt an die Fahrschule. Alles Weitere klärt ihr miteinander.",
              },
            ].map((s) => (
              <li key={s.n} className="border-l-2 border-brand-sky/30 pl-5 md:border-l-0 md:pl-0 md:text-center">
                <p className="font-mono text-xs tracking-[0.2em] text-primary">{s.n}</p>
                <h3 className="mt-2 text-xl font-semibold">{s.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground md:mx-auto md:max-w-[26ch]">{s.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ================== 02 · WAS KOSTET DER FÜHRERSCHEIN? ============== */}
      {/* EIN Visual: die Bausteine-Leiste (schematisch, bewusst OHNE Beträge). */}
      <section aria-labelledby="s2-title" className="border-t border-border">
        <div className="mx-auto w-full max-w-5xl px-6 py-24 sm:py-32">
          <SectionHead
            id="s2-title"
            no="02"
            kicker="Was kostet der Führerschein?"
            title="Kein Preis. Eine Summe aus Bausteinen."
            lead="Ein seriöser Gesamtpreis lässt sich vorab nicht versprechen — aber jeder Baustein lässt sich verstehen. Genau das zeigen wir dir, je Fahrschule und klar gekennzeichnet."
          />

          {/* Bausteine-Leiste — Breiten rein schematisch, keine Beträge */}
          <div className="reveal mt-14" role="img" aria-label="Schematische Aufteilung der fünf Kostenbausteine einer Fahrschulausbildung, ohne Beträge">
            <div className="flex flex-col gap-1.5 md:flex-row">
              {KOSTEN_BAUSTEINE.map((k) => (
                <div
                  key={k.n}
                  className={`flex h-12 items-center rounded-lg px-3 ${k.tone} ${k.w} transition-transform duration-[var(--motion-duration-base)] ease-[var(--motion-ease)] motion-safe:hover:-translate-y-0.5`}
                >
                  <span className="font-mono text-xs font-semibold text-foreground">{k.n}</span>
                </div>
              ))}
              {/* Amtliche Gebühren: getrennt, gestrichelt — sie gehen NICHT an die Fahrschule */}
              <div className="flex h-12 items-center rounded-lg border-2 border-dashed border-border px-3 md:basis-[14%]">
                <span className="font-mono text-xs font-semibold text-muted-foreground">+</span>
              </div>
            </div>
            <p className="mt-3 font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
              Schematische Darstellung — Anteile variieren, bewusst ohne Beträge
            </p>
          </div>

          <dl className="reveal-stagger mt-12 grid gap-x-10 gap-y-8 sm:grid-cols-2">
            {KOSTEN_BAUSTEINE.map((k) => (
              <div key={k.n} className="flex flex-col">
                <dt className="flex flex-col">
                  <span className="font-mono text-xs tracking-[0.2em] text-primary">{k.n}</span>
                  <span className="mt-1 font-semibold">{k.t}</span>
                </dt>
                <dd className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{k.d}</dd>
              </div>
            ))}
            <div className="flex flex-col">
              <dt className="flex flex-col">
                <span className="font-mono text-xs tracking-[0.2em] text-muted-foreground">+</span>
                <span className="mt-1 font-semibold">Amtliche Prüfgebühren</span>
              </dt>
              <dd className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                Fallen zusätzlich an und gehen an die Prüforganisation (z.&nbsp;B. TÜV oder DEKRA) sowie die Behörde —
                nicht an die Fahrschule.
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {/* ======================= 03 · TRANSPARENZ ========================= */}
      {/* EIN Visual: die Demo-Ergebnisliste mit dem einzigen Lime-Moment. */}
      <section aria-labelledby="s3-title" className="border-t border-border">
        <div className="mx-auto w-full max-w-5xl px-6 py-24 sm:py-32">
          <div className="grid items-start gap-14 lg:grid-cols-2">
            <div className="flex flex-col gap-8">
              <SectionHead
                id="s3-title"
                no="03"
                kicker="Transparenz"
                title="Sortiert nach Distanz. Nicht nach Bezahlung."
                lead="Die Reihenfolge deiner Ergebnisse richtet sich nach der Entfernung zu dir. Kein bezahltes Ranking, keine gesponserten Plätze."
              />
              <div className="reveal flex flex-col gap-4 text-sm leading-relaxed text-muted-foreground">
                <p>
                  Jede Angabe trägt ihren Stand offen: <strong className="font-semibold text-foreground">recherchiert</strong>{" "}
                  heißt ohne Gewähr — <strong className="font-semibold text-foreground">bestätigt</strong> heißt, die
                  Fahrschule hat ihre Daten selbst geprüft und freigegeben.
                </p>
                <p>
                  Und Bewertungen? Zeigen wir erst, wenn sie verifiziert sind. Keine gekauften Sterne — dieses Feature
                  kommt später, dafür richtig.
                </p>
              </div>
            </div>

            {/* Demo-Ergebnisliste: abstrakte Zeilen (keine erfundenen Schulen), Distanzen als Demo markiert */}
            <div className="reveal rounded-2xl border border-border bg-card p-5 shadow-elevation-2">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <p className="text-sm font-semibold">Deine Ergebnisse</p>
                <DemoTag />
              </div>
              <ul className="reveal-stagger flex flex-col divide-y divide-border">
                {[
                  { km: "1,1 km", status: "bestaetigt" as const, w1: "w-36", w2: "w-24" },
                  { km: "2,4 km", status: "recherchiert" as const, w1: "w-44", w2: "w-28" },
                  { km: "3,9 km", status: "recherchiert" as const, w1: "w-32", w2: "w-20" },
                ].map((r, i) => (
                  <li key={i} className="flex flex-col gap-3 py-5">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full bg-brand-sky" />
                        {/* abstrakter Namens-Platzhalter statt erfundener Fahrschule */}
                        <span aria-hidden="true" className={`h-3 ${r.w1} rounded-full bg-secondary`} />
                      </div>
                      <span className="shrink-0 font-mono text-xs text-muted-foreground">{r.km}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4 pl-[1.375rem]">
                      <span aria-hidden="true" className={`h-2 ${r.w2} rounded-full bg-secondary`} />
                      <DataBadge status={r.status} />
                    </div>
                  </li>
                ))}
              </ul>
              <p className="border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
                Beispielhafte Darstellung. Distanzen und Platzhalter dienen nur der Illustration.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ======================== 04 · REFORM 2027 ======================== */}
      <section aria-labelledby="s4-title" className="border-t border-border">
        <div className="mx-auto w-full max-w-5xl px-6 py-24 sm:py-32">
          <SectionHead
            id="s4-title"
            no="04"
            kicker="Ausblick"
            title="Amtliche Daten, sobald es sie gibt."
            lead="Eine geplante Gesetzesreform soll Preise und praktische Bestehensquoten von Fahrschulen öffentlich machen. Sobald diese amtlichen Daten verfügbar sind, bereiten wir sie hier auf — vergleichbar, verständlich, mit Quelle."
          />
          <p className="reveal mt-6 text-sm text-muted-foreground">
            Bis dahin gilt: nur, was heute belegbar ist — klar gekennzeichnet.
          </p>
        </div>
      </section>

      {/* ====================== 05 · STADT-EINSTIEGE ====================== */}
      <section aria-labelledby="s5-title" className="border-t border-border">
        <div className="mx-auto w-full max-w-5xl px-6 py-24 sm:py-32">
          <SectionHead id="s5-title" no="05" kicker="Städte" title="Fang dort an, wo du bist." />

          <div className="mt-12 flex flex-col gap-8">
            {/* München — der Fokus, eine Kachel, ein Gedanke */}
            <Link
              href="/fahrschulen?ort=M%C3%BCnchen"
              className={`group reveal flex min-h-11 flex-col justify-between gap-6 rounded-2xl border border-border bg-card p-8 shadow-elevation-1 transition-[transform,box-shadow] duration-[var(--motion-duration-base)] ease-[var(--motion-ease)] motion-safe:hover:-translate-y-1 hover:shadow-elevation-2 sm:flex-row sm:items-end ${focusRing}`}
            >
              <div>
                <p className="font-mono text-xs tracking-[0.2em] text-primary uppercase">Start-Stadt</p>
                <p className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">München</p>
                <p className="mt-2 max-w-md text-sm text-muted-foreground">
                  Hier starten wir mit der dichtesten Abdeckung — vom Zentrum bis in die Stadtteile.
                </p>
              </div>
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
                Fahrschulen in München
                <Arrow />
              </span>
            </Link>

            {/* Weitere Städte — federnde Chips */}
            <ul className="reveal-stagger flex flex-wrap gap-2.5" aria-label="Weitere Städte">
              {STAEDTE.map((stadt) => (
                <li key={stadt}>
                  <Link
                    href={`/fahrschulen?ort=${encodeURIComponent(stadt)}`}
                    className={`inline-flex min-h-11 items-center rounded-full border border-border bg-card px-5 py-2.5 text-sm font-medium transition-[transform,border-color,color] duration-[var(--motion-duration-fast)] ease-[var(--motion-ease)] hover:border-brand-sky/60 hover:text-primary motion-safe:hover:-translate-y-0.5 motion-safe:hover:scale-[1.03] motion-safe:active:scale-[0.97] ${focusRing}`}
                  >
                    {stadt}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ========================= 06 · UNTER 18 ========================== */}
      <section aria-labelledby="s6-title" className="border-t border-border">
        <div className="mx-auto w-full max-w-5xl px-6 py-24 sm:py-32">
          <div className="grid items-center gap-14 lg:grid-cols-2">
            <SectionHead
              id="s6-title"
              no="06"
              kicker="Unter 18"
              title="Deine Eltern sind mit an Bord."
              lead="Wenn du minderjährig bist, gehören deine Eltern oder Sorgeberechtigten dazu — bei der Anmeldung zur Fahrschule sowieso. Deshalb binden wir sie bei deiner Anfrage von Anfang an mit ein."
            />
            {/* EIN Visual: zwei verbundene Punkte — du + Eltern, eine Linie */}
            <div className="reveal flex flex-col items-center gap-6">
              <svg viewBox="0 0 320 120" className="w-full max-w-xs" aria-hidden="true" focusable="false">
                <path d="M60 60 H260" className="text-border" stroke="currentColor" strokeWidth="2" strokeDasharray="6 8" fill="none" />
                <circle cx="60" cy="60" r="26" className="text-brand-sky/15" fill="currentColor" />
                <circle cx="60" cy="60" r="26" className="text-brand-sky" fill="none" stroke="currentColor" strokeWidth="2" />
                <circle cx="260" cy="60" r="26" className="text-brand-sky/15" fill="currentColor" />
                <circle cx="260" cy="60" r="26" className="text-brand-sky" fill="none" stroke="currentColor" strokeWidth="2" />
                <circle cx="160" cy="60" r="5" className="text-brand-sky" fill="currentColor" />
              </svg>
              <p className="max-w-sm text-center text-sm leading-relaxed text-muted-foreground">
                Und wir fragen nur ab, was für deine Anfrage wirklich nötig ist — Datenminimierung ist bei uns
                Grundeinstellung, kein Extra.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ======================== 07 · DATENSCHUTZ ======================== */}
      <section aria-labelledby="s7-title" className="border-t border-border">
        <div className="mx-auto w-full max-w-5xl px-6 py-24 sm:py-32">
          <SectionHead
            id="s7-title"
            no="07"
            kicker="Datenschutz"
            title="Vergleichen, ohne verglichen zu werden."
          />
          <ul className="reveal-stagger mt-12 grid gap-10 sm:grid-cols-3">
            {[
              {
                t: "Karten ohne Google",
                d: "Unsere Karten kommen von OpenStreetMap — ohne Google-Tracking im Hintergrund.",
                icon: (
                  <path d="M9 20 3 17V4l6 3m0 13 6-3m-6 3V7m6 10 6 3V7l-6-3m0 13V4M9 7l6-3" />
                ),
              },
              {
                t: "Gehostet in Deutschland",
                d: "Deine Anfragen laufen über Server in Deutschland — nicht über Dienste in Drittländern.",
                icon: (
                  <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
                ),
              },
              {
                t: "Ohne Tracking-Cookies",
                d: "Die Seite funktioniert ohne Tracking-Cookies — deshalb auch kein Cookie-Banner-Spießrutenlauf.",
                icon: (
                  <path d="M20 12a8 8 0 1 1-8-8c0 2 1 3 3 3 0 2 1 3 3 3 .7 0 1.4-.2 2 .2ZM9 10h.01M9.5 15h.01M14 14h.01" />
                ),
              },
            ].map((f) => (
              <li key={f.t} className="flex flex-col gap-3">
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className="text-brand-sky"
                >
                  {f.icon}
                </svg>
                <h3 className="font-semibold">{f.t}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{f.d}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ========================== 08 · JOBS ============================= */}
      <section aria-labelledby="s8-title" className="border-t border-border">
        <div className="mx-auto w-full max-w-5xl px-6 py-24 sm:py-32">
          <SectionHead
            id="s8-title"
            no="08"
            kicker="Jobs"
            title="Zwei Wege ans Steuer — beruflich."
          />
          <div className="reveal-stagger mt-12 grid gap-6 md:grid-cols-2">
            <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-8 shadow-elevation-1 transition-[transform,box-shadow] duration-[var(--motion-duration-base)] ease-[var(--motion-ease)] motion-safe:hover:-translate-y-1 hover:shadow-elevation-2">
              <p className="font-mono text-xs tracking-[0.2em] text-primary uppercase">Du bist Fahrlehrer:in</p>
              <h3 className="text-xl font-semibold">Offene Stellen in deiner Nähe</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Fahrschulen suchen Verstärkung — finde Stellenangebote direkt dort, wo du auch die Schulen vergleichst.
              </p>
              <div className="mt-auto pt-2">
                <ArrowLink href="/jobs">Stellen ansehen</ArrowLink>
              </div>
            </div>
            <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-8 shadow-elevation-1 transition-[transform,box-shadow] duration-[var(--motion-duration-base)] ease-[var(--motion-ease)] motion-safe:hover:-translate-y-1 hover:shadow-elevation-2">
              <p className="font-mono text-xs tracking-[0.2em] text-primary uppercase">Du willst es werden</p>
              <h3 className="text-xl font-semibold">Fahrlehrer:in werden</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Der Quereinstieg ist gefragt: Viele Fahrschulen finanzieren die Ausbildung zur Fahrlehrerin oder zum
                Fahrlehrer. Wir zeigen dir, wie der Weg aussieht.
              </p>
              <div className="mt-auto pt-2">
                <ArrowLink href="/jobs/fahrlehrer-werden">Ausbildung entdecken</ArrowLink>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ====================== 09 · FÜR FAHRSCHULEN ====================== */}
      {/* Sie-Form. Ruhig, sachlich — ein Gedanke: Der Eintrag ist kostenlos. */}
      <section aria-labelledby="s9-title" className="border-t border-border">
        <div className="mx-auto w-full max-w-5xl px-6 py-24 sm:py-32">
          <div className="grid items-start gap-10 lg:grid-cols-[1fr_auto]">
            <SectionHead
              id="s9-title"
              no="09"
              kicker="Für Fahrschulen"
              title="Ihr Eintrag ist kostenlos."
              lead="Ihre Fahrschule ist vermutlich schon gelistet. Prüfen Sie Ihre Daten, korrigieren Sie sie bei Bedarf — und bestätigen Sie sie. Bestätigte Angaben erhalten eine sichtbare Kennzeichnung, die Fahrschülern Sicherheit gibt."
            />
            <div className="reveal flex flex-col items-start gap-4 lg:pt-14">
              <DataBadge status="bestaetigt" />
              <ArrowLink href="/fahrschulen">Eintrag finden und prüfen</ArrowLink>
            </div>
          </div>
        </div>
      </section>

      {/* =========================== 10 · FAQ ============================= */}
      <section aria-labelledby="s10-title" className="border-t border-border">
        <div className="mx-auto w-full max-w-3xl px-6 py-24 sm:py-32">
          <SectionHead id="s10-title" no="10" kicker="Fragen" title="Kurz und ehrlich beantwortet." />
          <div className="reveal-stagger mt-12 flex flex-col divide-y divide-border border-y border-border">
            {FAQ.map((f) => (
              <details key={f.q} className="group">
                <summary
                  className={`flex min-h-11 cursor-pointer list-none items-center justify-between gap-6 py-5 text-left font-semibold [&::-webkit-details-marker]:hidden ${focusRing} rounded-md`}
                >
                  {f.q}
                  <svg
                    aria-hidden="true"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    className="shrink-0 text-primary transition-transform duration-[var(--motion-duration-base)] ease-[var(--motion-ease)] group-open:rotate-45"
                  >
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </summary>
                <p className="pb-6 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ========================= FINALE · SUCHE ========================= */}
      <section aria-labelledby="final-title" className="border-t border-border">
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-8 px-6 py-24 text-center sm:py-32">
          <h2 id="final-title" className="reveal text-3xl font-bold tracking-tight text-balance sm:text-5xl">
            Ein Ort. Eine Suche.
            <br />
            <span className="text-primary">Deine Fahrschule.</span>
          </h2>
          <div className="reveal flex flex-col items-center gap-4 sm:flex-row">
            <a
              href="#suche"
              className={`group inline-flex min-h-12 items-center gap-2 rounded-full bg-primary px-8 py-3 text-base font-semibold text-primary-foreground transition-transform duration-[var(--motion-duration-fast)] ease-[var(--motion-ease)] motion-safe:hover:scale-[1.03] motion-safe:active:scale-[0.97] ${focusRing}`}
            >
              Zur Suche
              <Arrow />
            </a>
            <Link
              href="/fahrschulen"
              className={`inline-flex min-h-12 items-center rounded-full border border-border px-8 py-3 text-base font-semibold transition-[transform,border-color] duration-[var(--motion-duration-fast)] ease-[var(--motion-ease)] hover:border-brand-sky/60 motion-safe:hover:scale-[1.03] motion-safe:active:scale-[0.97] ${focusRing}`}
            >
              Alle Fahrschulen
            </Link>
          </div>
          <p className="reveal text-sm text-muted-foreground">
            <Wordmark className="text-base" /> — unabhängig, für Fahrschüler kostenlos, ohne Konto.
          </p>
        </div>
      </section>
    </div>
  );
}
