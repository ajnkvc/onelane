import Link from "next/link";
import { Wordmark } from "@/components/ui/wordmark";

/**
 * SiteHeader — globale Navigation (Server-Komponente, kein Client-JS).
 * Sticky mit dezentem Backdrop-Blur (reines CSS).
 * Links: Wordmark + (ab sm:) gedeckte Tagline „Deutschlands Fahrschulvergleich".
 * Rechts: dezenter „Ratgeber"-Textlink (Gründer 2026-07-02 — bewusst ruhiger
 * als die Pills, der Header bleibt zweistufig: Inhalte leise, Aktionen laut),
 * auffälliger Jobbörse-Pill (Ziel /jobs, Route folgt unmittelbar) und
 * der Konto-Zugang „Login" (→ /login; Schüler-/Fahrlehrer-Konten, ehrliche
 * Interim-Seite bis die Konten starten). BEWUSST „Login" statt „Anmelden" —
 * sonst Begriffs-Kollision mit den „Anmeldung starten"-CTAs (Fahrschul-
 * Anmeldung) in der Seite. Ebenso bewusst sekundär gestaltet: der Header
 * drängt nicht zur Conversion, das erledigen die Sektions-CTAs.
 * Landmark `header` ist Navigation; der Profil-TrustHeader bleibt Seiteninhalt.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/65">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center rounded-md"
            aria-label="onelane — Startseite"
          >
            <Wordmark className="text-2xl leading-none sm:text-3xl" />
          </Link>
          {/* Optisch zur Wortmarken-Mittelachse zentriert: leading-none entfernt
              den Zeilenhöhen-Versatz, der Micro-Offset gleicht die x-Höhe der
              kleinen Type gegen die Versal-Achse der Wortmarke aus. */}
          <span className="hidden translate-y-[1px] truncate text-xs font-medium leading-none text-muted-foreground sm:inline">
            Deutschlands Fahrschulvergleich
          </span>
        </div>

        <nav className="flex shrink-0 items-center gap-2 text-sm font-medium" aria-label="Hauptnavigation">
          <Link
            href="/ratgeber"
            className="inline-flex min-h-11 items-center rounded-full px-3 text-foreground/80 transition-colors duration-[var(--motion-duration-fast)] ease-[var(--motion-ease)] hover:text-primary"
          >
            Ratgeber
          </Link>
          <Link
            href="/jobs"
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-primary/40 px-4 text-primary transition-colors duration-[var(--motion-duration-fast)] ease-[var(--motion-ease)] hover:border-primary/70 hover:bg-primary/5"
          >
            <span aria-hidden="true" className="size-1.5 rounded-full bg-accent" />
            <span className="sm:hidden">Jobs</span>
            <span className="hidden sm:inline">Jobbörse</span>
          </Link>
          <Link
            href="/login"
            className="inline-flex min-h-11 items-center rounded-full border border-border bg-card px-4 text-foreground transition-colors duration-[var(--motion-duration-fast)] ease-[var(--motion-ease)] hover:border-primary/50 hover:text-primary sm:px-5"
          >
            Login
          </Link>
        </nav>
      </div>
    </header>
  );
}
