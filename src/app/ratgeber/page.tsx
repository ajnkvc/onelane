import type { Metadata } from "next";
import Link from "next/link";
import { RevealOnScroll } from "@/components/home/reveal";
import { RatgeberCover } from "@/components/ratgeber/cover";
import { getSiteUrl } from "@/lib/public-config";
import { RATGEBER_GUIDES } from "@/lib/ratgeber";

/**
 * /ratgeber — Hub aller Ratgeber-Guides (SSR, indexierbar).
 * ----------------------------------------------------------------------------
 * Editorialer Kopf (mono-Kicker, leichte Display-Headline) + Grid ALLER Guides
 * aus der Registry (lib/ratgeber.ts — Reihenfolge dort = Reihenfolge hier).
 * Jede Karte ist GANZ klickbar (Cover + Kategorie-Chip + Titel + Teaser +
 * Lesezeit, sanfter Lift wie die Karten der Startseite). Die Artikel-Seiten
 * selbst rendern über die gemeinsame Shell components/ratgeber/artikel.tsx.
 *
 * EHRLICHKEIT: Teaser/Lead zahlenlos (§ 32 FahrlG), keine Versprechen — der
 * Ratgeber ist Wissens-Angebot, kein Verkaufsargument.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ratgeber — Wissen rund um Führerschein & Fahrschule",
  description:
    "Kosten verstehen, die passende Fahrschule finden, Prüfungen ruhig angehen: Der onelane-Ratgeber erklärt ehrlich und unabhängig, was auf dem Weg zum Führerschein zählt — laufend erweitert.",
  alternates: { canonical: `${getSiteUrl()}/ratgeber` },
};

/** Einheitlicher Fokus-Stil (WCAG 2.2: sichtbarer Fokus) für alle Interaktiven. */
const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export default function RatgeberHubPage() {
  return (
    <div className="bg-background text-foreground">
      <RevealOnScroll />
      <div className="mx-auto w-full max-w-6xl px-6 pb-24 pt-16 sm:pt-24">
        {/* ================= Kopf ================= */}
        <header className="reveal mx-auto max-w-3xl text-center">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
            onelane · Ratgeber
          </p>
          <h1 className="mt-6 text-4xl font-light tracking-tight text-balance sm:text-6xl">
            Wissen, das dich <span className="font-semibold">weiterbringt.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl leading-relaxed text-muted-foreground">
            Kosten, Fahrschulwahl, Prüfungen: Wir erklären ehrlich und unabhängig, was auf dem
            Weg zum Führerschein wirklich zählt — und erweitern den Ratgeber laufend.
          </p>
        </header>

        {/* ================= Grid aller Guides (Registry-Reihenfolge) ========== */}
        <div className="reveal-stagger mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {RATGEBER_GUIDES.map((g) => (
            <Link
              key={g.slug}
              href={`/ratgeber/${g.slug}`}
              className={`hover-lift group flex flex-col overflow-hidden rounded-3xl border border-border/60 bg-card text-left shadow-elevation-1 ${focusRing}`}
            >
              {/* Cover — rund macht der Karten-Container (overflow-hidden) */}
              <span className="block overflow-hidden">
                <RatgeberCover
                  id={g.cover}
                  className="transition-transform duration-[var(--motion-duration-slow)] ease-[var(--motion-ease)] motion-safe:group-hover:scale-[1.03]"
                />
              </span>
              <span className="flex flex-1 flex-col p-6">
                <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
                    {g.kategorie}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    {g.lesezeit} Min. Lesezeit
                  </span>
                </span>
                <span className="mt-4 text-xl font-semibold tracking-tight text-balance transition-colors duration-[var(--motion-duration-base)] ease-[var(--motion-ease)] group-hover:text-primary">
                  {g.titel}
                </span>
                <span className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {g.teaser}
                </span>
              </span>
            </Link>
          ))}
        </div>

        {/* ================= dezenter Ausklang ================= */}
        <p className="reveal mt-16 text-center text-sm text-muted-foreground">
          Dein Thema fehlt? Wir schreiben weiter — oder du startest direkt:{" "}
          <Link
            href="/fahrschulen"
            className={`font-medium text-primary underline-offset-4 hover:underline ${focusRing} rounded-md`}
          >
            Fahrschulen vergleichen
          </Link>
        </p>
      </div>
    </div>
  );
}
