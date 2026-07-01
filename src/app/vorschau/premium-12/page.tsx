import type { Metadata } from "next";
import Link from "next/link";
import { SearchBar } from "@/components/search/search-bar";
import { Typewriter } from "@/components/home/typewriter";

/**
 * VORSCHAU „Premium 12 · Map-first" — abstrakte, stilisierte Stadtkarte als
 * Hintergrund (reines Inline-SVG: Straßen/Blöcke in dezenten Grautönen, 2–3
 * Standort-Pins, einer pulsierend via `pulse-ring`). Darüber mittig eine glasige
 * Such-Karte (backdrop-blur). KEINE echte Karte/Kacheln, keine externen Assets.
 * Beispielwerte sind klar als solche markiert.
 */
export const metadata: Metadata = {
  title: "Vorschau — Premium 12 (Map-first)",
  robots: { index: false, follow: false },
};

const SLOGAN = ["günstigste", "nächste", "bestbewertete", "passende"];

export default function PremiumMapFirst() {
  return (
    <div className="bg-[var(--background)]">
      <div className="mx-auto max-w-6xl px-6 pt-4 text-right">
        <Link href="/vorschau" className="text-sm text-muted-foreground underline-offset-2 hover:underline">← Vorschauen</Link>
      </div>

      <section className="relative z-20 overflow-hidden">
        {/* Atmosphäre + abstrakte Stadtkarte hinter dem Inhalt */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="vp-aurora absolute inset-0 opacity-40" />
          <svg
            className="absolute inset-0 size-full"
            viewBox="0 0 1200 700"
            preserveAspectRatio="xMidYMid slice"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Stadtblöcke (dezente Grautöne) */}
            <g fill="#eef2f6" stroke="#e2e8f0" strokeWidth="1">
              <rect x="70" y="80" width="150" height="110" rx="8" />
              <rect x="250" y="60" width="120" height="150" rx="8" />
              <rect x="430" y="90" width="180" height="120" rx="8" />
              <rect x="690" y="70" width="140" height="140" rx="8" />
              <rect x="880" y="100" width="160" height="110" rx="8" />
              <rect x="90" y="280" width="170" height="130" rx="8" />
              <rect x="300" y="300" width="140" height="120" rx="8" />
              <rect x="500" y="290" width="150" height="140" rx="8" />
              <rect x="720" y="300" width="130" height="120" rx="8" />
              <rect x="910" y="290" width="180" height="130" rx="8" />
              <rect x="120" y="500" width="160" height="120" rx="8" />
              <rect x="340" y="520" width="170" height="110" rx="8" />
              <rect x="580" y="500" width="140" height="130" rx="8" />
              <rect x="790" y="510" width="170" height="120" rx="8" />
            </g>
            {/* Straßen */}
            <g stroke="#dbe3ec" strokeWidth="14" strokeLinecap="round" fill="none">
              <line x1="0" y1="240" x2="1200" y2="240" />
              <line x1="0" y1="460" x2="1200" y2="460" />
              <line x1="230" y1="0" x2="230" y2="700" />
              <line x1="660" y1="0" x2="660" y2="700" />
              <line x1="870" y1="0" x2="870" y2="700" />
            </g>
            {/* gestrichelte Verbindung zwischen Standorten */}
            <path
              className="vp-dash"
              d="M 320 360 L 600 200 L 980 380"
              stroke="#a3e635"
              strokeWidth="3"
              strokeDasharray="8 8"
              fill="none"
            />
            {/* Standort-Pins (statisch) */}
            <g fill="#0ea5e9">
              <circle cx="320" cy="360" r="9" />
              <circle cx="320" cy="360" r="3.5" fill="#ffffff" />
              <circle cx="980" cy="380" r="9" />
              <circle cx="980" cy="380" r="3.5" fill="#ffffff" />
            </g>
          </svg>

          {/* pulsierender Haupt-Pin (HTML-Overlay, mittig oben) */}
          <span className="absolute left-1/2 top-[26%] flex size-5 -translate-x-1/2">
            <span className="pulse-ring absolute inline-flex size-5 rounded-full bg-brand-cyan" />
            <span className="relative inline-flex size-5 rounded-full border-2 border-white bg-brand-sky shadow-md" />
          </span>
        </div>

        <div className="relative mx-auto max-w-5xl px-6 pb-28 pt-20 text-center sm:pt-28">
          {/* glasige Such-Karte */}
          <div className="vp-rise mx-auto flex max-w-2xl flex-col items-center gap-6 rounded-3xl border border-white/60 bg-white/65 p-8 shadow-2xl backdrop-blur-xl sm:p-10">
            <span className="vp-rise inline-flex items-center gap-2 rounded-full border border-brand-sky/25 bg-card/70 px-4 py-1.5 text-sm font-medium text-[#0369a1] shadow-sm backdrop-blur">
              <span className="size-2 rounded-full bg-brand-sky" /> Fahrschulen in deiner Nähe
            </span>

            <h1 className="vp-rise-2 text-4xl font-bold leading-[1.05] tracking-tight text-[#1b3a5c] sm:text-6xl">
              Die <Typewriter words={SLOGAN} className="text-gradient-brand" /><br /> Fahrschule auf der Karte.
            </h1>

            <p className="vp-rise-2 max-w-xl text-lg text-muted-foreground">
              Standort eingeben und Schulen in der Umgebung vergleichen — Preise, Klassen und <strong className="text-foreground">Bestehensquoten</strong> auf einen Blick.
            </p>

            <div className="vp-rise-3 mt-1 w-full max-w-xl">
              <SearchBar />
            </div>

            {/* Trust-Pills */}
            <div className="vp-rise-3 mt-2 flex flex-wrap items-center justify-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-[#e4ecf4] bg-white/80 px-3 py-1.5 text-xs font-medium text-[#1b3a5c] shadow-sm">
                <span className="size-2 rounded-full bg-[#22d3ee]" /> Karte &amp; Liste vereint
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-[#e4ecf4] bg-white/80 px-3 py-1.5 text-xs font-medium text-[#1b3a5c] shadow-sm">
                <span className="size-2 rounded-full bg-[#0ea5e9]" /> neutral &amp; werbefrei
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-[#e4ecf4] bg-white/80 px-3 py-1.5 text-xs font-medium text-[#1b3a5c] shadow-sm">
                <span className="size-2 rounded-full bg-[#a3e635]" /> Beispiel-Standorte „onelane“
              </span>
            </div>
          </div>
        </div>
      </section>

      <p className="pb-12 text-center text-xs text-muted-foreground">Vorschau „Premium 12 · Map-first“ — Design-Test, nicht final. Karte und Pins sind schematisch (keine echten Standorte).</p>
    </div>
  );
}
