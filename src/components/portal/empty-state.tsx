import Link from "next/link";

/**
 * empty-state.tsx — Premium-Empty-State-System des App-Portals (OS-P2).
 * ----------------------------------------------------------------------------
 * KONTRAKT (P3 nutzt exakt diese API):
 *   <EmptyState szene="strecke|posteingang|werkstatt" titel="…"
 *               beschreibung="EIN Satz." aktion={{ href, label }} kompakt />
 *
 * - Illustrations-Slot: drei generische Szenen im Stil der Ratgeber-Cover
 *   (Inline-SVG, lane-Motiv = gestrichelte Fahrbahn-Mittellinie, Petrol-Palette
 *   NUR über Token-Utilities, aria-hidden, 16:10, slice).
 * - `kompakt` für Karten-Slots im Dashboard (kleinere Illustration/Typo);
 *   Standard für ganze Platzhalter-Seiten.
 * - Ton: ehrlich und nutzerseitig („in Vorbereitung"), NIE interne Codenamen.
 */

export type EmptySzene = "strecke" | "posteingang" | "werkstatt";

/** Marken-Signatur (identisch zum Ratgeber-Cover): Fahrbahn + Mittellinie. */
function Lane({ d, band = 52 }: { d: string; band?: number }) {
  return (
    <g>
      <path d={d} className="stroke-brand-sky/15" strokeWidth={band} strokeLinecap="round" />
      <path
        d={d}
        className="stroke-brand-sky/50"
        strokeWidth={3}
        strokeDasharray="14 20"
        strokeLinecap="round"
      />
    </g>
  );
}

/** Strecke — die Spur führt in den freien Raum: „hier entsteht dein Weg". */
function SzeneStrecke() {
  return (
    <g>
      <rect width="480" height="300" className="fill-secondary" />
      <circle cx="360" cy="80" r="95" className="fill-brand-sky/10" />
      <Lane d="M-20 265 C 120 235, 220 265, 300 190 S 420 90, 500 70" />
      <circle cx="52" cy="252" r="8" className="fill-none stroke-brand-sky/60" strokeWidth="3" />
      <path d="M418 96 L 452 76 L 442 112 Z" className="fill-accent" />
    </g>
  );
}

/** Posteingang — leere, ruhige Ablage: „noch nichts eingegangen". */
function SzenePosteingang() {
  return (
    <g>
      <rect width="480" height="300" className="fill-secondary" />
      <circle cx="120" cy="82" r="80" className="fill-brand-cyan/10" />
      <Lane d="M-20 272 C 140 246, 320 288, 500 252" band={40} />
      <path
        d="M120 96 h240 v110 a14 14 0 0 1 -14 14 h-212 a14 14 0 0 1 -14 -14 z"
        className="fill-card stroke-border"
        strokeWidth="2.5"
      />
      <path
        d="M120 150 h72 l14 20 h68 l14 -20 h72"
        className="stroke-brand-sky/50 fill-none"
        strokeWidth="2.5"
      />
      <circle cx="352" cy="88" r="9" className="fill-accent" />
    </g>
  );
}

/** Werkstatt — Bausteine neben der Spur: „hier wird noch gebaut". */
function SzeneWerkstatt() {
  return (
    <g>
      <rect width="480" height="300" className="fill-secondary" />
      <circle cx="372" cy="92" r="86" className="fill-brand-sky/10" />
      <Lane d="M-20 268 C 150 240, 330 286, 500 246" band={44} />
      <rect x="96" y="150" width="58" height="58" rx="10" className="fill-brand-sky/55" />
      <rect x="166" y="122" width="58" height="86" rx="10" className="fill-primary" />
      <rect x="236" y="166" width="58" height="42" rx="10" className="fill-accent" />
      <rect
        x="306"
        y="138"
        width="58"
        height="70"
        rx="10"
        className="fill-card stroke-brand-sky/50"
        strokeWidth="2.5"
        strokeDasharray="7 7"
      />
    </g>
  );
}

const SZENEN: Record<EmptySzene, () => React.JSX.Element> = {
  strecke: SzeneStrecke,
  posteingang: SzenePosteingang,
  werkstatt: SzeneWerkstatt,
};

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export function EmptyState({
  szene = "strecke",
  titel,
  beschreibung,
  aktion,
  kompakt = false,
  className = "",
}: {
  szene?: EmptySzene;
  titel: string;
  /** Genau EIN ehrlicher Satz. */
  beschreibung: string;
  aktion?: { href: string; label: string };
  /** Karten-Variante (Dashboard-Slot) statt Seiten-Variante. */
  kompakt?: boolean;
  className?: string;
}) {
  const Szene = SZENEN[szene];
  return (
    <div
      className={`flex flex-col items-center text-center ${
        kompakt ? "gap-3 py-2" : "gap-5 py-6"
      } ${className}`}
    >
      <div
        className={`overflow-hidden rounded-2xl border border-border shadow-elevation-1 ${
          kompakt ? "w-44" : "w-full max-w-sm"
        }`}
      >
        <svg
          viewBox="0 0 480 300"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
          focusable="false"
          fill="none"
          className="block h-auto w-full"
        >
          <Szene />
        </svg>
      </div>
      <div className="max-w-sm">
        <h3 className={`font-semibold tracking-tight ${kompakt ? "text-sm" : "text-lg"}`}>
          {titel}
        </h3>
        <p className={`mt-1 text-muted-foreground ${kompakt ? "text-xs" : "text-sm"}`}>
          {beschreibung}
        </p>
      </div>
      {aktion ? (
        <Link
          href={aktion.href}
          className={`inline-flex min-h-9 items-center rounded-full border border-border bg-card px-4 text-sm font-medium text-foreground shadow-elevation-1 motion-safe:transition-colors motion-safe:duration-[var(--motion-duration-fast)] hover:border-brand-sky/60 ${focusRing}`}
        >
          {aktion.label}
        </Link>
      ) : null}
    </div>
  );
}
