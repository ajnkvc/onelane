import { describe, it, expect, vi } from "vitest";

// server-only + DAL als No-op mocken (Muster tests/insights.test.ts /
// tests/shell-actions.test.ts) — hier werden NUR die puren Helfer getestet;
// die RLS-Lesepfade selbst sind über tests/rls/* abgedeckt.
vi.mock("server-only", () => ({}));
vi.mock("@/server/dal", () => ({ withCurrentUserContext: vi.fn() }));

import {
  baueTerminCursor,
  parseTerminCursor,
  normalisiereFortschritt,
  erzeugeRedaktionsBriefings,
  FORTSCHRITT_TYPEN,
} from "@/modules/portal/bereiche";
import { RATGEBER_GUIDES } from "@/lib/ratgeber";

/**
 * portal-bereiche.test.ts — pure Helfer der Bereichs-Module (OS-P3, Paket D):
 *  - Termin-Cursor: Roundtrip + fail-closed Parsen (Manipulation ⇒ Seite 1).
 *  - Fortschritt-Normalisierung: feste Typ-Reihenfolge, 0-Defaults, Verwerfen
 *    fremder/negativer Werte.
 *  - Redaktions-Briefings: deterministisch, PII-frei, nur ungedeckte Kategorien.
 */

const UUID = "8ee145dc-e64c-4c42-ad2e-bbc4bdaf22d2";

describe("Termin-Cursor (Keyset-Pagination)", () => {
  it("Roundtrip: bauen ⇒ parsen liefert identische Werte", () => {
    const cursor = baueTerminCursor(1751490000000, UUID);
    expect(parseTerminCursor(cursor)).toEqual({ startMs: 1751490000000, id: UUID });
  });

  it("fail-closed: ungültige Formate ergeben null (Liste beginnt vorn)", () => {
    for (const wert of [
      undefined,
      null,
      "",
      "v1",
      `v2.123.${UUID}`, // fremde Version
      `v1.abc.${UUID}`, // keine Zahl
      `v1.-5.${UUID}`, // negativ
      "v1.123.nicht-eine-uuid",
      `v1.123.${UUID}.extra`,
      `v1.999999999999999999999.${UUID}`, // kein sicherer Integer
      "'; drop table appointments; --",
    ]) {
      expect(parseTerminCursor(wert)).toBeNull();
    }
  });

  it("nur Kleinbuchstaben-UUIDs der Allowlist-Form passieren", () => {
    expect(parseTerminCursor(`v1.1.${UUID.toUpperCase()}`)).toBeNull();
  });
});

describe("normalisiereFortschritt", () => {
  it("liefert IMMER alle Typen in fester Reihenfolge (fehlende = 0)", () => {
    const ergebnis = normalisiereFortschritt([{ typ: "fahrstunde", anzahl: 3 }]);
    expect(ergebnis.map((e) => e.typ)).toEqual([...FORTSCHRITT_TYPEN]);
    expect(ergebnis[0]).toEqual({ typ: "fahrstunde", absolviert: 3 });
    expect(ergebnis.slice(1).every((e) => e.absolviert === 0)).toBe(true);
  });

  it("verwirft fremde Typen und ungültige Werte", () => {
    const ergebnis = normalisiereFortschritt([
      { typ: "fahrstunde", anzahl: "2" }, // String-Zahl (Treiber) ist ok
      { typ: "theorie", anzahl: -1 }, // negativ ⇒ verworfen (0)
      { typ: "unbekannt", anzahl: 99 }, // fremder Typ ⇒ ignoriert
      { typ: 42, anzahl: 1 }, // kaputter Typ ⇒ ignoriert
    ]);
    expect(ergebnis.find((e) => e.typ === "fahrstunde")?.absolviert).toBe(2);
    expect(ergebnis.find((e) => e.typ === "theorie")?.absolviert).toBe(0);
    expect(ergebnis.reduce((s, e) => s + e.absolviert, 0)).toBe(2);
  });
});

describe("erzeugeRedaktionsBriefings", () => {
  it("liefert für den echten Registry-Stand genau 3 Vorschläge", () => {
    expect(erzeugeRedaktionsBriefings(RATGEBER_GUIDES)).toHaveLength(3);
  });

  it("deterministisch: gleicher Registry-Stand ⇒ identisches Ergebnis", () => {
    const a = erzeugeRedaktionsBriefings(RATGEBER_GUIDES);
    const b = erzeugeRedaktionsBriefings(RATGEBER_GUIDES);
    expect(a).toEqual(b);
  });

  it("schlägt KEINE bereits vertretene Kategorie und keinen bestehenden Slug vor", () => {
    const kategorien = new Set(RATGEBER_GUIDES.map((g) => g.kategorie));
    const slugs = new Set(RATGEBER_GUIDES.map((g) => g.slug));
    for (const briefing of erzeugeRedaktionsBriefings(RATGEBER_GUIDES)) {
      expect(kategorien.has(briefing.kategorie)).toBe(false);
      expect(slugs.has(briefing.schluessel)).toBe(false);
    }
  });

  it("gedeckte Kategorien fallen raus (Vorschläge rücken nach)", () => {
    const basis = erzeugeRedaktionsBriefings([]);
    const gedeckt = erzeugeRedaktionsBriefings([
      { slug: "x", kategorie: basis[0].kategorie },
    ]);
    expect(gedeckt.map((b) => b.schluessel)).not.toContain(basis[0].schluessel);
    expect(gedeckt).toHaveLength(3);
  });

  it("PII-frei und vollständig: statische Texte, drei Gliederungspunkte, Begründung aus Aggregat", () => {
    for (const briefing of erzeugeRedaktionsBriefings(RATGEBER_GUIDES)) {
      const texte = [
        briefing.arbeitstitel,
        briefing.begruendung,
        briefing.kategorie,
        ...briefing.gliederung,
      ];
      expect(briefing.gliederung).toHaveLength(3);
      for (const text of texte) {
        expect(text.length).toBeGreaterThan(0);
        expect(text).not.toMatch(/@/); // keine E-Mail-Adressen
        expect(text).not.toMatch(/\b\d{4,}\b/); // keine Telefon-/ID-Nummern
      }
      expect(briefing.begruendung).toContain(String(RATGEBER_GUIDES.length));
    }
  });

  it("Vertraulichkeits-Sweep: kein pay/buchung/booking in Briefing-Texten", () => {
    const alles = JSON.stringify(erzeugeRedaktionsBriefings([])).toLowerCase();
    expect(alles).not.toContain("pay");
    expect(alles).not.toContain("buchung");
    expect(alles).not.toContain("booking");
  });
});
