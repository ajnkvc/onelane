import type { Metadata } from "next";
import Link from "next/link";
import { SearchBar } from "@/components/search/search-bar";
import { Typewriter } from "@/components/home/typewriter";

/**
 * VORSCHAU „Premium 4 · Topografie" — ruhiges, edles Fintech/Apple-Premium.
 * Hinter der Suche liegen feine topografische Höhenlinien (inline-SVG, sehr dezent),
 * wie eine abstrakte Landkarte. Viel Weißraum. SSR, CSS/SVG-only. `noindex`.
 */
export const metadata: Metadata = {
  title: "Vorschau — Premium 4 (Topografie)",
  robots: { index: false, follow: false },
};

const SLOGAN = ["günstigste", "nächste", "bestbewertete", "passende"];

export default function PremiumTopografie() {
  return (
    <div className="bg-[#f7f8fa]">
      <div className="mx-auto max-w-6xl px-6 pt-4 text-right">
        <Link
          href="/vorschau"
          className="text-sm text-[#5b6b7c] underline-offset-2 transition-colors hover:text-[#1b3a5c] hover:underline"
        >
          ← Vorschauen
        </Link>
      </div>

      <section className="relative overflow-hidden">
        {/* Topografie-Hintergrund: feine Höhenlinien, sehr dezent, hinter dem Inhalt */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(60% 50% at 50% 0%, rgba(27,58,92,0.06), transparent 70%), linear-gradient(180deg, #ffffff 0%, #f7f8fa 100%)",
            }}
          />
          <svg
            className="absolute inset-x-0 top-0 h-full w-full"
            viewBox="0 0 1200 720"
            preserveAspectRatio="xMidYMid slice"
            fill="none"
            stroke="#1b3a5c"
            strokeWidth="1"
            strokeOpacity="0.10"
          >
            <path d="M-40 120 C 220 60, 420 200, 660 150 S 1080 70, 1260 160" />
            <path d="M-40 190 C 220 130, 420 270, 660 220 S 1080 140, 1260 230" />
            <path d="M-40 260 C 220 200, 420 340, 660 290 S 1080 210, 1260 300" />
            <path d="M-40 330 C 220 270, 420 410, 660 360 S 1080 280, 1260 370" />
            <path d="M-40 400 C 220 340, 420 480, 660 430 S 1080 350, 1260 440" />
            <path d="M-40 470 C 220 410, 420 550, 660 500 S 1080 420, 1260 510" />
            <path d="M-40 540 C 220 480, 420 620, 660 570 S 1080 490, 1260 580" />
            <path d="M-40 610 C 220 550, 420 690, 660 640 S 1080 560, 1260 650" />
            {/* innere Kontur-Inseln, noch zarter */}
            <g strokeOpacity="0.5">
              <path d="M470 300 C 540 270, 640 300, 660 360 S 560 440, 480 410 S 400 330, 470 300 Z" />
              <path d="M505 325 C 555 305, 620 325, 635 365 S 565 415, 510 395 S 455 345, 505 325 Z" />
              <path d="M850 230 C 910 215, 980 245, 985 295 S 905 355, 850 335 S 790 250, 850 230 Z" />
            </g>
          </svg>
        </div>

        <div className="relative mx-auto flex w-full max-w-3xl flex-col items-center gap-6 px-6 pb-28 pt-20 text-center sm:pt-28">
          <span className="vp-rise inline-flex items-center gap-2 rounded-full border border-[#1b3a5c]/12 bg-white/80 px-4 py-1.5 text-sm font-medium text-[#1b3a5c] shadow-[0_1px_3px_rgba(27,58,92,0.06)] backdrop-blur">
            <span className="size-2 rounded-full bg-[#1b3a5c]" /> Transparenter Fahrschul-Vergleich
          </span>

          <h1 className="vp-rise-2 text-4xl font-semibold leading-[1.05] tracking-tight text-[#0f2438] sm:text-6xl">
            Finde die{" "}
            <Typewriter words={SLOGAN} className="text-gradient-brand" />
            <br /> Fahrschule deiner Stadt.
          </h1>

          <p className="vp-rise-2 max-w-xl text-lg text-[#5b6b7c]">
            Preise, Klassen und{" "}
            <strong className="font-semibold text-[#1b3a5c]">echte Bestehensquoten</strong> — ruhig
            und klar verglichen.
          </p>

          <div className="vp-rise-3 mt-2 w-full max-w-xl rounded-[1.6rem] border border-[#1b3a5c]/10 bg-white/95 p-2 shadow-[0_30px_70px_-35px_rgba(27,58,92,0.45)] backdrop-blur">
            <SearchBar />
          </div>

          <div className="vp-rise-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-3 text-sm text-[#5b6b7c]">
            <span className="inline-flex items-center gap-1.5">
              <span className="text-[#1b3a5c]">✓</span> 100 % kostenlos
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="text-[#1b3a5c]">✓</span> unabhängig
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="text-[#1b3a5c]">✓</span> echte Bestehensquoten
            </span>
          </div>
        </div>
      </section>

      <p className="pb-12 text-center text-xs text-[#9aa7b4]">
        Vorschau „Premium 4 · Topografie“ — Design-Test, nicht final.
      </p>
    </div>
  );
}
