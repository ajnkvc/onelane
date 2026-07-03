/**
 * highlights.ts — reine, testbare Ableitung der „Highlights der Fahrschule".
 * ----------------------------------------------------------------------------
 * Highlight-Muster bekannter Vergleichsportale, aber EHRLICH: Jedes Highlight
 * braucht eine echte Datengrundlage in den strukturierten Angaben (kein
 * Marketing-Freitext, keine
 * Vermutung). Maximal 5 Einträge in fester Reihenfolge; die UI zeigt die Box
 * erst ab 2 Highlights (sonst weglassen). Keine DB, kein server-only —
 * deterministisch unit-testbar.
 */

export type HighlightIconKey = "automatik" | "sprachen" | "abendtheorie" | "b197" | "preise";

export interface Highlight {
  icon: HighlightIconKey;
  text: string;
}

export interface HighlightInput {
  klassen: string[];
  sprachen: string[];
  vehicles?: { getriebe?: string | null }[];
  /** Theorie-Zeiten mit Beginn ≥ 18:00 vorhanden? (berechnet der Aufrufer aus den Zeiten-Daten) */
  theorieAbende?: boolean;
  /** Mindestens eine Preisklasse durch die Fahrschule bestätigt? */
  preiseBestaetigt?: boolean;
}

const MAX_HIGHLIGHTS = 5;

/** Leitet ehrliche Highlights ab — nur wenn die Datengrundlage wirklich da ist. */
export function berechneHighlights(input: HighlightInput): Highlight[] {
  const out: Highlight[] = [];

  const automatik = (input.vehicles ?? []).filter((v) => v.getriebe === "automatik").length;
  if (automatik > 0) {
    out.push({
      icon: "automatik",
      text:
        automatik === 1
          ? "Automatik-Fahrzeug in der Flotte"
          : `${automatik} Automatik-Fahrzeuge in der Flotte`,
    });
  }

  if (input.klassen.includes("B197")) {
    out.push({ icon: "b197", text: "B197: Automatik lernen, Schaltwagen fahren dürfen" });
  }

  if (input.theorieAbende === true) {
    out.push({ icon: "abendtheorie", text: "Theorieunterricht auch abends (ab 18 Uhr)" });
  }

  if (input.sprachen.length > 1) {
    out.push({ icon: "sprachen", text: `Unterricht in ${input.sprachen.length} Sprachen` });
  }

  if (input.preiseBestaetigt === true) {
    out.push({ icon: "preise", text: "Preise von der Fahrschule bestätigt" });
  }

  return out.slice(0, MAX_HIGHLIGHTS);
}
