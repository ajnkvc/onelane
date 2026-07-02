import {
  openingStatus,
  naechsteTheorie,
  wochenraster,
  wochentagVon,
  type ZeitenRow,
} from "@/lib/zeiten";

/**
 * zeiten-widget.tsx — Öffnungs-/Theoriezeiten als Live-Widget (ersetzt die
 * reinen Wochentags-Listen).
 * ----------------------------------------------------------------------------
 * Drei Ebenen aus strukturierten von/bis-Zeiten (src/lib/zeiten.ts, explizites
 * `now` → SSR-deterministisch pro Request):
 *  1. STATUS-PILL: „Jetzt geöffnet · bis 18:00" / „Schließt bald" / „Öffnet um …"
 *     — bg-accent + Pflicht-Dunkeltext NUR im geöffneten Zustand, sonst neutral
 *     secondary. Wird NUR gerendert, wenn Büro-Zeiten vorliegen (nie falsche
 *     „geschlossen"-Behauptung ohne Daten).
 *  2. „Nächste Theorie: heute 19:00–20:30" als Zeile mit Folgeterminen.
 *  3. Aufklappbares 7-Spalten-Wochenraster (details/summary, ohne JS bedienbar):
 *     Balken als SSR-SVG (Attribute statt Inline-Styles → Nonce-CSP-fest),
 *     Heute-Spalte hervorgehoben; zusätzlich eine sr-only-Tabelle für
 *     Screenreader (Information nie nur grafisch).
 */

const VOLLE_TAGE = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];

const ART_LABEL: Record<string, string> = {
  buero: "Büro",
  theorie: "Theorie",
  praxis: "Fahrpraxis",
};

/** Balkenfarbe je Art — Token-Klassen (SVG-fill), Theorie als Primärakzent. */
function blockKlasse(art: string): string {
  if (art === "theorie") return "fill-primary/80";
  if (art === "buero") return "fill-muted-foreground/25";
  return "fill-muted-foreground/45";
}

/* SVG-Geometrie (viewBox-Einheiten, nicht px — skaliert responsiv). */
const SVG_W = 720;
const SVG_H = 236;
const ACHSE_W = 40;
const PAD_TOP = 26;
const PAD_BOTTOM = 8;
const SPALTE_W = (SVG_W - ACHSE_W) / 7;
const PLOT_H = SVG_H - PAD_TOP - PAD_BOTTOM;

export function ZeitenWidget({ hours, now }: { hours: ZeitenRow[]; now: Date }) {
  const status = openingStatus(hours, now);
  const theorie = naechsteTheorie(hours, now, 3);
  const raster = wochenraster(hours);
  const heute = wochentagVon(now);

  // Anzeigefenster: auf volle Stunden gerundet um die tatsächlichen Blöcke,
  // Standard 08:00–20:00, damit leere Ränder nicht dominieren.
  const alle = raster.flatMap((t) => t.bloecke);
  const minStart = Math.min(8 * 60, ...alle.map((b) => b.startMin));
  const maxEnd = Math.max(20 * 60, ...alle.map((b) => b.endMin));
  const von = Math.floor(minStart / 60) * 60;
  const bis = Math.ceil(maxEnd / 60) * 60;
  const y = (min: number) => PAD_TOP + ((min - von) / (bis - von)) * PLOT_H;

  // Stunden-Hilfslinien in gleichmäßigen Schritten (max. ~6 Linien).
  const schrittStunden = Math.max(2, Math.ceil((bis - von) / 60 / 6));
  const linien: number[] = [];
  for (let m = von; m <= bis; m += schrittStunden * 60) linien.push(m);

  const hatBloecke = alle.length > 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Ebene 1+2: Status-Pill + nächste Theorie */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {status && (
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${
              status.status === "geoeffnet"
                ? "bg-accent text-accent-foreground"
                : "bg-secondary text-secondary-foreground"
            }`}
          >
            <span
              aria-hidden="true"
              className={`size-1.5 rounded-full ${
                status.status === "geoeffnet" || status.status === "schliesst_bald"
                  ? "bg-accent-foreground/70"
                  : "bg-muted-foreground/60"
              }`}
            />
            {status.label}
          </span>
        )}
        {theorie.length > 0 && (
          <p className="text-sm">
            <span className="font-medium">Nächste Theorie:</span>{" "}
            <span className="font-mono tabular-nums">
              {theorie[0].tagLabel} {theorie[0].von}
            </span>
            {theorie.length > 1 && (
              <span className="text-muted-foreground">
                {" "}
                · dann {theorie
                  .slice(1)
                  .map((t) => `${t.tagLabel} ${t.von}`)
                  .join(" · ")}
              </span>
            )}
          </p>
        )}
      </div>

      {/* Ebene 3: aufklappbares Wochenraster (ohne JS bedienbar) */}
      {hatBloecke && (
        <details className="group rounded-md border border-border bg-background">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-2.5 text-sm font-medium marker:content-none [&::-webkit-details-marker]:hidden">
            Wochenraster ansehen
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="size-4 shrink-0 text-muted-foreground motion-safe:transition-transform motion-safe:duration-[var(--motion-duration-fast)] motion-safe:ease-[var(--motion-ease)] group-open:rotate-180"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </summary>

          <div className="border-t border-border px-3 pb-3 pt-2">
            {/* Balken-Visualisierung: reine SVG-Attribute (CSP-fest), heute markiert */}
            <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="h-auto w-full" aria-hidden="true">
              {/* Heute-Spalte dezent hinterlegen */}
              <rect
                x={ACHSE_W + heute * SPALTE_W}
                y={PAD_TOP - 4}
                width={SPALTE_W}
                height={PLOT_H + 8}
                rx="4"
                className="fill-primary/5"
              />
              {/* Stunden-Hilfslinien + Achsen-Labels */}
              {linien.map((m) => (
                <g key={m}>
                  <line
                    x1={ACHSE_W}
                    x2={SVG_W - 4}
                    y1={y(m)}
                    y2={y(m)}
                    className="stroke-border"
                    strokeWidth="1"
                  />
                  <text
                    x={ACHSE_W - 6}
                    y={y(m) + 3}
                    textAnchor="end"
                    className="fill-muted-foreground font-mono text-[10px] tabular-nums"
                  >
                    {String(m / 60).padStart(2, "0")}h
                  </text>
                </g>
              ))}
              {/* Tages-Spalten */}
              {raster.map((tag) => {
                const x0 = ACHSE_W + tag.wochentag * SPALTE_W;
                return (
                  <g key={tag.wochentag}>
                    <text
                      x={x0 + SPALTE_W / 2}
                      y={14}
                      textAnchor="middle"
                      className={`font-mono text-[11px] uppercase ${
                        tag.wochentag === heute
                          ? "fill-primary font-semibold"
                          : "fill-muted-foreground"
                      }`}
                    >
                      {tag.label}
                    </text>
                    {tag.bloecke.map((b, i) => (
                      <rect
                        key={i}
                        x={x0 + 7}
                        width={SPALTE_W - 14}
                        y={y(b.startMin)}
                        height={Math.max(5, y(b.endMin) - y(b.startMin))}
                        rx="2.5"
                        className={blockKlasse(b.art)}
                      />
                    ))}
                  </g>
                );
              })}
            </svg>

            {/* Legende */}
            <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className="size-2.5 rounded-[2px] bg-primary/80" />
                Theorie
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className="size-2.5 rounded-[2px] bg-muted-foreground/25" />
                Büro
              </span>
              <span className="ms-auto">heute: {VOLLE_TAGE[heute]}</span>
            </p>

            {/* Screenreader-Tabelle: gleiche Information, nicht nur grafisch */}
            <table className="sr-only">
              <caption>Öffnungs- und Theoriezeiten je Wochentag</caption>
              <thead>
                <tr>
                  <th scope="col">Tag</th>
                  <th scope="col">Zeiten</th>
                </tr>
              </thead>
              <tbody>
                {raster.map((tag) => (
                  <tr key={tag.wochentag}>
                    <th scope="row">{VOLLE_TAGE[tag.wochentag]}</th>
                    <td>
                      {tag.bloecke.length === 0
                        ? "keine Angabe"
                        : tag.bloecke
                            .map((b) => `${ART_LABEL[b.art] ?? b.art} ${b.von}–${b.bis}`)
                            .join(", ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}
