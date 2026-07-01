import type { Metadata } from "next";
import Link from "next/link";

/**
 * VORSCHAU „Premium" (Fintech/Apple-artig) — reiner Design-Test, SSR, CSS-only.
 * Nicht verlinkt im Footer, `noindex`. Ändert die echte Startseite NICHT.
 * Beispiel-Inhalte sind neutral gehalten (keine erfundenen Kennzahlen).
 */
export const metadata: Metadata = {
  title: "Vorschau — Premium",
  robots: { index: false, follow: false },
};

function Line({ d }: { d: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

export default function VorschauPremium() {
  return (
    <div className="min-h-screen bg-[#fbfcfe] text-[#0f2235]">
      <div className="mx-auto max-w-[78rem] px-6">
        {/* Nav */}
        <header className="flex items-center justify-between py-6">
          <span className="text-lg font-semibold tracking-tight">fahrschul<span className="text-[#94a3b8]">portal</span></span>
          <div className="flex items-center gap-6 text-sm text-[#475569]">
            <span className="hidden sm:inline">Fahrschulen</span>
            <span className="hidden sm:inline">Preise</span>
            <Link href="/vorschau" className="rounded-full border border-[#e2e8f0] px-4 py-1.5 font-medium text-[#0f2235] transition hover:bg-white">← Vorschauen</Link>
          </div>
        </header>

        {/* Hero */}
        <section className="relative isolate overflow-hidden rounded-[2rem] border border-[#e8edf3] bg-white px-6 py-20 sm:px-16 sm:py-28">
          <div className="vp-aurora absolute inset-0 -z-10 opacity-70" />
          <div className="vp-grid absolute inset-0 -z-10 opacity-60" />
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#dbe3ec] bg-white/70 px-4 py-1.5 text-xs font-medium uppercase tracking-[0.18em] text-[#64748b] backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-[#0ea5e9]" /> Vergleichsportal für Fahrschulen
            </span>
            <h1 className="mt-7 text-balance text-5xl font-semibold leading-[1.05] tracking-[-0.03em] sm:text-7xl">
              Die richtige Fahrschule.<br />
              <span className="bg-gradient-to-r from-[#0f2235] via-[#0e7490] to-[#0ea5e9] bg-clip-text text-transparent">Klar verglichen.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-pretty text-lg leading-relaxed text-[#516074]">
              Verifizierte Schulen, transparente Preise je Klasse und Online-Anmeldung —
              ruhig und übersichtlich an einem Ort.
            </p>

            {/* Mock-Suche */}
            <div className="mx-auto mt-9 flex max-w-xl items-center gap-2 rounded-2xl border border-[#e2e8f0] bg-white p-2 shadow-[0_18px_40px_-24px_rgba(15,34,53,0.45)]">
              <div className="flex flex-1 items-center gap-3 px-3 text-[#64748b]">
                <Line d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.3-4.3" />
                <span className="text-[15px]">Adresse, Stadtteil oder Stadt eingeben …</span>
              </div>
              <button className="rounded-xl bg-[#0f2235] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#15314b]">Suchen</button>
            </div>

            <div className="mt-7 flex flex-wrap items-center justify-center gap-x-7 gap-y-2 text-sm text-[#64748b]">
              <span className="inline-flex items-center gap-2"><span className="text-[#0ea5e9]"><Line d="M20 6 9 17l-5-5" /></span> Verifizierte Fahrschulen</span>
              <span className="inline-flex items-center gap-2"><span className="text-[#0ea5e9]"><Line d="M20 6 9 17l-5-5" /></span> Preise je Führerscheinklasse</span>
              <span className="inline-flex items-center gap-2"><span className="text-[#0ea5e9]"><Line d="M20 6 9 17l-5-5" /></span> Online anmelden</span>
            </div>
          </div>
        </section>

        {/* Drei Versprechen */}
        <section className="grid gap-5 py-20 sm:grid-cols-3">
          {[
            { i: "M12 2 4 6v6c0 5 3.4 7.7 8 10 4.6-2.3 8-5 8-10V6l-8-4Z", t: "Geprüft, nicht geraten", d: "Jede Angabe wird gegen die Quelle der Schule abgeglichen — keine erfundenen Daten." },
            { i: "M3 12h18M3 6h18M3 18h12", t: "Alles aufgeschlüsselt", d: "Grundgebühr, Fahrstunde, Sonderfahrten, Prüfung — Position für Position." },
            { i: "M12 21s-7-4.3-7-10a7 7 0 0 1 14 0c0 5.7-7 10-7 10Zm0-7a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z", t: "In deiner Nähe", d: "Standortbasierte Suche mit Karte — die passenden Schulen direkt um dich herum." },
          ].map((c) => (
            <div key={c.t} className="group rounded-3xl border border-[#e8edf3] bg-white p-7 shadow-[0_1px_0_rgba(15,34,53,0.04)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_28px_50px_-30px_rgba(15,34,53,0.4)]">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f1f6fb] text-[#0e7490]"><Line d={c.i} /></div>
              <h3 className="mt-5 text-lg font-semibold tracking-tight">{c.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#516074]">{c.d}</p>
            </div>
          ))}
        </section>

        {/* Dunkle Akzent-Sektion */}
        <section className="relative isolate overflow-hidden rounded-[2rem] bg-[#0c1c2e] px-6 py-16 text-white sm:px-16">
          <div className="vp-aurora absolute inset-0 -z-10 opacity-30" />
          <div className="grid items-center gap-10 sm:grid-cols-2">
            <div>
              <span className="text-xs font-medium uppercase tracking-[0.2em] text-[#7dd3fc]">Transparenz</span>
              <h2 className="mt-4 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">Vergleichen, was wirklich zählt.</h2>
              <p className="mt-4 max-w-md text-[15px] leading-relaxed text-[#aebfd0]">
                Statt Lockpreisen siehst du die echten Gesamtkosten — fair, vollständig und bis
                zur Bestätigung klar gekennzeichnet.
              </p>
              <button className="mt-7 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-[#0c1c2e] transition hover:bg-[#e2e8f0]">Fahrschule finden →</button>
            </div>
            <div className="vp-float rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur">
              {[["Grundgebühr", "—"], ["Fahrstunde (45 Min.)", "—"], ["Sonderfahrten", "—"], ["Prüfungsentgelte", "—"]].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between border-b border-white/10 py-3 text-sm last:border-0">
                  <span className="text-[#aebfd0]">{k}</span><span className="font-medium tabular-nums">{v}</span>
                </div>
              ))}
              <p className="mt-3 text-xs text-[#7d93a8]">Beispiel-Darstellung — Werte je Schule, bis zur Bestätigung als „unbestätigt“ markiert.</p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-24 text-center">
          <h2 className="mx-auto max-w-2xl text-balance text-4xl font-semibold tracking-[-0.02em] sm:text-5xl">Bereit für den Führerschein?</h2>
          <p className="mx-auto mt-4 max-w-md text-[#516074]">Finde deine Fahrschule in wenigen Sekunden.</p>
          <button className="mt-8 rounded-2xl bg-[#0f2235] px-8 py-4 text-base font-semibold text-white transition hover:bg-[#15314b]">Jetzt Fahrschule finden</button>
          <p className="mt-10 text-xs text-[#94a3b8]">Vorschau „Premium“ — Design-Test, nicht final. Marke „onelane“ ist ein Platzhalter.</p>
        </section>
      </div>
    </div>
  );
}
