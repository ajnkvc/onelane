import type { Metadata } from "next";
import Link from "next/link";

/**
 * VORSCHAU „Laut 1" — disziplinierter Neo-Brutalismus: begrenzte Palette
 * (Tinte + Creme + EIN Akzent), harte Schatten, klares Raster, gut lesbar.
 * Laut, aber seriös. SSR, CSS-only. `noindex`.
 */
export const metadata: Metadata = {
  title: "Vorschau — Laut 1 (Refined Brutalism)",
  robots: { index: false, follow: false },
};

const INK = "#16130f";

export default function Laut1() {
  return (
    <div className="min-h-screen bg-[#f4efe4] text-[#16130f]">
      <div className="mx-auto max-w-6xl px-5">
        <header className="flex items-center justify-between py-6">
          <span className="text-xl font-extrabold tracking-tight">fahr<span className="text-[#2f5bff]">.</span>vergleich</span>
          <Link href="/vorschau" className="rounded-lg border-2 border-[#16130f] bg-white px-4 py-1.5 text-sm font-bold shadow-[3px_3px_0_#16130f] transition hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[1px_1px_0_#16130f]">← Vorschauen</Link>
        </header>

        <section className="grid items-center gap-10 py-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <span className="inline-block rounded-md border-2 border-[#16130f] bg-[#ffd23f] px-3 py-1 text-sm font-extrabold uppercase tracking-wide shadow-[3px_3px_0_#16130f]">Endlich Durchblick</span>
            <h1 className="mt-6 text-5xl font-black leading-[0.98] tracking-[-0.02em] sm:text-7xl">
              Fahrschulen.<br />Ehrlich<br /><span className="bg-[#2f5bff] px-2 text-white [box-decoration-break:clone] [-webkit-box-decoration-break:clone]">verglichen.</span>
            </h1>
            <p className="mt-6 max-w-md text-lg font-medium leading-relaxed text-[#3a352d]">
              Preise, Klassen und echte Bestehensquoten — klar nebeneinander. Kein Lockpreis,
              kein Blabla, keine versteckten Kosten.
            </p>
            <div className="mt-7 flex max-w-lg flex-col gap-3 sm:flex-row">
              <input disabled placeholder="Stadt oder PLZ …" className="flex-1 rounded-lg border-2 border-[#16130f] bg-white px-4 py-3.5 text-base font-medium placeholder:text-[#9a9286] focus:outline-none" />
              <button className="rounded-lg border-2 border-[#16130f] bg-[#2f5bff] px-6 py-3.5 text-base font-extrabold text-white shadow-[4px_4px_0_#16130f] transition hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[2px_2px_0_#16130f]">Vergleichen</button>
            </div>
            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm font-bold">
              {["100 % kostenlos", "unabhängig", "DSGVO-konform"].map((t) => (
                <span key={t} className="inline-flex items-center gap-2"><span className="grid size-5 place-items-center rounded-full bg-[#16130f] text-[10px] text-[#ffd23f]">✓</span>{t}</span>
              ))}
            </div>
          </div>

          {/* Beispielkarte — physisch, klar, lesbar */}
          <div className="rounded-2xl border-2 border-[#16130f] bg-white p-5 shadow-[8px_8px_0_#16130f]">
            <div className="flex items-center justify-between border-b-2 border-dashed border-[#e5ddcd] pb-3 text-xs font-bold uppercase tracking-wide text-[#8a8275]"><span>Kostenüberblick</span><span>Klasse B</span></div>
            {[["Grundgebühr", "—"], ["Fahrstunde (45 Min.)", "—"], ["Überland / Autobahn / Nacht", "—"], ["Prüfungsentgelte", "—"]].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between border-b border-[#f0eadc] py-3 text-sm font-medium last:border-0"><span>{k}</span><span className="font-extrabold tabular-nums">{v}</span></div>
            ))}
            <div className="mt-3 rounded-lg bg-[#ffd23f] px-3 py-2 text-center text-xs font-extrabold uppercase" style={{ border: `2px solid ${INK}` }}>Alles aufgeschlüsselt — kein „ab 0 €“</div>
          </div>
        </section>

        {/* Drei klare Blöcke */}
        <section className="grid gap-4 py-10 sm:grid-cols-3">
          {[["01", "Standort wählen", "Stadt eingeben — passende Schulen sofort sehen."], ["02", "Fair vergleichen", "Preise & Bestehensquoten transparent nebeneinander."], ["03", "Online anmelden", "Direkt anfragen, in Minuten, kostenlos."]].map(([n, t, d]) => (
            <div key={n} className="rounded-2xl border-2 border-[#16130f] bg-white p-6 shadow-[5px_5px_0_#16130f]">
              <span className="text-3xl font-black text-[#2f5bff]">{n}</span>
              <h3 className="mt-2 text-xl font-extrabold">{t}</h3>
              <p className="mt-1 text-sm font-medium text-[#3a352d]">{d}</p>
            </div>
          ))}
        </section>

        <p className="py-10 text-center text-xs font-medium text-[#8a8275]">Vorschau „Laut 1 · Refined Brutalism“ — Design-Test, nicht final.</p>
      </div>
    </div>
  );
}
