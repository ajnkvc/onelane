import type { Metadata } from "next";
import Link from "next/link";
import { SearchBar } from "@/components/search/search-bar";
import { Typewriter } from "@/components/home/typewriter";

/**
 * VORSCHAU „Premium 7" — Original-Hero + animierte „Fahrstunde"-Szene (Auto mit
 * Lehrer + Schüler, drehende Räder, fahrende Straße, scrollende Kulisse).
 * Wirkt wie ein Mini-Video, ist aber reines CSS/SVG (CSP-konform, kein Asset).
 */
export const metadata: Metadata = {
  title: "Vorschau — Premium 7 (Fahrstunde)",
  robots: { index: false, follow: false },
};

const SLOGAN = ["günstigste", "nächste", "bestbewertete", "passende"];

/** Animierte Fahrschul-Szene (Seitenansicht), komplett CSS-/SVG-animiert. */
function FahrstundeScene() {
  const trees = (offset: number) => (
    <g transform={`translate(${offset} 0)`}>
      <circle cx="60" cy="150" r="26" fill="#bbf7d0" />
      <rect x="56" y="150" width="8" height="26" fill="#86c79a" />
      <circle cx="170" cy="158" r="18" fill="#a7e8c0" />
      <rect x="166" y="158" width="6" height="20" fill="#86c79a" />
      <circle cx="300" cy="146" r="30" fill="#bbf7d0" />
      <rect x="296" y="146" width="8" height="30" fill="#86c79a" />
      <circle cx="120" cy="60" r="16" fill="#ffffff" opacity="0.85" />
      <circle cx="138" cy="60" r="20" fill="#ffffff" opacity="0.85" />
      <circle cx="330" cy="48" r="14" fill="#ffffff" opacity="0.8" />
    </g>
  );
  return (
    <svg viewBox="0 0 420 320" className="h-full w-full" role="img" aria-label="Animierte Beispiel-Fahrstunde mit Fahrlehrer und Fahrschüler">
      <defs>
        <linearGradient id="pm7-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#e9f6ff" /><stop offset="1" stopColor="#f3fbff" /></linearGradient>
        <linearGradient id="pm7-car" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0ea5e9" /><stop offset="1" stopColor="#0369a1" /></linearGradient>
      </defs>
      <rect width="420" height="320" rx="24" fill="url(#pm7-sky)" />
      {/* scrollende Kulisse */}
      <g className="vp-scenery">{trees(0)}{trees(420)}</g>
      {/* Straße */}
      <rect x="0" y="250" width="420" height="70" fill="#334155" />
      <line x1="-40" y1="285" x2="460" y2="285" stroke="#fbbf24" strokeWidth="5" strokeDasharray="26 22" className="vp-dash" />
      {/* Auto mit leichtem Wippen */}
      <g className="vp-bob">
        {/* Karosserie */}
        <rect x="120" y="196" width="190" height="46" rx="16" fill="url(#pm7-car)" />
        <path d="M150 196 q14 -34 52 -34 h44 q30 0 44 34 Z" fill="#38bdf8" />
        {/* Fenster + Insassen */}
        <path d="M160 194 q10 -24 40 -24 h6 v24 Z" fill="#dff3ff" />
        <path d="M214 194 v-24 h22 q22 0 32 24 Z" fill="#dff3ff" />
        {/* Schüler (links, am Lenkrad) */}
        <circle cx="182" cy="178" r="9" fill="#fcd9b8" />
        <rect x="176" y="186" width="12" height="10" rx="3" fill="#a3e635" />
        <circle cx="196" cy="190" r="6" fill="none" stroke="#1f2937" strokeWidth="2" />
        {/* Lehrer (rechts) */}
        <circle cx="240" cy="176" r="9" fill="#f6c39b" />
        <rect x="234" y="184" width="12" height="12" rx="3" fill="#1d4ed8" />
        {/* „L" am Heck */}
        <rect x="126" y="206" width="18" height="18" rx="4" fill="#fff" />
        <text x="135" y="220" textAnchor="middle" fontSize="14" fontWeight="700" fill="#dc2626" fontFamily="inherit">L</text>
        {/* Räder */}
        <g>
          <circle cx="162" cy="244" r="20" fill="#1f2937" />
          <g className="vp-spin"><circle cx="162" cy="244" r="9" fill="#cbd5e1" /><path d="M162 235v18M153 244h18" stroke="#64748b" strokeWidth="2" /></g>
        </g>
        <g>
          <circle cx="268" cy="244" r="20" fill="#1f2937" />
          <g className="vp-spin"><circle cx="268" cy="244" r="9" fill="#cbd5e1" /><path d="M268 235v18M259 244h18" stroke="#64748b" strokeWidth="2" /></g>
        </g>
      </g>
    </svg>
  );
}

export default function PremiumFahrstunde() {
  return (
    <div className="bg-[var(--background)]">
      <div className="mx-auto max-w-6xl px-6 pt-4 text-right">
        <Link href="/vorschau" className="text-sm text-muted-foreground underline-offset-2 hover:underline">← Vorschauen</Link>
      </div>

      <section className="relative z-20 overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10"><div className="vp-aurora absolute inset-0 opacity-60" /></div>
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 pb-20 pt-14 lg:grid-cols-[1fr_1fr] lg:pt-20">
          <div className="flex flex-col items-start gap-6 text-left">
            <span className="vp-rise inline-flex items-center gap-2 rounded-full border border-brand-sky/25 bg-card/70 px-4 py-1.5 text-sm font-medium text-[#0369a1] shadow-sm backdrop-blur">
              <span className="size-2 rounded-full bg-brand-sky" /> Transparenter Fahrschul-Vergleich
            </span>
            <h1 className="vp-rise-2 text-4xl font-bold leading-[1.04] tracking-tight text-[#1b3a5c] sm:text-6xl">
              Finde die <Typewriter words={SLOGAN} className="text-gradient-brand" /><br /> Fahrschule deiner Stadt.
            </h1>
            <p className="vp-rise-2 max-w-md text-lg text-muted-foreground">
              Von der ersten Fahrstunde bis zum Schein — Preise, Klassen und <strong className="text-foreground">echte Bestehensquoten</strong> klar verglichen.
            </p>
            <div className="vp-rise-3 w-full max-w-xl"><SearchBar /></div>
          </div>

          <div className="vp-rise-3 rounded-[1.8rem] border border-[#e4ecf4] bg-white/70 p-3 shadow-[0_30px_60px_-32px_rgba(15,34,53,0.45)] backdrop-blur">
            <div className="overflow-hidden rounded-[1.4rem]"><FahrstundeScene /></div>
            <p className="px-2 py-2 text-center text-xs text-muted-foreground">Beispiel-Fahrstunde — illustrativ, keine echten Personen.</p>
          </div>
        </div>
      </section>

      <p className="pb-12 text-center text-xs text-muted-foreground">Vorschau „Premium 7 · Fahrstunde“ — Design-Test, nicht final.</p>
    </div>
  );
}
