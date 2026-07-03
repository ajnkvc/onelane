import type { TagesInsights } from "@/modules/insights";

/**
 * insights-panel.tsx — „dein Tag auf einen Blick" (OS-P2, KI-Insights V1).
 * ----------------------------------------------------------------------------
 * Rendert das Ergebnis von modules/insights: Tageszusammenfassung (vom AiPort
 * formuliert), nächste empfohlene Aktion und Risiko-Chips. Dezent als
 * „automatisch erstellt" gekennzeichnet (Transparenz). Reine Server-Komponente.
 */
export function InsightsPanel({ insights }: { insights: TagesInsights }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-elevation-1">
      <header className="flex items-baseline justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            dein Tag auf einen Blick
          </p>
        </div>
        <p className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
          automatisch erstellt
        </p>
      </header>

      <p className="mt-3 text-sm leading-relaxed">{insights.zusammenfassung}</p>

      {insights.naechsteAktion ? (
        <p className="mt-3 flex items-start gap-2 text-sm">
          <span
            aria-hidden="true"
            className="mt-1 inline-block size-2 shrink-0 rounded-full bg-accent"
          />
          <span>
            <span className="font-medium">Nächster Schritt:</span> {insights.naechsteAktion}
          </span>
        </p>
      ) : null}

      {insights.risiken.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {insights.risiken.map((chip) => (
            <li
              key={chip.text}
              className={`rounded-full border px-2.5 py-1 text-xs ${
                chip.ton === "warnung"
                  ? "border-warning/40 bg-warning/10 text-warning"
                  : "border-border bg-muted text-muted-foreground"
              }`}
            >
              {chip.text}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
