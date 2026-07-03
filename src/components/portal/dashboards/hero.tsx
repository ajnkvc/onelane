/**
 * hero.tsx — Begrüßungs-Hero der Dashboards (OS-P2).
 * ----------------------------------------------------------------------------
 * KONTRAKT: <DashboardHero kicker titel satz?> — mono-Kicker (Editorial-Muster),
 * persönlicher Titel, darunter EIN Kennzahlen-Satz aus ECHTEN Daten (vom
 * jeweiligen Dashboard deterministisch gebaut; die KI-Zusammenfassung wohnt
 * getrennt im Insights-Panel und ist als „automatisch erstellt" gekennzeichnet).
 */
export function DashboardHero({
  kicker,
  titel,
  satz,
}: {
  kicker: string;
  titel: string;
  /** EIN Satz aus echten Zahlen; null/undefined → Zeile entfällt. */
  satz?: string | null;
}) {
  return (
    <header className="max-w-2xl">
      <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
        {kicker}
      </p>
      <h1 className="mt-2 text-2xl font-light tracking-tight sm:text-3xl">
        {titel}
        <span className="font-semibold text-brand-sky">.</span>
      </h1>
      {satz ? <p className="mt-2 text-sm text-muted-foreground">{satz}</p> : null}
    </header>
  );
}

/** Hilfsformate der Dashboards (deterministisch, testfrei trivial). */
export const TYP_LABEL: Record<string, string> = {
  fahrstunde: "Fahrstunde",
  theorie: "Theorie",
  fragenkatalog: "Lernstand",
  pruefung: "Prüfung",
};

export const TERMIN_STATUS_LABEL: Record<string, string> = {
  booked: "geplant",
  completed: "absolviert",
  cancelled: "abgesagt",
};

/** „vor 3 Std." / „vor 2 Tagen" aus Stunden-Alter. */
export function alterLabel(stunden: number): string {
  if (stunden < 1) return "gerade eben";
  if (stunden < 24) return `vor ${stunden} Std.`;
  const tage = Math.floor(stunden / 24);
  return tage === 1 ? "vor 1 Tag" : `vor ${tage} Tagen`;
}
