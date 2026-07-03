import Link from "next/link";
import { Wordmark } from "@/components/ui/wordmark";

/**
 * SiteFooter — globaler Fuß mit Rechts-/Navigations-Links (Server-Komponente).
 * Verlinkt nur existierende Routen bzw. die bewussten Legal-Stubs.
 */

/** 30 größte Städte Deutschlands (Einwohner) — Einstiegspunkte + interne Verlinkung. */
const TOP_CITIES = [
  "Berlin", "Hamburg", "München", "Köln", "Frankfurt am Main", "Stuttgart",
  "Düsseldorf", "Leipzig", "Dortmund", "Essen", "Bremen", "Dresden",
  "Hannover", "Nürnberg", "Duisburg", "Bochum", "Wuppertal", "Bielefeld",
  "Bonn", "Münster", "Mannheim", "Karlsruhe", "Augsburg", "Wiesbaden",
  "Mönchengladbach", "Gelsenkirchen", "Aachen", "Braunschweig", "Chemnitz", "Kiel",
];

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-16 border-t border-border/60">
      {/* Vertrauens-Leiste GANZ OBEN im Footer (Gründer 2026-07-02: „soll auffallen")
          — nur wahre, technisch gedeckte Zusicherungen; keine Siegel-Optik. */}
      <div className="border-b border-border/60 bg-secondary/50">
        <ul className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-center gap-x-10 gap-y-2 px-6 py-5 text-sm font-semibold text-foreground">
          <li className="flex items-center gap-2.5">
            <svg className="size-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="4" y="10" width="16" height="10" rx="2" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3" />
            </svg>
            SSL/TLS-verschlüsselte Übertragung
          </li>
          <li className="flex items-center gap-2.5">
            <svg className="size-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="5" width="18" height="6" rx="1.5" />
              <rect x="3" y="13" width="18" height="6" rx="1.5" />
              <path d="M7 8h.01M7 16h.01" />
            </svg>
            Server in Deutschland
          </li>
          <li className="flex items-center gap-2.5">
            <svg className="size-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M8.5 12.5l2.3 2.3L15.5 10" />
            </svg>
            Datenverarbeitung nach DSGVO
          </li>
        </ul>
      </div>
      <div className="mx-auto w-full max-w-6xl px-6 pt-10">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Fahrschulen in Deutschlands größten Städten
        </h2>
        <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm text-muted-foreground sm:grid-cols-3 md:grid-cols-5">
          {TOP_CITIES.map((c) => (
            <li key={c}>
              <Link
                href={`/fahrschulen?ort=${encodeURIComponent(c)}`}
                className="underline-offset-2 hover:text-foreground hover:underline"
              >
                {c}
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <Wordmark className="text-xl" />
          <p className="max-w-xs text-xs text-muted-foreground">
            onelane — das unabhängige Vergleichsportal für Fahrschulen in Deutschland.
          </p>
        </div>
        <nav
          className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground"
          aria-label="Footer-Navigation"
        >
          <Link href="/fahrschulen" className="underline-offset-2 hover:text-foreground hover:underline">
            Fahrschulen
          </Link>
          <Link href="/ratgeber" className="underline-offset-2 hover:text-foreground hover:underline">
            Ratgeber
          </Link>
          <Link href="/os" className="underline-offset-2 hover:text-foreground hover:underline">
            onelane os
          </Link>
          <Link href="/impressum" className="underline-offset-2 hover:text-foreground hover:underline">
            Impressum
          </Link>
          <Link href="/datenschutz" className="underline-offset-2 hover:text-foreground hover:underline">
            Datenschutz
          </Link>
          <Link href="/nutzungsbedingungen" className="underline-offset-2 hover:text-foreground hover:underline">
            Nutzungsbedingungen
          </Link>
        </nav>
      </div>
      <div className="border-t border-border/60 py-4 text-center text-xs text-muted-foreground">
        © {year} onelane
      </div>
    </footer>
  );
}
