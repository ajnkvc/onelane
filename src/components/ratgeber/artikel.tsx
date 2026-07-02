import type { Metadata } from "next";
import Link from "next/link";
import { RatgeberCover } from "@/components/ratgeber/cover";
import { TrustBadge } from "@/components/trust/trust-badge";
import { getSiteUrl } from "@/lib/public-config";
import { getGuide, RATGEBER_STAND_LABEL } from "@/lib/ratgeber";

/**
 * RatgeberArtikel — gemeinsame Shell aller Ratgeber-Artikel (Server-Komponente).
 * ----------------------------------------------------------------------------
 * Liest Titel/Kategorie/Stand/Lesezeit/Cover aus der Registry (lib/ratgeber.ts)
 * — die Artikel-Seiten liefern NUR den Fließtext als Kinder (h2/h3/p/ul/ol/li/
 * strong/a/blockquote; der Prosa-Container setzt die Typografie zentral, kein
 * Klassen-Gefrickel im Artikel). Aufbau: Breadcrumb → Kategorie-Chip + Stand +
 * Lesezeit → H1 → großes Cover → Prosa → optionale Rechts-Zeile → Abschluss-CTA
 * (Vergleich) + trust-Zeile + Zurück-Link.
 *
 * NUTZUNG in src/app/ratgeber/<slug>/page.tsx:
 *   export const dynamic = "force-dynamic";
 *   export const metadata = ratgeberMetadata("<slug>");
 *   <RatgeberArtikel slug="<slug>" rechtsHinweis>…Prosa…</RatgeberArtikel>
 *
 * EHRLICHKEIT (§ 32 FahrlG, UWG): Artikel bleiben zahlenlos (keine Preise/
 * Quoten), ohne Erfolgsversprechen; amtliche Fakten mit „Stand"-Bezug. Bei
 * Vertrags-/Rechtsthemen `rechtsHinweis` setzen (sichtbare Hinweis-Zeile).
 */

/** Einheitlicher Fokus-Stil (WCAG 2.2: sichtbarer Fokus) für alle Interaktiven. */
const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/**
 * Metadata-Helfer für generateMetadata/metadata der Artikel-Seiten:
 * Titel aus der Registry (Layout-Template hängt „· onelane" an), Teaser als
 * Description, canonical nach dem Muster der Profilseiten (absolute URL).
 */
export function ratgeberMetadata(slug: string): Metadata {
  const guide = getGuide(slug);
  if (!guide) return { robots: { index: false, follow: false } };
  const canonical = `${getSiteUrl()}/ratgeber/${guide.slug}`;
  return {
    title: guide.titel,
    description: guide.teaser,
    alternates: { canonical },
    openGraph: {
      title: guide.titel,
      description: guide.teaser,
      url: canonical,
      type: "article",
    },
  };
}

export function RatgeberArtikel({
  slug,
  rechtsHinweis = false,
  children,
}: {
  /** Slug aus der Registry (lib/ratgeber.ts) — Meta kommt von dort. */
  slug: string;
  /** true bei Vertrags-/Rechtsthemen: sichtbare „keine Rechtsberatung"-Zeile. */
  rechtsHinweis?: boolean;
  children: React.ReactNode;
}) {
  const guide = getGuide(slug);
  if (!guide) {
    // Programmierfehler (Tippfehler/fehlende Registrierung) — laut scheitern,
    // statt eine halbe Seite ohne Titel/Cover auszuliefern.
    throw new Error(
      `RatgeberArtikel: unbekannter Slug "${slug}" — bitte in src/lib/ratgeber.ts registrieren.`,
    );
  }
  return (
    <div className="bg-background text-foreground">
      <article className="mx-auto w-full max-w-3xl px-6 pb-24 pt-12 sm:pt-16">
        {/* ================= Breadcrumb ================= */}
        <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
          <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <li>
              <Link
                href="/ratgeber"
                className={`font-medium text-primary underline-offset-4 hover:underline ${focusRing} rounded-md`}
              >
                Ratgeber
              </Link>
            </li>
            <li aria-hidden="true" className="text-muted-foreground/60">
              ›
            </li>
            <li aria-current="page" className="min-w-0 truncate">
              {guide.titel}
            </li>
          </ol>
        </nav>

        {/* ================= Kopf: Chip + Stand + Lesezeit + H1 ================= */}
        <header className="mt-10">
          <p className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              {guide.kategorie}
            </span>
            <span className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Stand: {RATGEBER_STAND_LABEL}
            </span>
            <span aria-hidden="true" className="size-1 bg-accent" />
            <span className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
              {guide.lesezeit} Min. Lesezeit
            </span>
          </p>
          <h1 className="mt-6 text-4xl font-light tracking-tight text-balance sm:text-5xl">
            {guide.titel}
          </h1>
        </header>

        {/* ================= Cover (rund macht der Container) ================= */}
        <div className="mt-10 overflow-hidden rounded-2xl border border-border/60">
          <RatgeberCover id={guide.cover} />
        </div>

        {/* ================= Prosa — Artikel-Satz zentral gesetzt ================= */}
        <div
          className="mt-6 max-w-prose leading-relaxed text-muted-foreground
            [&_h2]:mt-12 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-foreground
            [&_h3]:mt-8 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:tracking-tight [&_h3]:text-foreground
            [&_p]:mt-4
            [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:pl-6
            [&_ol]:mt-4 [&_ol]:list-decimal [&_ol]:pl-6
            [&_li]:mt-2 [&_li]:pl-1
            [&_strong]:font-semibold [&_strong]:text-foreground
            [&_a]:font-medium [&_a]:text-primary [&_a]:underline-offset-4 [&_a:hover]:underline
            [&_blockquote]:mt-6 [&_blockquote]:border-l-2 [&_blockquote]:border-accent [&_blockquote]:pl-6"
        >
          {children}
        </div>

        {/* ================= Rechts-Zeile (nur bei Vertrags-/Rechtsthemen) ===== */}
        {rechtsHinweis ? (
          <p className="mt-12 border-t border-border pt-6 text-sm leading-relaxed text-muted-foreground">
            Das ist keine Rechtsberatung. Gesetzliche Angaben ohne Gewähr — verbindlich sind
            deine Führerscheinstelle und deine Fahrschule.
          </p>
        ) : null}

        {/* ================= Abschluss: CTA + trust-Zeile + Zurück-Link ======== */}
        <footer className="mt-16 border-t border-border pt-14 text-center">
          <Link
            href="/fahrschulen"
            className={`inline-flex min-h-12 items-center gap-2 rounded-full bg-accent px-7 py-3 text-base font-semibold text-accent-foreground transition-colors duration-[var(--motion-duration-fast)] ease-[var(--motion-ease)] hover:bg-brand-lime ${focusRing}`}
          >
            Jetzt Fahrschulen vergleichen
          </Link>
          <p className="mt-3 text-xs text-muted-foreground">kostenlos &amp; unverbindlich</p>
          <div className="mt-10 flex flex-col items-center gap-2">
            <TrustBadge size="sm" />
            <p className="text-sm text-muted-foreground">Wir bleiben an deiner Seite.</p>
          </div>
          <p className="mt-10 text-sm">
            <Link
              href="/ratgeber"
              className={`inline-flex min-h-11 items-center gap-1.5 font-medium text-primary underline-offset-4 hover:underline ${focusRing} rounded-md`}
            >
              <span aria-hidden="true">←</span> Zurück zum Ratgeber
            </Link>
          </p>
        </footer>
      </article>
    </div>
  );
}
