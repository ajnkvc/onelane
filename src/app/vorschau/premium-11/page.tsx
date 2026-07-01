import type { Metadata } from "next";
import Link from "next/link";

import { Typewriter } from "@/components/home/typewriter";
import { SearchBar } from "@/components/search/search-bar";

export const metadata: Metadata = {
  title: "Vorschau — Premium 11 (Clay Stack)",
  robots: { index: false, follow: false },
};

/**
 * Premium 11 · Clay Card Stack — Design-Vorschau (nicht final).
 * ----------------------------------------------------------------------------
 *  Apple-artiges Premium mit claymorpher Tiefe: ein leicht versetzter Stapel
 *  aus Beispiel-Ergebniskarten (weiche, mehrstufige Schatten, sanft schwebend)
 *  neben einer zentrierten Suche. Alle Kartenwerte sind ausdrücklich Beispiele.
 */

const claySurface =
  "0 1px 0 0 rgba(255,255,255,0.9) inset, 0 -8px 18px 0 rgba(2,6,23,0.05) inset, 0 18px 36px -12px rgba(2,6,23,0.22), 0 48px 80px -32px rgba(2,6,23,0.28)";

const claySoft =
  "0 1px 0 0 rgba(255,255,255,0.85) inset, 0 12px 26px -12px rgba(2,6,23,0.18), 0 30px 56px -28px rgba(2,6,23,0.22)";

export default function Premium11Page() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f6f7fb] text-slate-900">
      {/* Sanfte Hintergrund-Ebenen (globale Klassen, nicht neu definiert) */}
      <div className="vp-aurora" aria-hidden />
      <div className="vp-grid" aria-hidden />

      <nav className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 pt-8">
        <Link
          href="/vorschau"
          className="text-sm font-medium text-slate-500 transition-colors hover:text-slate-900"
        >
          ← Vorschauen
        </Link>
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
          Premium 11
        </span>
      </nav>

      <section className="relative z-10 mx-auto grid w-full max-w-6xl items-center gap-14 px-6 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
        {/* Linke Spalte: Hero-Muster (Eyebrow + Headline + Subline + Suche) */}
        <div className="vp-rise">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/70 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 shadow-sm backdrop-blur">
            <span className="pulse-ring inline-block h-2 w-2 rounded-full bg-emerald-500" />
            Fahrschulen vergleichen
          </p>

          <h1 className="mt-6 text-4xl font-semibold leading-[1.08] tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
            Finde die{" "}
            <Typewriter
              words={["günstigste", "nächste", "bestbewertete", "passende"]}
              className="text-gradient-brand"
            />
            <br />
            Fahrschule in deiner Nähe.
          </h1>

          <p className="mt-6 max-w-md text-lg leading-relaxed text-slate-600">
            Preise, Bewertungen und Standorte auf einen Blick — neutral
            gebündelt, damit du in Ruhe vergleichst und entscheidest.
          </p>

          <div className="mt-8 max-w-xl">
            <SearchBar />
          </div>

          <p className="mt-4 text-xs text-slate-400">
            Beispielhafte Vorschau — gezeigte Werte sind Platzhalter, keine
            bestätigten Angaben.
          </p>
        </div>

        {/* Rechte Spalte: claymorpher Karten-Stapel (Beispiel-Ergebnisse) */}
        <div className="relative mx-auto h-[460px] w-full max-w-md">
          {/* Hintere Karte (am stärksten versetzt) */}
          <article
            className="vp-drift-2 absolute right-4 top-6 w-[88%] rounded-[2rem] bg-white/85 p-5 backdrop-blur"
            style={{ boxShadow: claySoft, transform: "rotate(-3deg)" }}
            aria-hidden
          >
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#eef1ff] text-base font-bold text-indigo-500">
                R
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-700">
                  onelane Fahrschule
                </p>
                <p className="text-xs text-slate-400">Beispiel · Standort C</p>
              </div>
            </div>
            <div className="mt-4 h-2 w-2/3 rounded-full bg-slate-200/80" />
            <div className="mt-2 h-2 w-1/2 rounded-full bg-slate-200/60" />
          </article>

          {/* Mittlere Karte */}
          <article
            className="vp-drift absolute left-2 top-2 w-[92%] rounded-[2rem] bg-white/90 p-6 backdrop-blur"
            style={{ boxShadow: claySoft, transform: "rotate(2.5deg)" }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#eafff3] text-base font-bold text-emerald-500">
                  R
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-700">
                    onelane Fahrschule
                  </p>
                  <p className="text-xs text-slate-400">Beispiel · Standort B</p>
                </div>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500">
                Beispiel
              </span>
            </div>
            <div className="mt-5 flex items-end gap-2">
              <span className="text-2xl font-semibold text-slate-800">€ —,—</span>
              <span className="pb-1 text-xs text-slate-400">Grundbetrag</span>
            </div>
          </article>

          {/* Vordere Karte (Hauptkarte, claymorphe Tiefe) */}
          <article
            className="vp-float absolute bottom-0 left-1/2 w-[96%] -translate-x-1/2 rounded-[2.25rem] bg-white p-7"
            style={{ boxShadow: claySurface }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span
                  className="grid h-12 w-12 place-items-center rounded-[1.25rem] text-lg font-bold text-white"
                  style={{
                    background:
                      "linear-gradient(135deg, #6366f1 0%, #22c55e 100%)",
                  }}
                >
                  R
                </span>
                <div>
                  <p className="text-base font-semibold text-slate-900">
                    onelane Fahrschule
                  </p>
                  <p className="text-xs text-slate-400">
                    Beispiel · Standort A · Klasse B
                  </p>
                </div>
              </div>
              <span
                className="rounded-full px-3 py-1 text-[11px] font-semibold text-emerald-600"
                style={{ background: "#eafff3" }}
              >
                Beispiel
              </span>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <div
                className="rounded-2xl p-4"
                style={{
                  background: "#f7f8fc",
                  boxShadow: "0 1px 0 0 rgba(255,255,255,0.9) inset",
                }}
              >
                <p className="text-[11px] uppercase tracking-wide text-slate-400">
                  Grundbetrag
                </p>
                <p className="mt-1 text-xl font-semibold text-slate-900">
                  € —,—
                </p>
              </div>
              <div
                className="rounded-2xl p-4"
                style={{
                  background: "#f7f8fc",
                  boxShadow: "0 1px 0 0 rgba(255,255,255,0.9) inset",
                }}
              >
                <p className="text-[11px] uppercase tracking-wide text-slate-400">
                  Bewertung
                </p>
                <p className="mt-1 flex items-center gap-1 text-xl font-semibold text-slate-900">
                  <svg
                    viewBox="0 0 20 20"
                    className="h-4 w-4 text-amber-400"
                    fill="currentColor"
                    aria-hidden
                  >
                    <path d="M10 1.6l2.47 5.01 5.53.8-4 3.9.94 5.5L10 14.2 5.06 16.8 6 11.3l-4-3.9 5.53-.8z" />
                  </svg>
                  —,—
                </p>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                Beispielwerte — noch nicht bestätigt.
              </span>
              <span
                className="rounded-full px-4 py-2 text-sm font-semibold text-white"
                style={{
                  background:
                    "linear-gradient(135deg, #6366f1 0%, #22c55e 100%)",
                }}
              >
                Vergleichen
              </span>
            </div>
          </article>
        </div>
      </section>

      <footer className="relative z-10 mx-auto w-full max-w-6xl px-6 pb-12">
        <p className="text-xs text-slate-400">
          Vorschau „Premium 11 · Clay Stack“ — Design-Test, nicht final.
        </p>
      </footer>
    </main>
  );
}
