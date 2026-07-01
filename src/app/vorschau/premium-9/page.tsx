import type { Metadata } from "next";
import Link from "next/link";
import { SearchBar } from "@/components/search/search-bar";
import { Typewriter } from "@/components/home/typewriter";

/**
 * VORSCHAU „Premium 9" — schwebende, animierte Widgets um die Suche
 * (driftende Beispiel-Karten, pulsierender Karten-Pin, Quoten-Ring).
 * Reines CSS (vp-drift/vp-float/pulse-ring), CSP-konform. Beispielwerte markiert.
 */
export const metadata: Metadata = {
  title: "Vorschau — Premium 9 (Live-Widgets)",
  robots: { index: false, follow: false },
};

const SLOGAN = ["günstigste", "nächste", "bestbewertete", "passende"];

export default function PremiumWidgets() {
  return (
    <div className="bg-[var(--background)]">
      <div className="mx-auto max-w-6xl px-6 pt-4 text-right">
        <Link href="/vorschau" className="text-sm text-muted-foreground underline-offset-2 hover:underline">← Vorschauen</Link>
      </div>

      <section className="relative z-20 overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10"><div className="vp-aurora absolute inset-0 opacity-70" /><div className="vp-grid absolute inset-0 opacity-50" /></div>

        <div className="relative mx-auto max-w-5xl px-6 pb-28 pt-20 text-center sm:pt-24">
          {/* schwebende Widgets (nur große Screens) */}
          <div aria-hidden className="pointer-events-none absolute inset-0 hidden lg:block">
            <div className="vp-drift absolute left-0 top-24 w-56 rounded-2xl border border-[#e4ecf4] bg-white/90 p-3 text-left shadow-xl backdrop-blur">
              <div className="flex items-center gap-2"><span className="grid size-9 place-items-center rounded-lg bg-gradient-to-br from-[#0ea5e9] to-[#22d3ee] text-xs font-bold text-white">FN</span><div><div className="text-sm font-semibold text-[#1b3a5c]">Fahrschule Nord</div><div className="text-xs text-muted-foreground">B · A1 · BE</div></div></div>
              <div className="mt-2 flex items-center justify-between text-xs"><span className="text-muted-foreground">Ø Bestehen</span><span className="font-semibold text-[#65a30d]">hoch</span></div>
            </div>

            <div className="vp-drift-2 absolute right-0 top-16 w-44 rounded-2xl border border-[#e4ecf4] bg-white/90 p-4 text-center shadow-xl backdrop-blur">
              <div className="mx-auto grid size-16 place-items-center rounded-full" style={{ background: "conic-gradient(#0ea5e9 0 63%, #e2e8f0 63% 100%)" }}>
                <span className="grid size-12 place-items-center rounded-full bg-white text-sm font-bold text-[#1b3a5c]">63%</span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">bestehen im 1. Anlauf*</p>
            </div>

            <div className="vp-drift absolute bottom-6 left-10 flex items-center gap-2 rounded-full border border-[#e4ecf4] bg-white/90 px-3 py-2 text-xs shadow-xl backdrop-blur">
              <span className="relative flex size-3"><span className="pulse-ring absolute inline-flex size-3 rounded-full bg-brand-cyan" /><span className="relative inline-flex size-3 rounded-full bg-brand-sky" /></span>
              3 Fahrschulen in der Nähe
            </div>

            <div className="vp-drift-2 absolute bottom-2 right-8 w-48 rounded-2xl border border-[#e4ecf4] bg-white/90 p-3 text-left shadow-xl backdrop-blur">
              <div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">Grundgebühr</span><span className="font-semibold">Beispiel</span></div>
              <div className="mt-1 flex items-center justify-between text-xs"><span className="text-muted-foreground">Fahrstunde</span><span className="font-semibold">Beispiel</span></div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary"><div className="h-full w-2/3 rounded-full bg-gradient-to-r from-[#0ea5e9] to-[#a3e635]" /></div>
            </div>
          </div>

          {/* Hero */}
          <div className="relative mx-auto flex max-w-2xl flex-col items-center gap-6">
            <span className="vp-rise inline-flex items-center gap-2 rounded-full border border-brand-sky/25 bg-card/70 px-4 py-1.5 text-sm font-medium text-[#0369a1] shadow-sm backdrop-blur"><span className="size-2 rounded-full bg-brand-sky" /> Alles auf einen Blick</span>
            <h1 className="vp-rise-2 text-4xl font-bold leading-[1.05] tracking-tight text-[#1b3a5c] sm:text-6xl">Finde die <Typewriter words={SLOGAN} className="text-gradient-brand" /><br /> Fahrschule deiner Stadt.</h1>
            <p className="vp-rise-2 max-w-xl text-lg text-muted-foreground">Preise, Klassen und <strong className="text-foreground">echte Bestehensquoten</strong> — live nebeneinander.</p>
            <div className="vp-rise-3 mt-2 w-full max-w-xl"><SearchBar /></div>
          </div>
        </div>
      </section>

      <p className="pb-12 text-center text-xs text-muted-foreground">Vorschau „Premium 9 · Live-Widgets“ — Design-Test, nicht final. *Beispielwert (bundesweit, TÜV-Verband), keine Schul-Angabe.</p>
    </div>
  );
}
