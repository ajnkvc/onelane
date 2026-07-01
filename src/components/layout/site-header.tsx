import Link from "next/link";
import { Wordmark } from "@/components/ui/wordmark";

/**
 * SiteHeader — globale Navigation (Server-Komponente, kein Client-JS).
 * Sticky mit dezentem Backdrop-Blur (reines CSS). Nur existierende Routen.
 * Landmark `header` ist Navigation; der Profil-TrustHeader bleibt Seiteninhalt.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/65">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-6">
        <Link href="/" className="rounded-md" aria-label="onelane — Startseite">
          <Wordmark className="text-2xl sm:text-3xl" />
        </Link>
        <nav className="flex items-center gap-1 text-sm font-medium" aria-label="Hauptnavigation">
          <Link
            href="/fahrschulen"
            className="rounded-md px-3 py-2 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          >
            Fahrschulen
          </Link>
        </nav>
      </div>
    </header>
  );
}
