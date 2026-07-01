import type { Metadata } from "next";
import Link from "next/link";

/**
 * VORSCHAU „Frech" (jung/bissig/verrückt) — reiner Design-Test, SSR, CSS-only.
 * Nicht verlinkt im Footer, `noindex`. Ändert die echte Startseite NICHT.
 * Copy ist frech, aber ohne erfundene Kennzahlen.
 */
export const metadata: Metadata = {
  title: "Vorschau — Frech",
  robots: { index: false, follow: false },
};

const TAGS = ["Klasse B", "A1 · A2 · A", "Automatik", "B196", "BE", "Schnell zum Schein", "Kein Lockpreis", "Endlich Durchblick"];

export default function VorschauFrech() {
  return (
    <div className="min-h-screen bg-[#faf7ef] text-[#161616] [--ink:#161616]">
      <div className="mx-auto max-w-[80rem] px-5">
        {/* Nav */}
        <header className="flex items-center justify-between py-6">
          <span className="text-xl font-black tracking-tight">FAHR<span className="rounded-md bg-[#a3e635] px-1.5">LOS</span></span>
          <Link href="/vorschau" className="rounded-full border-2 border-[#161616] bg-white px-4 py-1.5 text-sm font-bold shadow-[3px_3px_0_#161616] transition hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[1px_1px_0_#161616]">← Vorschauen</Link>
        </header>

        {/* Hero */}
        <section className="relative isolate overflow-hidden rounded-[2.2rem] border-2 border-[#161616] bg-white px-6 py-16 shadow-[8px_8px_0_#161616] sm:px-12 sm:py-20">
          <div className="vp-blob absolute inset-0 -z-10 opacity-25" />
          <span className="vp-wobble inline-block rounded-full border-2 border-[#161616] bg-[#f472b6] px-4 py-1.5 text-sm font-black text-white shadow-[3px_3px_0_#161616]">SCHLUSS MIT FAHRSCHUL-ROULETTE 🎲</span>
          <h1 className="mt-6 text-6xl font-black uppercase leading-[0.92] tracking-[-0.02em] sm:text-8xl">
            Finde die<br />
            <span className="bg-[#a3e635] px-2 [box-decoration-break:clone] [-webkit-box-decoration-break:clone]">Fahrschule,</span><br />
            die zu dir passt.
          </h1>
          <p className="mt-7 max-w-lg text-lg font-medium leading-relaxed text-[#3a3a3a]">
            Echte Preise. Echte Bewertungen. Null Blabla. Tipp deine Stadt ein und
            sieh sofort, wo du am schnellsten (und fairsten) zum Schein kommst.
          </p>

          <div className="mt-8 flex max-w-xl flex-col gap-3 sm:flex-row">
            <input
              disabled
              placeholder="Deine Stadt … z. B. Aachen"
              className="flex-1 rounded-2xl border-2 border-[#161616] bg-white px-5 py-4 text-base font-medium placeholder:text-[#9a9a9a] focus:outline-none"
            />
            <button className="rounded-2xl border-2 border-[#161616] bg-[#161616] px-7 py-4 text-base font-black text-[#a3e635] shadow-[4px_4px_0_#a3e635] transition hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[2px_2px_0_#a3e635]">LOS GEHT&rsquo;S →</button>
          </div>
        </section>

        {/* Marquee */}
        <section className="my-7 overflow-hidden rounded-2xl border-2 border-[#161616] bg-[#161616] py-3">
          <div className="marquee-track items-center gap-4 text-lg font-black text-[#faf7ef]">
            {[...TAGS, ...TAGS].map((t, i) => (
              <span key={`${t}-${i}`} className="inline-flex items-center gap-4 whitespace-nowrap">
                {t} <span className="text-[#a3e635]">✦</span>
              </span>
            ))}
          </div>
        </section>

        {/* Bunte Karten */}
        <section className="grid gap-5 py-10 sm:grid-cols-3">
          {[
            { bg: "#a3e635", t: "Preise ohne Tricks", d: "Grundgebühr, Stunden, Sonderfahrten, Prüfung — alles offen. Kein „ab 0 €“-Quatsch." },
            { bg: "#38bdf8", t: "In deiner Nähe", d: "Sag uns deinen Standort, wir zeigen dir die Schulen drumherum auf der Karte." },
            { bg: "#f472b6", t: "Direkt anmelden", d: "Schule gefunden? Online anmelden — fertig. Kein Telefon-Ping-Pong." },
          ].map((c, i) => (
            <div
              key={c.t}
              className="rounded-[1.6rem] border-2 border-[#161616] p-7 shadow-[6px_6px_0_#161616] transition hover:-translate-y-1.5"
              style={{ background: c.bg }}
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl border-2 border-[#161616] bg-white text-xl font-black">{i + 1}</span>
              <h3 className="mt-5 text-2xl font-black uppercase leading-tight">{c.t}</h3>
              <p className="mt-2 text-[15px] font-medium leading-relaxed text-[#161616]/80">{c.d}</p>
            </div>
          ))}
        </section>

        {/* Big CTA */}
        <section className="relative my-10 overflow-hidden rounded-[2.2rem] border-2 border-[#161616] bg-[#161616] px-6 py-20 text-center text-white sm:px-12">
          <div className="vp-blob absolute inset-0 -z-10 opacity-30" />
          <h2 className="text-balance text-5xl font-black uppercase leading-[0.95] sm:text-7xl">
            Worauf<br /><span className="text-[#a3e635]">wartest du?</span>
          </h2>
          <p className="mx-auto mt-5 max-w-md text-lg font-medium text-white/80">Deine Fahrschule ist nur einen Klick weit weg.</p>
          <button className="mt-8 rounded-2xl border-2 border-[#a3e635] bg-[#a3e635] px-9 py-4 text-lg font-black text-[#161616] shadow-[5px_5px_0_#faf7ef] transition hover:translate-x-0.5 hover:translate-y-0.5">JETZT LOSLEGEN 🚗💨</button>
          <p className="mt-10 text-xs font-medium text-white/40">Vorschau „Frech“ — Design-Test, nicht final. Marke ist Platzhalter.</p>
        </section>
      </div>
    </div>
  );
}
