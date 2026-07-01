import type { Metadata } from "next";
import Link from "next/link";
import { SearchBar } from "@/components/search/search-bar";
import { Typewriter } from "@/components/home/typewriter";

/**
 * VORSCHAU „Premium 2" — Original-Hero + feines Mesh + schwebende Ergebnis-
 * Vorschau (Bento). SSR, CSS/SVG-only. `noindex`. Beispielkarte ohne echte Werte.
 */
export const metadata: Metadata = {
  title: "Vorschau — Premium 2 (Mesh + Bento)",
  robots: { index: false, follow: false },
};

const SLOGAN = ["günstigste", "nächste", "bestbewertete", "passende"];

export default function PremiumMesh() {
  return (
    <div className="bg-[var(--background)]">
      <div className="mx-auto max-w-6xl px-6 pt-4 text-right">
        <Link href="/vorschau" className="text-sm text-muted-foreground underline-offset-2 hover:underline">← Vorschauen</Link>
      </div>

      <section className="relative z-20 overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="vp-aurora absolute inset-0 opacity-80" />
          <div className="vp-grid absolute inset-0 opacity-70" />
        </div>

        <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 pb-20 pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:pt-24">
          {/* Links: Text + Suche */}
          <div className="flex flex-col items-start gap-6 text-left">
            <span className="vp-rise inline-flex items-center gap-2 rounded-full border border-brand-sky/25 bg-card/70 px-4 py-1.5 text-sm font-medium text-[#0369a1] shadow-sm backdrop-blur">
              <span className="size-2 rounded-full bg-brand-sky" /> Transparenter Fahrschul-Vergleich
            </span>
            <h1 className="vp-rise-2 text-4xl font-bold leading-[1.04] tracking-tight text-[#1b3a5c] sm:text-6xl">
              Finde die <Typewriter words={SLOGAN} className="text-gradient-brand" /><br /> Fahrschule deiner Stadt.
            </h1>
            <p className="vp-rise-2 max-w-md text-lg text-muted-foreground">
              Preise, Klassen und <strong className="text-foreground">echte Bestehensquoten</strong> — klar nebeneinander.
            </p>
            <div className="vp-rise-3 w-full max-w-xl"><SearchBar /></div>
          </div>

          {/* Rechts: schwebende Ergebnis-Vorschau (Bento) */}
          <div className="vp-rise-3 relative hidden lg:block">
            <div className="vp-float rounded-3xl border border-[#e4ecf4] bg-white/90 p-5 shadow-[0_30px_60px_-30px_rgba(15,34,53,0.45)] backdrop-blur">
              <div className="flex items-center justify-between text-xs text-muted-foreground"><span>3 Fahrschulen in deiner Nähe</span><span>nach Bewertung</span></div>
              {[["Fahrschule Nord", "B · A1 · BE", "★ 4,8"], ["City Drive", "B · B197 · AM", "★ 4,7"], ["MoveOn", "B · A2 · A", "★ 4,6"]].map(([n, k, r], i) => (
                <div key={n} className="mt-3 flex items-center gap-3 rounded-2xl border border-[#eef2f7] p-3">
                  <span className="grid size-11 place-items-center rounded-xl bg-gradient-to-br from-[#0ea5e9] to-[#22d3ee] text-sm font-bold text-white">{["FN", "CD", "MO"][i]}</span>
                  <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold text-[#1b3a5c]">{n}</div><div className="truncate text-xs text-muted-foreground">{k}</div></div>
                  <span className="rounded-full bg-secondary px-2 py-1 text-xs font-medium text-[#0369a1]">{r}</span>
                </div>
              ))}
              <p className="mt-3 text-center text-[11px] text-muted-foreground">Beispiel-Vorschau — echte Ergebnisse je Standort.</p>
            </div>
            <div className="absolute -right-3 -top-3 rounded-2xl border border-[#e4ecf4] bg-white px-3 py-2 text-xs font-semibold text-[#65a30d] shadow-lg">bis zu 15 %* sparen</div>
          </div>
        </div>
      </section>

      <p className="pb-12 text-center text-xs text-muted-foreground">Vorschau „Premium 2 · Mesh + Bento“ — Design-Test, nicht final. *Rabatt nur mit Partnerschulen.</p>
    </div>
  );
}
