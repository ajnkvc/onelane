import type { Metadata } from "next";
import Link from "next/link";
import { SearchBar } from "@/components/search/search-bar";
import { Typewriter } from "@/components/home/typewriter";

/**
 * VORSCHAU „Premium 10 · Diagonal Split" — asymmetrisches Split-Layout:
 * linke Hälfte hell mit Hero + Suche, rechte Hälfte eine tief-marineblaue
 * diagonale Fläche (clip-path) mit schwebendem Beispiel-Karten-Widget (vp-float).
 * Reines CSS, CSP-konform. Beispielwerte klar als „Beispiel" markiert.
 */
export const metadata: Metadata = {
  title: "Vorschau — Premium 10 (Diagonal Split)",
  robots: { index: false, follow: false },
};

const SLOGAN = ["günstigste", "nächste", "bestbewertete", "passende"];

export default function PremiumDiagonalSplit() {
  return (
    <div className="bg-[var(--background)]">
      <div className="mx-auto max-w-6xl px-6 pt-4 text-right">
        <Link href="/vorschau" className="text-sm text-muted-foreground underline-offset-2 hover:underline">← Vorschauen</Link>
      </div>

      <section className="relative overflow-hidden">
        {/* tief-marineblaue diagonale Fläche (rechts), per clip-path schräg geschnitten */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0"
          style={{
            clipPath: "polygon(58% 0, 100% 0, 100% 100%, 42% 100%)",
            background: "linear-gradient(135deg, #0b2545 0%, #13315c 55%, #1b3a5c 100%)",
          }}
        >
          <div className="vp-grid absolute inset-0 opacity-[0.18]" />
          <div className="vp-aurora absolute inset-0 opacity-30" />
        </div>
        {/* feine Lichtkante entlang der Diagonale */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0"
          style={{
            clipPath: "polygon(58% 0, 58.6% 0, 42.6% 100%, 42% 100%)",
            background: "linear-gradient(180deg, rgba(34,211,238,0.55), rgba(163,230,53,0.35))",
          }}
        />

        <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-12 px-6 pb-28 pt-20 lg:grid-cols-2 lg:gap-8 lg:pt-24">
          {/* LINKS — heller Hero mit Suche */}
          <div className="flex max-w-2xl flex-col items-start gap-6">
            <span className="vp-rise inline-flex items-center gap-2 rounded-full border border-brand-sky/25 bg-card/80 px-4 py-1.5 text-sm font-medium text-[#0369a1] shadow-sm backdrop-blur">
              <span className="size-2 rounded-full bg-brand-sky" /> Preise &amp; Quoten im Vergleich
            </span>
            <h1 className="vp-rise-2 text-4xl font-bold leading-[1.05] tracking-tight text-[#1b3a5c] sm:text-6xl">
              Finde die <Typewriter words={SLOGAN} className="text-gradient-brand" /> Fahrschule deiner Stadt.
            </h1>
            <p className="vp-rise-2 max-w-xl text-lg text-muted-foreground">
              Vergleiche Klassen, Kosten und <strong className="text-foreground">echte Bestehensquoten</strong> ruhig und übersichtlich — und entscheide dich sicher.
            </p>
            <div className="vp-rise-3 w-full">
              <SearchBar />
            </div>

            {/* 3 Trust-Pills */}
            <ul className="vp-rise-3 mt-2 flex flex-wrap items-center gap-2 text-sm">
              <li className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1.5 text-muted-foreground shadow-sm backdrop-blur">
                <svg aria-hidden width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 3 4 6v6c0 4.5 3.4 7.8 8 9 4.6-1.2 8-4.5 8-9V6l-8-3Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>
                Neutral &amp; unabhängig
              </li>
              <li className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1.5 text-muted-foreground shadow-sm backdrop-blur">
                <svg aria-hidden width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" /><path d="m8 12 3 3 5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                Alle Klassen abgedeckt
              </li>
              <li className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1.5 text-muted-foreground shadow-sm backdrop-blur">
                <svg aria-hidden width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="2" /></svg>
                Direkt in deiner Nähe
              </li>
            </ul>
          </div>

          {/* RECHTS — schwebendes Beispiel-Karten-Widget über der dunklen Fläche */}
          <div aria-hidden className="relative hidden min-h-[20rem] lg:block">
            <div className="vp-float absolute right-0 top-1/2 w-72 -translate-y-1/2 rounded-3xl border border-white/15 bg-white/95 p-5 text-left shadow-2xl backdrop-blur">
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-xl bg-gradient-to-br from-[#0ea5e9] to-[#22d3ee] text-sm font-bold text-white">FS</span>
                <div>
                  <div className="text-sm font-semibold text-[#1b3a5c]">Fahrschule (Beispiel)</div>
                  <div className="text-xs text-muted-foreground">B · B197 · BE · A1</div>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-4">
                <div className="grid size-16 shrink-0 place-items-center rounded-full" style={{ background: "conic-gradient(#0ea5e9 0 64%, #e2e8f0 64% 100%)" }}>
                  <span className="grid size-12 place-items-center rounded-full bg-white text-sm font-bold text-[#1b3a5c]">64%</span>
                </div>
                <p className="text-xs leading-snug text-muted-foreground">bestehen im 1. Anlauf<br /><span className="text-[0.7rem]">Beispielwert — keine Schul-Angabe</span></p>
              </div>

              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">Grundgebühr</span><span className="font-semibold text-[#1b3a5c]">Beispiel</span></div>
                <div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">Fahrstunde</span><span className="font-semibold text-[#1b3a5c]">Beispiel</span></div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary"><div className="h-full w-2/3 rounded-full bg-gradient-to-r from-[#0ea5e9] to-[#a3e635]" /></div>
              </div>
            </div>

            {/* kleines Status-Chip, leicht versetzt schwebend */}
            <div className="vp-float absolute right-56 top-12 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/95 px-3 py-2 text-xs text-[#1b3a5c] shadow-xl backdrop-blur">
              <span className="size-2 rounded-full bg-brand-cyan" /> 3 in der Nähe
            </div>
          </div>
        </div>
      </section>

      <p className="pb-12 text-center text-xs text-muted-foreground">Vorschau „Premium 10 · Diagonal Split“ — Design-Test, nicht final. Beispielwerte sind keine bestätigten Angaben.</p>
    </div>
  );
}
