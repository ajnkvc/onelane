import type { Metadata } from "next";

/**
 * /vorschau/farben — Paletten-Entscheidungsseite (Wegwerf-Prototyp).
 * Drei Markenrichtungen nebeneinander an identischen UI-Proben (Buttons, Badges,
 * trust-Plakette, Tint-Zone, Gold-Rating, Preis-Duo), damit die Farbwahl an
 * ECHTEN Bausteinen fällt statt an abstrakten Swatches. Prototyp-Konvention:
 * Roh-Hex hier bewusst erlaubt (Wegwerf-Code); die Umsetzung erfolgt danach
 * ausschließlich als tokens.css-Wertetausch (Ein-Punkt-CI).
 */
export const metadata: Metadata = {
  title: "Vorschau — Farbrichtungen",
  robots: { index: false, follow: false },
};

type Palette = {
  key: string;
  name: string;
  claim: string;
  bg: string;
  surface: string;
  ink: string;
  muted: string;
  primary: string;
  primarySoft: string;
  tint: string;
  effekt: string;
  bestaetigt: string;
  bestaetigtText: string;
  rating: string;
  hinweis: string;
};

const PALETTEN: Palette[] = [
  {
    key: "sky",
    name: "A · Status quo — Sky",
    claim: "vertraut, kühl, sachlich",
    bg: "#ffffff",
    surface: "#ffffff",
    ink: "#0f2942",
    muted: "#5b6b7b",
    primary: "#0369a1",
    primarySoft: "#e0f2fe",
    tint: "#f0f7fc",
    effekt: "#22d3ee",
    bestaetigt: "#a3e635",
    bestaetigtText: "#1a2e05",
    rating: "#f59e0b",
    hinweis: "Reinweiße Basis („zu weiß“-Feedback), Blau-Familie nah an CHECK24-Konvention.",
  },
  {
    key: "indigo",
    name: "B · Indigo-Violett (Empfehlung)",
    claim: "jung, digital-souverän, unbesetzt im Markt",
    bg: "#faf9f7",
    surface: "#ffffff",
    ink: "#211f33",
    muted: "#5e5b73",
    primary: "#4338ca",
    primarySoft: "#e7e5ff",
    tint: "#f1efff",
    effekt: "#8b5cf6",
    bestaetigt: "#15803d",
    bestaetigtText: "#ffffff",
    rating: "#f59e0b",
    hinweis: "Warmes Papier-Off-White als Basis; Indigo differenziert von Portal-Blau UND Fahrschul-Grün.",
  },
  {
    key: "petrol",
    name: "C · Petrol-Tiefsee",
    claim: "ruhig-premium, sicher, erwachsen",
    bg: "#f8faf9",
    surface: "#ffffff",
    ink: "#0c2b2b",
    muted: "#4e6363",
    primary: "#0f766e",
    primarySoft: "#d9f2ef",
    tint: "#ecf5f3",
    effekt: "#14b8a6",
    bestaetigt: "#15803d",
    bestaetigtText: "#ffffff",
    rating: "#f59e0b",
    hinweis: "Sicherheits-Assoziation ohne Grün-Marke; wärmer als Sky, weniger jugendlich als Indigo.",
  },
];

function Probe({ p }: { p: Palette }) {
  return (
    <section
      aria-label={p.name}
      className="flex flex-col gap-4 rounded-md border p-5"
      style={{ background: p.bg, borderColor: `${p.ink}22` }}
    >
      <header>
        <h2 className="text-lg font-semibold" style={{ color: p.ink }}>{p.name}</h2>
        <p className="text-sm" style={{ color: p.muted }}>{p.claim}</p>
      </header>

      {/* Header-Probe */}
      <div className="flex items-center justify-between rounded-md border px-3 py-2"
        style={{ background: p.surface, borderColor: `${p.ink}1a` }}>
        <span className="text-xl font-bold tracking-tight" style={{ color: p.ink }}>
          one<span style={{ color: p.primary }}>lane</span><span style={{ color: p.effekt }}>.</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="rounded-full border px-3 py-1.5 text-xs font-medium"
            style={{ borderColor: `${p.primary}66`, color: p.primary }}>Jobbörse</span>
          <span className="rounded-full px-3 py-1.5 text-xs font-semibold"
            style={{ background: p.primary, color: "#fff" }}>Kostenfrei anfragen</span>
        </span>
      </div>

      {/* trust-Plakette */}
      <div className="flex items-center gap-3 rounded-md border px-3 py-2"
        style={{ background: p.surface, borderColor: `${p.ink}1a` }}>
        <span className="flex h-9 w-40 items-stretch overflow-hidden rounded-[5px] border"
          style={{ borderColor: `${p.ink}33`, background: p.surface }}>
          <span className="flex w-[18%] items-center justify-center" style={{ background: p.primary }}>
            <span className="size-2 rounded-full" style={{ background: p.rating }} />
          </span>
          <span className="flex flex-1 flex-col items-center justify-center leading-none">
            <span className="text-[13px] font-semibold" style={{ color: p.ink }}>
              onelane <span style={{ color: p.primary, letterSpacing: "0.3em" }}>TRUST</span>
            </span>
            <span className="mt-1 h-px w-3/4 border-t border-dashed" style={{ borderColor: `${p.ink}44` }} />
          </span>
        </span>
        <span className="text-sm font-medium" style={{ color: p.ink }}>Wir bleiben an deiner Seite.</span>
      </div>

      {/* Tint-Zone + Preis-Duo + Badges */}
      <div className="rounded-md p-4" style={{ background: p.tint }}>
        <p className="text-sm font-semibold" style={{ color: p.ink }}>Fahrschule Isarpilot</p>
        <p className="text-xs" style={{ color: p.muted }}>
          Bogenhausen · <span style={{ color: p.rating }}>★</span>
          <span className="font-semibold" style={{ color: p.ink }}> 4,9</span>
          <span style={{ color: p.muted }}> · Google, 389 Bew.</span>
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm" style={{ color: p.ink }}>
          <span>Grundbetrag</span><span className="text-right font-semibold tabular-nums">520,00 €</span>
          <span>Fahrstunde (45 Min.)</span><span className="text-right font-semibold tabular-nums">75,00 €</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-full px-2.5 py-1 text-[11px] font-medium"
            style={{ background: p.bestaetigt, color: p.bestaetigtText }}>✓ von der Fahrschule bestätigt</span>
          <span className="rounded-full px-2.5 py-1 text-[11px] font-medium"
            style={{ background: `${p.ink}14`, color: p.ink }}>recherchiert · ohne Gewähr</span>
          <span className="rounded-full px-2.5 py-1 text-[11px] font-medium"
            style={{ background: p.primarySoft, color: p.primary }}>Bestehensquote · amtlich ab 2027</span>
        </div>
        <button type="button" className="mt-4 w-full rounded-full py-2.5 text-sm font-semibold"
          style={{ background: p.primary, color: "#fff" }}>
          Kostenfrei anfragen
        </button>
      </div>

      {/* Dark-Band-Probe (motel-one-Impuls) */}
      <div className="rounded-md px-4 py-5 text-center" style={{ background: p.ink }}>
        <p className="text-base font-light" style={{ color: "#ffffffd9" }}>
          Finde die <span className="font-semibold" style={{ color: p.effekt }}>passende</span> Fahrschule deiner Stadt.
        </p>
      </div>

      <p className="text-xs leading-relaxed" style={{ color: p.muted }}>{p.hinweis}</p>
    </section>
  );
}

export default function FarbenVorschau() {
  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-10">
      <h1 className="text-3xl font-light tracking-tight">
        Farbrichtungen — <span className="font-semibold">an echten Bausteinen</span>
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Drei Richtungen, identische UI-Proben. Gold (Bewertung) und Grün (bestätigt) bleiben in
        jeder Richtung semantisch gleich. Umsetzung nach Wahl als reiner tokens.css-Wertetausch.
      </p>
      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        {PALETTEN.map((p) => <Probe key={p.key} p={p} />)}
      </div>
    </div>
  );
}
