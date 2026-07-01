import type { Metadata } from "next";
import Link from "next/link";

/**
 * VORSCHAU „Laut 3" — warmes Mesh-Pop (2026-Mesh-Gradient): freundlich, jung,
 * rund, aber poliert & kohärent. Laut ohne billig. SSR, CSS-only. `noindex`.
 */
export const metadata: Metadata = {
  title: "Vorschau — Laut 3 (Mesh Pop)",
  robots: { index: false, follow: false },
};

const TAGS = ["Klasse B", "Automatik B197", "A1 · A2 · A", "BE", "B196", "Schnell & fair"];

export default function Laut3() {
  return (
    <div className="min-h-screen bg-[#fff4ec] text-[#2a1a12]">
      <div className="mx-auto max-w-6xl px-5">
        <header className="flex items-center justify-between py-6">
          <span className="text-xl font-black tracking-tight">fahr<span className="text-[#ff5c8a]">mit</span></span>
          <Link href="/vorschau" className="rounded-full bg-white px-4 py-1.5 text-sm font-bold shadow-md ring-1 ring-black/5 transition hover:-translate-y-0.5">← Vorschauen</Link>
        </header>

        <section className="relative isolate overflow-hidden rounded-[2.4rem] px-6 py-16 text-center shadow-[0_30px_70px_-40px_rgba(255,92,138,0.6)] sm:px-12 sm:py-24">
          <div className="vp-mesh absolute inset-0 -z-10" />
          <span className="vp-rise inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-1.5 text-sm font-bold text-[#d6356b] shadow-sm backdrop-blur">🚗 Dein Weg zum Führerschein</span>
          <h1 className="vp-rise-2 mx-auto mt-6 max-w-3xl text-5xl font-black leading-[0.98] tracking-tight sm:text-7xl">
            Die passende Fahrschule —<br /><span className="bg-gradient-to-r from-[#ff7a18] via-[#ff5c8a] to-[#7c5cff] bg-clip-text text-transparent">ohne Stress gefunden.</span>
          </h1>
          <p className="vp-rise-2 mx-auto mt-5 max-w-xl text-lg font-medium text-[#6b4f42]">
            Preise, Klassen & echte Bestehensquoten — bunt, klar und ehrlich. In Sekunden zur
            richtigen Schule in deiner Nähe.
          </p>
          <div className="vp-rise-3 mx-auto mt-8 flex max-w-xl flex-col gap-3 rounded-[1.4rem] bg-white p-2 shadow-xl sm:flex-row">
            <input disabled placeholder="Stadt oder PLZ eingeben …" className="flex-1 rounded-2xl bg-[#fff4ec] px-5 py-4 text-base font-medium placeholder:text-[#b8a99e] focus:outline-none" />
            <button className="rounded-2xl bg-gradient-to-r from-[#ff7a18] to-[#ff5c8a] px-7 py-4 text-base font-bold text-white shadow-lg transition hover:brightness-105">Finden</button>
          </div>
          <div className="vp-rise-3 mt-6 flex flex-wrap justify-center gap-2">
            {TAGS.map((t) => (<span key={t} className="rounded-full bg-white/70 px-3 py-1 text-sm font-semibold text-[#6b4f42] backdrop-blur">{t}</span>))}
          </div>
        </section>

        <section className="grid gap-5 py-12 sm:grid-cols-3">
          {[
            { e: "📍", t: "In deiner Nähe", d: "Standort eingeben, passende Schulen sofort auf der Karte." },
            { e: "💸", t: "Faire Preise", d: "Jede Position offen — Grundgebühr, Stunden, Sonderfahrten, Prüfung." },
            { e: "✅", t: "Echte Quoten", d: "Bestehensquoten statt Werbeversprechen — du entscheidest informiert." },
          ].map((c) => (
            <div key={c.t} className="rounded-3xl bg-white p-7 shadow-[0_18px_40px_-28px_rgba(124,92,255,0.5)] ring-1 ring-black/5 transition hover:-translate-y-1.5">
              <span className="grid size-12 place-items-center rounded-2xl bg-[#fff0e6] text-2xl">{c.e}</span>
              <h3 className="mt-4 text-xl font-black">{c.t}</h3>
              <p className="mt-1.5 text-sm font-medium text-[#6b4f42]">{c.d}</p>
            </div>
          ))}
        </section>

        <p className="pb-12 text-center text-xs font-medium text-[#a8978b]">Vorschau „Laut 3 · Mesh Pop“ — Design-Test, nicht final.</p>
      </div>
    </div>
  );
}
