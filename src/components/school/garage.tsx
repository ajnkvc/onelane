import type { ProfileVehicle } from "@/modules/schools/profile";

/**
 * garage.tsx — Fahrzeuge als Snap-Slider (Muster aus dem Canvas-Prototyp).
 * ----------------------------------------------------------------------------
 * Horizontaler scroll-snap-Slider ohne JS; jede Kachel trägt eine stilisierte
 * SVG-Glyphe (Zweirad für A-Klassen, sonst Pkw — currentColor/Token, kein
 * Asset, kein Foto-Zwang) plus Specs als kantige Chips. Server-tauglich,
 * keine Inline-Styles.
 */

const GETRIEBE_LABEL: Record<string, string> = {
  automatik: "Automatik",
  schaltung: "Schaltung",
};

function FahrzeugGlyphe({ zweirad }: { zweirad: boolean }) {
  return (
    <svg viewBox="0 0 96 40" className="h-11 w-auto self-start" aria-hidden="true">
      {zweirad ? (
        <g className="stroke-primary" strokeWidth="2.5" fill="none" strokeLinecap="round">
          <circle cx="20" cy="30" r="8" />
          <circle cx="72" cy="30" r="8" />
          <path d="M20 30 38 14h14l8 10M50 14l6-6h8M38 14l8 16h18" />
        </g>
      ) : (
        <g className="stroke-primary" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 28h-4v-6l8-4 6-8h28l10 10h20a6 6 0 0 1 6 6v2h-6" />
          <circle cx="26" cy="30" r="6" />
          <circle cx="70" cy="30" r="6" />
          <path d="M32 30h32" />
        </g>
      )}
    </svg>
  );
}

export function GarageSlider({ vehicles }: { vehicles: ProfileVehicle[] }) {
  return (
    <ul
      className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2"
      tabIndex={0}
      aria-label="Fahrzeuge der Fahrschule"
    >
      {vehicles.map((v, i) => {
        const zweirad = (v.klasse ?? "").startsWith("A");
        return (
          <li key={`${v.marke}-${v.modell}-${i}`} className="w-60 shrink-0 snap-start">
            <article className="flex h-full flex-col rounded-md border border-border bg-background px-4 py-3">
              <FahrzeugGlyphe zweirad={zweirad} />
              <h3 className="mt-2 text-sm font-semibold tracking-tight">
                {[v.marke, v.modell].filter(Boolean).join(" ") || "Fahrzeug"}
              </h3>
              <p className="mt-2 flex flex-wrap gap-1">
                {v.klasse && (
                  <span className="rounded-[3px] border border-border px-1.5 py-0.5 font-mono text-[11px]">
                    Klasse {v.klasse}
                  </span>
                )}
                {v.getriebe && (
                  <span className="rounded-[3px] border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground">
                    {GETRIEBE_LABEL[v.getriebe] ?? v.getriebe}
                  </span>
                )}
                {v.besonderheiten.map((b) => (
                  <span key={b} className="rounded-[3px] border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground">
                    {b}
                  </span>
                ))}
              </p>
            </article>
          </li>
        );
      })}
    </ul>
  );
}
