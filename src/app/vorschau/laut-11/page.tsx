import type { Metadata } from "next";
import Link from "next/link";

/**
 * VORSCHAU „Laut 11" — Kinetic Type Wall: Wand aus großen Lauftext-Wörtern
 * in abwechselnden Richtungen als energetische Hero-Ebene, davor klare
 * Botschaft + Suche. SSR, CSS-only, CSP-konform.
 */
export const metadata: Metadata = {
  title: "Vorschau — Laut 11 (Type Wall)",
  robots: { index: false, follow: false },
};

const ROW_A = ["FAHRSCHULE", "BESTEHENSQUOTE", "KLASSE B", "FAIR"];
const ROW_B = ["TRANSPARENT", "PREISE", "AUTOMATIK", "VERGLEICHEN"];
const ROW_C = ["A1 · A2 · A", "MOTORRAD", "EHRLICH", "BE"];

function WallRow({
  words,
  reverse,
  color,
}: {
  words: string[];
  reverse?: boolean;
  color: string;
}) {
  const items = [...words, ...words, ...words];
  return (
    <div className="marquee-mask">
      <div
        className="marquee-track items-center gap-10 whitespace-nowrap text-7xl font-black uppercase leading-none tracking-tight sm:text-8xl md:text-9xl"
        style={reverse ? { flexDirection: "row-reverse" } : undefined}
      >
        {items.map((w, i) => (
          <span key={`${w}-${i}`} className="inline-flex items-center gap-10">
            <span style={{ color }}>{w}</span>
            <span aria-hidden className="text-white/15">/</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export default function Laut11() {
  return (
    <div className="min-h-screen overflow-hidden bg-[#070a16] text-white">
      <div className="mx-auto max-w-6xl px-5">
        <header className="relative z-20 flex items-center justify-between py-6">
          <span className="text-xl font-black tracking-widest text-[#fbbf24]">onelane</span>
          <Link
            href="/vorschau"
            className="rounded-md border border-white/20 bg-white/5 px-4 py-1.5 text-sm font-bold text-white/80 transition hover:bg-white/10"
          >
            ← Vorschauen
          </Link>
        </header>

        <section className="relative isolate overflow-hidden rounded-3xl border border-white/10 px-6 py-24 sm:py-32">
          {/* Type Wall — kinetische Hintergrund-Ebene */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 flex flex-col justify-center gap-2 opacity-25"
          >
            <WallRow words={ROW_A} color="#38bdf8" />
            <WallRow words={ROW_B} reverse color="#fbbf24" />
            <WallRow words={ROW_C} color="#a3e635" />
          </div>
          {/* Lesbarkeits-Schleier über der Wand */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10"
            style={{
              background:
                "radial-gradient(60% 60% at 50% 50%, rgba(7,10,22,0.85), rgba(7,10,22,0.45))",
            }}
          />

          <div className="relative z-10 text-center">
            <span className="vp-rise inline-block rounded-full border border-[#fbbf24]/50 bg-[#fbbf24]/10 px-4 py-1.5 text-xs font-black uppercase tracking-[0.3em] text-[#fbbf24]">
              Fahrschul-Vergleich
            </span>
            <h1 className="vp-rise-2 mx-auto mt-7 max-w-3xl text-5xl font-black uppercase leading-[0.95] tracking-tight sm:text-7xl">
              <span className="block">Die richtige</span>
              <span className="vp-text-pan bg-gradient-to-r from-[#38bdf8] via-[#fbbf24] to-[#a3e635] bg-[length:200%_auto] bg-clip-text text-transparent">
                Fahrschule, laut &amp; klar.
              </span>
            </h1>
            <p className="vp-rise-2 mx-auto mt-6 max-w-xl text-lg font-medium text-white/70">
              Preise, Klassen &amp; Bestehensquoten an einem Ort vergleichen — transparent und ohne Kleingedrucktes. Gib deine Stadt ein und leg los.
            </p>
            <div className="vp-rise-3 mx-auto mt-9 flex max-w-xl flex-col gap-3 sm:flex-row">
              <input
                disabled
                placeholder="Stadt oder PLZ eingeben …"
                className="flex-1 rounded-xl border border-white/20 bg-black/40 px-5 py-4 text-base font-semibold text-white placeholder:text-white/40 focus:outline-none"
              />
              <button className="rounded-xl bg-[#fbbf24] px-8 py-4 text-base font-black uppercase text-[#070a16] transition hover:brightness-110">
                Vergleichen →
              </button>
            </div>
          </div>
        </section>

        <p className="py-12 text-center text-xs font-bold text-white/40">
          Vorschau „Laut 11 · Type Wall“ — Design-Test, nicht final.
        </p>
      </div>
    </div>
  );
}
