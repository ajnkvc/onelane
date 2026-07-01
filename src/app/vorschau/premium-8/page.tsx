import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import { SearchBar } from "@/components/search/search-bar";
import { Typewriter } from "@/components/home/typewriter";
import { InteractiveBg } from "@/components/home/interactive-bg";

/**
 * VORSCHAU „Premium 8" — interaktiver Hintergrund: Verlaufs-Blobs folgen sanft
 * der Maus (Parallax) über die Client-Insel `InteractiveBg` (CSP-konform).
 */
export const metadata: Metadata = {
  title: "Vorschau — Premium 8 (Interaktiv)",
  robots: { index: false, follow: false },
};

const SLOGAN = ["günstigste", "nächste", "bestbewertete", "passende"];
const PILLS = ["100 % kostenlos", "unabhängig", "echte Bestehensquoten"];

// Jeder Layer bewegt sich unterschiedlich stark (Parallax-Tiefe) via --mx/--my.
const blob = (tx: number, ty: number): CSSProperties => ({
  transform: `translate3d(calc(var(--mx) * ${tx}px), calc(var(--my) * ${ty}px), 0)`,
  transition: "transform 0.3s cubic-bezier(0.22,1,0.36,1)",
});

export default function PremiumInteractive() {
  return (
    <div className="bg-[#071a2c]">
      <div className="mx-auto max-w-6xl px-6 pt-4 text-right">
        <Link href="/vorschau" className="text-sm text-white/60 underline-offset-2 hover:text-white hover:underline">← Vorschauen</Link>
      </div>

      <section className="relative z-20 overflow-hidden">
        <InteractiveBg className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute inset-0" style={{ background: "radial-gradient(60% 60% at 50% 10%, rgba(14,165,233,0.18), transparent 60%), #071a2c" }} />
          <div className="absolute -left-10 top-10 size-[26rem] rounded-full blur-3xl" style={{ ...blob(40, 26), background: "radial-gradient(circle, rgba(14,165,233,0.55), transparent 70%)" }} />
          <div className="absolute right-0 top-0 size-[24rem] rounded-full blur-3xl" style={{ ...blob(-34, 22), background: "radial-gradient(circle, rgba(99,102,241,0.5), transparent 70%)" }} />
          <div className="absolute bottom-0 left-1/3 size-[28rem] rounded-full blur-3xl" style={{ ...blob(26, -30), background: "radial-gradient(circle, rgba(34,211,238,0.4), transparent 70%)" }} />
          <div className="vp-grid absolute inset-0 opacity-[0.12]" />
        </InteractiveBg>

        <div className="relative mx-auto flex w-full max-w-3xl flex-col items-center gap-6 px-6 pb-28 pt-20 text-center sm:pt-28">
          <span className="vp-rise inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-sm font-medium text-[#cdeafe] backdrop-blur">
            <span className="size-2 rounded-full bg-[#22d3ee]" /> Beweg die Maus — der Hintergrund reagiert
          </span>
          <h1 className="vp-rise-2 text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-6xl">
            Finde die <Typewriter words={SLOGAN} className="bg-gradient-to-r from-[#7dd3fc] to-[#a3e635] bg-clip-text text-transparent" /><br /> Fahrschule deiner Stadt.
          </h1>
          <p className="vp-rise-2 max-w-xl text-lg text-[#aecbe2]">
            Preise, Klassen und <strong className="text-white">echte Bestehensquoten</strong> — klar verglichen.
          </p>
          <div className="vp-rise-3 mt-2 w-full max-w-xl rounded-[1.6rem] border border-white/15 bg-white/95 p-2 shadow-[0_30px_70px_-30px_rgba(0,0,0,0.7)] backdrop-blur"><SearchBar /></div>
          <div className="vp-rise-3 flex flex-wrap items-center justify-center gap-4 text-sm text-[#aecbe2]">
            {PILLS.map((p) => (<span key={p} className="inline-flex items-center gap-1.5"><span className="text-[#a3e635]">✓</span> {p}</span>))}
          </div>
        </div>
      </section>

      <p className="pb-12 text-center text-xs text-white/40">Vorschau „Premium 8 · Interaktiv“ — Design-Test, nicht final.</p>
    </div>
  );
}
