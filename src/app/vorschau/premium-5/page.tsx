import type { Metadata } from "next";
import Link from "next/link";
import { SearchBar } from "@/components/search/search-bar";
import { Typewriter } from "@/components/home/typewriter";

/**
 * VORSCHAU „Premium 5 · Wegweiser" — ruhiges Fintech/Apple-Premium-Hero,
 * zweispaltig: links Text + Suche, rechts eine claymorphe Wegweiser-Illustration
 * (inline-SVG). Server-Komponente, CSS/SVG-only, `noindex`.
 */
export const metadata: Metadata = {
  title: "Vorschau — Premium 5 (Wegweiser)",
  robots: { index: false, follow: false },
};

const SLOGAN = ["günstigste", "nächste", "bestbewertete", "passende"];

export default function PremiumWegweiser() {
  return (
    <div className="relative overflow-hidden bg-[#f6f8fb]">
      {/* Ruhige Verlaufs-Atmosphäre im Hintergrund */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(70% 55% at 18% 0%, rgba(56,189,248,0.16), transparent 60%), radial-gradient(60% 60% at 92% 12%, rgba(34,197,94,0.12), transparent 60%), linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%)",
        }}
      />
      <div aria-hidden className="vp-aurora pointer-events-none absolute inset-0 -z-10 opacity-50" />

      <div className="mx-auto max-w-6xl px-6 pt-5">
        <Link
          href="/vorschau"
          className="text-sm text-slate-500 underline-offset-4 transition-colors hover:text-slate-900 hover:underline"
        >
          ← Vorschauen
        </Link>
      </div>

      <section className="relative mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-12 px-6 pb-24 pt-12 lg:grid-cols-2 lg:gap-10 lg:pt-20">
        {/* Linke Spalte: Text + Suche */}
        <div className="flex flex-col gap-6">
          <span className="vp-rise inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-4 py-1.5 text-sm font-medium text-slate-600 shadow-sm backdrop-blur">
            <span className="size-2 rounded-full bg-emerald-500" /> Den richtigen Weg zum Führerschein finden
          </span>

          <h1 className="vp-rise-2 text-4xl font-bold leading-[1.06] tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
            Finde die{" "}
            <Typewriter words={SLOGAN} className="text-gradient-brand" />
            <br />
            Fahrschule für deinen Weg.
          </h1>

          <p className="vp-rise-2 max-w-md text-lg leading-relaxed text-slate-600">
            Preise, Klassen und Standorte ruhig und klar verglichen — damit du
            ohne Umwege zur passenden Fahrschule findest.
          </p>

          <div className="vp-rise-3 w-full max-w-xl rounded-[1.75rem] border border-slate-200/80 bg-white/90 p-2.5 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.45)] backdrop-blur">
            <SearchBar />
          </div>

          <div className="vp-rise-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="text-emerald-600">✓</span> kostenlos &amp; unabhängig
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="text-emerald-600">✓</span> alle Klassen
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="text-emerald-600">✓</span> ruhig &amp; übersichtlich
            </span>
          </div>
        </div>

        {/* Rechte Spalte: Wegweiser-Illustration */}
        <div className="vp-rise-3 relative flex items-center justify-center">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 mx-auto size-[80%] rounded-full blur-3xl"
            style={{ background: "radial-gradient(circle, rgba(56,189,248,0.22), transparent 70%)" }}
          />
          <svg
            className="vp-float h-auto w-full max-w-[460px]"
            viewBox="0 0 360 400"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            role="img"
            aria-label="Illustration eines Wegweisers mit drei Richtungsschildern"
          >
            <defs>
              <linearGradient id="vp5-sky" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#e0f2fe" />
                <stop offset="1" stopColor="#f8fafc" />
              </linearGradient>
              <linearGradient id="vp5-post" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#cbd5e1" />
                <stop offset="0.5" stopColor="#f1f5f9" />
                <stop offset="1" stopColor="#94a3b8" />
              </linearGradient>
              <linearGradient id="vp5-sign1" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#38bdf8" />
                <stop offset="1" stopColor="#0ea5e9" />
              </linearGradient>
              <linearGradient id="vp5-sign2" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#34d399" />
                <stop offset="1" stopColor="#10b981" />
              </linearGradient>
              <linearGradient id="vp5-sign3" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#a5b4fc" />
                <stop offset="1" stopColor="#818cf8" />
              </linearGradient>
            </defs>

            {/* Weiche Bodenscheibe */}
            <ellipse cx="180" cy="360" rx="120" ry="22" fill="url(#vp5-sky)" />
            <ellipse cx="180" cy="358" rx="150" ry="30" fill="#0ea5e9" opacity="0.06" />

            {/* Pfosten mit weichem Schlagschatten */}
            <rect x="170" y="70" width="20" height="284" rx="10" fill="url(#vp5-post)" />
            <rect x="170" y="70" width="20" height="284" rx="10" fill="#0f172a" opacity="0.04" />

            {/* Schild 1 — nach rechts */}
            <g style={{ filter: "drop-shadow(0 14px 22px rgba(14,165,233,0.30))" }}>
              <path
                d="M58 96 H236 L274 124 L236 152 H58 Z"
                fill="url(#vp5-sign1)"
              />
              <rect x="72" y="118" width="120" height="9" rx="4.5" fill="#ffffff" opacity="0.92" />
              <rect x="72" y="132" width="78" height="7" rx="3.5" fill="#ffffff" opacity="0.55" />
            </g>

            {/* Schild 2 — nach links */}
            <g style={{ filter: "drop-shadow(0 14px 22px rgba(16,185,129,0.30))" }}>
              <path
                d="M302 176 H124 L86 204 L124 232 H302 Z"
                fill="url(#vp5-sign2)"
              />
              <rect x="168" y="198" width="120" height="9" rx="4.5" fill="#ffffff" opacity="0.92" />
              <rect x="210" y="212" width="78" height="7" rx="3.5" fill="#ffffff" opacity="0.55" />
            </g>

            {/* Schild 3 — nach rechts */}
            <g style={{ filter: "drop-shadow(0 14px 22px rgba(129,140,248,0.30))" }}>
              <path
                d="M58 256 H236 L274 284 L236 312 H58 Z"
                fill="url(#vp5-sign3)"
              />
              <rect x="72" y="278" width="96" height="9" rx="4.5" fill="#ffffff" opacity="0.92" />
              <rect x="72" y="292" width="64" height="7" rx="3.5" fill="#ffffff" opacity="0.55" />
            </g>

            {/* Pfosten-Kappe */}
            <circle cx="180" cy="70" r="14" fill="url(#vp5-post)" />
            <circle cx="180" cy="70" r="14" fill="#0ea5e9" opacity="0.10" />
            <circle cx="180" cy="66" r="4" fill="#ffffff" opacity="0.8" />
          </svg>
        </div>
      </section>

      <p className="pb-12 text-center text-xs text-slate-400">
        Vorschau „Premium 5 · Wegweiser“ — Design-Test, nicht final.
      </p>
    </div>
  );
}
