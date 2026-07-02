import type { Metadata } from "next";
import Link from "next/link";
import { DataBadge } from "@/components/school/data-badge";

/**
 * /fuer-fahrschulen — Informationsseite für Fahrschulen (SSR, indexierbar).
 * ----------------------------------------------------------------------------
 * Durchgehend Sie-Form. Inhalt bewusst schlank und wahrheitsgetreu: (1) der
 * Eintrag ist kostenlos gelistet, (2) Daten lassen sich korrigieren und
 * bestätigen (bestätigte Angaben — insbesondere Preise — tragen das grüne
 * Abzeichen; beide DataBadge-Zustände live gezeigt), (3) Stellenanzeigen
 * erscheinen in der Jobbörse, (4) Kontaktweg per E-Mail. KEINE Konditionen/
 * Preise/Provisionen, KEINE Zukunfts-Versprechen. Editorialer Kapitel-Stil.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Für Fahrschulen",
  description:
    "Ihr Eintrag auf onelane ist kostenlos gelistet. Prüfen, korrigieren und bestätigen Sie Ihre Angaben — bestätigte Daten tragen ein sichtbares Abzeichen.",
};

/** Mailto-Kontakt mit vorbefülltem Betreff „Fahrschule — Eintrag". */
const KONTAKT_MAILTO = "mailto:kontakt@onelane.de?subject=Fahrschule%20%E2%80%94%20Eintrag";

/** Kapitel-Zeile (zentriert): Hairlines beidseitig, Lime-Punkt als Marker. */
function Kicker({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center gap-4">
      <span aria-hidden="true" className="h-px w-10 bg-border" />
      <span aria-hidden="true" className="size-1.5 shrink-0 bg-accent" />
      <span className="shrink-0 font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
        {n} · {children}
      </span>
      <span aria-hidden="true" className="h-px w-10 bg-border" />
    </div>
  );
}

/** Kurz-FAQ — sichtbarer Text (details/summary, ohne JS bedienbar). */
const FAQ = [
  {
    q: "Was kostet der Eintrag?",
    a: "Nichts. Der Eintrag, Korrekturen und die Bestätigung Ihrer Angaben sind kostenlos.",
  },
  {
    q: "Woher stammen die Angaben über unsere Fahrschule?",
    a: "Aus öffentlich zugänglichen Quellen und Ihrer Website. Bis zu Ihrer Bestätigung sind sie sichtbar als „recherchiert · ohne Gewähr“ gekennzeichnet.",
  },
  {
    q: "Wie ändern wir unsere Angaben?",
    a: "Per E-Mail an kontakt@onelane.de. Wir prüfen Ihre Änderungen und übernehmen sie — bestätigte Angaben erhalten das grüne Abzeichen.",
  },
] as const;

export default function FuerFahrschulenPage() {
  return (
    <div className="bg-background text-foreground">
      <div className="mx-auto w-full max-w-3xl px-6 pb-24 pt-16 sm:pt-24">
        {/* ================= Kopf ================= */}
        <header className="text-center">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
            onelane · Für Fahrschulen
          </p>
          <h1 className="mt-6 text-4xl font-light tracking-tight text-balance sm:text-6xl">
            Ihr Eintrag ist <span className="font-semibold">kostenlos.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl leading-relaxed text-muted-foreground">
            onelane listet Fahrschulen mit sorgfältig recherchierten Angaben aus öffentlich
            zugänglichen Quellen. Hier lesen Sie, wie Sie Ihre Daten prüfen, korrigieren und
            bestätigen — und wie Sie uns erreichen.
          </p>
        </header>

        {/* ================= 01 · Ihr Eintrag ================= */}
        <section aria-labelledby="eintrag-heading" className="mt-20 sm:mt-24">
          <Kicker n="01">Ihr Eintrag</Kicker>
          <h2 id="eintrag-heading" className="mt-8 text-center text-3xl font-light tracking-tight sm:text-4xl">
            Vermutlich sind Sie <span className="font-semibold">schon gelistet.</span>
          </h2>
          <div className="mt-10 space-y-6 leading-relaxed text-muted-foreground">
            <p>
              Ihre Fahrschule ist wahrscheinlich bereits mit recherchierten Angaben auf onelane
              vertreten — kostenlos. Bis Sie Ihre Daten bestätigt haben, sind alle Angaben für
              Fahrschülerinnen und Fahrschüler sichtbar als recherchiert und ohne Gewähr
              gekennzeichnet.
            </p>
            <p>
              Sie finden Ihren Eintrag über die{" "}
              <Link href="/fahrschulen" className="font-medium text-primary underline-offset-4 hover:underline">
                Fahrschulsuche
              </Link>
              .
            </p>
          </div>
        </section>

        {/* ================= 02 · Korrigieren & bestätigen ================= */}
        <section aria-labelledby="bestaetigen-heading" className="mt-20 border-t border-border pt-16 sm:mt-24">
          <Kicker n="02">Korrigieren &amp; bestätigen</Kicker>
          <h2 id="bestaetigen-heading" className="mt-8 text-center text-3xl font-light tracking-tight sm:text-4xl">
            Bestätigte Angaben tragen das <span className="font-semibold">grüne Abzeichen.</span>
          </h2>
          <p className="mt-10 leading-relaxed text-muted-foreground">
            Jede Angabe auf Ihrem Profil trägt eine sichtbare Kennzeichnung — in genau zwei
            Zuständen:
          </p>
          <ul className="mt-8 space-y-8">
            <li className="border-t border-border pt-6">
              <DataBadge status="recherchiert" />
              <p className="mt-3 leading-relaxed text-muted-foreground">
                So startet Ihr Eintrag: Angaben aus öffentlich zugänglichen Quellen und Ihrer
                Website.
              </p>
            </li>
            <li className="border-t border-border pt-6">
              <DataBadge status="bestaetigt" />
              <p className="mt-3 leading-relaxed text-muted-foreground">
                Nach Ihrer Prüfung und Bestätigung: Bestätigte Angaben — insbesondere bestätigte
                Preise — erhalten das grüne Abzeichen und schaffen Vertrauen bei
                Fahrschülerinnen und Fahrschülern.
              </p>
            </li>
          </ul>
        </section>

        {/* ================= 03 · Stellenanzeigen ================= */}
        <section aria-labelledby="jobs-heading" className="mt-20 border-t border-border pt-16 sm:mt-24">
          <Kicker n="03">Stellenanzeigen</Kicker>
          <h2 id="jobs-heading" className="mt-8 text-center text-3xl font-light tracking-tight sm:text-4xl">
            Sie suchen <span className="font-semibold">Verstärkung?</span>
          </h2>
          <p className="mt-10 leading-relaxed text-muted-foreground">
            Stellenanzeigen von Fahrschulen erscheinen in unserer Jobbörse — dort, wo
            Fahrlehrerinnen, Fahrlehrer und Quereinsteiger ohnehin nach Fahrschulen suchen.
            Melden Sie sich, wenn Sie eine Stelle veröffentlichen möchten.
          </p>
        </section>

        {/* ================= 04 · Kontakt ================= */}
        <section aria-labelledby="kontakt-heading" className="mt-20 border-t border-border pt-16 sm:mt-24">
          <Kicker n="04">Kontakt</Kicker>
          <h2 id="kontakt-heading" className="mt-8 text-center text-3xl font-light tracking-tight sm:text-4xl">
            Ein Weg genügt: <span className="font-semibold">eine E-Mail.</span>
          </h2>
          <p className="mt-10 leading-relaxed text-muted-foreground">
            Ob Korrektur, Bestätigung Ihrer Angaben oder Stellenanzeige — schreiben Sie uns.
            Wir melden uns bei Ihnen.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <a
              href={KONTAKT_MAILTO}
              className="inline-flex min-h-12 items-center gap-2 rounded-full bg-primary px-7 py-3 text-base font-semibold text-primary-foreground transition-transform duration-[var(--motion-duration-fast)] ease-[var(--motion-ease)] motion-safe:hover:scale-[1.02] motion-safe:active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Kontakt aufnehmen
            </a>
            <span className="text-sm text-muted-foreground">
              kontakt@onelane.de · Betreff „Fahrschule — Eintrag“
            </span>
          </div>
        </section>

        {/* ================= Kurz-FAQ ================= */}
        <section aria-labelledby="faq-heading" className="mt-20 border-t border-border pt-16 sm:mt-24">
          <Kicker n="05">Kurz gefragt</Kicker>
          <h2 id="faq-heading" className="mt-8 text-center text-3xl font-light tracking-tight sm:text-4xl">
            Drei Fragen, <span className="font-semibold">drei Antworten.</span>
          </h2>
          <div className="mt-10">
            {FAQ.map((f) => (
              <details key={f.q} className="group border-t border-border last:border-b">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-6 py-6 text-lg font-medium tracking-tight [&::-webkit-details-marker]:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-md">
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
                <p className="max-w-2xl pb-8 leading-relaxed text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
