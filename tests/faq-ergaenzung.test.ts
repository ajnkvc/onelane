import { describe, it, expect } from "vitest";
import { ergaenzeFaq } from "@/lib/faq-ergaenzung";

/**
 * faq-ergaenzung.test.ts — Grenzfälle der Auto-FAQ:
 * leere Daten → leeres Array; Formulierungen enthalten Schulname + echte Werte
 * (keine identischen Massentexte); Themen-Dedupe gegen vorhandene Fragen;
 * maximal 4 Einträge.
 */
const BASIS = { name: "Fahrschule Isarpilot", klassen: [], sprachen: [] };

describe("ergaenzeFaq", () => {
  it("leere Daten → leeres Array", () => {
    expect(ergaenzeFaq({ name: "X", klassen: [], sprachen: [] })).toEqual([]);
    expect(ergaenzeFaq({ name: "", klassen: ["B"], sprachen: ["Deutsch"] })).toEqual([]);
  });

  it("Automatik-Frage nennt Schulname und konkrete Fahrzeuge", () => {
    const [faq] = ergaenzeFaq({
      ...BASIS,
      vehicles: [
        { marke: "BMW", modell: "X1", getriebe: "automatik" },
        { marke: "VW", modell: "Golf", getriebe: "schaltung" },
      ],
    });
    expect(faq.frage).toBe("Bietet Fahrschule Isarpilot Automatik-Ausbildung an?");
    expect(faq.antwort).toContain("Fahrschule Isarpilot");
    expect(faq.antwort).toContain("BMW X1");
    expect(faq.antwort).not.toContain("Golf");
  });

  it("keine Automatik-Frage ohne Automatik-Fahrzeug", () => {
    expect(ergaenzeFaq({ ...BASIS, vehicles: [{ getriebe: "schaltung" }] })).toEqual([]);
  });

  it("Sprachen- und Klassen-Fragen tragen echte Werte + Schulname", () => {
    const faqs = ergaenzeFaq({
      name: "Fahrschule Nordlicht",
      klassen: ["B", "B197", "A1"],
      sprachen: ["Deutsch", "Englisch"],
    });
    expect(faqs).toHaveLength(2);
    expect(faqs[0].frage).toBe("In welchen Sprachen unterrichtet Fahrschule Nordlicht?");
    expect(faqs[0].antwort).toContain("Deutsch und Englisch");
    expect(faqs[1].frage).toBe("Welche Führerscheinklassen bietet Fahrschule Nordlicht an?");
    expect(faqs[1].antwort).toContain("B, B197 und A1");
  });

  it("Theoriezeiten werden zu konkreten Abenden gebündelt; ungültige Zeilen fallen raus", () => {
    const faqs = ergaenzeFaq({
      ...BASIS,
      theorieZeiten: [
        { wochentag: 0, von: "18:30:00", bis: "20:00:00" },
        { wochentag: 2, von: "18:30", bis: "20:00" },
        { wochentag: 9, von: "18:30", bis: "20:00" }, // ungültiger Wochentag
        { wochentag: 4, von: "quatsch", bis: "20:00" }, // ungültige Zeit
      ],
    });
    expect(faqs).toHaveLength(1);
    expect(faqs[0].frage).toBe("Wann findet der Theorieunterricht statt?");
    expect(faqs[0].antwort).toContain("montags und mittwochs von 18:30 bis 20:00 Uhr");
    expect(faqs[0].antwort).toContain("Fahrschule Isarpilot");
  });

  it("Themen-Dedupe: vorhandene Fragen unterdrücken die generierte Variante", () => {
    const faqs = ergaenzeFaq({
      name: "Fahrschule Isarpilot",
      klassen: ["B", "B197"],
      sprachen: ["Deutsch", "Englisch"],
      vehicles: [{ marke: "BMW", modell: "X1", getriebe: "automatik" }],
      theorieZeiten: [{ wochentag: 0, von: "18:30", bis: "20:00" }],
      vorhandeneFragen: ["Gibt es Automatikfahrzeuge?", "Wann findet der Theorieunterricht statt?"],
    });
    // Automatik + Theorie bereits behandelt → nur Sprachen + Klassen.
    expect(faqs.map((f) => f.frage)).toEqual([
      "In welchen Sprachen unterrichtet Fahrschule Isarpilot?",
      "Welche Führerscheinklassen bietet Fahrschule Isarpilot an?",
    ]);
  });

  it("maximal 4 Einträge, individuelle Texte je Schule (keine Massentexte)", () => {
    const input = {
      klassen: ["B"],
      sprachen: ["Deutsch"],
      vehicles: [{ marke: "VW", modell: "ID.3", getriebe: "automatik" }],
      theorieZeiten: [{ wochentag: 1, von: "19:00", bis: "20:30" }],
    };
    const a = ergaenzeFaq({ ...input, name: "Fahrschule A" });
    const b = ergaenzeFaq({ ...input, name: "Fahrschule B" });
    expect(a).toHaveLength(4);
    expect(b).toHaveLength(4);
    for (let i = 0; i < 4; i++) {
      expect(a[i].antwort).not.toBe(b[i].antwort); // Schulname individualisiert
    }
  });
});
