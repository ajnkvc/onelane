import type { Metadata } from "next";
import Link from "next/link";

/**
 * VORSCHAU „Laut 5 · Color-Block Bauhaus" — große, satte Farbblöcke in
 * Primärfarben, riesige Wörter/Zahlen, strenges Raster, viel Weißraum und
 * geometrische inline-SVG-Formen. Mutig, aber durch klare Ordnung seriös.
 * Server-Komponente, CSS-only, noindex.
 */
export const metadata: Metadata = {
  title: "Vorschau — Laut 5 (Color-Block)",
  robots: { index: false, follow: false },
};

const INK = "#111";
const BLUE = "#2f5bff";
const YELLOW = "#ffd23f";
const RED = "#ff3b30";

const VORTEILE = [
  {
    farbe: BLUE,
    text: "#fff",
    form: "kreis",
    titel: "Suchen",
    kicker: "Stadt & PLZ",
    beschreibung:
      "Gib deine Stadt oder Postleitzahl ein und sieh alle Fahrschulen in deiner Nähe auf einen Blick.",
  },
  {
    farbe: YELLOW,
    text: INK,
    form: "dreieck",
    titel: "Vergleichen",
    kicker: "Preis · Klassen · Quote",
    beschreibung:
      "Preise, angebotene Führerschein-Klassen und echte Bestehensquoten klar nebeneinander — ohne Schöngerede.",
  },
  {
    farbe: RED,
    text: "#fff",
    form: "quadrat",
    titel: "Anmelden",
    kicker: "Direkt online",
    beschreibung:
      "Hast du deine Fahrschule gefunden, meldest du dich direkt online an — papierlos und in wenigen Minuten.",
  },
];

function Shape({ form, color }: { form: string; color: string }) {
  if (form === "kreis") {
    return (
      <svg viewBox="0 0 64 64" className="h-12 w-12" aria-hidden="true">
        <circle cx="32" cy="32" r="28" fill={color} />
      </svg>
    );
  }
  if (form === "dreieck") {
    return (
      <svg viewBox="0 0 64 64" className="h-12 w-12" aria-hidden="true">
        <polygon points="32,6 58,56 6,56" fill={color} />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 64 64" className="h-12 w-12" aria-hidden="true">
      <rect x="8" y="8" width="48" height="48" fill={color} />
    </svg>
  );
}

export default function Laut5() {
  return (
    <div className="min-h-screen bg-[#f7f4ec] text-[#111]">
      <div className="mx-auto max-w-6xl px-5">
        <header className="flex items-center justify-between py-6">
          <span className="flex items-center gap-2 text-xl font-black tracking-tight">
            <svg viewBox="0 0 32 32" className="h-6 w-6" aria-hidden="true">
              <circle cx="10" cy="16" r="8" fill={BLUE} />
              <rect x="16" y="8" width="16" height="16" fill={YELLOW} />
            </svg>
            onelane
          </span>
          <Link
            href="/vorschau"
            className="rounded-full border-2 border-[#111] bg-white px-4 py-1.5 text-sm font-bold transition hover:bg-[#111] hover:text-white"
          >
            ← Vorschauen
          </Link>
        </header>

        {/* HERO */}
        <section className="grid items-center gap-10 py-12 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="vp-rise">
            <span className="inline-block bg-[#ffd23f] px-3 py-1 text-sm font-black uppercase tracking-widest text-[#111]">
              Fahrschulen · ehrlich verglichen
            </span>
            <h1 className="mt-6 text-6xl font-black leading-[0.92] tracking-[-0.03em] sm:text-8xl">
              Finde
              <br />
              <span className="bg-[#2f5bff] px-2 text-white [-webkit-box-decoration-break:clone] [box-decoration-break:clone]">
                deine
              </span>
              <br />
              Fahrschule.
            </h1>
            <p className="mt-6 max-w-md text-lg font-medium text-[#444]">
              Such nach Stadt oder PLZ. Vergleich Preise, Klassen und echte
              Bestehensquoten. Melde dich direkt online an.
            </p>

            {/* Mock-Such-Input */}
            <div className="mt-8 flex max-w-md flex-col gap-3 sm:flex-row">
              <div className="flex flex-1 items-center gap-2 border-2 border-[#111] bg-white px-4 py-3">
                <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" fill="none" stroke={INK} strokeWidth="2.5" />
                  <line x1="16.5" y1="16.5" x2="22" y2="22" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
                </svg>
                <span className="text-base font-medium text-[#888]">
                  Stadt oder PLZ eingeben …
                </span>
              </div>
              <button
                type="button"
                className="border-2 border-[#111] bg-[#ff3b30] px-6 py-3 text-base font-black uppercase tracking-wide text-white transition hover:bg-[#111]"
              >
                Suchen
              </button>
            </div>
            <p className="mt-3 text-xs font-medium text-[#888]">
              Vorschau — keine echte Suche.
            </p>
          </div>

          {/* Color-Block Komposition */}
          <div className="vp-rise-2 grid grid-cols-2 grid-rows-2 gap-3 sm:gap-4">
            <div className="flex aspect-square items-center justify-center bg-[#2f5bff]">
              <svg viewBox="0 0 100 100" className="h-2/3 w-2/3 vp-float" aria-hidden="true">
                <circle cx="50" cy="50" r="42" fill="#fff" />
              </svg>
            </div>
            <div className="flex aspect-square items-center justify-center bg-[#ffd23f]">
              <span className="text-6xl font-black tracking-tighter text-[#111] vp-wobble">B</span>
            </div>
            <div className="flex aspect-square items-center justify-center bg-[#111]">
              <svg viewBox="0 0 100 100" className="h-2/3 w-2/3" aria-hidden="true">
                <polygon points="50,12 90,84 10,84" fill="#ffd23f" />
              </svg>
            </div>
            <div className="flex aspect-square items-center justify-center bg-[#ff3b30]">
              <svg viewBox="0 0 100 100" className="h-1/2 w-1/2" aria-hidden="true">
                <rect x="6" y="6" width="88" height="88" fill="#fff" />
              </svg>
            </div>
          </div>
        </section>

        {/* VORTEILS-RASTER */}
        <section className="py-12">
          <h2 className="text-4xl font-black tracking-tight sm:text-5xl">
            So einfach geht&apos;s
          </h2>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {VORTEILE.map((v, i) => (
              <div
                key={v.titel}
                className={`flex flex-col gap-4 border-2 border-[#111] p-7 transition hover:-translate-y-1 ${
                  i === 0 ? "vp-rise" : i === 1 ? "vp-rise-2" : "vp-rise-3"
                }`}
                style={{ backgroundColor: v.farbe, color: v.text }}
              >
                <div className="flex items-center justify-between">
                  <Shape form={v.form} color={v.text} />
                  <span className="text-5xl font-black tabular-nums opacity-30">
                    {i + 1}
                  </span>
                </div>
                <div>
                  <span className="text-xs font-black uppercase tracking-widest" style={{ color: v.text }}>
                    {v.kicker}
                  </span>
                  <h3 className="mt-1 text-3xl font-black tracking-tight">{v.titel}</h3>
                </div>
                <p className="text-base font-medium leading-snug">{v.beschreibung}</p>
              </div>
            ))}
          </div>
          <p className="mt-5 text-sm font-medium text-[#888]">
            Beispiel-Darstellung: angezeigte Werte und Quoten stammen aus
            geprüften Quellen und werden je Fahrschule ausgewiesen.
          </p>
        </section>

        {/* CTA */}
        <section className="my-12 grid items-center gap-8 border-2 border-[#111] bg-[#111] p-8 text-white sm:p-12 lg:grid-cols-[1.4fr_0.6fr]">
          <div>
            <h2 className="text-4xl font-black leading-tight tracking-tight sm:text-5xl">
              Bereit, den{" "}
              <span className="bg-[#ffd23f] px-2 text-[#111]">Überblick</span> zu
              bekommen?
            </h2>
            <p className="mt-4 max-w-lg text-lg font-medium text-[#bbb]">
              Vergleiche Fahrschulen fair und transparent — und start mit dem
              ersten Schritt zum Führerschein.
            </p>
            <button
              type="button"
              className="mt-7 border-2 border-[#ffd23f] bg-[#ffd23f] px-7 py-3 text-base font-black uppercase tracking-wide text-[#111] transition hover:bg-transparent hover:text-[#ffd23f]"
            >
              Jetzt vergleichen
            </button>
          </div>
          <div className="flex justify-center gap-3">
            <svg viewBox="0 0 60 60" className="h-20 w-20 vp-float" aria-hidden="true">
              <circle cx="30" cy="30" r="26" fill={BLUE} />
            </svg>
            <svg viewBox="0 0 60 60" className="h-20 w-20" aria-hidden="true">
              <rect x="4" y="4" width="52" height="52" fill={RED} />
            </svg>
            <svg viewBox="0 0 60 60" className="h-20 w-20 vp-wobble" aria-hidden="true">
              <polygon points="30,4 56,56 4,56" fill={YELLOW} />
            </svg>
          </div>
        </section>

        {/* FUSSNOTE */}
        <footer className="border-t-2 border-[#111] py-8">
          <p className="text-sm font-medium text-[#666]">
            Vorschau „Laut 5 · Color-Block“ — Design-Test, nicht final.
          </p>
        </footer>
      </div>
    </div>
  );
}
