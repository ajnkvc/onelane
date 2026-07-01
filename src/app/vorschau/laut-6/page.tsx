import type { Metadata } from "next";
import Link from "next/link";

/**
 * VORSCHAU „Laut 6 · Marker" — helle Off-White-Basis, klar lesbar, mit
 * handgezeichneten Marker-Akzenten (inline-SVG: Schwünge, Kreise, Pfeile)
 * und EINEM kräftigen Akzent. Verspielt, sympathisch, trotzdem vertrauenswürdig.
 * SSR, CSS-only, noindex.
 */
export const metadata: Metadata = {
  title: "Vorschau — Laut 6 (Marker)",
  robots: { index: false, follow: false },
};

const ACCENT = "#ff4d2e";

const VORTEILE = [
  {
    titel: "Stadt oder PLZ — fertig",
    text: "Tippe deinen Ort ein und sieh sofort die Fahrschulen in deiner Nähe. Keine endlosen Listen, kein Telefon-Marathon.",
  },
  {
    titel: "Preise & Klassen offen",
    text: "Grundgebühr, Fahrstunden, Sonderfahrten, Prüfgebühren — und welche Klassen angeboten werden. Alles auf einen Blick statt Kleingedrucktes.",
  },
  {
    titel: "Echte Bestehensquoten",
    text: "Wir zeigen tatsächliche Quoten statt Werbeversprechen — damit du informiert entscheidest und nicht nach Bauchgefühl.",
  },
];

export default function Laut6() {
  return (
    <div className="min-h-screen bg-[#fbf8f3] text-[#1c1814]">
      <div className="mx-auto max-w-5xl px-5">
        {/* Header */}
        <header className="flex items-center justify-between py-6">
          <span className="relative text-xl font-black tracking-tight">
            road<span style={{ color: ACCENT }}>ino</span>
            <svg
              aria-hidden="true"
              viewBox="0 0 120 14"
              className="vp-wobble absolute -bottom-2 left-0 w-full"
              fill="none"
            >
              <path
                d="M3 9 C 30 3, 60 12, 90 5 S 116 8, 117 6"
                stroke={ACCENT}
                strokeWidth="3.5"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <Link
            href="/vorschau"
            className="rounded-full bg-white px-4 py-1.5 text-sm font-bold text-[#1c1814] shadow-sm ring-1 ring-black/10 transition hover:-translate-y-0.5"
          >
            ← Vorschauen
          </Link>
        </header>

        {/* Hero */}
        <section className="relative pt-10 pb-16 sm:pt-16">
          <span className="vp-rise inline-flex items-center gap-2 rounded-full bg-white px-4 py-1.5 text-sm font-bold ring-1 ring-black/10">
            <span
              className="inline-block size-2 rounded-full"
              style={{ background: ACCENT }}
            />
            Der ehrliche Fahrschul-Vergleich
          </span>

          <h1 className="vp-rise-2 mt-6 max-w-3xl text-5xl font-black leading-[1.02] tracking-tight sm:text-7xl">
            Finde die{" "}
            <span className="relative inline-block whitespace-nowrap">
              richtige
              <svg
                aria-hidden="true"
                viewBox="0 0 240 26"
                className="absolute -bottom-1 left-0 w-full"
                fill="none"
              >
                <path
                  d="M5 17 C 70 6, 150 6, 235 13"
                  stroke={ACCENT}
                  strokeWidth="6"
                  strokeLinecap="round"
                />
              </svg>
            </span>{" "}
            Fahrschule —<br />
            ohne Rätselraten.
          </h1>

          <p className="vp-rise-2 mt-5 max-w-xl text-lg font-medium text-[#5b524a]">
            Vergleiche Preise, Klassen und echte Bestehensquoten in deiner Stadt.
            Such dir die passende Schule und melde dich direkt online an.
          </p>

          {/* Mock-Suche */}
          <div className="vp-rise-3 mt-9 flex max-w-xl flex-col gap-3 rounded-2xl bg-white p-2 shadow-[0_18px_50px_-30px_rgba(0,0,0,0.5)] ring-1 ring-black/10 sm:flex-row">
            <input
              disabled
              placeholder="Stadt oder PLZ eingeben …"
              className="flex-1 rounded-xl bg-[#fbf8f3] px-5 py-4 text-base font-medium placeholder:text-[#a89c8f] focus:outline-none"
            />
            <button
              className="rounded-xl px-7 py-4 text-base font-bold text-white shadow-sm transition hover:brightness-105"
              style={{ background: ACCENT }}
            >
              Fahrschulen finden
            </button>
          </div>

          {/* eingekreistes Wort als Marker-Akzent */}
          <p className="vp-rise-3 mt-5 text-sm font-semibold text-[#5b524a]">
            Komplett{" "}
            <span className="relative inline-block px-1">
              kostenlos
              <svg
                aria-hidden="true"
                viewBox="0 0 110 44"
                className="absolute -inset-x-1 -inset-y-1.5 h-[170%] w-[120%]"
                fill="none"
              >
                <path
                  d="M55 4 C 92 4, 106 14, 106 22 C 106 33, 80 40, 52 40 C 22 40, 4 32, 4 22 C 4 13, 20 6, 48 5"
                  stroke={ACCENT}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
            </span>{" "}
            &amp; unverbindlich.
          </p>
        </section>

        {/* Vorteile */}
        <section className="grid gap-5 pb-14 sm:grid-cols-3">
          {VORTEILE.map((v, i) => (
            <div
              key={v.titel}
              className="relative rounded-3xl bg-white p-7 shadow-[0_16px_40px_-30px_rgba(0,0,0,0.45)] ring-1 ring-black/10 transition hover:-translate-y-1.5"
            >
              <span
                className="grid size-9 place-items-center rounded-full text-sm font-black text-white"
                style={{ background: ACCENT }}
              >
                {i + 1}
              </span>
              <h3 className="mt-4 text-xl font-black">{v.titel}</h3>
              <p className="mt-2 text-sm font-medium leading-relaxed text-[#5b524a]">
                {v.text}
              </p>
            </div>
          ))}
        </section>

        {/* CTA */}
        <section className="relative overflow-hidden rounded-[2rem] bg-[#1c1814] px-7 py-14 text-center text-white sm:px-12">
          <svg
            aria-hidden="true"
            viewBox="0 0 120 60"
            className="vp-float absolute right-6 top-6 hidden w-24 opacity-80 sm:block"
            fill="none"
          >
            <path
              className="vp-dash"
              d="M8 50 C 40 50, 50 14, 96 14"
              stroke={ACCENT}
              strokeWidth="3"
              strokeLinecap="round"
            />
            <path
              d="M82 6 L 100 14 L 84 24"
              stroke={ACCENT}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>

          <h2 className="mx-auto max-w-2xl text-3xl font-black leading-tight sm:text-5xl">
            Bereit, deinen{" "}
            <span className="relative inline-block whitespace-nowrap">
              <span style={{ color: ACCENT }}>Führerschein</span>
              <svg
                aria-hidden="true"
                viewBox="0 0 280 18"
                className="absolute -bottom-1 left-0 w-full"
                fill="none"
              >
                <path
                  d="M5 11 C 80 4, 200 4, 275 10"
                  stroke={ACCENT}
                  strokeWidth="5"
                  strokeLinecap="round"
                />
              </svg>
            </span>{" "}
            anzugehen?
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-base font-medium text-white/70">
            Such deine Stadt, vergleiche in Ruhe und melde dich bei der Schule
            deiner Wahl an — alles an einem Ort.
          </p>
          <button
            className="mt-8 rounded-full bg-white px-8 py-4 text-base font-black text-[#1c1814] shadow-sm transition hover:-translate-y-0.5"
          >
            Jetzt Fahrschulen vergleichen
          </button>
        </section>

        {/* Fußnote */}
        <p className="py-10 text-center text-xs font-medium text-[#a89c8f]">
          Beispielwerte und Marke „onelane“ sind Platzhalter. Vorschau „Laut 6 ·
          Marker“ — Design-Test, nicht final.
        </p>
      </div>
    </div>
  );
}
