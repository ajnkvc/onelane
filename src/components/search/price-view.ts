import { hatPflichtangabenSet, type SchoolPriceRow } from "@/lib/preise";

/**
 * price-view.ts — reine Anzeige-Logik der Preisspalte in der Ergebnisliste.
 * ----------------------------------------------------------------------------
 * §32-FahrlG-Gating: Das Komponenten-Duo (Grundbetrag + Fahrstunde) wird NUR
 * herausgestellt, wenn das Pflichtangaben-Set der Klasse vollständig ist
 * (hatPflichtangabenSet). Unvollständige Aushänge erscheinen als neutraler
 * Hinweis mit Provenienz-Badge — nie als beworbenes Teil-Duo, nie geschätzt.
 * Ohne Preiszeile bleibt die Schule sichtbar („keine Preisangabe").
 *
 * Reines Modul (kein server-only, keine DB) — unit-testbar; die DB-Reads
 * liegen in src/modules/schools/prices.ts.
 */

/** Sicht der Preisspalte einer Ergebnis-Zeile. */
export type PreisSicht =
  | {
      kind: "duo";
      klasse: string;
      grundbetrag: number;
      fahrstunde45: number;
      status: SchoolPriceRow["status"];
      stand: string | null;
    }
  | { kind: "teil"; klasse: string; status: SchoolPriceRow["status"]; stand: string | null }
  | { kind: "none" };

/**
 * Preiszeile wählen (aktive Filter-Klasse > Klasse B > erste Zeile) und gaten.
 * Ist die Suche nach einer Klasse gefiltert, übergibt die Seite bereits
 * klassen-gefilterte Zeilen — die Fallback-Kette greift dann nur innerhalb
 * derselben Klasse und zeigt nie eine fremde Klasse unter aktivem Filter.
 */
export function preisSichtFuerZeile(rows: SchoolPriceRow[], klasse?: string): PreisSicht {
  if (rows.length === 0) return { kind: "none" };
  const row =
    (klasse ? rows.find((r) => r.klasse === klasse) : undefined) ??
    rows.find((r) => r.klasse === "B") ??
    rows[0];
  const grundbetrag = row.komponenten.grundbetrag;
  const fahrstunde45 = row.komponenten.fahrstunde45;
  if (hatPflichtangabenSet(row) && grundbetrag != null && fahrstunde45 != null) {
    return { kind: "duo", klasse: row.klasse, grundbetrag, fahrstunde45, status: row.status, stand: row.stand };
  }
  return { kind: "teil", klasse: row.klasse, status: row.status, stand: row.stand };
}

/** Preiszeilen eines Batch-Reads nach Schule gruppieren (Reihenfolge stabil). */
export function gruppierePreiseNachSchule(rows: SchoolPriceRow[]): Map<string, SchoolPriceRow[]> {
  const map = new Map<string, SchoolPriceRow[]>();
  for (const r of rows) {
    const list = map.get(r.schoolId);
    if (list) list.push(r);
    else map.set(r.schoolId, [r]);
  }
  return map;
}
