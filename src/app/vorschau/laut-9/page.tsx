import type { Metadata } from "next";
import Link from "next/link";

/**
 * VORSCHAU „Laut 9" — Risograph Duotone: zwei kräftige Druckfarben auf cremiger
 * Basis, leichter Misregistration-Versatz, Korn-/Punkt-Textur, fette Typo.
 * SSR-only, CSS/SVG-only, keine externen Assets.
 */
export const metadata: Metadata = {
  title: "Vorschau — Laut 9 (Risograph)",
  robots: { index: false, follow: false },
};

const ORANGE = "#ff5a1f";
const BLUE = "#1d2b8a";
const CREAM = "#f4ecdc";

// Korn-/Punkt-Textur: feines Punktraster + diagonales Korn.
const GRAIN: React.CSSProperties = {
  backgroundImage:
    "repeating-radial-gradient(circle at 0 0, rgba(29,43,138,0.10) 0, rgba(29,43,138,0.10) 1px, transparent 1.4px, transparent 5px), repeating-linear-gradient(45deg, rgba(255,90,31,0.05) 0, rgba(255,90,31,0.05) 1px, transparent 1px, transparent 4px)",
  backgroundSize: "6px 6px, 5px 5px",
};

const VORTEILE: { titel: string; text: string }[] = [
  {
    titel: "Klar vergleichen",
    text: "Preise und Fahrschulklassen nebeneinander — ohne Kleingedrucktes, ohne Umwege.",
  },
  {
    titel: "Ehrliche Quoten",
    text: "Echte Bestehensquoten als Orientierung, nicht als Verkaufsversprechen.",
  },
  {
    titel: "Vor Ort finden",
    text: "Suche nach Stadt oder Postleitzahl und sieh, was in deiner Nähe passt.",
  },
];

export default function Laut9() {
  return (
    <div className="min-h-screen overflow-hidden" style={{ backgroundColor: CREAM, color: BLUE }}>
      {/* Globale Korntextur über der cremigen Basis */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 opacity-70" style={GRAIN} />

      <div className="relative z-10 mx-auto max-w-6xl px-5">
        <header className="flex items-center justify-between py-6">
          <span className="text-xl font-black uppercase tracking-[0.25em]" style={{ color: ORANGE }}>
            onelane
          </span>
          <Link
            href="/vorschau"
            className="rounded-full border-2 px-4 py-1.5 text-sm font-black transition hover:bg-white/40"
            style={{ borderColor: BLUE, color: BLUE }}
          >
            ← Vorschauen
          </Link>
        </header>

        {/* HERO */}
        <section
          className="relative isolate overflow-hidden rounded-[2rem] border-2 px-6 py-16 sm:px-12 sm:py-24"
          style={{ borderColor: BLUE, backgroundColor: "rgba(255,255,255,0.35)" }}
        >
          {/* Duotone-Blob als Riso-Flächendruck */}
          <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 -z-10 h-80 w-80 rounded-full vp-float" style={{ backgroundColor: ORANGE, opacity: 0.18, filter: "blur(6px)" }} />
          <div aria-hidden className="pointer-events-none absolute -bottom-28 -left-20 -z-10 h-72 w-72 rounded-full vp-float" style={{ backgroundColor: BLUE, opacity: 0.14, filter: "blur(6px)", animationDelay: "1.2s" }} />

          <span
            className="vp-rise inline-flex items-center gap-2 rounded-full border-2 px-4 py-1.5 text-xs font-black uppercase tracking-[0.28em]"
            style={{ borderColor: ORANGE, color: ORANGE, backgroundColor: "rgba(255,90,31,0.08)" }}
          >
            <span aria-hidden style={{ color: BLUE }}>◆</span> Risograph · Duotone
          </span>

          <h1 className="vp-rise-2 mt-8 text-6xl font-black uppercase leading-[0.92] tracking-tight sm:text-8xl">
            <span className="block">Finde deine</span>
            {/* Misregistration: versetzte Zweitfarbe hinter dem Schlüsselwort */}
            <span className="relative inline-block">
              <span aria-hidden className="absolute select-none" style={{ left: "3px", top: "3px", color: ORANGE, opacity: 0.85 }}>
                Fahrschule
              </span>
              <span className="relative" style={{ color: BLUE }}>
                Fahrschule
              </span>
            </span>
          </h1>

          <p className="vp-rise-2 mt-7 max-w-xl text-lg font-semibold leading-relaxed" style={{ color: BLUE }}>
            Preise, Klassen &amp; echte Bestehensquoten — übersichtlich an einem Ort. Gib deine Stadt oder Postleitzahl ein und vergleiche in Ruhe.
          </p>

          <div className="vp-rise-3 mt-9 flex max-w-xl flex-col gap-3 sm:flex-row">
            <input
              disabled
              placeholder="Stadt oder PLZ …"
              className="flex-1 rounded-full border-2 bg-white/70 px-6 py-4 text-base font-bold placeholder:font-medium focus:outline-none"
              style={{ borderColor: BLUE, color: BLUE }}
            />
            <button
              className="rounded-full px-9 py-4 text-base font-black uppercase tracking-wide text-white transition hover:brightness-110"
              style={{ backgroundColor: ORANGE, boxShadow: `4px 4px 0 ${BLUE}` }}
            >
              Vergleichen →
            </button>
          </div>
        </section>

        {/* VORTEILE */}
        <section className="mt-8 grid gap-5 sm:grid-cols-3">
          {VORTEILE.map((v, i) => (
            <div
              key={v.titel}
              className="vp-rise rounded-2xl border-2 bg-white/45 p-7"
              style={{ borderColor: BLUE, animationDelay: `${i * 0.08}s`, boxShadow: `5px 5px 0 ${ORANGE}` }}
            >
              <span
                className="inline-flex h-11 w-11 items-center justify-center rounded-full text-lg font-black text-white"
                style={{ backgroundColor: i % 2 === 0 ? BLUE : ORANGE }}
                aria-hidden
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <h2 className="mt-5 text-xl font-black uppercase tracking-tight" style={{ color: BLUE }}>
                {v.titel}
              </h2>
              <p className="mt-2 text-sm font-medium leading-relaxed" style={{ color: BLUE }}>
                {v.text}
              </p>
            </div>
          ))}
        </section>

        <p className="py-12 text-center text-xs font-bold" style={{ color: ORANGE }}>
          Vorschau „Laut 9 · Risograph“ — Design-Test, nicht final.
        </p>
      </div>
    </div>
  );
}
