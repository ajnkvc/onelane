/**
 * data-badge.tsx — Provenienz-Kennzeichnung für Schul-Daten (UWG-/§32-Pflicht):
 * recherchierte Preise/Angaben bleiben „ohne Gewähr", bis die Fahrschule sie
 * bestätigt hat. Erst dann grünes Abzeichen mit Häkchen — als HELLER Chip
 * (--success-soft/--success-ink, Helligkeitsstufe des Action-Teals; Gründer
 * 2026-07-02: „muss auffallen wie der Aktion-Button"). Semantische Tokens
 * bleiben markenunabhängig: „bestätigt" bleibt grün, egal wie sich die
 * Markenpalette entwickelt. Information NIE nur über Farbe — Text (+ Icon)
 * immer dabei. Server-tauglich, keine Interaktion.
 */

type DataBadgeProps = {
  status: "recherchiert" | "bestaetigt";
  /** ISO-Datum (z. B. "2026-07-01" oder voller Zeitstempel); wird als "Stand MM/JJJJ" angezeigt. */
  stand?: string | null;
};

/** ISO-Datum → " · Stand MM/JJJJ" (reine String-Zerlegung, kein Date.now/Zeitzonen-Risiko). */
function standSuffix(stand: string | null | undefined): string {
  if (!stand) return "";
  const match = /^(\d{4})-(\d{2})/.exec(stand);
  if (!match) return "";
  return ` · Stand ${match[2]}/${match[1]}`;
}

export function DataBadge({ status, stand }: DataBadgeProps) {
  const suffix = standSuffix(stand);

  if (status === "bestaetigt") {
    return (
      <span
        data-slot="data-badge"
        className="inline-flex w-fit items-center gap-1 rounded-full bg-[var(--success-soft)] px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-[var(--success-ink)]"
      >
        <svg
          className="size-3 shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
        von der Fahrschule bestätigt{suffix}
      </span>
    );
  }

  return (
    <span
      data-slot="data-badge"
      className="inline-flex w-fit items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium whitespace-nowrap text-secondary-foreground"
    >
      recherchiert · ohne Gewähr{suffix}
    </span>
  );
}
