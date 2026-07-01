import type { Metadata } from "next";
import Link from "next/link";

/**
 * VORSCHAU „Laut 4 · Neon Night" — dunkle, edle Basis mit EINEM Neon-Akzent
 * (electric Lime) plus dezentem Cyan-Glow. Laut, aber premium durch
 * Zurückhaltung. SSR, CSS-only, keine externen Assets. `noindex`.
 */
export const metadata: Metadata = {
  title: "Vorschau — Laut 4 (Neon Night)",
  robots: { index: false, follow: false },
};

const TAGS = ["Klasse B", "Automatik B197", "A1 · A2 · A", "BE", "B196"];

const PUNKTE = [
  {
    t: "Stadt oder PLZ — fertig",
    d: "Standort eingeben, passende Fahrschulen in deiner Nähe sofort vor dir. Kein langes Suchen.",
  },
  {
    t: "Preise & Klassen offen",
    d: "Jede Position transparent — Grundgebühr, Fahrstunden, Sonderfahrten, Prüfung. Klar vergleichbar.",
  },
  {
    t: "Echte Bestehensquoten",
    d: "Praxis-Ergebnisse statt Werbeversprechen. Du entscheidest informiert, nicht nach Bauchgefühl.",
  },
  {
    t: "Online anmelden",
    d: "Schule gewählt? Direkt anfragen oder anmelden — ohne Telefon-Schleifen, wenn die Schule es anbietet.",
  },
];

const LIME = "#c6ff3a";

export default function Laut4() {
  return (
    <div className="min-h-screen bg-[#0d0f12] text-[#eef2e6]">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(60% 50% at 15% 0%, rgba(198,255,58,0.10), transparent 70%), radial-gradient(50% 45% at 90% 20%, rgba(56,224,224,0.08), transparent 70%)",
        }}
      />

      <div className="mx-auto max-w-6xl px-5">
        <header className="flex items-center justify-between py-6">
          <span className="text-xl font-black tracking-tight">
            <span style={{ color: LIME, textShadow: "0 0 18px rgba(198,255,58,0.55)" }}>●</span>{" "}
            <span className="opacity-90">Platzhalter</span>
          </span>
          <Link
            href="/vorschau"
            className="rounded-full bg-white/5 px-4 py-1.5 text-sm font-bold text-[#eef2e6] ring-1 ring-white/10 backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/10"
          >
            ← Vorschauen
          </Link>
        </header>

        <section className="relative isolate overflow-hidden py-16 sm:py-28">
          <span
            className="vp-rise inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-[0.2em]"
            style={{
              color: LIME,
              background: "rgba(198,255,58,0.08)",
              boxShadow: "inset 0 0 0 1px rgba(198,255,58,0.3)",
            }}
          >
            Vergleichsportal für Fahrschulen
          </span>

          <h1 className="vp-rise-2 mt-6 max-w-4xl text-6xl font-black leading-[0.92] tracking-tight sm:text-8xl">
            Finde deine <br />
            <span
              className="vp-text-pan bg-clip-text text-transparent"
              style={{
                backgroundImage:
                  "linear-gradient(90deg, #c6ff3a, #38e0e0, #c6ff3a)",
                backgroundSize: "200% auto",
                textShadow: "0 0 60px rgba(198,255,58,0.25)",
              }}
            >
              Fahrschule.
            </span>
          </h1>

          <p className="vp-rise-2 mt-7 max-w-xl text-lg font-medium leading-relaxed text-[#aab3a0]">
            Such nach Stadt oder PLZ. Vergleiche Preise, Führerschein-Klassen und echte
            Bestehensquoten — und melde dich online an. Ehrlich, offen, ohne Kleingedrucktes.
          </p>

          <div className="vp-rise-3 mt-9 flex max-w-xl flex-col gap-3 rounded-2xl bg-white/[0.04] p-2 ring-1 ring-white/10 backdrop-blur sm:flex-row">
            <input
              disabled
              placeholder="Stadt oder PLZ eingeben …"
              className="flex-1 rounded-xl bg-[#0d0f12]/60 px-5 py-4 text-base font-medium text-[#eef2e6] placeholder:text-[#6b7363] focus:outline-none"
            />
            <button
              className="rounded-xl px-7 py-4 text-base font-black text-[#0d0f12] transition hover:brightness-110"
              style={{
                background: LIME,
                boxShadow: "0 0 28px rgba(198,255,58,0.45)",
              }}
            >
              Vergleichen
            </button>
          </div>

          <div className="vp-rise-3 mt-6 flex flex-wrap gap-2">
            {TAGS.map((t) => (
              <span
                key={t}
                className="rounded-full bg-white/[0.04] px-3 py-1 text-sm font-semibold text-[#aab3a0] ring-1 ring-white/10"
              >
                {t}
              </span>
            ))}
          </div>
        </section>

        <section className="grid gap-4 pb-6 sm:grid-cols-2">
          {PUNKTE.map((c, i) => (
            <div
              key={c.t}
              className="group rounded-3xl bg-white/[0.03] p-7 ring-1 ring-white/10 transition hover:-translate-y-1.5 hover:bg-white/[0.05]"
              style={{ boxShadow: "0 24px 60px -40px rgba(198,255,58,0.4)" }}
            >
              <span
                className="text-sm font-black tabular-nums"
                style={{ color: LIME, textShadow: "0 0 16px rgba(198,255,58,0.5)" }}
              >
                0{i + 1}
              </span>
              <h3 className="mt-3 text-2xl font-black tracking-tight">{c.t}</h3>
              <p className="mt-2 text-base font-medium leading-relaxed text-[#aab3a0]">{c.d}</p>
            </div>
          ))}
        </section>

        <section className="my-12 overflow-hidden rounded-[2.2rem] px-6 py-16 text-center ring-1 ring-white/10 sm:px-12 sm:py-20"
          style={{
            background:
              "radial-gradient(80% 120% at 50% 0%, rgba(198,255,58,0.12), transparent 60%)",
          }}
        >
          <h2 className="mx-auto max-w-2xl text-4xl font-black leading-tight tracking-tight sm:text-5xl">
            Ein Vergleich. <span style={{ color: LIME }}>Volle Klarheit.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-base font-medium text-[#aab3a0]">
            Schluss mit Raten und Anrufen bei jeder Schule einzeln. Alles an einem Ort —
            damit du dich auf das Fahren konzentrieren kannst.
          </p>
          <button
            className="mt-8 rounded-xl px-8 py-4 text-base font-black text-[#0d0f12] transition hover:brightness-110"
            style={{
              background: LIME,
              boxShadow: "0 0 32px rgba(198,255,58,0.5)",
            }}
          >
            Jetzt vergleichen
          </button>
        </section>

        <p className="pb-12 text-center text-xs font-medium text-[#5f675a]">
          Tags &amp; Werte sind Beispiel-Inhalte. Markenname offen (Platzhalter).
          Vorschau „Laut 4 · Neon Night“ — Design-Test, nicht final.
        </p>
      </div>
    </div>
  );
}
