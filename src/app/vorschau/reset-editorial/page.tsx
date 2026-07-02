import type { Metadata } from "next";
import Link from "next/link";
import { SearchBar } from "@/components/search/search-bar";
import { RevealOnScroll } from "@/components/home/reveal";
import { DataBadge } from "@/components/school/data-badge";

/**
 * VORSCHAU „Reset Editorial" — Startseiten-Prototyp mit These „Editoriale
 * Klarheit": Typografie trägt alles. Magazinartiges Display-Layout (extreme
 * Gewichts-Kontraste font-light ↔ font-semibold), fast monochrom (Ink auf
 * Weiß), EIN Akzent chirurgisch (primary = Aktion, Lime nur als Marker).
 * Struktur durch Weißraum + feine Linien statt Karten-Flut. SSR, ohne externe
 * Assets, alle Zahlenaussagen vermieden (inhaltliche Ehrlichkeit, §32 FahrlG:
 * Kosten nur als Bestandteile, keine Beträge). `noindex`.
 */
export const metadata: Metadata = {
  title: "Vorschau — Reset Editorial",
  robots: { index: false, follow: false },
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
    title: "Direkt anfragen",
    text: "Nimm ohne Umweg Kontakt zu deiner Wunsch-Fahrschule auf. Ohne Konto, ohne Verpflichtung — der Vertrag entsteht bei der Fahrschule.",
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

const CITIES = [
  "Berlin",
  "Hamburg",
  "Köln",
  "Frankfurt am Main",
  "Stuttgart",
  "Düsseldorf",
  "Leipzig",
  "Nürnberg",
] as const;

const FAQ = [
  {
    q: "Woher stammen die Daten über die Fahrschulen?",
    a: "Aus öffentlich zugänglichen Quellen und den Websites der Fahrschulen — sorgfältig recherchiert und entsprechend gekennzeichnet. Jede Fahrschule kann ihre Angaben kostenlos korrigieren und bestätigen; erst dann tragen sie das Bestätigt-Zeichen.",
  },
  {
    q: "Was kostet onelane für Fahrschüler?",
    a: "Nichts. Suchen, vergleichen und anfragen ist kostenlos — und du brauchst dafür kein Konto.",
  },
  {
    q: "Wie verdient onelane dann Geld?",
    a: "Über Leistungen für Fahrschulen. Wichtig dabei: Die Sortierung der Suchergebnisse bleibt davon unbeeinflusst — Reihenfolge ist keine Werbefläche.",
  },
  {
    q: "Warum zeigt ihr keine Gesamtpreise an?",
    a: "Weil es keinen seriösen Gesamtpreis vorab gibt: Wie viele Fahrstunden du brauchst, hängt von dir ab. Fahrschulen weisen ihre Preise gesetzlich nach Bestandteilen aus — genau so zeigen wir sie, statt mit Pauschalen zu werben.",
  },
  {
    q: "Muss ich mich registrieren?",
    a: "Nein. Die Suche funktioniert ohne Konto, ohne Cookies-Banner und ohne Tracking-Profile. Du gibst nur an, was für deine Anfrage nötig ist.",
  },
] as const;

/* ---------------------------------------------------------------------------
 * Editoriale Hilfskomponenten (server-tauglich, nur Typografie + Linien)
 * ------------------------------------------------------------------------ */

/** Kapitel-Zeile: Lime-Punkt als Marker, Nummer + Label, auslaufende Linie. */
function Kicker({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4">
      <span aria-hidden className="size-1.5 shrink-0 bg-accent" />
      <span className="shrink-0 font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
        {n} · {children}
      </span>
      <span aria-hidden className="h-px flex-1 bg-border" />
    </div>
  );
}

/** Textlink mit animierter Unterstreichung (nur transform, reduced-motion-fest). */
function EditorialLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="group inline-flex min-h-11 items-center gap-2 text-base font-medium text-primary"
    >
      <span className="relative">
        {children}
        <span
          aria-hidden
          className="absolute -bottom-0.5 left-0 h-px w-full origin-left scale-x-0 bg-primary transition-transform duration-[var(--motion-duration-base)] ease-[var(--motion-ease)] group-hover:scale-x-100 group-focus-visible:scale-x-100 motion-reduce:transition-none"
        />
      </span>
      <span
        aria-hidden
        className="transition-transform duration-[var(--motion-duration-base)] ease-[var(--motion-ease)] group-hover:translate-x-1 motion-reduce:transition-none"
      >
        →
      </span>
    </Link>
  );
}

/** Handgesetzte Lime-Unterstreichung für EIN Akzentwort in der Headline. */
function AccentStroke() {
  return (
    <svg
      aria-hidden
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

/* ---------------------------------------------------------------------------
 * Seite
 * ------------------------------------------------------------------------ */

export default function ResetEditorialPage() {
  return (
    <div className="bg-background text-foreground">
      <div className="mx-auto w-full max-w-6xl px-6">
        <p className="pt-4 text-right">
          <Link
            href="/vorschau"
            className="inline-flex min-h-11 items-center text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            ← Vorschauen
          </Link>
        </p>

        {/* ================= HERO — die Suche als Frage ================= */}
        <section aria-labelledby="hero-heading" className="pb-24 pt-14 sm:pb-32 sm:pt-24">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
            onelane · Fahrschulvergleich
          </p>
          <h1
            id="hero-heading"
            className="mt-8 max-w-5xl text-5xl font-light leading-[1.04] tracking-tight sm:text-7xl lg:text-8xl"
          >
            Welche Fahrschule
            <br />
            <span className="relative inline-block font-semibold">
              passt zu dir
              <AccentStroke />
            </span>
            <span className="text-muted-foreground">?</span>
          </h1>
          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
            Deine Antwort beginnt mit deinem Ort. onelane zeigt dir Fahrschulen in deiner Nähe —
            mit <span className="font-semibold text-foreground">transparenten Preisbestandteilen</span> statt
            Lockangeboten.
          </p>

          <div className="mt-10">
            <SearchBar />
          </div>

          {/* Wahre Trust-Zeile — drei Fakten, feine Trenner, keine Zahlen. */}
          <ul className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-border pt-6 text-sm text-muted-foreground">
            {["unabhängig", "für Fahrschüler kostenlos", "ohne Konto"].map((t) => (
              <li key={t} className="flex items-center gap-2.5">
                <span aria-hidden className="size-1 bg-accent" />
                {t}
              </li>
            ))}
          </ul>
        </section>

        {/* ================= 01 · SO FUNKTIONIERT'S ================= */}
        <section aria-labelledby="steps-heading" className="border-t border-border py-24 sm:py-28">
          <div className="reveal">
            <Kicker n="01">So funktioniert’s</Kicker>
            <h2
              id="steps-heading"
              className="mt-8 max-w-3xl text-4xl font-light tracking-tight sm:text-5xl"
            >
              Drei Schritte. <span className="font-semibold">Kein Kleingedrucktes.</span>
            </h2>
          </div>
          <ol className="reveal-stagger mt-14 grid gap-12 sm:grid-cols-3 sm:gap-10">
            {STEPS.map((s) => (
              <li key={s.n} className="border-t border-border pt-6">
                <span aria-hidden className="block text-6xl font-light tabular-nums text-muted-foreground/50 sm:text-7xl">
                  {s.n}
                </span>
                <h3 className="mt-4 text-xl font-semibold tracking-tight">{s.title}</h3>
                <p className="mt-3 leading-relaxed text-muted-foreground">{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ================= 02 · WAS KOSTET DER FÜHRERSCHEIN ================= */}
        <section aria-labelledby="cost-heading" className="border-t border-border py-24 sm:py-28">
          <div className="reveal">
            <Kicker n="02">Kosten verstehen</Kicker>
            <h2
              id="cost-heading"
              className="mt-8 max-w-3xl text-4xl font-light tracking-tight sm:text-5xl"
            >
              Was kostet der Führerschein? <span className="font-semibold">Fünf Bestandteile.</span>
            </h2>
            <p className="mt-6 max-w-2xl leading-relaxed text-muted-foreground">
              Einen ehrlichen Gesamtpreis gibt es vorab nicht — wie viele Fahrstunden du brauchst,
              hängt von dir ab. Fahrschulen weisen ihre Preise deshalb nach Bestandteilen aus.
              Diese fünf solltest du kennen:
            </p>
          </div>

          {/* Typografisches Preis-Register: Zeilen mit feinen Linien, keine Beträge. */}
          <dl className="reveal mt-14">
            {COST_PARTS.map((c) => (
              <div
                key={c.n}
                className="grid gap-2 border-t border-border py-7 sm:grid-cols-[4rem_1fr_14rem] sm:gap-8"
              >
                <span aria-hidden className="text-4xl font-light tabular-nums text-muted-foreground/40">
                  {c.n}
                </span>
                <div>
                  <dt className="text-xl font-semibold tracking-tight">{c.title}</dt>
                  <dd className="mt-2 max-w-xl leading-relaxed text-muted-foreground">{c.text}</dd>
                </div>
                <span className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground sm:justify-self-end sm:pt-2 sm:text-right">
                  {c.unit}
                </span>
              </div>
            ))}
          </dl>

          <p className="reveal mt-10 max-w-2xl border-l-2 border-accent pl-6 leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground">Dazu kommen amtliche Gebühren</span> — für
            die Prüforganisation (z.&nbsp;B. TÜV oder DEKRA) und die Führerscheinbehörde. Sie sind
            gesetzlich festgelegt und kein Teil des Fahrschulpreises.
          </p>
        </section>

        {/* ================= 03 · SO SORTIEREN WIR ================= */}
        <section aria-labelledby="sort-heading" className="border-t border-border py-24 sm:py-28">
          <div className="reveal">
            <Kicker n="03">Transparenz</Kicker>
            <h2
              id="sort-heading"
              className="mt-8 max-w-3xl text-4xl font-light tracking-tight sm:text-5xl"
            >
              Sortiert nach <span className="font-semibold">Nähe.</span> Nicht nach Budget.
            </h2>
          </div>

          <div className="reveal-stagger mt-14 grid gap-12 lg:grid-cols-2 lg:gap-16">
            <div className="border-t border-border pt-6">
              <h3 className="text-xl font-semibold tracking-tight">Kein bezahltes Ranking</h3>
              <p className="mt-3 max-w-lg leading-relaxed text-muted-foreground">
                Die Reihenfolge deiner Suchergebnisse richtet sich nach der Distanz zu deinem
                Standort. Keine Fahrschule kann sich einen besseren Platz kaufen — die Reihenfolge
                ist keine Werbefläche.
              </p>
            </div>
            <div className="border-t border-border pt-6">
              <h3 className="text-xl font-semibold tracking-tight">Jede Angabe gekennzeichnet</h3>
              <p className="mt-3 max-w-lg leading-relaxed text-muted-foreground">
                Du siehst bei jeder Angabe, woher sie stammt und wie belastbar sie ist — in genau
                zwei Zuständen:
              </p>
              <ul className="mt-5 space-y-4">
                <li className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <DataBadge status="recherchiert" />
                  <span className="text-sm text-muted-foreground">So starten alle Einträge.</span>
                </li>
                <li className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <DataBadge status="bestaetigt" />
                  <span className="text-sm text-muted-foreground">
                    Erst wenn die Fahrschule ihre Daten geprüft hat.
                  </span>
                </li>
              </ul>
            </div>
          </div>

          <p className="reveal mt-12 max-w-2xl border-l-2 border-accent pl-6 leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground">Und Bewertungen?</span> Gekaufte Sterne
            wirst du hier nie sehen. Wir zeigen Bewertungen erst, wenn wir sie verifizieren können —
            dieses System bauen wir gerade.
          </p>
        </section>

        {/* ================= 04 · STÄDTE ================= */}
        <section aria-labelledby="cities-heading" className="border-t border-border py-24 sm:py-28">
          <div className="reveal">
            <Kicker n="04">Dein Einstieg</Kicker>
            <h2
              id="cities-heading"
              className="mt-8 text-4xl font-light tracking-tight sm:text-5xl"
            >
              Fahrschulen in <span className="font-semibold">ganz Deutschland.</span>
            </h2>
          </div>

          <div className="reveal mt-14">
            <Link
              href="/fahrschulen?ort=M%C3%BCnchen"
              className="group flex flex-wrap items-baseline gap-x-6 gap-y-2 border-t border-border py-8"
            >
              <span className="relative text-5xl font-light tracking-tight sm:text-7xl">
                München
                <span
                  aria-hidden
                  className="absolute -bottom-1 left-0 h-0.5 w-full origin-left scale-x-0 bg-foreground transition-transform duration-[var(--motion-duration-base)] ease-[var(--motion-ease)] group-hover:scale-x-100 group-focus-visible:scale-x-100 motion-reduce:transition-none"
                />
              </span>
              <span className="text-sm text-muted-foreground">
                Unser Start — Stadtteil für Stadtteil erschlossen
                <span aria-hidden className="ml-2 inline-block transition-transform duration-[var(--motion-duration-base)] ease-[var(--motion-ease)] group-hover:translate-x-1 motion-reduce:transition-none">→</span>
              </span>
            </Link>

            <ul className="flex flex-wrap items-baseline gap-x-10 gap-y-4 border-t border-border pt-8">
              {CITIES.map((c) => (
                <li key={c}>
                  <Link
                    href={`/fahrschulen?ort=${encodeURIComponent(c)}`}
                    className="group relative inline-flex min-h-11 items-center text-2xl font-light tracking-tight text-muted-foreground transition-colors duration-[var(--motion-duration-fast)] hover:text-foreground sm:text-3xl"
                  >
                    {c}
                    <span
                      aria-hidden
                      className="absolute bottom-1.5 left-0 h-px w-full origin-left scale-x-0 bg-foreground transition-transform duration-[var(--motion-duration-base)] ease-[var(--motion-ease)] group-hover:scale-x-100 group-focus-visible:scale-x-100 motion-reduce:transition-none"
                    />
                  </Link>
                </li>
              ))}
              <li>
                <span className="text-sm text-muted-foreground">… und viele weitere Orte über die Suche.</span>
              </li>
            </ul>
          </div>
        </section>

        {/* ================= 05 · ELTERN ================= */}
        <section aria-labelledby="parents-heading" className="border-t border-border py-24 sm:py-28">
          <div className="grid gap-12 lg:grid-cols-[1fr_1fr] lg:gap-16">
            <div className="reveal">
              <Kicker n="05">Unter 18?</Kicker>
              <h2
                id="parents-heading"
                className="mt-8 text-4xl font-light tracking-tight sm:text-5xl"
              >
                Deine Eltern sind <span className="font-semibold">mit an Bord.</span>
              </h2>
              <p className="mt-6 max-w-xl leading-relaxed text-muted-foreground">
                Wenn du minderjährig bist, gehört der Führerschein euch gemeinsam: Deine
                Sorgeberechtigten müssen dem Ausbildungsvertrag zustimmen — und meistens zahlen sie
                auch mit. Deshalb ist onelane so gebaut, dass ihr es gemeinsam nutzen könnt.
              </p>
            </div>
            <ul className="reveal-stagger space-y-8 lg:pt-24">
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
                  Wir fragen nur ab, was für eine Anfrage nötig ist — gerade bei Minderjährigen gilt:
                  so wenig Daten wie möglich.
                </p>
              </li>
            </ul>
          </div>
        </section>

        {/* ================= 06 · DATENSCHUTZ ================= */}
        <section aria-labelledby="privacy-heading" className="border-t border-border py-24 sm:py-28">
          <div className="reveal">
            <Kicker n="06">Datenschutz</Kicker>
            <h2
              id="privacy-heading"
              className="mt-8 max-w-3xl text-4xl font-light tracking-tight sm:text-5xl"
            >
              Vergleichen, <span className="font-semibold">ohne beobachtet zu werden.</span>
            </h2>
          </div>
          <div className="reveal-stagger mt-14 grid gap-12 sm:grid-cols-3 sm:gap-10">
            <div className="border-t border-border pt-6">
              <h3 className="font-semibold tracking-tight">Karten ohne Google</h3>
              <p className="mt-3 leading-relaxed text-muted-foreground">
                Unsere Karten basieren auf OpenStreetMap — kein Google-Tracking, keine
                Standortprofile bei Dritten.
              </p>
            </div>
            <div className="border-t border-border pt-6">
              <h3 className="font-semibold tracking-tight">Hosting in Deutschland</h3>
              <p className="mt-3 leading-relaxed text-muted-foreground">
                Diese Seite läuft auf Servern in Deutschland — deine Suche verlässt die EU nicht.
              </p>
            </div>
            <div className="border-t border-border pt-6">
              <h3 className="font-semibold tracking-tight">Kein Cookie-Banner nötig</h3>
              <p className="mt-3 leading-relaxed text-muted-foreground">
                Wir setzen keine Tracking-Cookies. Deshalb begrüßt dich hier ein Suchfeld — kein
                Zustimmungs-Dialog.
              </p>
            </div>
          </div>
        </section>

        {/* ================= 07 · AUSBLICK 2027 ================= */}
        <section aria-labelledby="reform-heading" className="border-t border-border py-24 sm:py-28">
          <div className="reveal">
            <Kicker n="07">Ausblick · 2027</Kicker>
            <h2 id="reform-heading" className="sr-only">
              Geplante Gesetzesreform 2027
            </h2>
            <p className="mt-10 max-w-4xl text-3xl font-light leading-snug tracking-tight sm:text-4xl">
              Eine geplante Gesetzesreform soll Preise und praktische Bestehensquoten von
              Fahrschulen <span className="font-semibold">öffentlich machen</span>. Sobald diese
              amtlichen Daten verfügbar sind, bereiten wir sie hier auf — vergleichbar und
              verständlich.
            </p>
            <p className="mt-8 text-sm text-muted-foreground">
              Bis dahin gilt: nur gekennzeichnete, nachvollziehbare Angaben. Keine Schätzungen.
            </p>
          </div>
        </section>

        {/* ================= 08 · JOBS ================= */}
        <section aria-labelledby="jobs-heading" className="border-t border-border py-24 sm:py-28">
          <div className="reveal">
            <Kicker n="08">Jobbörse</Kicker>
            <h2
              id="jobs-heading"
              className="mt-8 max-w-3xl text-4xl font-light tracking-tight sm:text-5xl"
            >
              Auf der <span className="font-semibold">anderen Seite</span> des Lenkrads.
            </h2>
          </div>
          <div className="reveal-stagger mt-14 grid gap-12 lg:grid-cols-2 lg:gap-16">
            <div className="border-t border-border pt-6">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Für Fahrlehrer:innen
              </p>
              <h3 className="mt-4 text-2xl font-light tracking-tight sm:text-3xl">
                Offene Stellen — <span className="font-semibold">direkt von Fahrschulen.</span>
              </h3>
              <p className="mt-4 max-w-lg leading-relaxed text-muted-foreground">
                Fahrschulen in ganz Deutschland suchen Verstärkung. Finde Stellen in deiner Region —
                ohne Umweg über Personalvermittler.
              </p>
              <div className="mt-6">
                <EditorialLink href="/jobs">Offene Stellen ansehen</EditorialLink>
              </div>
            </div>
            <div className="border-t border-border pt-6">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Für Quereinsteiger:innen
              </p>
              <h3 className="mt-4 text-2xl font-light tracking-tight sm:text-3xl">
                Fahrlehrer:in werden — <span className="font-semibold">Ausbildung inklusive.</span>
              </h3>
              <p className="mt-4 max-w-lg leading-relaxed text-muted-foreground">
                Viele Fahrschulen finanzieren die Fahrlehrer-Ausbildung, wenn du danach bei ihnen
                einsteigst. Ein Berufswechsel mit Perspektive — und mit Rückenwind.
              </p>
              <div className="mt-6">
                <EditorialLink href="/jobs/fahrlehrer-werden">Ausbildungswege entdecken</EditorialLink>
              </div>
            </div>
          </div>
        </section>

        {/* ================= 09 · FÜR FAHRSCHULEN (Sie-Form, Inverse-Band) ===== */}
        <section aria-labelledby="schools-heading" className="border-t border-border py-24 sm:py-28">
          <div className="reveal bg-foreground px-8 py-16 text-background sm:px-14 sm:py-20">
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-background/60">
              09 · Für Fahrschulen
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
                className="inline-flex min-h-12 items-center gap-2 bg-accent px-7 py-3 font-semibold text-accent-foreground transition-transform duration-[var(--motion-duration-fast)] ease-[var(--motion-ease)] motion-safe:hover:-translate-y-0.5 motion-safe:active:translate-y-0"
              >
                Eintrag prüfen und bestätigen
                <span aria-hidden>→</span>
              </Link>
            </div>
          </div>
        </section>

        {/* ================= 10 · FAQ ================= */}
        <section aria-labelledby="faq-heading" className="border-t border-border py-24 sm:py-32">
          <div className="reveal">
            <Kicker n="10">Häufige Fragen</Kicker>
            <h2
              id="faq-heading"
              className="mt-8 text-4xl font-light tracking-tight sm:text-5xl"
            >
              Ehrliche Antworten, <span className="font-semibold">bevor du fragst.</span>
            </h2>
          </div>
          <div className="reveal mt-14 max-w-3xl">
            {FAQ.map((f) => (
              <details key={f.q} className="group border-t border-border last:border-b">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-6 py-6 text-lg font-medium tracking-tight [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <svg
                    aria-hidden
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
                <p className="max-w-2xl pb-8 leading-relaxed text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
          <p className="reveal mt-16 text-sm text-muted-foreground">
            Noch offen? Fang einfach mit deinem Ort an —{" "}
            <Link
              href="/fahrschulen"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              zur Fahrschulsuche
            </Link>
            .
          </p>
        </section>
      </div>

      {/* Scroll-Reveal-Insel (fail-safe: ohne JS bleibt alles sichtbar). */}
      <RevealOnScroll />
    </div>
  );
}
