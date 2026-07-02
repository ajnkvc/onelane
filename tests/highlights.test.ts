import { describe, it, expect } from "vitest";
import { berechneHighlights } from "@/lib/highlights";

/**
 * highlights.test.ts — Grenzfälle der ehrlichen Highlight-Ableitung:
 * ohne Datengrundlage KEIN Highlight (leere Daten → leeres Array), Automatik
 * nur bei echtem Automatik-Fahrzeug, Sprachen erst ab 2, max. 5 Einträge.
 */
describe("berechneHighlights", () => {
  it("leere Daten → leeres Array", () => {
    expect(berechneHighlights({ klassen: [], sprachen: [] })).toEqual([]);
    expect(
      berechneHighlights({ klassen: [], sprachen: [], vehicles: [], theorieAbende: false, preiseBestaetigt: false }),
    ).toEqual([]);
  });

  it("Automatik NUR bei mindestens einem Fahrzeug mit getriebe === 'automatik'", () => {
    expect(
      berechneHighlights({
        klassen: [],
        sprachen: [],
        vehicles: [{ getriebe: "schaltung" }, { getriebe: null }, {}],
      }),
    ).toEqual([]);
    const eins = berechneHighlights({
      klassen: [],
      sprachen: [],
      vehicles: [{ getriebe: "automatik" }],
    });
    expect(eins).toEqual([{ icon: "automatik", text: "Automatik-Fahrzeug in der Flotte" }]);
    const zwei = berechneHighlights({
      klassen: [],
      sprachen: [],
      vehicles: [{ getriebe: "automatik" }, { getriebe: "automatik" }],
    });
    expect(zwei[0].text).toBe("2 Automatik-Fahrzeuge in der Flotte");
  });

  it("B197 nur bei exakt enthaltener Klasse", () => {
    expect(berechneHighlights({ klassen: ["B", "BE"], sprachen: [] })).toEqual([]);
    expect(berechneHighlights({ klassen: ["B197"], sprachen: [] })).toEqual([
      { icon: "b197", text: "B197: Automatik lernen, Schaltwagen fahren dürfen" },
    ]);
  });

  it("Abend-Theorie nur bei explizitem true", () => {
    expect(berechneHighlights({ klassen: [], sprachen: [], theorieAbende: undefined })).toEqual([]);
    expect(berechneHighlights({ klassen: [], sprachen: [], theorieAbende: true })).toEqual([
      { icon: "abendtheorie", text: "Theorieunterricht auch abends (ab 18 Uhr)" },
    ]);
  });

  it("Sprachen erst ab 2 (eine Sprache ist kein Highlight)", () => {
    expect(berechneHighlights({ klassen: [], sprachen: ["de"] })).toEqual([]);
    expect(berechneHighlights({ klassen: [], sprachen: ["de", "en", "tr"] })).toEqual([
      { icon: "sprachen", text: "Unterricht in 3 Sprachen" },
    ]);
  });

  it("Preise bestätigt nur bei explizitem true", () => {
    expect(berechneHighlights({ klassen: [], sprachen: [], preiseBestaetigt: false })).toEqual([]);
    expect(berechneHighlights({ klassen: [], sprachen: [], preiseBestaetigt: true })).toEqual([
      { icon: "preise", text: "Preise von der Fahrschule bestätigt" },
    ]);
  });

  it("volle Datengrundlage → max. 5, feste Reihenfolge", () => {
    const alle = berechneHighlights({
      klassen: ["B", "B197"],
      sprachen: ["de", "en"],
      vehicles: [{ getriebe: "automatik" }],
      theorieAbende: true,
      preiseBestaetigt: true,
    });
    expect(alle).toHaveLength(5);
    expect(alle.map((h) => h.icon)).toEqual([
      "automatik",
      "b197",
      "abendtheorie",
      "sprachen",
      "preise",
    ]);
  });
});
