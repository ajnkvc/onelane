import type { KalenderSlot } from "@/modules/portal/os-betrieb";
import { PanelKarte } from "@/components/portal/karten";
import { verfuegbarkeitEintragen, verfuegbarkeitEntfernen } from "./actions";

/**
 * verfuegbarkeit-pflege.tsx — Pflege-Panel der Einzel-Fahrlehrer-Ansicht
 * (Welle 2, Schreibpfad Migration 0031). Server-gerendert, Formulare ohne JS:
 * EIN Eintrag-Formular (konkreter Wochentag der angezeigten Woche ODER
 * wiederkehrendes Wochentags-Muster, von/bis, optional Blocker) + Löschen je
 * Slot. Gerendert wird das Panel NUR für Berechtigte (Manager bzw. eigene
 * Spur) — die echte Durchsetzung liegt in Modul-SQL + RLS (0031), das Panel
 * ist Komfort, nicht die Verteidigungslinie.
 */

const TAGE_KURZ = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"] as const;

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";
const inputKlasse = `min-h-9 rounded-lg border border-border bg-background px-2.5 text-sm ${focusRing}`;

function tagLabel(iso: string, index: number): string {
  return `${TAGE_KURZ[index]} ${iso.slice(8, 10)}.${iso.slice(5, 7)}.`;
}

export function VerfuegbarkeitPflege({
  instructorId,
  instructorName,
  tage,
  slots,
}: {
  instructorId: string;
  instructorName: string;
  /** Die 7 Tages-ISO-Daten der angezeigten Woche (Mo–So). */
  tage: string[];
  /** Slots der Auswahl in dieser Woche (inkl. wiederkehrender Muster). */
  slots: KalenderSlot[];
}) {
  return (
    <PanelKarte titel={`Verfügbarkeit von ${instructorName}`} kicker="pflege">
      <div className="grid gap-4">
        <form action={verfuegbarkeitEintragen} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="instructorId" value={instructorId} />
          <label className="grid gap-1 text-xs font-medium">
            Tag
            <select name="tag" className={inputKlasse} defaultValue={`d:${tage[0]}`}>
              <optgroup label="diese Woche">
                {tage.map((iso, i) => (
                  <option key={iso} value={`d:${iso}`}>
                    {tagLabel(iso, i)}
                  </option>
                ))}
              </optgroup>
              <optgroup label="jede Woche (wiederkehrend)">
                {TAGE_KURZ.map((kurz, i) => (
                  <option key={kurz} value={`w:${i}`}>
                    jeden {kurz}
                  </option>
                ))}
              </optgroup>
            </select>
          </label>
          <label className="grid gap-1 text-xs font-medium">
            von
            <input type="time" name="von" required defaultValue="08:00" className={inputKlasse} />
          </label>
          <label className="grid gap-1 text-xs font-medium">
            bis
            <input type="time" name="bis" required defaultValue="17:00" className={inputKlasse} />
          </label>
          <label className="flex min-h-9 items-center gap-2 text-xs font-medium">
            <input
              type="checkbox"
              name="istBlockiert"
              value="1"
              className={`size-4 rounded border-border ${focusRing}`}
            />
            als Blocker (nicht verfügbar)
          </label>
          <button
            type="submit"
            className={`inline-flex min-h-9 items-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground shadow-elevation-1 motion-safe:transition-opacity hover:opacity-90 ${focusRing}`}
          >
            eintragen
          </button>
        </form>

        {slots.length > 0 ? (
          <ul className="divide-y divide-border text-sm">
            {slots.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="tabular-nums">
                  {s.ist_datum ? tagLabel(tage[s.tag_index], s.tag_index) : `jeden ${TAGE_KURZ[s.tag_index]}`}
                  {" · "}
                  {s.von ?? "—"}–{s.bis ?? "—"}
                  {s.ist_blockiert ? (
                    <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                      Blocker
                    </span>
                  ) : null}
                </span>
                <form action={verfuegbarkeitEntfernen}>
                  <input type="hidden" name="slotId" value={s.id} />
                  <button
                    type="submit"
                    className={`rounded-full px-3 py-1 text-xs font-medium text-muted-foreground underline-offset-4 hover:text-destructive hover:underline ${focusRing}`}
                  >
                    entfernen
                  </button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
            Für diese Woche ist noch keine Verfügbarkeit eingetragen.
          </p>
        )}
        <p className="text-xs text-muted-foreground/80">
          Wiederkehrende Einträge gelten für jede Woche; das Entfernen löscht das Muster dauerhaft.
        </p>
      </div>
    </PanelKarte>
  );
}
