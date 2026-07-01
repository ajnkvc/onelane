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
