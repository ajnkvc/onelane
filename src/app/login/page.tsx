import type { Metadata } from "next";
import Link from "next/link";

/**
 * /login — Konto-Zugang für Fahrschüler und Fahrlehrer:innen (Interim-Seite).
 * ----------------------------------------------------------------------------
 * Nutzerkonten starten erst mit den nächsten Funktionsstufen; diese Seite ist
 * die EHRLICHE Zwischenlösung hinter dem Header-„Login": sie verspricht nichts
 * Falsches, sammelt keine E-Mail-Adressen und führt beide Zielgruppen zu den
 * Wegen, die HEUTE funktionieren (Fahrschul-Anmeldung ohne Konto bzw. Jobbörse).
 * Fahrschulen werden bewusst nur auf /fuer-fahrschulen verwiesen — interne
 * Zugänge/Systeme werden öffentlich nicht genannt.
 * noindex: Interim-Inhalt ohne Suchwert.
 */
export const metadata: Metadata = {
  title: "Login",
  description:
    "Dein onelane-Login für Fahrschüler und Fahrlehrer:innen — Konten starten in Kürze. Deine Anmeldung bei einer Fahrschule funktioniert schon heute ohne Konto.",
  robots: { index: false, follow: true },
};

const focusRing =
  "outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:border-ring";

export default function LoginPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-16 sm:py-24">
      <header className="text-center">
        <p className="font-mono text-xs tracking-[0.25em] text-muted-foreground uppercase">
          onelane · Konto
        </p>
        <h1 className="mt-4 text-4xl font-light tracking-tight sm:text-5xl">
          Dein onelane-<span className="font-semibold">Login</span>.
        </h1>
        <p className="mx-auto mt-4 max-w-xl leading-relaxed text-muted-foreground">
          Konten für Fahrschüler und Fahrlehrer:innen starten in Kürze — mit
          allem, was deine Anmeldung und deinen Weg zum Führerschein begleitet.
        </p>
      </header>

      <div className="mt-12 grid gap-6 sm:grid-cols-2">
        <section
          aria-labelledby="login-schueler"
          className="rounded-md border border-border bg-card p-6 shadow-elevation-1"
        >
          <h2 id="login-schueler" className="text-lg font-semibold">
            Fahrschüler
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Dein Konto startet in Kürze. Das Wichtigste geht aber schon heute —
            deine Anmeldung bei einer Fahrschule funktioniert ganz ohne Konto.
          </p>
          <Link
            href="/fahrschulen"
            className={`mt-5 inline-flex min-h-11 items-center rounded-full bg-accent px-5 font-semibold text-accent-foreground transition-transform duration-[var(--motion-duration-fast)] ease-[var(--motion-ease)] motion-safe:hover:scale-[1.02] motion-safe:active:scale-[0.98] ${focusRing}`}
          >
            Fahrschule finden
          </Link>
        </section>

        <section
          aria-labelledby="login-fahrlehrer"
          className="rounded-md border border-border bg-card p-6 shadow-elevation-1"
        >
          <h2 id="login-fahrlehrer" className="text-lg font-semibold">
            Fahrlehrer:innen
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Dein Konto startet in Kürze. Offene Stellen und den Weg in den Beruf
            findest du schon jetzt in der Jobbörse.
          </p>
          <Link
            href="/jobs"
            className={`mt-5 inline-flex min-h-11 items-center rounded-full border border-primary/40 px-5 font-medium text-primary transition-colors duration-[var(--motion-duration-fast)] ease-[var(--motion-ease)] hover:border-primary/70 hover:bg-primary/5 ${focusRing}`}
          >
            Zur Jobbörse
          </Link>
        </section>
      </div>

      <p className="mt-10 text-center text-sm text-muted-foreground">
        Sie leiten eine Fahrschule?{" "}
        <Link
          href="/fuer-fahrschulen"
          className={`font-medium text-primary underline-offset-4 hover:underline ${focusRing} rounded-sm`}
        >
          Für Fahrschulen
        </Link>
      </p>
    </div>
  );
}
