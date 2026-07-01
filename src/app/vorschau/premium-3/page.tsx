import type { Metadata } from "next";
import Link from "next/link";
import { SearchBar } from "@/components/search/search-bar";
import { Typewriter } from "@/components/home/typewriter";

/**
 * VORSCHAU „Premium 3" — ruhiger Spotlight + dezentes Lenkrad-/Straßen-Motiv
 * hinter einer glasigen Suche. SSR, CSS/SVG-only. `noindex`.
 */
export const metadata: Metadata = {
  title: "Vorschau — Premium 3 (Spotlight)",
  robots: { index: false, follow: false },
};

const SLOGAN = ["günstigste", "nächste", "bestbewertete", "passende"];

export default function PremiumSpotlight() {
  return (
    <div className="bg-[#071a2c]">
      <div className="mx-auto max-w-6xl px-6 pt-4 text-right">
        <Link href="/vorschau" className="text-sm text-white/60 underline-offset-2 hover:text-white hover:underline">← Vorschauen</Link>
      </div>

      <section className="relative z-20 overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          {/* Spotlight */}
          <div className="absolute inset-0" style={{ background: "radial-gradient(60% 60% at 50% 0%, rgba(14,165,233,0.35), transparent 60%), radial-gradient(50% 50% at 50% 120%, rgba(34,211,238,0.18), transparent 60%), #071a2c" }} />
          {/* Lenkrad-Motiv, sehr dezent */}
          <svg className="vp-float absolute left-1/2 top-24 -z-10 size-[460px] -translate-x-1/2 opacity-[0.10]" viewBox="0 0 200 200" fill="none" stroke="#bfe7ff" strokeWidth="3">
            <circle cx="100" cy="100" r="78" /><circle cx="100" cy="100" r="26" />
            <path d="M100 126 V174 M126 100 H174 M74 100 H26" />
            <circle cx="100" cy="100" r="96" strokeOpacity="0.5" strokeDasharray="4 10" />
          </svg>
        </div>

        <div className="relative mx-auto flex w-full max-w-3xl flex-col items-center gap-6 px-6 pb-24 pt-20 text-center sm:pt-28">
          <span className="vp-rise inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-sm font-medium text-[#cdeafe] backdrop-blur">
            <span className="size-2 rounded-full bg-[#22d3ee]" /> Transparenter Fahrschul-Vergleich
          </span>
          <h1 className="vp-rise-2 text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-6xl">
            Finde die <Typewriter words={SLOGAN} className="bg-gradient-to-r from-[#7dd3fc] to-[#a3e635] bg-clip-text text-transparent" /><br /> Fahrschule deiner Stadt.
          </h1>
          <p className="vp-rise-2 max-w-xl text-lg text-[#aecbe2]">
            Preise, Klassen und <strong className="text-white">echte Bestehensquoten</strong> — klar verglichen.
          </p>
          <div className="vp-rise-3 mt-2 w-full max-w-xl rounded-[1.6rem] border border-white/15 bg-white/95 p-2 shadow-[0_30px_70px_-30px_rgba(0,0,0,0.7)] backdrop-blur">
            <SearchBar />
          </div>
          <div className="vp-rise-3 flex flex-wrap items-center justify-center gap-4 text-sm text-[#aecbe2]">
            <span className="inline-flex items-center gap-1.5"><span className="text-[#a3e635]">✓</span> 100 % kostenlos</span>
            <span className="inline-flex items-center gap-1.5"><span className="text-[#a3e635]">✓</span> unabhängig</span>
            <span className="inline-flex items-center gap-1.5"><span className="text-[#a3e635]">✓</span> echte Bestehensquoten</span>
          </div>
        </div>
      </section>

      <p className="pb-12 text-center text-xs text-white/40">Vorschau „Premium 3 · Spotlight“ — Design-Test, nicht final.</p>
    </div>
  );
}
