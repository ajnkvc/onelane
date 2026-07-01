import type { Metadata } from "next";
import Link from "next/link";
import { SearchBar } from "@/components/search/search-bar";
import { Typewriter } from "@/components/home/typewriter";

/**
 * VORSCHAU „Premium 6 · Aurora Route" — sehr ruhiges, Apple-artiges Premium.
 * Hinter der Suche ein verfeinerter Aurora-Verlauf plus ein dezentes Punktfeld
 * entlang einer geschwungenen Route (inline-SVG) mit zwei Standort-Pins.
 * SSR/Server-Komponente, CSS/SVG-only, keine externen Assets. `noindex`.
 */
export const metadata: Metadata = {
  title: "Vorschau — Premium 6 (Aurora Route)",
  robots: { index: false, follow: false },
};

const SLOGAN = ["günstigste", "nächste", "bestbewertete", "passende"];

/** Punkte gleichmäßig entlang einer geschwungenen Bahn (kubische Bézier). */
function routeDots() {
  // Kontrollpunkte der Route (im viewBox 0 0 1200 520).
  const p0 = { x: 90, y: 430 };
  const p1 = { x: 380, y: 120 };
  const p2 = { x: 820, y: 470 };
  const p3 = { x: 1120, y: 150 };
  const dots: { x: number; y: number; r: number }[] = [];
  const N = 46;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const u = 1 - t;
    const x =
      u * u * u * p0.x +
      3 * u * u * t * p1.x +
      3 * u * t * t * p2.x +
      t * t * t * p3.x;
    const y =
      u * u * u * p0.y +
      3 * u * u * t * p1.y +
      3 * u * t * t * p2.y +
      t * t * t * p3.y;
    // Punkte mittig größer, an den Rändern kleiner — wirkt „atmend".
    const r = 1.6 + 2.4 * Math.sin(Math.PI * t);
    dots.push({ x, y, r });
  }
  return { dots, p0, p3 };
}

export default function PremiumAuroraRoute() {
  const { dots, p0, p3 } = routeDots();

  return (
    <div className="bg-[#070d18]">
      <div className="mx-auto max-w-6xl px-6 pt-4 text-right">
        <Link
          href="/vorschau"
          className="text-sm text-white/55 underline-offset-2 transition-colors hover:text-white hover:underline"
        >
          ← Vorschauen
        </Link>
      </div>

      <section className="relative z-20 overflow-hidden">
        {/* Atmosphäre: Aurora + Punktroute, hinter dem Inhalt. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          {/* Grundton */}
          <div className="absolute inset-0" style={{ background: "#070d18" }} />
          {/* Verfeinerte Aurora */}
          <div
            className="vp-aurora absolute inset-0"
            style={{
              background:
                "radial-gradient(55% 50% at 22% 8%, rgba(99,102,241,0.34), transparent 62%), radial-gradient(48% 46% at 82% 4%, rgba(56,189,248,0.28), transparent 60%), radial-gradient(60% 60% at 50% 118%, rgba(45,212,191,0.20), transparent 62%)",
            }}
          />
          {/* Weiches Leuchten direkt hinter der Suche */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(38% 30% at 50% 46%, rgba(125,211,252,0.16), transparent 70%)",
            }}
          />

          {/* Punktfeld entlang einer geschwungenen Route */}
          <svg
            className="vp-float absolute left-1/2 top-1/2 -z-10 w-[150%] max-w-none -translate-x-1/2 -translate-y-1/2 opacity-70 sm:w-[110%]"
            viewBox="0 0 1200 520"
            fill="none"
            aria-hidden
          >
            <defs>
              <linearGradient id="vp6-route" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#7dd3fc" />
                <stop offset="0.5" stopColor="#a5b4fc" />
                <stop offset="1" stopColor="#5eead4" />
              </linearGradient>
            </defs>

            {/* Schwach angedeutete Bahn unter den Punkten */}
            <path
              d={`M ${p0.x} ${p0.y} C 380 120 820 470 ${p3.x} ${p3.y}`}
              stroke="url(#vp6-route)"
              strokeWidth="1.5"
              strokeOpacity="0.22"
              className="vp-dash"
            />

            {/* Punkte entlang der Route */}
            {dots.map((d, i) => (
              <circle
                key={i}
                cx={d.x}
                cy={d.y}
                r={d.r}
                fill="url(#vp6-route)"
                opacity={0.35 + 0.5 * Math.sin((Math.PI * i) / dots.length)}
              />
            ))}

            {/* Standort-Pin: Start */}
            <g transform={`translate(${p0.x - 14} ${p0.y - 38})`} opacity="0.85">
              <path
                d="M14 0 C5 0 0 6 0 14 C0 24 14 38 14 38 C14 38 28 24 28 14 C28 6 23 0 14 0 Z"
                fill="#7dd3fc"
                fillOpacity="0.85"
              />
              <circle cx="14" cy="14" r="5.5" fill="#070d18" />
            </g>
            {/* Standort-Pin: Ziel */}
            <g transform={`translate(${p3.x - 14} ${p3.y - 38})`} opacity="0.9">
              <path
                d="M14 0 C5 0 0 6 0 14 C0 24 14 38 14 38 C14 38 28 24 28 14 C28 6 23 0 14 0 Z"
                fill="#5eead4"
                fillOpacity="0.9"
              />
              <circle cx="14" cy="14" r="5.5" fill="#070d18" />
            </g>
          </svg>
        </div>

        <div className="relative mx-auto flex w-full max-w-3xl flex-col items-center gap-6 px-6 pb-28 pt-20 text-center sm:pt-28">
          <span className="vp-rise inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-4 py-1.5 text-sm font-medium text-[#cfe3ff] backdrop-blur">
            <span className="size-2 rounded-full bg-[#5eead4]" /> Transparenter Fahrschul-Vergleich
          </span>

          <h1 className="vp-rise-2 text-4xl font-semibold leading-[1.05] tracking-tight text-white sm:text-6xl">
            Finde die <Typewriter words={SLOGAN} className="text-gradient-brand" />
            <br /> Fahrschule auf deiner Route.
          </h1>

          <p className="vp-rise-2 max-w-xl text-lg text-[#a9c0dc]">
            Preise, Klassen und Bestehensquoten — ruhig und klar verglichen, von
            der Adresse bis zur passenden Schule.
          </p>

          <div className="vp-rise-3 mt-2 w-full max-w-xl rounded-[1.7rem] border border-white/14 bg-white/90 p-2 shadow-[0_36px_90px_-32px_rgba(0,0,0,0.75)] backdrop-blur-xl">
            <SearchBar />
          </div>

          <div className="vp-rise-3 flex flex-wrap items-center justify-center gap-4 text-sm text-[#a9c0dc]">
            <span className="inline-flex items-center gap-1.5">
              <span className="text-[#5eead4]">✓</span> 100 % kostenlos
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="text-[#5eead4]">✓</span> unabhängig &amp; werbefrei
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="text-[#5eead4]">✓</span> auf einen Blick
            </span>
          </div>
        </div>
      </section>

      <p className="pb-12 text-center text-xs text-white/40">
        Vorschau „Premium 6 · Aurora Route“ — Design-Test, nicht final.
      </p>
    </div>
  );
}
