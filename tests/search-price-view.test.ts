import { describe, it, expect } from "vitest";
import { preisSichtFuerZeile, gruppierePreiseNachSchule } from "@/components/search/price-view";
import type { SchoolPriceRow } from "@/lib/preise";

/**
 * search-price-view.test.ts — Anzeige-Logik der Preisspalte in der Ergebnisliste
 * (src/components/search/price-view.ts). Sichert das §-32-Gating ab: Das
 * Komponenten-Duo wird NUR bei vollständigem Pflichtangaben-Set herausgestellt;
 * unvollständige Aushänge werden neutral („teil") gezeigt, fehlende ehrlich
 * („none") — nie geschätzt, nie ausgeblendet. Dazu die Klassen-Wahl
 * (Filter > B > erste Zeile) und die Batch-Gruppierung nach Schule.
 */

function row(
  klasse = "B",
  overrides: Partial<Record<string, number | null>> = {},
  schoolId = "00000000-0000-0000-0000-000000000001",
): SchoolPriceRow {
  return {
    schoolId,
    klasse,
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

describe("preisSichtFuerZeile — §32-Gating", () => {
  it("liefert 'none' ohne Preiszeilen", () => {
    expect(preisSichtFuerZeile([])).toEqual({ kind: "none" });
  });

  it("stellt das Duo NUR bei vollständigem Pflichtangaben-Set heraus", () => {
    const sicht = preisSichtFuerZeile([row()]);
    expect(sicht).toMatchObject({ kind: "duo", klasse: "B", grundbetrag: 450, fahrstunde45: 65 });
  });

  it("gated unvollständige Sets auf 'teil' — auch wenn das Duo selbst vorliegt", () => {
    // Grundbetrag + Fahrstunde vorhanden, aber Pflicht-Komponente fehlt → kein herausgestelltes Duo.
    const sicht = preisSichtFuerZeile([row("B", { sonderfahrtAutobahn45: null })]);
    expect(sicht.kind).toBe("teil");
  });

  it("gated fehlenden Grundbetrag auf 'teil' (nie halbes Duo)", () => {
    const sicht = preisSichtFuerZeile([row("B", { grundbetrag: null })]);
    expect(sicht.kind).toBe("teil");
  });

  it("reicht Provenienz (status + stand) in die Teil-Sicht durch", () => {
    const sicht = preisSichtFuerZeile([row("B", { vorstellungTheorie: null })]);
    expect(sicht).toMatchObject({ kind: "teil", status: "recherchiert", stand: "2026-06-01" });
  });
});

describe("preisSichtFuerZeile — Klassen-Wahl (Filter > B > erste Zeile)", () => {
  it("bevorzugt die aktive Filter-Klasse", () => {
    const sicht = preisSichtFuerZeile([row("B"), row("A1", { grundbetrag: 300 })], "A1");
    expect(sicht).toMatchObject({ kind: "duo", klasse: "A1", grundbetrag: 300 });
  });

  it("fällt ohne Filter auf Klasse B zurück", () => {
    const sicht = preisSichtFuerZeile([row("A1"), row("B", { fahrstunde45: 70 })]);
    expect(sicht).toMatchObject({ kind: "duo", klasse: "B", fahrstunde45: 70 });
  });

  it("nimmt ohne B-Zeile die erste Zeile", () => {
    const sicht = preisSichtFuerZeile([row("A1", { grundbetrag: 310 })]);
    expect(sicht).toMatchObject({ kind: "duo", klasse: "A1", grundbetrag: 310 });
  });
});

describe("gruppierePreiseNachSchule", () => {
  it("gruppiert Batch-Zeilen je Schule in stabiler Reihenfolge", () => {
    const a1 = row("B", {}, "school-a");
    const a2 = row("A1", {}, "school-a");
    const b1 = row("B", {}, "school-b");
    const map = gruppierePreiseNachSchule([a1, a2, b1]);
    expect(map.get("school-a")).toEqual([a1, a2]);
    expect(map.get("school-b")).toEqual([b1]);
    expect(map.has("school-c")).toBe(false);
  });

  it("liefert für leere Eingabe eine leere Map", () => {
    expect(gruppierePreiseNachSchule([]).size).toBe(0);
  });
});
