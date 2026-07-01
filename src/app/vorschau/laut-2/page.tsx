import type { Metadata } from "next";
import Link from "next/link";

/**
 * VORSCHAU „Laut 2" — Bold Editorial / Maximalist-Minimal: riesige Typografie,
 * viel Weißraum, EIN lauter Akzent, kinetische Verlaufs-Headline. SSR, CSS-only.
 */
export const metadata: Metadata = {
  title: "Vorschau — Laut 2 (Bold Editorial)",
  robots: { index: false, follow: false },
};

export default function Laut2() {
  return (
    <div className="min-h-screen bg-[#0c0c0d] text-white">
      <div className="mx-auto max-w-6xl px-6">
        <header className="flex items-center justify-between py-7">
          <span className="text-lg font-semibold tracking-tight">FAHRVERGLEICH</span>
          <Link href="/vorschau" className="rounded-full border border-white/20 px-4 py-1.5 text-sm text-white/80 transition hover:bg-white/10">← Vorschauen</Link>
        </header>

        <section className="py-12 sm:py-16">
          <span className="text-sm font-medium uppercase tracking-[0.3em] text-[#c6ff3a]">Der Fahrschul-Vergleich</span>
          <h1 className="mt-6 text-[15vw] font-black uppercase leading-[0.84] tracking-[-0.03em] sm:text-[10rem]">
            Schluss<br />
            <span className="vp-text-pan bg-gradient-to-r from-[#c6ff3a] via-[#7dd3fc] to-[#c6ff3a] bg-[length:200%_auto] bg-clip-text text-transparent">mit</span><br />
            Raten.
          </h1>
          <div className="mt-10 flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
            <p className="max-w-md text-xl font-medium leading-relaxed text-white/70">
              Preise, Klassen und echte Bestehensquoten — radikal transparent. Du siehst alles.
              Sofort. Ohne Kleingedrucktes.
            </p>
            <div className="flex w-full max-w-md flex-col gap-3 sm:flex-row">
              <input disabled placeholder="Deine Stadt …" className="flex-1 rounded-full border border-white/20 bg-white/5 px-5 py-4 text-base font-medium placeholder:text-white/40 focus:outline-none" />
              <button className="rounded-full bg-[#c6ff3a] px-7 py-4 text-base font-bold text-[#0c0c0d] transition hover:bg-white">Los →</button>
            </div>
          </div>
        </section>

        {/* Riesige Zahlen-/Aussage-Reihe (qualitativ, ohne erfundene Werte) */}
        <section className="grid gap-px overflow-hidden rounded-3xl border border-white/10 bg-white/10 sm:grid-cols-3">
          {[["Klar", "Jede Position einzeln — kein Lockpreis."], ["Echt", "Bestehensquoten statt Bauchgefühl."], ["Frei", "Unabhängig & 100 % kostenlos."]].map(([t, d]) => (
            <div key={t} className="bg-[#0c0c0d] p-8">
              <div className="text-5xl font-black text-[#c6ff3a]">{t}</div>
              <p className="mt-3 text-sm text-white/60">{d}</p>
            </div>
          ))}
        </section>

        <section className="py-20 text-center">
          <h2 className="text-balance text-5xl font-black uppercase leading-[0.95] sm:text-7xl">Bereit?<br /><span className="text-[#c6ff3a]">Dann los.</span></h2>
          <button className="mt-8 rounded-full bg-[#c6ff3a] px-9 py-4 text-lg font-bold text-[#0c0c0d] transition hover:bg-white">Fahrschule finden</button>
          <p className="mt-10 text-xs text-white/30">Vorschau „Laut 2 · Bold Editorial“ — Design-Test, nicht final.</p>
        </section>
      </div>
    </div>
  );
}
