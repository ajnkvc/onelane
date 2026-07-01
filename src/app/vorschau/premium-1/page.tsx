import type { Metadata } from "next";
import Link from "next/link";
import { SearchBar } from "@/components/search/search-bar";
import { Typewriter } from "@/components/home/typewriter";

/**
 * VORSCHAU „Premium 1" — Original-Hero + themenbezogene Routen-/Karten-Grafik
 * hinter der Suche. SSR, CSS/SVG-only, keine externen Assets. `noindex`.
 */
export const metadata: Metadata = {
  title: "Vorschau — Premium 1 (Route)",
  robots: { index: false, follow: false },
};

const SLOGAN = ["günstigste", "nächste", "bestbewertete", "passende"];
const PILLS = ["100 % kostenlos", "unabhängig", "echte Bestehensquoten"];

export default function PremiumRoute() {
  return (
    <div className="bg-[var(--background)]">
      <div className="mx-auto max-w-6xl px-6 pt-4 text-right">
        <Link href="/vorschau" className="text-sm text-muted-foreground underline-offset-2 hover:underline">← Vorschauen</Link>
      </div>

      <section className="relative z-20 overflow-hidden">
        {/* Themen-Grafik: zarte Karte mit Route + Pins hinter der Suche */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="aurora absolute inset-0" style={{ backgroundImage: "radial-gradient(42% 55% at 16% 18%, rgba(14,165,233,0.30), transparent 62%), radial-gradient(46% 58% at 84% 10%, rgba(34,211,238,0.28), transparent 62%), linear-gradient(180deg, #eef9ff, var(--background) 72%)", backgroundSize: "200% 200%" }} />
          <svg className="absolute inset-x-0 top-0 h-full w-full opacity-[0.5]" viewBox="0 0 1200 520" preserveAspectRatio="xMidYMid slice" fill="none">
            <defs>
              <pattern id="pm1-grid" width="48" height="48" patternUnits="userSpaceOnUse">
                <path d="M48 0H0V48" stroke="#1b3a5c" strokeOpacity="0.05" strokeWidth="1" />
              </pattern>
              <linearGradient id="pm1-route" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#0ea5e9" /><stop offset="1" stopColor="#22d3ee" />
              </linearGradient>
            </defs>
            <rect width="1200" height="520" fill="url(#pm1-grid)" />
            <path d="M70 430 C 280 360, 300 180, 520 180 S 820 320, 980 200 1150 120 1150 120" stroke="url(#pm1-route)" strokeWidth="4" strokeLinecap="round" className="vp-dash" />
            {[[520, 180], [980, 200], [70, 430]].map(([x, y], i) => (
              <g key={i}>
                <circle cx={x} cy={y} r="26" fill="#0ea5e9" opacity="0.12" />
                <path d={`M${x} ${y - 16} a11 11 0 0 1 11 11 c0 8 -11 19 -11 19 s-11 -11 -11 -19 a11 11 0 0 1 11 -11Z`} fill="#0ea5e9" />
                <circle cx={x} cy={y - 5} r="4" fill="#fff" />
              </g>
            ))}
          </svg>
        </div>

        <div className="relative mx-auto flex w-full max-w-3xl flex-col items-center gap-6 px-6 pb-20 pt-20 text-center sm:pt-28">
          <span className="vp-rise inline-flex items-center gap-2 rounded-full border border-brand-sky/25 bg-card/70 px-4 py-1.5 text-sm font-medium text-[#0369a1] shadow-sm backdrop-blur">
            <span className="relative flex size-2"><span className="pulse-ring absolute inline-flex size-2 rounded-full bg-brand-cyan" /><span className="relative inline-flex size-2 rounded-full bg-brand-sky" /></span>
            Deutschlands transparenter Fahrschul-Vergleich
          </span>
          <h1 className="vp-rise-2 text-4xl font-bold leading-[1.05] tracking-tight text-[#1b3a5c] sm:text-6xl">
            Finde die <Typewriter words={SLOGAN} className="text-gradient-brand" /><br /> Fahrschule deiner Stadt.
          </h1>
          <p className="vp-rise-2 max-w-xl text-lg text-muted-foreground">
            Vergleiche nach Preis, Klassen und <strong className="text-foreground">echten Bestehensquoten</strong> — und melde dich direkt an.
          </p>
          <div className="vp-rise-3 mt-2 flex w-full justify-center"><SearchBar /></div>
          <div className="vp-rise-3 flex flex-wrap items-center justify-center gap-2">
            {PILLS.map((p) => (
              <span key={p} className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-sm text-muted-foreground">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-brand-lime" aria-hidden><path d="m5 13 4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>{p}
              </span>
            ))}
          </div>
        </div>
      </section>

      <p className="pb-12 text-center text-xs text-muted-foreground">Vorschau „Premium 1 · Route“ — Design-Test, nicht final.</p>
    </div>
  );
}
