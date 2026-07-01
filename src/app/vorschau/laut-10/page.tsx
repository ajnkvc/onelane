import type { Metadata } from "next";
import Link from "next/link";

/**
 * VORSCHAU „Laut 10" — Sticker Collage: rotierte Badges/Sticker, Klebeband,
 * dezent wackelnde Elemente auf klarem Raster. Jung & verspielt, aber geordnet.
 * SSR, inline-SVG/CSS-only, keine externen Assets.
 */
export const metadata: Metadata = {
  title: "Vorschau — Laut 10 (Sticker)",
  robots: { index: false, follow: false },
};

function StarBurst({ className, fill }: { className?: string; fill: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <path
        d="M50 2 L60 28 L88 18 L74 44 L98 50 L74 56 L88 82 L60 72 L50 98 L40 72 L12 82 L26 56 L2 50 L26 44 L12 18 L40 28 Z"
        fill={fill}
        stroke="#1a1726"
        strokeWidth="3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Blob({ className, fill }: { className?: string; fill: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <path
        d="M50 4 C72 4 96 18 94 44 C92 66 80 96 50 96 C24 96 6 74 6 48 C6 22 28 4 50 4 Z"
        fill={fill}
        stroke="#1a1726"
        strokeWidth="3"
      />
    </svg>
  );
}

const TAPE = "linear-gradient(180deg, rgba(255,255,255,0.55), rgba(255,255,255,0.25))";

export default function Laut10() {
  return (
    <div className="min-h-screen overflow-hidden bg-[#fdf6ec] text-[#1a1726]">
      <div className="mx-auto max-w-6xl px-5">
        <header className="relative z-10 flex items-center justify-between py-6">
          <span className="text-xl font-black tracking-tight">
            onelane<span className="text-[#ff5a5f]">.</span>
          </span>
          <Link
            href="/vorschau"
            className="rounded-full border-2 border-[#1a1726] bg-white px-4 py-1.5 text-sm font-bold transition hover:-translate-y-0.5 hover:shadow-[3px_3px_0_#1a1726]"
          >
            ← Vorschauen
          </Link>
        </header>

        {/* HERO */}
        <section className="relative isolate overflow-hidden rounded-[2rem] border-2 border-[#1a1726] bg-[#fff9f0] px-6 py-20 text-center shadow-[8px_8px_0_#1a1726] sm:py-28">
          {/* Klebeband oben */}
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-0 h-10 w-44 -translate-x-1/2 -translate-y-1/2 -rotate-3 border border-white/40"
            style={{ background: TAPE, backdropFilter: "blur(1px)" }}
          />

          {/* Streu-Sticker */}
          <StarBurst className="vp-wobble pointer-events-none absolute left-6 top-16 hidden h-16 w-16 -rotate-12 sm:block" fill="#ffd23f" />
          <Blob className="vp-float pointer-events-none absolute right-8 top-24 hidden h-20 w-20 rotate-6 sm:block" fill="#8ad8c5" />
          <StarBurst className="vp-drift pointer-events-none absolute bottom-10 right-16 hidden h-12 w-12 rotate-12 sm:block" fill="#ff5a5f" />
          <Blob className="vp-wobble pointer-events-none absolute bottom-16 left-12 hidden h-14 w-14 -rotate-6 sm:block" fill="#c4b5fd" />

          <span className="vp-rise inline-block -rotate-2 rounded-xl border-2 border-[#1a1726] bg-[#ffd23f] px-4 py-1.5 text-xs font-black uppercase tracking-[0.2em] shadow-[3px_3px_0_#1a1726]">
            ★ Fahrschulen vergleichen ★
          </span>

          <h1 className="vp-rise-2 mx-auto mt-7 max-w-3xl text-5xl font-black leading-[0.95] tracking-tight sm:text-7xl">
            Finde deine
            <span className="relative mx-2 inline-block rotate-1 bg-[#ff5a5f] px-3 text-[#fff9f0]">
              Fahrschule
            </span>
            ohne Rätselraten.
          </h1>

          <p className="vp-rise-2 mx-auto mt-6 max-w-xl text-lg font-medium text-[#1a1726]/70">
            Preise, Klassen &amp; Standorte übersichtlich nebeneinander — damit du
            entspannt entscheidest, wo du den Schein machst.
          </p>

          <div className="vp-rise-3 mx-auto mt-8 flex max-w-xl flex-col gap-3 sm:flex-row">
            <input
              disabled
              placeholder="Stadt oder PLZ eingeben …"
              className="flex-1 rounded-xl border-2 border-[#1a1726] bg-white px-5 py-4 text-base font-semibold text-[#1a1726] placeholder:text-[#1a1726]/40 focus:outline-none"
            />
            <button className="rounded-xl border-2 border-[#1a1726] bg-[#1a1726] px-8 py-4 text-base font-black text-[#fff9f0] shadow-[4px_4px_0_#ff5a5f] transition hover:-translate-y-0.5">
              Los geht’s →
            </button>
          </div>
        </section>

        {/* VORTEILE */}
        <section className="grid gap-5 py-12 sm:grid-cols-3">
          {[
            {
              rot: "-rotate-2",
              fill: "#ffd23f",
              icon: <StarBurst className="h-10 w-10" fill="#ffd23f" />,
              titel: "Alles auf einen Blick",
              text: "Preise, Klassen und Lage übersichtlich nebeneinander statt verstreut über zig Websites.",
            },
            {
              rot: "rotate-1",
              fill: "#8ad8c5",
              icon: <Blob className="h-10 w-10" fill="#8ad8c5" />,
              titel: "In deiner Nähe",
              text: "Schulen und Filialen rund um deinen Wohnort — du siehst sofort, was praktisch erreichbar ist.",
            },
            {
              rot: "-rotate-1",
              fill: "#c4b5fd",
              icon: <StarBurst className="h-10 w-10" fill="#c4b5fd" />,
              titel: "Ehrlich & transparent",
              text: "Klare Angaben statt Werbe-Versprechen — Quellen kennzeichnen wir, Bestätigtes markieren wir.",
            },
          ].map((c) => (
            <article
              key={c.titel}
              className={`${c.rot} rounded-2xl border-2 border-[#1a1726] bg-white p-6 shadow-[6px_6px_0_#1a1726] transition hover:rotate-0`}
            >
              <div className="vp-wobble mb-4 inline-flex h-14 w-14 items-center justify-center rounded-xl border-2 border-[#1a1726] bg-[#fff9f0]">
                {c.icon}
              </div>
              <h2 className="text-xl font-black">{c.titel}</h2>
              <p className="mt-2 text-sm font-medium text-[#1a1726]/70">{c.text}</p>
            </article>
          ))}
        </section>

        <p className="pb-12 text-center text-xs font-bold text-[#1a1726]/40">
          Vorschau „Laut 10 · Sticker“ — Design-Test, nicht final.
        </p>
      </div>
    </div>
  );
}
