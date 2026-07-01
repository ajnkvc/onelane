import type { Metadata } from "next";
import Link from "next/link";

/**
 * VORSCHAU „Laut 7" — Comic / Pop-Art: Halbton-Punkte, Sprechblase, eine
 * Comic-Fahrlehrer-Figur (inline-SVG), knallige Pop-Farben. SSR, CSS/SVG-only.
 */
export const metadata: Metadata = {
  title: "Vorschau — Laut 7 (Comic Pop-Art)",
  robots: { index: false, follow: false },
};

/** Comic-Fahrlehrer mit Daumen hoch (Pop-Art). */
function ComicCoach() {
  return (
    <svg viewBox="0 0 240 260" className="h-full w-full" role="img" aria-label="Comic-Fahrlehrer, illustrativ">
      <defs><pattern id="l7-dots" width="10" height="10" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="2" fill="#111" opacity="0.18" /></pattern></defs>
      <circle cx="120" cy="120" r="110" fill="#ffd23f" />
      <circle cx="120" cy="120" r="110" fill="url(#l7-dots)" />
      {/* Körper */}
      <path d="M70 250 q50 -60 100 0 Z" fill="#2f5bff" stroke="#111" strokeWidth="4" />
      <rect x="96" y="150" width="48" height="60" rx="14" fill="#2f5bff" stroke="#111" strokeWidth="4" />
      {/* Kopf */}
      <circle cx="120" cy="118" r="46" fill="#ffe0bd" stroke="#111" strokeWidth="4" />
      {/* Sonnenbrille */}
      <rect x="84" y="106" width="72" height="20" rx="8" fill="#111" />
      <rect x="90" y="110" width="24" height="12" rx="5" fill="#38bdf8" />
      <rect x="126" y="110" width="24" height="12" rx="5" fill="#38bdf8" />
      {/* Lächeln */}
      <path d="M104 142 q16 16 32 0" fill="none" stroke="#111" strokeWidth="4" strokeLinecap="round" />
      {/* Mütze */}
      <path d="M74 96 q46 -40 92 0 Z" fill="#dc2626" stroke="#111" strokeWidth="4" />
      <rect x="70" y="92" width="100" height="12" rx="6" fill="#dc2626" stroke="#111" strokeWidth="4" />
      {/* Daumen hoch */}
      <g className="vp-wobble" style={{ transformOrigin: "170px 170px" }}>
        <circle cx="178" cy="172" r="22" fill="#ffe0bd" stroke="#111" strokeWidth="4" />
        <rect x="172" y="138" width="12" height="26" rx="6" fill="#ffe0bd" stroke="#111" strokeWidth="4" />
      </g>
    </svg>
  );
}

export default function Laut7() {
  return (
    <div className="min-h-screen bg-[#fff8e6] text-[#111]">
      <div className="mx-auto max-w-6xl px-5">
        <header className="flex items-center justify-between py-6">
          <span className="text-xl font-black tracking-tight">FAHR<span className="text-[#2f5bff]">POW!</span></span>
          <Link href="/vorschau" className="rounded-full border-[3px] border-[#111] bg-white px-4 py-1.5 text-sm font-black shadow-[3px_3px_0_#111] transition hover:translate-x-0.5 hover:translate-y-0.5">← Vorschauen</Link>
        </header>

        <section className="grid items-center gap-8 py-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <span className="inline-block -rotate-2 rounded-xl border-[3px] border-[#111] bg-[#a3e635] px-4 py-1.5 text-sm font-black uppercase shadow-[4px_4px_0_#111]">Boom! Endlich Durchblick</span>
            <h1 className="mt-6 text-6xl font-black uppercase leading-[0.9] tracking-tight sm:text-8xl" style={{ WebkitTextStroke: "2px #111" }}>
              <span className="text-[#2f5bff]">Fahrschule</span><br />gefunden.
            </h1>
            <div className="relative mt-6 max-w-md rounded-2xl border-[3px] border-[#111] bg-white p-4 text-lg font-bold shadow-[5px_5px_0_#111]">
              Preise, Klassen &amp; echte Bestehensquoten — knallhart verglichen. Tippe deine Stadt!
              <span className="absolute -bottom-3 left-10 size-5 rotate-45 border-b-[3px] border-r-[3px] border-[#111] bg-white" />
            </div>
            <div className="mt-7 flex max-w-lg flex-col gap-3 sm:flex-row">
              <input disabled placeholder="Deine Stadt …" className="flex-1 rounded-xl border-[3px] border-[#111] bg-white px-5 py-4 text-base font-bold placeholder:text-[#9a9a9a] focus:outline-none" />
              <button className="rounded-xl border-[3px] border-[#111] bg-[#dc2626] px-7 py-4 text-base font-black text-white shadow-[4px_4px_0_#111] transition hover:translate-x-0.5 hover:translate-y-0.5">POW! →</button>
            </div>
          </div>
          <div className="mx-auto w-full max-w-sm"><ComicCoach /></div>
        </section>

        <p className="pb-12 text-center text-xs font-bold text-[#7a7363]">Vorschau „Laut 7 · Comic Pop-Art“ — Design-Test, nicht final.</p>
      </div>
    </div>
  );
}
