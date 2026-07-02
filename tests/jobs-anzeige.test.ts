import { describe, it, expect } from "vitest";
import {
  titelMitMwd,
  formatDatum,
  gehaltsBadge,
  finanzierungsLabel,
  EMPLOYMENT_TYPE_SCHEMA,
  SALARY_UNIT_SCHEMA,
} from "@/lib/jobs-anzeige";

/**
 * jobs-anzeige.test.ts — Darstellungs-Helfer der Jobbörse (src/lib/jobs-anzeige.ts).
 * Sichert die VERBINDLICHEN Wording-Auflagen der M5-Spec: AGG-neutraler Titel
 * („… (m/w/d)" automatisch, nie doppelt), Gehalts-Badge NUR bei kompletter
 * bestätigter Spanne mit Pflicht-Label („Angabe der Fahrschule · bestätigt am
 * <Datum>"), erlaubtes Finanzierungs-Flag-Wording (keine Zusagen) sowie die
 * Schema.org-Mappings des JobPosting-JSON-LD.
 */

describe("titelMitMwd — AGG-neutraler Titel", () => {
  it("hängt „ (m/w/d)\" an, wenn der Zusatz fehlt", () => {
    expect(titelMitMwd("Fahrlehrer/in Klasse B (Vollzeit)")).toBe(
      "Fahrlehrer/in Klasse B (Vollzeit) (m/w/d)",
    );
  });

  it("dupliziert einen vorhandenen Zusatz nicht (auch bei Varianten)", () => {
    expect(titelMitMwd("Fahrlehrer (m/w/d)")).toBe("Fahrlehrer (m/w/d)");
    expect(titelMitMwd("Fahrlehrer (M/W/D)")).toBe("Fahrlehrer (M/W/D)");
    expect(titelMitMwd("Fahrlehrer ( m / w / d )")).toBe("Fahrlehrer ( m / w / d )");
  });

  it("trimmt Whitespace am Rand", () => {
    expect(titelMitMwd("  Fahrlehrer  ")).toBe("Fahrlehrer (m/w/d)");
  });
});

describe("formatDatum — ISO → deutsches Format", () => {
  it("formatiert YYYY-MM-DD als TT.MM.JJJJ", () => {
    expect(formatDatum("2026-06-10")).toBe("10.06.2026");
  });

  it("liefert null für fehlende/ungültige Werte (nichts erfinden)", () => {
    expect(formatDatum(null)).toBeNull();
    expect(formatDatum(undefined)).toBeNull();
    expect(formatDatum("Juni 2026")).toBeNull();
    expect(formatDatum("")).toBeNull();
  });
});

describe("gehaltsBadge — nur komplette bestätigte Spannen", () => {
  const komplett = {
    gehaltVonEuro: "3400.00",
    gehaltBisEuro: "3900.00",
    gehaltZeitraum: "monat" as const,
    gehaltBestaetigtAm: "2026-06-10",
  };

  it("liefert Spanne + Pflicht-Label bei kompletter bestätigter Spanne", () => {
    const b = gehaltsBadge(komplett);
    expect(b).not.toBeNull();
    expect(b?.spanne).toBe("3.400–3.900 € pro Monat");
    expect(b?.label).toBe("Angabe der Fahrschule · bestätigt am 10.06.2026");
  });

  it("liefert null ohne Bestätigungsdatum (UI zeigt „Gehalt: auf Anfrage\")", () => {
    expect(gehaltsBadge({ ...komplett, gehaltBestaetigtAm: null })).toBeNull();
  });

  it("liefert null bei unvollständiger Spanne (Defense-in-Depth zur DB, 0025)", () => {
    expect(gehaltsBadge({ ...komplett, gehaltVonEuro: null })).toBeNull();
    expect(gehaltsBadge({ ...komplett, gehaltBisEuro: null })).toBeNull();
    expect(gehaltsBadge({ ...komplett, gehaltZeitraum: null })).toBeNull();
  });

  it("kennt alle Zeiträume", () => {
    expect(gehaltsBadge({ ...komplett, gehaltZeitraum: "jahr" })?.spanne).toBe(
      "3.400–3.900 € pro Jahr",
    );
    // Nachkommastellen bleiben erhalten — bestätigte Beträge werden NIE gerundet.
    expect(
      gehaltsBadge({
        ...komplett,
        gehaltVonEuro: "28.50",
        gehaltBisEuro: "34.00",
        gehaltZeitraum: "stunde",
      })?.spanne,
    ).toBe("28,5–34 € pro Stunde");
  });
});

describe("finanzierungsLabel — erlaubtes Flag-Wording, keine Zusagen", () => {
  it("bildet exakt das erlaubte Wording ab", () => {
    expect(finanzierungsLabel("voll")).toBe("Ausbildungsfinanzierung voll — nach Vereinbarung");
    expect(finanzierungsLabel("anteilig")).toBe(
      "Ausbildungsfinanzierung anteilig — nach Vereinbarung",
    );
    expect(finanzierungsLabel("nach_vereinbarung")).toBe(
      "Ausbildungsfinanzierung möglich — nach Vereinbarung",
    );
  });

  it("zeigt bei „keine\" nichts an", () => {
    expect(finanzierungsLabel("keine")).toBeNull();
  });
});

describe("Schema.org-Mappings (JobPosting-JSON-LD)", () => {
  it("deckt alle Beschäftigungsarten der DB-Allowlist ab", () => {
    for (const art of ["vollzeit", "teilzeit", "minijob", "nebenberuflich"]) {
      expect(EMPLOYMENT_TYPE_SCHEMA[art]).toMatch(/^(FULL|PART)_TIME$/);
    }
  });

  it("deckt alle Gehalts-Zeiträume ab", () => {
    expect(SALARY_UNIT_SCHEMA.monat).toBe("MONTH");
    expect(SALARY_UNIT_SCHEMA.jahr).toBe("YEAR");
    expect(SALARY_UNIT_SCHEMA.stunde).toBe("HOUR");
  });
});
