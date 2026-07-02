/**
 * preise.ts — reine, client-taugliche Preis-Helfer (kein server-only, keine DB).
 * ----------------------------------------------------------------------------
 * RECHTSRAHMEN (§ 32 FahrlG, Anlage 4 FahrlG-DV; OLG Celle 13 U 134/12):
 * Fahrschul-Preise sind als KOMPONENTEN des amtlichen Preisaushangs darzustellen —
 * Grundbetrag, Fahrstunde à 45 min, Sonderfahrten GETRENNT nach Fahrtart,
 * Vorstellungsentgelte. Gesamt-/Pauschalpreise und blickfangmäßig herausgestellte
 * Kostenschätzungen sind unzulässig. DESHALB gibt es hier BEWUSST KEINE Summen-/
 * Schätzfunktion („kein Gesamtpreis by design"). Die UI zeigt Komponenten-Tabellen
 * mit Provenienz-Kennzeichnung (status 'recherchiert' = ohne Gewähr ·
 * 'bestaetigt' = durch die Fahrschule) und weist behördliche Prüfgebühren
 * (TÜV/DEKRA, GebOSt) stets als getrennte Drittgebühren aus.
 *
 * Die DB-Zugriffe liegen in src/modules/schools/prices.ts (server-only).
 */

/** Anzeige-Reihenfolge + deutsche Labels der Aushang-Komponenten (Anlage-4-Logik). */
export const PREIS_KOMPONENTEN = [
  { key: "grundbetrag", label: "Grundbetrag" },
  { key: "fahrstunde45", label: "Fahrstunde (45 Min.)" }, // gitleaks:allow (Feldname)
  { key: "sonderfahrtUeberland45", label: "Sonderfahrt Überland (45 Min.)" }, // gitleaks:allow (Feldname)
  { key: "sonderfahrtAutobahn45", label: "Sonderfahrt Autobahn (45 Min.)" },
  { key: "sonderfahrtDaemmerung45", label: "Sonderfahrt Dämmerung (45 Min.)" }, // gitleaks:allow (Feldname)
  { key: "vorstellungTheorie", label: "Vorstellung zur theoretischen Prüfung" },
  { key: "vorstellungPraxis", label: "Vorstellung zur praktischen Prüfung" },
  { key: "lehrmaterial", label: "Lehrmaterial" },
] as const;

export type PreisKomponentenKey = (typeof PREIS_KOMPONENTEN)[number]["key"];

/** Pflichtangaben-Kern laut § 32: ohne diese Komponenten keine herausgestellte Preisdarstellung. */
export const PFLICHT_KOMPONENTEN: readonly PreisKomponentenKey[] = [
  "grundbetrag",
  "fahrstunde45",
  "sonderfahrtUeberland45",
  "sonderfahrtAutobahn45",
  "sonderfahrtDaemmerung45",
  "vorstellungTheorie",
  "vorstellungPraxis",
];

export interface SchoolPriceRow {
  schoolId: string;
  klasse: string;
  /** Beträge in EUR; null = von der Schule (noch) nicht angegeben — UI zeigt „keine Angabe". */
  komponenten: Record<PreisKomponentenKey, number | null>;
  status: "recherchiert" | "bestaetigt";
  /** Stand der Angabe (Aushang-/Recherche-Datum), ISO `YYYY-MM-DD` oder null. */
  stand: string | null;
}

/**
 * Pflichtangaben-Set vollständig? Nur dann darf die UI die Preise einer Klasse
 * HERAUSGESTELLT zeigen; unvollständige Sets erscheinen nur als neutrale Tabelle
 * mit „keine Angabe"-Lücken (Preisklarheit: nie einzelne Bestandteile bewerben).
 */
export function hatPflichtangabenSet(row: SchoolPriceRow): boolean {
  return PFLICHT_KOMPONENTEN.every((k) => row.komponenten[k] != null);
}

const euroFormat = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
});

/** Einheitliche EUR-Formatierung (de-DE); null → „keine Angabe" macht die UI selbst. */
export function formatEuro(betrag: number): string {
  return euroFormat.format(betrag);
}

/** „Stand MM/JJJJ" aus ISO-Datum (`YYYY-MM-DD`); ungültig/fehlend → null. */
export function formatStand(standIso: string | null | undefined): string | null {
  if (!standIso) return null;
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(standIso);
  if (!m) return null;
  return `Stand ${m[2]}/${m[1]}`;
}
