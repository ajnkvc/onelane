import type { Metadata } from "next";
import Link from "next/link";

/**
 * /jobs/fahrlehrer-werden — KURZE Conversion-Seite für den Quereinstieg
 * (SSR, indexierbar). BEWUSST kein Ratgeber-Duplikat: Hook mit MOVING-Zahl
 * (Quelle + Stand, Zahl unverändert), drei kompakte Schritte in den Beruf,
 * Erklärung des Finanzierungs-Flags (erlaubtes Wording, keine Zusagen/
 * Bindungsdauern), Filter-CTA auf /jobs?quereinsteiger=1 und ein prominenter
 * Link auf den ausführlichen Ratgeber /ratgeber/fahrlehrer-werden.
 * Editorialer Kapitel-Stil (zentrierte Köpfe) wie /trust.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Fahrlehrer:in werden — der Quereinstieg",
  description:
    "Deutschland fehlen Fahrlehrer:innen. In drei Schritten zum Quereinstieg — und zu Fahrschulen, die die Ausbildung nach Vereinbarung mitfinanzieren.",
};

/** Einheitlicher Fokus-Stil (WCAG 2.2: sichtbarer Fokus) für alle Interaktiven. */
const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const SCHRITTE = [
  {
    n: "01",
    titel: "Voraussetzungen klären",
    text: "Mindestens 21 Jahre, Klasse B seit mindestens 3 Jahren, in der Regel eine abgeschlossene Berufsausbildung. Ob dein Einzelfall passt, klärt eine Fahrlehrer-Ausbildungsstätte mit dir.",
  },
  {
    n: "02",
    titel: "Ausbildung machen",
    text: "Eine geregelte Ausbildung an einer amtlich anerkannten Ausbildungsstätte plus Lehrpraktikum in einer Fahrschule — in Vollzeit meist rund ein Jahr.",
  },
  {
    n: "03",
    titel: "Fahrschule finden",
    text: "Viele Fahrschulen suchen dringend — manche schon während deiner Ausbildung. Auf unserer Jobbörse siehst du, wer Quereinsteiger:innen ausdrücklich willkommen heißt.",
  },
] as const;

export default function FahrlehrerWerdenPage() {
  return (
    <div className="bg-background text-foreground">
      <div className="mx-auto w-full max-w-3xl px-6 pb-24 pt-16 sm:pt-24">
        {/* ================= Hook: MOVING-Zahl mit Quelle ================= */}
        <header className="text-center">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
            Jobbörse · Quereinstieg
          </p>
          <h1 className="mt-6 text-4xl font-light tracking-tight text-balance sm:text-6xl">
            Deutschland fehlen über{" "}
            <span className="font-semibold">10.900 Fahrlehrer:innen.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl leading-relaxed text-muted-foreground">
            Vielleicht bist du eine:r davon — du weißt es nur noch nicht. Der Beruf ist ein
            klassischer Quereinstieg: klare Voraussetzungen, geregelte Ausbildung, gefragt wie
            selten. Hier ist der Weg in drei Schritten.
          </p>
          <p className="mt-4 font-mono text-[11px] text-muted-foreground">
            Quelle: MOVING Branchenreport 2025 · Stand 2025
          </p>
        </header>

        {/* ================= Drei Schritte (kompakt) ================= */}
        <section aria-labelledby="schritte-heading" className="mt-20">
          <h2 id="schritte-heading" className="sr-only">Drei Schritte in den Beruf</h2>
          <ol className="grid gap-8 sm:grid-cols-3">
            {SCHRITTE.map((s) => (
              <li key={s.n} className="border-t border-border pt-6">
                <span aria-hidden="true" className="font-mono text-xs text-muted-foreground/70">{s.n}</span>
                <h3 className="mt-2 text-lg font-bold tracking-tight">{s.titel}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.text}</p>
              </li>
            ))}
          </ol>
          <p className="mt-8 text-sm leading-relaxed text-muted-foreground">
            Eckpunkte nach § 2 FahrlG — Stand: Juli 2026, ohne Gewähr. Verbindlich ist die
            Auskunft der zuständigen Behörde und deiner Ausbildungsstätte.
          </p>
        </section>

        {/* ================= Finanzierungs-Flag erklärt ================= */}
        <section aria-labelledby="finanzierung-heading" className="mt-20 border-t border-border pt-16">
          <h2 id="finanzierung-heading" className="text-center text-3xl font-light tracking-tight sm:text-4xl">
            Was <span className="font-semibold">„Ausbildungsfinanzierung“</span> bei uns heißt
          </h2>
          <div className="mt-10 space-y-6 leading-relaxed text-muted-foreground">
            <p>
              Manche Fahrschulen beteiligen sich an den Kosten deiner Fahrlehrer-Ausbildung —
              anteilig oder ganz. In unseren Stellenanzeigen siehst du das als klaren Hinweis:{" "}
              <span className="font-medium text-foreground">
                „Ausbildungsfinanzierung möglich / anteilig / voll — nach Vereinbarung“.
              </span>
            </p>
            <p>
              „Nach Vereinbarung“ meinen wir wörtlich: Die Konditionen verhandelst du direkt mit
              der Fahrschule — wir versprechen dir an dieser Stelle nichts, was wir nicht halten
              können. Lies eine Vereinbarung in Ruhe, bevor du unterschreibst.
            </p>
          </div>
        </section>

        {/* ================= CTAs: Filter + Ratgeber ================= */}
        <section aria-labelledby="cta-heading" className="mt-20 border-t border-border pt-16 text-center">
          <h2 id="cta-heading" className="text-3xl font-light tracking-tight sm:text-4xl">
            Bereit für den <span className="font-semibold">Beifahrersitz?</span>
          </h2>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/jobs?quereinsteiger=1"
              className={`inline-flex min-h-12 items-center rounded-full bg-accent px-7 py-3 text-base font-semibold text-accent-foreground transition-transform duration-[var(--motion-duration-fast)] ease-[var(--motion-ease)] motion-safe:hover:scale-[1.02] motion-safe:active:scale-[0.98] ${focusRing}`}
            >
              Stellen für Quereinsteiger:innen
            </Link>
            <Link
              href="/ratgeber/fahrlehrer-werden"
              className={`inline-flex min-h-12 items-center rounded-full border border-border bg-card px-7 py-3 text-base font-semibold transition-colors duration-[var(--motion-duration-fast)] ease-[var(--motion-ease)] hover:border-primary/50 hover:text-primary ${focusRing}`}
            >
              Der ausführliche Ratgeber
            </Link>
          </div>
          <p className="mx-auto mt-8 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Im Ratgeber liest du in Ruhe, wie Ausbildung, Lehrpraktikum und Prüfungen ablaufen —
            und worauf du bei einer Bindungsvereinbarung achten solltest:{" "}
            <Link href="/ratgeber/fahrlehrer-werden" className="font-medium text-primary underline-offset-4 hover:underline">
              Fahrlehrer:in werden — der komplette Guide
            </Link>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
