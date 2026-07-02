import { describe, it, expect } from "vitest";
import * as vergleichModul from "@/lib/vergleich";
import {
  MAX_VERGLEICH,
  parseVergleichsRefs,
  vergleichsHref,
  normalisiereKlasseWunsch,
  sammleKlassen,
  waehleVergleichsKlasse,
  fokusZeileFuerSchule,
  baueVergleichsZeilen,
} from "@/lib/vergleich";
import { PREIS_KOMPONENTEN, type SchoolPriceRow } from "@/lib/preise";

/**
 * vergleich.test.ts — reine Vergleichs-Helfer (src/lib/vergleich.ts, M3).
 * Sichert den URL-Kontrakt (?s=stadt/slug, striktes Parsing, Dedupe, Cap 4)
 * und die §-32-Zeilenlogik ab: je Aushang-Komponente EINE Zeile, Markierung
 * nur komponentenbasiert je Zeile — und per Export-Scan, dass es im Modul
 * KEINE Summen-/Gesamt-/Schätzfunktion gibt (by design).
 */

function row(
  klasse: string,
  komponenten: Partial<Record<(typeof PREIS_KOMPONENTEN)[number]["key"], number | null>> = {},
): SchoolPriceRow {
  return {
    schoolId: "00000000-0000-0000-0000-000000000001",
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
      ...komponenten,
    },
    status: "recherchiert",
    stand: "2026-06-01",
  };
}

describe("parseVergleichsRefs (URL-Kontrakt ?s=stadt/slug)", () => {
  it("parst einen einzelnen gültigen Wert", () => {
    expect(parseVergleichsRefs("muenchen/fahrschule-isarpilot")).toEqual([
      { stadt: "muenchen", slug: "fahrschule-isarpilot" },
    ]);
  });

  it("parst wiederholte Werte in Reihenfolge", () => {
    expect(parseVergleichsRefs(["a/b", "c/d"])).toEqual([
      { stadt: "a", slug: "b" },
      { stadt: "c", slug: "d" },
    ]);
  });

  it("liefert [] für undefined/null/leer", () => {
    expect(parseVergleichsRefs(undefined)).toEqual([]);
    expect(parseVergleichsRefs(null)).toEqual([]);
    expect(parseVergleichsRefs([])).toEqual([]);
    expect(parseVergleichsRefs("")).toEqual([]);
  });

  it("verwirft still, was nicht exakt zwei Slug-Segmente hat", () => {
    expect(parseVergleichsRefs(["nur-ein-segment", "a/b/c", "/", "a/", "/b"])).toEqual([]);
  });

  it("verwirft ungültige Slugs (Großschreibung, Umlaute, Sonderzeichen, Randstriche)", () => {
    for (const kaputt of [
      "Muenchen/schule",
      "münchen/schule",
      "muenchen/schu_le",
      "muenchen/-schule",
      "muenchen/schule-",
      "muenchen/schu le",
      "muenchen/schu%2Fle",
    ]) {
      expect(parseVergleichsRefs(kaputt)).toEqual([]);
    }
  });

  it("verwirft überlange Segmente (> 200 Zeichen)", () => {
    const lang = "a".repeat(201);
    expect(parseVergleichsRefs(`${lang}/b`)).toEqual([]);
    expect(parseVergleichsRefs(`a/${lang}`)).toEqual([]);
  });

  it("dedupliziert identische Refs (erste gewinnt)", () => {
    expect(parseVergleichsRefs(["a/b", "a/b", "c/d"])).toEqual([
      { stadt: "a", slug: "b" },
      { stadt: "c", slug: "d" },
    ]);
  });

  it(`kappt hart bei ${MAX_VERGLEICH} gültigen Refs`, () => {
    const fuenf = ["a/a", "b/b", "c/c", "d/d", "e/e"];
    expect(parseVergleichsRefs(fuenf)).toHaveLength(MAX_VERGLEICH);
    expect(parseVergleichsRefs(fuenf).map((r) => r.stadt)).toEqual(["a", "b", "c", "d"]);
  });

  it("Müll-Werte verbrauchen das Cap NICHT (Cap zählt nur Gültige)", () => {
    const werte = ["UNGÜLTIG", "x//y", "kein-slash", "a/a", "b/b", "c/c", "d/d"];
    expect(parseVergleichsRefs(werte)).toHaveLength(MAX_VERGLEICH);
  });
});

describe("vergleichsHref (einzige URL-Bau-Stelle)", () => {
  it("baut wiederholte s-Parameter", () => {
    expect(vergleichsHref([{ stadt: "a", slug: "b" }, { stadt: "c", slug: "d" }])).toBe(
      "/vergleich?s=a/b&s=c/d",
    );
  });

  it("hängt eine normalisierte Fokus-Klasse an", () => {
    expect(vergleichsHref([{ stadt: "a", slug: "b" }], "b")).toBe("/vergleich?s=a/b&klasse=B");
  });

  it("lässt ungültige Klassen weg", () => {
    expect(vergleichsHref([{ stadt: "a", slug: "b" }], "b/17?")).toBe("/vergleich?s=a/b");
  });

  it("lässt ungültige Refs defensiv weg", () => {
    expect(
      vergleichsHref([
        { stadt: "a", slug: "b" },
        { stadt: "Böse", slug: "x" },
      ]),
    ).toBe("/vergleich?s=a/b");
  });

  it("kappt bei MAX_VERGLEICH Refs", () => {
    const refs = ["a", "b", "c", "d", "e"].map((s) => ({ stadt: s, slug: s }));
    const href = vergleichsHref(refs);
    expect(href.match(/s=/g)).toHaveLength(MAX_VERGLEICH);
  });

  it("ohne Refs: nackte /vergleich-URL", () => {
    expect(vergleichsHref([])).toBe("/vergleich");
  });

  it("Roundtrip: parseVergleichsRefs(eigene URL-Params) ist verlustfrei", () => {
    const refs = [
      { stadt: "muenchen", slug: "fahrschule-isarpilot" },
      { stadt: "muenchen", slug: "fahrschule-drehmoment" },
    ];
    const params = new URLSearchParams(vergleichsHref(refs).split("?")[1]);
    expect(parseVergleichsRefs(params.getAll("s"))).toEqual(refs);
  });
});

describe("normalisiereKlasseWunsch", () => {
  it("trimmt und schreibt groß", () => {
    expect(normalisiereKlasseWunsch(" b ")).toBe("B");
    expect(normalisiereKlasseWunsch("a1")).toBe("A1");
  });

  it("null/undefined/leer/ungültig → null", () => {
    expect(normalisiereKlasseWunsch(null)).toBeNull();
    expect(normalisiereKlasseWunsch(undefined)).toBeNull();
    expect(normalisiereKlasseWunsch("")).toBeNull();
    expect(normalisiereKlasseWunsch("b/17?")).toBeNull();
    expect(normalisiereKlasseWunsch("X".repeat(13))).toBeNull();
  });
});

describe("sammleKlassen", () => {
  it("dedupliziert über Schulen und sortiert B zuerst", () => {
    const klassen = sammleKlassen([
      [row("A1"), row("B")],
      [row("B"), row("A")],
    ]);
    expect(klassen).toEqual(["B", "A", "A1"]);
  });

  it("leer bei leeren Preislisten", () => {
    expect(sammleKlassen([[], []])).toEqual([]);
  });
});

describe("waehleVergleichsKlasse (?klasse= → B → erste vollständige → erste)", () => {
  it("Wunsch gewinnt, wenn vorhanden", () => {
    expect(waehleVergleichsKlasse([[row("A")], [row("B")]], "a")).toBe("A");
  });

  it("fehlender Wunsch fällt auf B zurück", () => {
    expect(waehleVergleichsKlasse([[row("A")], [row("B")]], "CE")).toBe("B");
  });

  it("ohne B: erste Klasse, für die IRGENDEINE Schule das Pflicht-Set hat", () => {
    const unvollstaendigA = row("A", { grundbetrag: null });
    const vollstaendigA2 = row("A2");
    expect(waehleVergleichsKlasse([[unvollstaendigA], [vollstaendigA2]])).toBe("A2");
  });

  it("nirgends vollständig: erste vorhandene Klasse", () => {
    const kaputtA = row("A", { grundbetrag: null });
    const kaputtC = row("C", { fahrstunde45: null });
    expect(waehleVergleichsKlasse([[kaputtA], [kaputtC]])).toBe("A");
  });

  it("keine Preise → null", () => {
    expect(waehleVergleichsKlasse([[], []])).toBeNull();
  });
});

describe("fokusZeileFuerSchule", () => {
  it("liefert die Zeile der Fokus-Klasse", () => {
    const b = row("B");
    expect(fokusZeileFuerSchule([row("A"), b], "B")).toBe(b);
  });

  it("null ohne Fokus-Klasse oder ohne Treffer (Spalte bleibt neutral)", () => {
    expect(fokusZeileFuerSchule([row("A")], null)).toBeNull();
    expect(fokusZeileFuerSchule([row("A")], "B")).toBeNull();
  });
});

describe("baueVergleichsZeilen (§ 32: komponentenweise, keine Summen)", () => {
  it("exakt EINE Zeile je Aushang-Komponente, in Anlage-4-Reihenfolge", () => {
    const zeilen = baueVergleichsZeilen([row("B"), row("B")]);
    expect(zeilen.map((z) => z.key)).toEqual(PREIS_KOMPONENTEN.map((k) => k.key));
    expect(zeilen.map((z) => z.label)).toEqual(PREIS_KOMPONENTEN.map((k) => k.label));
  });

  it("keine synthetischen Zeilen (kein „Gesamt“, kein „ab“)", () => {
    const zeilen = baueVergleichsZeilen([row("B")]);
    expect(zeilen).toHaveLength(PREIS_KOMPONENTEN.length);
    for (const z of zeilen) expect(z.label).not.toMatch(/gesamt|summe|ab\s|zirka|ca\./i);
  });

  it("markiert den niedrigsten Wert je Zeile (nur dort)", () => {
    const zeilen = baueVergleichsZeilen([
      row("B", { grundbetrag: 400 }),
      row("B", { grundbetrag: 500 }),
    ]);
    const grund = zeilen.find((z) => z.key === "grundbetrag")!;
    expect(grund.zellen.map((c) => c.guenstigster)).toEqual([true, false]);
  });

  it("Gleichstand am Minimum markiert alle günstigsten Zellen", () => {
    const zeilen = baueVergleichsZeilen([
      row("B", { fahrstunde45: 60 }),
      row("B", { fahrstunde45: 60 }),
      row("B", { fahrstunde45: 70 }),
    ]);
    const fahrstunde = zeilen.find((z) => z.key === "fahrstunde45")!; // gitleaks:allow (Feldname)
    expect(fahrstunde.zellen.map((c) => c.guenstigster)).toEqual([true, true, false]);
  });

  it("markiert NICHT, wenn alle Angaben gleich sind (nichts hervorzuheben)", () => {
    const zeilen = baueVergleichsZeilen([row("B"), row("B")]);
    for (const z of zeilen) for (const c of z.zellen) expect(c.guenstigster).toBe(false);
  });

  it("markiert NICHT bei weniger als zwei Angaben", () => {
    const zeilen = baueVergleichsZeilen([row("B"), null]);
    for (const z of zeilen) for (const c of z.zellen) expect(c.guenstigster).toBe(false);
  });

  it("fehlende Angaben bleiben neutral null (nie benachteiligend markiert)", () => {
    const zeilen = baueVergleichsZeilen([
      row("B", { lehrmaterial: null }),
      row("B", { lehrmaterial: 79 }),
    ]);
    const lehr = zeilen.find((z) => z.key === "lehrmaterial")!;
    expect(lehr.zellen[0]).toEqual({ wert: null, guenstigster: false });
    // Einzige Angabe → keine Markierung (kein „günstigster“ ohne Vergleich).
    expect(lehr.zellen[1]).toEqual({ wert: 79, guenstigster: false });
  });

  it("null-Fokuszeile einer Schule ⇒ ganze Spalte „keine Angabe“", () => {
    const zeilen = baueVergleichsZeilen([null, row("B")]);
    for (const z of zeilen) expect(z.zellen[0].wert).toBeNull();
  });
});

describe("kein Gesamtpreis by design (M3 wie lib/preise)", () => {
  it("das Vergleichs-Modul exportiert KEINE Summen-/Gesamt-/Schätzfunktion", () => {
    for (const name of Object.keys(vergleichModul)) {
      expect(name).not.toMatch(/summe|gesamt|total|schaetz|estimat/i);
    }
  });
});
