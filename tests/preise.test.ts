import { describe, it, expect } from "vitest";
import {
  PREIS_KOMPONENTEN,
  PFLICHT_KOMPONENTEN,
  hatPflichtangabenSet,
  formatEuro,
  formatStand,
  type SchoolPriceRow,
} from "@/lib/preise";

/**
 * preise.test.ts — reine Preis-Helfer (src/lib/preise.ts, Migration 0021).
 * Sichert die §-32-Darstellungslogik ab: Pflichtangaben-Vollständigkeit als
 * Gate für herausgestellte Preisdarstellung; de-DE-Formatierung; Stand-Label.
 * Bewusst KEIN Test einer Summen-/Schätzfunktion — sie existiert by design nicht.
 */

function row(overrides: Partial<Record<string, number | null>> = {}): SchoolPriceRow {
  return {
    schoolId: "00000000-0000-0000-0000-000000000001",
    klasse: "B",
    komponenten: {
      grundbetrag: 450,
      fahrstunde45: 65,
      sonderfahrtUeberland45: 75,
      sonderfahrtAutobahn45: 75,
      sonderfahrtDaemmerung45: 75,
      vorstellungTheorie: 80,
      vorstellungPraxis: 150,
      lehrmaterial: null,
      ...overrides,
    },
    status: "recherchiert",
    stand: "2026-06-01",
  };
}

describe("PREIS_KOMPONENTEN (Anlage-4-Struktur)", () => {
  it("führt alle Pflichtkomponenten in der Anzeige-Liste", () => {
    const keys = PREIS_KOMPONENTEN.map((k) => k.key);
    for (const pflicht of PFLICHT_KOMPONENTEN) expect(keys).toContain(pflicht);
  });

  it("trennt Sonderfahrten nach Fahrtart (Überland/Autobahn/Dämmerung)", () => {
    const keys = PREIS_KOMPONENTEN.map((k) => k.key);
    expect(keys).toContain("sonderfahrtUeberland45");
    expect(keys).toContain("sonderfahrtAutobahn45");
    expect(keys).toContain("sonderfahrtDaemmerung45");
  });

  it("lehrmaterial ist bewusst KEINE Pflichtkomponente", () => {
    expect(PFLICHT_KOMPONENTEN).not.toContain("lehrmaterial");
  });
});

describe("hatPflichtangabenSet", () => {
  it("true bei vollständigem Set (lehrmaterial darf fehlen)", () => {
    expect(hatPflichtangabenSet(row())).toBe(true);
  });

  it.each(PFLICHT_KOMPONENTEN.map((k) => [k] as const))(
    "false, sobald Pflichtkomponente %s fehlt",
    (key) => {
      expect(hatPflichtangabenSet(row({ [key]: null }))).toBe(false);
    },
  );

  it("0 € ist eine gültige Angabe (nur null = fehlend)", () => {
    expect(hatPflichtangabenSet(row({ vorstellungTheorie: 0 }))).toBe(true);
  });
});

describe("formatEuro (de-DE)", () => {
  it("formatiert mit Komma-Dezimalen und €-Zeichen", () => {
    // de-DE nutzt NBSP zwischen Betrag und € — normalisieren für den Vergleich.
    expect(formatEuro(65).replace(/ /g, " ")).toBe("65,00 €");
    expect(formatEuro(1234.5).replace(/ /g, " ")).toBe("1.234,50 €");
  });
});

describe("formatStand", () => {
  it("ISO-Datum → 'Stand MM/JJJJ'", () => {
    expect(formatStand("2026-06-01")).toBe("Stand 06/2026");
  });
  it("fehlend/ungültig → null", () => {
    expect(formatStand(null)).toBeNull();
    expect(formatStand(undefined)).toBeNull();
    expect(formatStand("Juni 2026")).toBeNull();
    expect(formatStand("")).toBeNull();
  });
});
