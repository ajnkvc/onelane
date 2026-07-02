import Link from "next/link";

/**
 * TrustEmblem — „Kennzeichen-Plakette": das Marken-Objekt von „onelane trust".
 * ----------------------------------------------------------------------------
 * Querformatige Plakette (~4,2:1, rounded-md — bewusst nicht voll rund):
 * links ein vertikales Primary-Band (feiner vertikaler Verlauf) mit dem
 * onelane-Punkt (Lime, 1px heller Ring), im Hauptfeld die kennzeichenhafte
 * Setzung „onelane trust" („trust" als gesperrte Kapitälchen in Primary),
 * darunter eine feine gestrichelte Fahrbahn-Mittellinie, die an beiden Enden
 * weich ausläuft (CSS-Mask, CSP-konform ohne Inline-Styles). Doppelrahmen-Look
 * echter Kennzeichen: äußerer 1px-Rahmen + innere Hairline mit 2px Abstand,
 * dazu ein hauchfeiner Licht-Verlauf oben auf der Platte (kein Glanz-Kitsch).
 * Präzise Abstände, gesperrte Typo — „Schweizer Grafikdesign trifft
 * Nummernschild".
 *
 * VERLINKUNG: Standardmäßig verlinkt die PLAKETTE (nicht der Claim) auf die
 * Erklärseite /trust (sichtbarer Fokus-Ring, aria-label). `href={null}`
 * rendert sie ohne Link — z. B. auf /trust selbst (kein Selbst-Link).
 *
 * MOTION: standardmäßig STATISCH. Einziger Effekt: beim ersten Einscrollen
 * (Reveal-Insel setzt html.reveal-on + .in am Vorfahren) wandern die Striche
 * der Mittellinie EINMAL kurz ein (~600 ms, stroke-dashoffset → 0) und stehen
 * dann — wie ein Wagen, der einparkt. Kein Loop, kein Puls. Ohne JS und bei
 * prefers-reduced-motion (Reveal-Insel setzt dann kein reveal-on): statisch.
 *
 * RECHTSLEITPLANKE: Dies ist ein MARKEN-Versprechen („wir bleiben an deiner
 * Seite"), KEIN Gütesiegel und keine Amts-Imitation. Deshalb bewusst KEINE
 * EU-Sterne/Flaggen/Stadt-Kürzel/Stempel-Plaketten, keine Sterne/Häkchen/
 * Lorbeeren/Schild-Formen und keine Begriffe wie „geprüft/zertifiziert/
 * Siegel" — weder hier noch an den Einsatzstellen ergänzen.
 */
const SIZES = {
  /** ~32 px hoch — inline/kompakt (z. B. Abschluss-Suchmodul). */
  sm: {
    box: "h-8 w-36",
    band: "w-6",
    dot: "size-1.5",
    word: "text-xs",
    line: "mt-1",
    pad: "px-2",
  },
  /** ~60 px hoch — Sektionsköpfe (trust-Block, Betreuung). */
  md: {
    box: "h-[3.75rem] w-[15.75rem]",
    band: "w-11",
    dot: "size-2.5",
    word: "text-xl",
    line: "mt-1.5",
    pad: "px-4",
  },
} as const;

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export function TrustEmblem({
  size = "md",
  tone = "card",
  claim = false,
  href = "/trust",
  className = "",
}: {
  size?: "sm" | "md";
  /** Plaketten-Fläche: `card` auf getönten Flächen, `background` auf Karten. */
  tone?: "card" | "background";
  /** Zeigt unter der Plakette den Claim + „unser Versprechen an dich". */
  claim?: boolean;
  /** Linkziel der Plakette (Default: /trust). `null` = ohne Link. */
  href?: string | null;
  className?: string;
}) {
  const s = SIZES[size];
  const surface = tone === "background" ? "bg-background" : "bg-card";
  const plate = (
      <span
        className={`relative inline-flex overflow-hidden rounded-md border border-border shadow-elevation-1 ${surface} ${s.box}`}
      >
        {/* Vertikales Marken-Band: feiner Verlauf + onelane-Punkt mit hellem Ring */}
        <span
          aria-hidden="true"
          className={`flex h-full items-center justify-center bg-[linear-gradient(180deg,var(--primary),color-mix(in_oklab,var(--primary),black_16%))] ${s.band}`}
        >
          <span className={`rounded-full bg-accent ring-1 ring-background/60 ${s.dot}`} />
        </span>
        {/* Hauptfeld: Wortmarke + Fahrbahn-Mittellinie (Enden laufen weich aus) */}
        <span className={`flex min-w-0 flex-1 flex-col items-center justify-center ${s.pad}`}>
          <span className={`flex items-baseline gap-[0.5em] leading-none ${s.word}`}>
            <span className="font-semibold tracking-tight text-foreground">onelane</span>
            <span className="text-[0.7em] font-semibold uppercase tracking-[0.35em] text-primary">
              trust
            </span>
          </span>
          <svg
            aria-hidden="true"
            focusable="false"
            className={`h-[2px] w-full [mask-image:linear-gradient(90deg,transparent,black_18%,black_82%,transparent)] ${s.line}`}
          >
            <line
              x1="0"
              y1="1"
              x2="100%"
              y2="1"
              strokeWidth="1.5"
              className="stroke-muted-foreground/40 [stroke-dasharray:6_5] [html.reveal-on_&]:[stroke-dashoffset:22] [html.reveal-on_.in_&]:[stroke-dashoffset:0] motion-safe:transition-[stroke-dashoffset] motion-safe:duration-[600ms] motion-safe:ease-[var(--motion-ease)]"
            />
          </svg>
        </span>
        {/* Doppelrahmen echter Kennzeichen: innere Hairline mit 2px Abstand */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-[2px] rounded-[4px] border border-border/70"
        />
        {/* Hauchfeiner Licht-Verlauf oben auf der Platte */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,color-mix(in_oklab,white_4%,transparent),transparent_45%)]"
        />
      </span>
  );
  return (
    <div className={`flex flex-col items-center ${className}`}>
      {href ? (
        <Link
          href={href}
          aria-label="Mehr über onelane trust"
          className={`inline-flex rounded-md transition-transform duration-[var(--motion-duration-fast)] ease-[var(--motion-ease)] motion-safe:hover:scale-[1.02] ${focusRing}`}
        >
          {plate}
        </Link>
      ) : (
        plate
      )}
      {claim ? (
        <div className="mt-5 text-center">
          <p className="text-lg font-medium tracking-tight">Wir bleiben an deiner Seite.</p>
          <p className="mt-1 text-sm text-muted-foreground">unser Versprechen an dich</p>
        </div>
      ) : null}
    </div>
  );
}
