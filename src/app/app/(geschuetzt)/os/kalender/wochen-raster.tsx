import {
  minutenVon,
  rasterFenster,
  spaltenLayout,
  type KalenderSlot,
  type KalenderTermin,
} from "@/modules/portal/os-betrieb";
import { TYP_LABEL } from "@/components/portal/dashboards/hero";

/**
 * wochen-raster.tsx — READ-ONLY Wochenraster des OS-Kalenders (OS-P3 Paket B).
 * ----------------------------------------------------------------------------
 * Server-Komponente ohne Interaktivität: 7 Tagesspalten (Mo–So, Europe/Berlin-
 * Daten kommen fertig aus modules/portal/os-betrieb), Zeitachse mit Stunden-
 * Hairlines, Termine als Blöcke (Typ-Farben NUR über Token-Utilities),
 * Verfügbarkeits-Slots als HINTERGRUND-Bänder (nur bei EINEM ausgewählten
 * Fahrlehrer — im „alle"-Blick wären überlagerte Bänder irreführend).
 * Überlappende Termine teilen sich die Spalte per Spur-Layout (spaltenLayout).
 */

const TAGE_KURZ = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"] as const;

/** Termin-Typ → Token-Klassen (Information nie NUR über Farbe: Label steht dabei). */
const TYP_STIL: Record<KalenderTermin["typ"], string> = {
  fahrstunde: "border-brand-sky/70 bg-brand-sky/15",
  theorie: "border-primary/60 bg-primary/10",
  pruefung: "border-accent bg-accent/20",
  fragenkatalog: "border-brand-cyan/70 bg-brand-cyan/15",
};

const PX_PRO_STUNDE = 44;

function prozent(min: number, fenster: { startMin: number; endMin: number }): number {
  const span = fenster.endMin - fenster.startMin;
  return Math.max(0, Math.min(100, ((min - fenster.startMin) / span) * 100));
}

export function WochenRaster({
  tage,
  heute,
  termine,
  slots,
  zeigeSlots,
  fahrlehrerName,
}: {
  /** 7 ISO-Daten Mo–So. */
  tage: string[];
  /** „heute" (ISO, Berlin) für die Spalten-Hervorhebung. */
  heute: string;
  termine: KalenderTermin[];
  slots: KalenderSlot[];
  /** Bänder nur bei Einzel-Fahrlehrer-Auswahl. */
  zeigeSlots: boolean;
  /** id → Name (für Termin-Labels im „alle"-Blick). */
  fahrlehrerName: Map<string, string>;
}) {
  const fenster = rasterFenster([
    ...termine.map((t) => ({ von: t.von, bis: t.bis })),
    ...(zeigeSlots ? slots.map((s) => ({ von: s.von, bis: s.bis })) : []),
  ]);
  const hoehePx = ((fenster.endMin - fenster.startMin) / 60) * PX_PRO_STUNDE;
  const stunden: number[] = [];
  for (let m = fenster.startMin; m <= fenster.endMin; m += 60) stunden.push(m);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[880px]">
        {/* Kopfzeile: Tage */}
        <div className="grid" style={{ gridTemplateColumns: "3.25rem repeat(7, 1fr)" }}>
          <div aria-hidden="true" />
          {tage.map((iso, i) => (
            <div
              key={iso}
              className={`border-b border-border px-2 pb-2 text-center ${
                iso === heute ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <p className="font-mono text-[10px] uppercase tracking-[0.22em]">{TAGE_KURZ[i]}</p>
              <p
                className={`text-sm tabular-nums ${
                  iso === heute ? "font-semibold" : "font-medium text-foreground"
                }`}
              >
                {iso.slice(8, 10)}.{iso.slice(5, 7)}.{iso === heute ? " · heute" : ""}
              </p>
            </div>
          ))}
        </div>

        {/* Raster-Körper */}
        <div className="grid" style={{ gridTemplateColumns: "3.25rem repeat(7, 1fr)" }}>
          {/* Zeitachse */}
          <div className="relative" style={{ height: `${hoehePx}px` }} aria-hidden="true">
            {stunden.map((m) => (
              <span
                key={m}
                className="absolute right-2 -translate-y-1/2 font-mono text-[10px] text-muted-foreground tabular-nums"
                style={{ top: `${prozent(m, fenster)}%` }}
              >
                {String(Math.floor(m / 60)).padStart(2, "0")}:00
              </span>
            ))}
          </div>

          {tage.map((iso, tagIndex) => {
            const tagesTermine = termine.filter((t) => t.tag_index === tagIndex);
            const plaetze = spaltenLayout(
              tagesTermine.map((t) => ({
                vonMin: minutenVon(t.von) ?? fenster.startMin,
                bisMin: Math.max(
                  (minutenVon(t.von) ?? fenster.startMin) + 30,
                  minutenVon(t.bis) ?? (minutenVon(t.von) ?? fenster.startMin) + 45,
                ),
              })),
            );
            const tagesSlots = zeigeSlots ? slots.filter((s) => s.tag_index === tagIndex) : [];

            return (
              <div
                key={iso}
                className={`relative border-l border-border ${
                  iso === heute ? "bg-brand-sky/[0.04]" : ""
                }`}
                style={{ height: `${hoehePx}px` }}
              >
                {/* Stunden-Hairlines */}
                {stunden.map((m) => (
                  <span
                    key={m}
                    aria-hidden="true"
                    className="absolute inset-x-0 border-t border-border/60"
                    style={{ top: `${prozent(m, fenster)}%` }}
                  />
                ))}

                {/* Verfügbarkeits-Bänder (Hintergrund) */}
                {tagesSlots.map((s, i) => {
                  const von = minutenVon(s.von);
                  const bis = minutenVon(s.bis);
                  if (von === null || bis === null || bis <= von) return null;
                  return (
                    <div
                      key={`slot-${i}`}
                      title={`${s.ist_blockiert ? "Blockiert" : "Verfügbar"} ${s.von}–${s.bis}`}
                      className={`absolute inset-x-0.5 rounded-md ${
                        s.ist_blockiert
                          ? "bg-muted/70 [background-image:repeating-linear-gradient(135deg,transparent,transparent_5px,var(--border)_5px,var(--border)_6px)]"
                          : "bg-success/10"
                      }`}
                      style={{
                        top: `${prozent(von, fenster)}%`,
                        height: `${prozent(bis, fenster) - prozent(von, fenster)}%`,
                      }}
                    />
                  );
                })}

                {/* Termine */}
                {tagesTermine.map((t, i) => {
                  const von = minutenVon(t.von) ?? fenster.startMin;
                  const bis = Math.max(von + 30, minutenVon(t.bis) ?? von + 45);
                  const platz = plaetze[i];
                  const breite = 100 / platz.spuren;
                  const name = t.instructor_id
                    ? (fahrlehrerName.get(t.instructor_id) ?? null)
                    : null;
                  return (
                    <div
                      key={t.id}
                      className={`absolute overflow-hidden rounded-lg border-l-[3px] px-1.5 py-1 text-[11px] leading-tight shadow-elevation-1 ${TYP_STIL[t.typ]} ${
                        t.status === "completed" ? "opacity-55" : ""
                      }`}
                      style={{
                        top: `${prozent(von, fenster)}%`,
                        height: `${Math.max(2.5, prozent(bis, fenster) - prozent(von, fenster))}%`,
                        left: `calc(${platz.spur * breite}% + 2px)`,
                        width: `calc(${breite}% - 4px)`,
                      }}
                      title={`${t.von}–${t.bis ?? "…"} · ${TYP_LABEL[t.typ] ?? t.typ}${
                        t.klasse ? ` (Klasse ${t.klasse})` : ""
                      }${t.schueler_name ? ` · ${t.schueler_name}` : ""}${
                        name ? ` · ${name}` : t.instructor_id ? "" : " · ganze Schule"
                      }`}
                    >
                      <p className="font-semibold tabular-nums">
                        {t.von}
                        {t.bis ? `–${t.bis}` : ""}
                      </p>
                      <p className="truncate">
                        {TYP_LABEL[t.typ] ?? t.typ}
                        {t.klasse ? ` · ${t.klasse}` : ""}
                      </p>
                      {/* Schüler-Name (Welle 2, Definer-Pfad 0031) — null ohne aktives Enrollment. */}
                      {t.schueler_name ? <p className="truncate">{t.schueler_name}</p> : null}
                      {name ? <p className="truncate text-muted-foreground">{name}</p> : null}
                      {t.status === "completed" ? (
                        <p className="truncate text-muted-foreground">absolviert</p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Legende der Typ-Farben + Bänder — Information nie nur über Farbe. */
export function RasterLegende({ zeigeSlots }: { zeigeSlots: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
      {(Object.keys(TYP_STIL) as Array<keyof typeof TYP_STIL>).map((typ) => (
        <span key={typ} className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className={`h-3 w-3 rounded border-l-[3px] ${TYP_STIL[typ]}`} />
          {TYP_LABEL[typ] ?? typ}
        </span>
      ))}
      {zeigeSlots ? (
        <>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="h-3 w-3 rounded bg-success/20" />
            verfügbar
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="h-3 w-3 rounded bg-muted [background-image:repeating-linear-gradient(135deg,transparent,transparent_3px,var(--border)_3px,var(--border)_4px)]"
            />
            blockiert
          </span>
        </>
      ) : null}
    </div>
  );
}
