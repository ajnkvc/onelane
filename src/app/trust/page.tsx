import type { Metadata } from "next";
import Link from "next/link";
import { TrustEmblem } from "@/components/trust/trust-emblem";
import { TRUST_ARGUMENTE } from "@/lib/trust-argumente";

/**
 * /trust — Erklär- und Werbeseite für „onelane trust" (SSR, indexierbar).
 * ----------------------------------------------------------------------------
 * Vertieft das Marken-Versprechen der Startseite: Kopf mit Plakette + Claim,
 * „So läuft deine Anfrage" (4 Schritte) als DUNKLES Petrol-Band, die fünf
 * trust-Argumente ausführlicher (aus dem trust-Block der Startseite übernommen
 * und vertieft — KEINE neuen Versprechen, keine Fristen/Garantien und keine
 * „geprüft"-Sprache), dazu ehrlich „Was trust NICHT ist" (kein Prüfsiegel,
 * keine Rechtsberatung). Abschluss: ein Primär-CTA + Kontaktzeile. Editorialer
 * Kapitel-Stil (zentrierte Köpfe, schmale Lese-Spalte), Petrol + Mint, kein
 * FAQ-Schema (kein sichtbares FAQ auf dieser Seite).
 *
 * RECHTSLEITPLANKE (wie trust-badge/-emblem): Marken-Versprechen, KEIN
 * Gütesiegel — keine Siegel-Optik, keine „geprüft/zertifiziert"-Begriffe.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  // Absoluter Titel: die Marke steckt bereits im Titel — kein „· onelane"-Suffix.
  title: { absolute: "onelane trust — Wir bleiben an deiner Seite" },
  description:
    "onelane trust ist unser Versprechen an dich: Wir betreuen dich rund um deine Fahrschul-Anfrage — wir übermitteln sie strukturiert, haken nach, wenn sich niemand meldet, und helfen beim Wechsel, wenn es nicht passt.",
};

/** Einheitlicher Fokus-Stil (WCAG 2.2: sichtbarer Fokus) für alle Interaktiven. */
const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/** Kapitel-Zeile (zentriert): Hairlines beidseitig, Mint-Punkt als Marker. */
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

/** Die 4 Schritte einer Anfrage — operativ leistbar, ohne Fristen-Zusagen. */
const SCHRITTE = [
  {
    n: "01",
    title: "Du fragst an",
    text: "Kostenfrei und ohne Konto: Wunsch-Fahrschule wählen, Klasse und Startzeitraum angeben — fertig in zwei Minuten.",
  },
  {
    n: "02",
    title: "Wir übermitteln strukturiert",
    text: "Deine Anfrage geht sauber aufbereitet an genau diese Fahrschule — mit Klasse, Zeitraum und dem Preisstand zum Zeitpunkt deiner Anfrage.",
  },
  {
    n: "03",
    title: "Die Schule antwortet dir direkt",
    text: "Die Fahrschule meldet sich direkt bei dir. Auch den Ausbildungsvertrag schließt du direkt mit ihr — wir stehen nicht dazwischen.",
  },
  {
    n: "04",
    title: "Wir haken nach, falls nicht",
    text: "Meldet sich niemand, erinnern wir die Fahrschule an deine Anfrage. Du telefonierst niemandem hinterher.",
  },
] as const;

/**
 * Die fünf trust-Argumente kommen aus der GEMEINSAMEN Quelle
 * src/lib/trust-argumente.ts (deckungsgleich mit dem aufklappbaren
 * trust-Panel der Startseite — kein Text-Drift).
 */

export default function TrustPage() {
  return (
    <div className="bg-background text-foreground">
      {/* ================= Kopf: Plakette + Claim ================= */}
      <header className="mx-auto w-full max-w-3xl px-6 pt-16 text-center sm:pt-24">
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
          onelane · trust
        </p>
        {/* Kein Selbst-Link: auf /trust rendert die Plakette ohne href. */}
        <div className="mt-8 flex justify-center">
          <TrustEmblem size="md" href={null} />
        </div>
        <h1 className="mt-8 text-4xl font-light tracking-tight text-balance sm:text-6xl">
          Wir bleiben <span className="font-semibold">an deiner Seite.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl leading-relaxed text-muted-foreground">
          onelane trust ist unser Versprechen an dich: Wir betreuen dich rund um deine Anfrage —
          von der ehrlichen Zweitmeinung vor deiner Entscheidung bis zur Hilfe beim Wechsel,
          wenn es gar nicht passt. Diese Seite erklärt, was das konkret heißt.
        </p>
      </header>

      {/* ============ 01 · So läuft deine Anfrage (dunkles Petrol-Band) ====== */}
      <section aria-labelledby="ablauf-heading" className="mt-16 sm:mt-24">
        <div className="bg-foreground py-16 text-background sm:py-20">
          <div className="mx-auto w-full max-w-5xl px-6">
            <p className="text-center font-mono text-xs uppercase tracking-[0.22em] text-background/60">
              01 · Der Ablauf
            </p>
            <h2
              id="ablauf-heading"
              className="mt-6 text-center text-3xl font-light tracking-tight text-balance sm:text-4xl"
            >
              So läuft <span className="font-semibold">deine Anfrage.</span>
            </h2>
            <ol className="mx-auto mt-12 grid max-w-4xl gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
              {SCHRITTE.map((s) => (
                <li key={s.n} className="border-l-2 border-accent/60 pl-5 text-left lg:border-l-0 lg:border-t-2 lg:pl-0 lg:pt-5">
                  <p className="font-mono text-xs tracking-[0.2em] text-accent">{s.n}</p>
                  <h3 className="mt-2 text-lg font-semibold tracking-tight">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-background/70">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* ================= 02 · Das Versprechen im Detail ==================== */}
      <section aria-labelledby="versprechen-heading" className="mx-auto w-full max-w-3xl px-6 pt-20 sm:pt-24">
        <Kicker n="02">Das Versprechen</Kicker>
        <h2
          id="versprechen-heading"
          className="mt-8 text-center text-3xl font-light tracking-tight text-balance sm:text-4xl"
        >
          Sechs Zusagen — <span className="font-semibold">ohne Sternchen.</span>
        </h2>
        <dl className="mt-12">
          {TRUST_ARGUMENTE.map((a, i) => (
            <div
              key={a.title}
              className="grid gap-x-6 gap-y-2 border-t border-border py-7 text-left sm:grid-cols-[3.5rem_1fr]"
            >
              <span aria-hidden="true" className="text-4xl font-light tabular-nums text-muted-foreground/40">
                {i + 1}
              </span>
              <div>
                <dt className="text-xl font-semibold tracking-tight">{a.title}</dt>
                <dd className="mt-2 leading-relaxed text-muted-foreground">{a.text}</dd>
              </div>
            </div>
          ))}
        </dl>
      </section>

      {/* ================= 03 · Was trust NICHT ist (Ehrlichkeit) ============ */}
      <section aria-labelledby="grenzen-heading" className="mx-auto w-full max-w-3xl px-6 pt-16 sm:pt-20">
        <Kicker n="03">Ehrlichkeit</Kicker>
        <h2
          id="grenzen-heading"
          className="mt-8 text-center text-3xl font-light tracking-tight text-balance sm:text-4xl"
        >
          Was trust <span className="font-semibold">nicht ist.</span>
        </h2>
        <div className="mt-10 space-y-6 leading-relaxed text-muted-foreground">
          <p>
            <span className="font-semibold text-foreground">Kein Prüfsiegel.</span> onelane trust
            ist unser Versprechen, wie WIR uns um deine Anfrage kümmern — keine Aussage über die
            Qualität einer Fahrschule und keine Prüfung einzelner Angaben. Wie wir Angaben
            kennzeichnen und sortieren, erklären wir auf{" "}
            <Link
              href="/so-sortieren-wir"
              className={`font-medium text-primary underline-offset-4 hover:underline ${focusRing} rounded-md`}
            >
              So sortieren wir
            </Link>
            .
          </p>
          <p>
            <span className="font-semibold text-foreground">Keine Rechtsberatung.</span> Bei
            Problemen helfen wir zu vermitteln — rechtlich beraten dürfen und wollen wir nicht.
            Den Ausbildungsvertrag schließt du direkt mit deiner Fahrschule.
          </p>
        </div>
      </section>

      {/* ================= Abschluss: CTA + Kontaktzeile ===================== */}
      <section aria-label="Jetzt anfragen" className="mx-auto w-full max-w-3xl px-6 pb-24 pt-16 text-center sm:pt-20">
        <Link
          href="/fahrschulen"
          className={`inline-flex min-h-12 items-center gap-2 rounded-full bg-accent px-7 py-3 text-base font-semibold text-accent-foreground transition-colors duration-[var(--motion-duration-fast)] ease-[var(--motion-ease)] hover:bg-brand-lime ${focusRing}`}
        >
          Jetzt anfragen
        </Link>
        <p className="mt-3 text-xs text-muted-foreground">kostenlos &amp; unverbindlich</p>
        <p className="mt-8 text-sm text-muted-foreground">
          Du hast vorab eine Frage?{" "}
          <a
            href="mailto:kontakt@onelane.de"
            className={`font-medium text-primary underline-offset-4 hover:underline ${focusRing} rounded-md`}
          >
            Schreib uns
          </a>{" "}
          — kontakt@onelane.de
        </p>
      </section>
    </div>
  );
}
