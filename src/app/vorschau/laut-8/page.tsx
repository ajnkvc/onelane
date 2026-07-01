import type { Metadata } from "next";
import Link from "next/link";

/**
 * VORSCHAU „Laut 8" — Retro-Arcade: Neon-Grid-Horizont, Scanlines, 80s-Vibe.
 * Laut & verrückt, aber kohärent. SSR, CSS/SVG-only, CSP-konform.
 */
export const metadata: Metadata = {
  title: "Vorschau — Laut 8 (Retro Arcade)",
  robots: { index: false, follow: false },
};

const TAGS = ["KLASSE B", "AUTOMATIK", "A1·A2·A", "BE", "B196", "INSERT COIN"];

export default function Laut8() {
  return (
    <div className="min-h-screen overflow-hidden bg-[#0a0420] text-white">
      <div className="mx-auto max-w-6xl px-5">
        <header className="relative z-10 flex items-center justify-between py-6">
          <span className="text-xl font-black tracking-widest text-[#ff2e97]" style={{ textShadow: "0 0 10px rgba(255,46,151,0.7)" }}>FAHR★ARCADE</span>
          <Link href="/vorschau" className="rounded-md border border-[#22d3ee]/50 bg-white/5 px-4 py-1.5 text-sm font-bold text-[#22d3ee] transition hover:bg-white/10">← Vorschauen</Link>
        </header>

        <section className="relative isolate overflow-hidden rounded-3xl border border-[#ff2e97]/30 px-6 py-20 text-center sm:py-28" style={{ background: "linear-gradient(180deg,#160a33,#0a0420)" }}>
          {/* Neon-Grid-Horizont */}
          <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-1/2" style={{ background: "linear-gradient(transparent, rgba(255,46,151,0.10))" }}>
            <svg viewBox="0 0 800 300" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 h-full w-full">
              <defs><linearGradient id="l8-line" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#22d3ee" stopOpacity="0.1" /><stop offset="1" stopColor="#22d3ee" stopOpacity="0.7" /></linearGradient></defs>
              {Array.from({ length: 11 }).map((_, i) => (<line key={`v${i}`} x1={400 + (i - 5) * 30} y1="120" x2={400 + (i - 5) * 220} y2="300" stroke="url(#l8-line)" strokeWidth="2" />))}
              {Array.from({ length: 7 }).map((_, i) => { const y = 120 + i * i * 4.2; return <line key={`h${i}`} x1="0" y1={y} x2="800" y2={y} stroke="url(#l8-line)" strokeWidth="2" />; })}
            </svg>
          </div>
          <div aria-hidden className="vp-scan pointer-events-none absolute inset-0 -z-10" />

          <span className="vp-rise inline-block rounded-md border border-[#22d3ee]/60 bg-[#22d3ee]/10 px-4 py-1.5 text-xs font-black uppercase tracking-[0.3em] text-[#22d3ee]">★ Player 1 · Führerschein ★</span>
          <h1 className="vp-rise-2 mt-7 text-6xl font-black uppercase leading-[0.9] tracking-tight sm:text-8xl">
            <span className="block text-[#ff2e97]" style={{ textShadow: "0 0 18px rgba(255,46,151,0.8)" }}>Level up</span>
            <span className="vp-text-pan bg-gradient-to-r from-[#22d3ee] via-[#a3e635] to-[#22d3ee] bg-[length:200%_auto] bg-clip-text text-transparent">zum Schein.</span>
          </h1>
          <p className="vp-rise-2 mx-auto mt-6 max-w-lg text-lg font-medium text-[#c9b8ff]">
            Preise, Klassen &amp; echte Bestehensquoten — vergleichen wie ein Highscore. Stadt eingeben und los!
          </p>
          <div className="vp-rise-3 mx-auto mt-8 flex max-w-xl flex-col gap-3 sm:flex-row">
            <input disabled placeholder="STADT EINGEBEN …" className="flex-1 rounded-lg border border-[#22d3ee]/50 bg-black/40 px-5 py-4 text-base font-bold tracking-wide text-white placeholder:text-white/40 focus:outline-none" />
            <button className="rounded-lg bg-[#ff2e97] px-8 py-4 text-base font-black uppercase text-white transition hover:brightness-110" style={{ boxShadow: "0 0 22px rgba(255,46,151,0.6)" }}>Start →</button>
          </div>
        </section>

        <section className="my-6 overflow-hidden rounded-xl border border-white/10 bg-black/30 py-3">
          <div className="marquee-track items-center gap-6 text-sm font-black uppercase tracking-widest text-[#a3e635]">
            {[...TAGS, ...TAGS].map((t, i) => (<span key={`${t}-${i}`} className="inline-flex items-center gap-6 whitespace-nowrap">{t} <span className="text-[#ff2e97]">★</span></span>))}
          </div>
        </section>

        <p className="pb-12 text-center text-xs font-bold text-white/40">Vorschau „Laut 8 · Retro Arcade“ — Design-Test, nicht final.</p>
      </div>
    </div>
  );
}
