import {
  PREIS_KOMPONENTEN,
  hatPflichtangabenSet,
  type PreisKomponentenKey,
  type SchoolPriceRow,
} from "@/lib/preise";

/**
 * vergleich.ts — reine, testbare Helfer für den Vergleichsmodus (/vergleich).
 * ----------------------------------------------------------------------------
 * Kein server-only, keine DB — client- UND server-tauglich (die Compare-Bar
 * baut damit URLs, die SSR-Seite parst damit Parameter).
 *
 * URL-KONTRAKT: /vergleich?s=<stadtSlug>/<schulSlug>&s=… (2–4 Schulen; die
 * Seite toleriert auch 1). Parsing ist STRIKT: beide Segmente müssen dem
 * Slug-Muster entsprechen, Duplikate fliegen raus, hartes Cap bei 4 —
 * Ungültiges wird STILL verworfen (kein Fehler-Oracle für gebastelte URLs).
 *
 * RECHTSRAHMEN (§ 32 FahrlG, wie src/lib/preise.ts): Der Vergleich ist
 * KOMPONENTENWEISE — je Aushang-Komponente eine Zeile, nie eine Summe, nie ein
 * „ab"-Preis, nie ein „günstigste Fahrschule"-Urteil. Deshalb gibt es hier
 * BEWUSST KEINE Summen-/Gesamt-/Schätzfunktion (Tests sichern das ab).
 * Erlaubt ist das dezente Markieren des niedrigsten Werts JE ZEILE
 * (komponentenbasiert); fehlende Angaben bleiben neutral „keine Angabe".
 */

/** Maximal vergleichbare Schulen — mehr vergleicht das Produkt bewusst nicht. */
export const MAX_VERGLEICH = 4;

/** Slug-Muster wie in modules/ereignisse (kleingeschrieben, Bindestrich-getrennt). */
const SLUG_MUSTER = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_SEGMENT_LAENGE = 200;

/** Fokus-Klassen-Muster wie auf der Profilseite (?klasse=…). */
const KLASSE_MUSTER = /^[A-Z0-9]{1,12}$/;

export interface VergleichsRef {
  stadt: string;
  slug: string;
}

function istSlug(wert: string): boolean {
  return wert.length > 0 && wert.length <= MAX_SEGMENT_LAENGE && SLUG_MUSTER.test(wert);
}

/**
 * ?s=-Parameter (einzeln oder wiederholt) → validierte, deduplizierte Refs.
 * Ungültige Werte werden still verworfen; nach MAX_VERGLEICH gültigen Refs
 * ist Schluss (Cap zählt nur Gültige — ein Angreifer kann den Vergleich nicht
 * mit Müll-Werten „vollmachen").
 */
export function parseVergleichsRefs(raw: string | string[] | undefined | null): VergleichsRef[] {
  const werte = Array.isArray(raw) ? raw : raw != null ? [raw] : [];
  const out: VergleichsRef[] = [];
  const gesehen = new Set<string>();
  for (const wert of werte) {
    if (typeof wert !== "string") continue;
    const teile = wert.split("/");
    if (teile.length !== 2) continue;
    const [stadt, slug] = teile;
    if (!istSlug(stadt) || !istSlug(slug)) continue;
    const key = `${stadt}/${slug}`;
    if (gesehen.has(key)) continue;
    gesehen.add(key);
    out.push({ stadt, slug });
    if (out.length >= MAX_VERGLEICH) break;
  }
  return out;
}

/**
 * Vergleichs-URL aus Refs (+ optionaler Fokus-Klasse) bauen. Die Segmente sind
 * validierte Slugs ([a-z0-9-]) — der „/" bleibt bewusst unkodiert lesbar.
 * Ungültige Refs/Klassen werden defensiv weggelassen (Helfer ist der EINZIGE
 * URL-Bauer für Bar UND Teilen-Modul — eine Quelle der Wahrheit).
 */
export function vergleichsHref(refs: readonly VergleichsRef[], klasse?: string | null): string {
  const params = refs
    .filter((r) => istSlug(r.stadt) && istSlug(r.slug))
    .slice(0, MAX_VERGLEICH)
    .map((r) => `s=${r.stadt}/${r.slug}`);
  const k = normalisiereKlasseWunsch(klasse);
  if (k) params.push(`klasse=${encodeURIComponent(k)}`);
  return params.length > 0 ? `/vergleich?${params.join("&")}` : "/vergleich";
}

/** ?klasse=-Wunsch normalisieren (trim + uppercase); ungültig → null. */
export function normalisiereKlasseWunsch(raw: string | null | undefined): string | null {
  const k = raw?.trim().toUpperCase() ?? "";
  return KLASSE_MUSTER.test(k) ? k : null;
}

/**
 * Alle Klassen über die verglichenen Schulen (dedupliziert), B zuerst —
 * Reihenfolge des Klassen-Umschalters auf /vergleich.
 */
export function sammleKlassen(preiseJeSchule: ReadonlyArray<readonly SchoolPriceRow[]>): string[] {
  const set = new Set<string>();
  for (const rows of preiseJeSchule) for (const r of rows) set.add(r.klasse);
  return [...set].sort((a, b) => (a === "B" ? -1 : b === "B" ? 1 : a.localeCompare(b, "de")));
}

/**
 * Fokus-Klasse der Preisgruppe auflösen (Muster der Profilseite):
 * ?klasse=-Wunsch → 'B' → erste Klasse, für die mindestens EINE Schule das
 * vollständige Pflichtangaben-Set hat → erste vorhandene → null (keine Preise).
 */
export function waehleVergleichsKlasse(
  preiseJeSchule: ReadonlyArray<readonly SchoolPriceRow[]>,
  wunsch?: string | null,
): string | null {
  const klassen = sammleKlassen(preiseJeSchule);
  if (klassen.length === 0) return null;
  const w = normalisiereKlasseWunsch(wunsch);
  if (w) {
    const treffer = klassen.find((k) => k.toUpperCase() === w);
    if (treffer) return treffer;
  }
  if (klassen.includes("B")) return "B";
  const vollstaendig = klassen.find((k) =>
    preiseJeSchule.some((rows) => {
      const row = rows.find((r) => r.klasse === k);
      return row != null && hatPflichtangabenSet(row);
    }),
  );
  return vollstaendig ?? klassen[0];
}

/** Preiszeile einer Schule zur Fokus-Klasse (oder null — Spalte bleibt neutral). */
export function fokusZeileFuerSchule(
  rows: readonly SchoolPriceRow[],
  fokusKlasse: string | null,
): SchoolPriceRow | null {
  if (!fokusKlasse) return null;
  return rows.find((r) => r.klasse === fokusKlasse) ?? null;
}

export interface VergleichsZelle {
  /** Betrag in EUR; null = „keine Angabe" (neutral, nie benachteiligend). */
  wert: number | null;
  /**
   * Niedrigster Wert DIESER Komponenten-Zeile (komponentenbasiert, § 32 —
   * KEIN Gesamturteil). Markiert nur, wenn ≥ 2 Angaben vorliegen und sich die
   * Werte tatsächlich unterscheiden; Gleichstand am Minimum markiert alle.
   */
  guenstigster: boolean;
}

export interface VergleichsZeile {
  key: PreisKomponentenKey;
  label: string;
  zellen: VergleichsZelle[];
}

/**
 * Vergleichszeilen der Preisgruppe: JE Aushang-Komponente (Anlage-4-Reihenfolge
 * aus PREIS_KOMPONENTEN) eine Zeile mit einer Zelle pro Schule. Es wird NICHTS
 * aggregiert oder hochgerechnet — exakt eine Zeile pro Komponente, keine
 * synthetischen Zeilen (kein „Gesamt", kein „ab").
 */
export function baueVergleichsZeilen(
  fokusZeilen: ReadonlyArray<SchoolPriceRow | null>,
): VergleichsZeile[] {
  return PREIS_KOMPONENTEN.map(({ key, label }) => {
    const werte = fokusZeilen.map((row) => row?.komponenten[key] ?? null);
    const vorhanden = werte.filter((w): w is number => w != null);
    // Markierung nur bei echtem Unterschied (≥ 2 Angaben, min < max) — bei
    // Gleichstand aller Angaben gäbe es nichts hervorzuheben.
    const min = vorhanden.length >= 2 ? Math.min(...vorhanden) : null;
    const markieren = min != null && Math.max(...vorhanden) > min;
    return {
      key,
      label,
      zellen: werte.map((wert) => ({ wert, guenstigster: markieren && wert === min })),
    };
  });
}
