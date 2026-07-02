import { describe, it, expect } from "vitest";
import {
  openingStatus,
  naechsteTheorie,
  wochenraster,
  minuteDerWoche,
  wochentagVon,
  type ZeitenRow,
} from "@/lib/zeiten";

/**
 * zeiten.test.ts — deterministische Tests der reinen Zeit-Helfer (src/lib/zeiten.ts).
 * Alle Zeitpunkte sind FESTE Instants (UTC), die Umrechnung nach Europe/Berlin
 * läuft über Intl — inklusive DST-Kante (Sommerzeit-Beginn 2026-03-29).
 * Konvention: wochentag 0 = Montag … 6 = Sonntag.
 */

const buero = (wochentag: number, von: string, bis: string): ZeitenRow => ({
  art: "buero",
  wochentag,
  von,
  bis,
});
const theorie = (wochentag: number, von: string, bis: string): ZeitenRow => ({
  art: "theorie",
  wochentag,
  von,
  bis,
});

// Standard-Woche: Büro Mo–Fr 09:00–18:00, Theorie Mi + Fr 19:00–20:30.
const woche: ZeitenRow[] = [
  ...[0, 1, 2, 3, 4].map((d) => buero(d, "09:00:00", "18:00:00")),
  theorie(2, "19:00:00", "20:30:00"),
  theorie(4, "19:00:00", "20:30:00"),
];

// Fixe Instants (Juli 2026 = CEST, UTC+2). 2026-07-01 ist ein Mittwoch.
const MI_1500_BERLIN = new Date("2026-07-01T13:00:00Z"); // Mi 15:00
const MI_1730_BERLIN = new Date("2026-07-01T15:30:00Z"); // Mi 17:30
const MI_2200_BERLIN = new Date("2026-07-01T20:00:00Z"); // Mi 22:00
const MI_0830_BERLIN = new Date("2026-07-01T06:30:00Z"); // Mi 08:30
const SA_1200_BERLIN = new Date("2026-07-04T10:00:00Z"); // Sa 12:00

describe("minuteDerWoche (Intl-basierte TZ-Umrechnung)", () => {
  it("rechnet UTC-Instants korrekt nach Europe/Berlin um (CEST, UTC+2)", () => {
    // Mi (Index 2) 15:00 → 2*1440 + 15*60 = 3780
    expect(minuteDerWoche(MI_1500_BERLIN, "Europe/Berlin")).toBe(2 * 1440 + 15 * 60);
  });

  it("DST-Kante: 2026-03-29 01:30Z ist bereits 03:30 CEST (Stunde 02–03 übersprungen)", () => {
    // 2026-03-29 ist ein Sonntag (Index 6); um 01:00Z springt die Uhr 02:00→03:00.
    expect(minuteDerWoche(new Date("2026-03-29T01:30:00Z"), "Europe/Berlin")).toBe(
      6 * 1440 + 3 * 60 + 30,
    );
    // Kurz VOR der Umstellung gilt noch CET (UTC+1): 00:59Z = 01:59 lokal.
    expect(minuteDerWoche(new Date("2026-03-29T00:59:00Z"), "Europe/Berlin")).toBe(
      6 * 1440 + 1 * 60 + 59,
    );
  });

  it("wochentagVon liefert den lokalen Wochentag (0=Mo)", () => {
    expect(wochentagVon(MI_1500_BERLIN)).toBe(2);
    expect(wochentagVon(SA_1200_BERLIN)).toBe(5);
  });
});

describe("openingStatus", () => {
  it("mitten in der Büro-Zeit: geoeffnet mit bis-Label", () => {
    expect(openingStatus(woche, MI_1500_BERLIN)).toEqual({
      status: "geoeffnet",
      label: "Jetzt geöffnet · bis 18:00",
    });
  });

  it("30 Minuten vor Schluss: schliesst_bald (Schwelle 60 min)", () => {
    expect(openingStatus(woche, MI_1730_BERLIN)).toEqual({
      status: "schliesst_bald",
      label: "Schließt bald · 18:00",
    });
  });

  it("abends geschlossen: nennt die nächste Öffnung (morgen)", () => {
    expect(openingStatus(woche, MI_2200_BERLIN)).toEqual({
      status: "geschlossen",
      label: "Geschlossen · Öffnet morgen 09:00",
    });
  });

  it("30 Minuten vor Öffnung: oeffnet_bald", () => {
    expect(openingStatus(woche, MI_0830_BERLIN)).toEqual({
      status: "oeffnet_bald",
      label: "Öffnet um 09:00",
    });
  });

  it("Wochenende: geschlossen mit Kurz-Wochentag der nächsten Öffnung", () => {
    expect(openingStatus(woche, SA_1200_BERLIN)).toEqual({
      status: "geschlossen",
      label: "Geschlossen · Öffnet Mo 09:00",
    });
  });

  it("Mitternachts-Block (Fr 22:00–02:00): Samstag 01:00 ist noch offen (schließt bald)", () => {
    const rows = [buero(4, "22:00", "02:00")];
    const sa0100 = new Date("2026-07-03T23:00:00Z"); // Sa 01:00 Berlin
    expect(openingStatus(rows, sa0100)).toEqual({
      status: "schliesst_bald",
      label: "Schließt bald · 02:00",
    });
  });

  it("Wochen-Überlauf (So 22:00–01:00): Montag 00:30 ist noch offen", () => {
    const rows = [buero(6, "22:00", "01:00")];
    const mo0030 = new Date("2026-07-05T22:30:00Z"); // Mo 00:30 Berlin (So 22:30 UTC → Mo)
    const s = openingStatus(rows, mo0030);
    expect(s?.status).toBe("schliesst_bald");
  });

  it("Mittagspause: zwei Blöcke am selben Tag werden getrennt bewertet", () => {
    const rows = [buero(2, "09:00", "12:00"), buero(2, "14:00", "18:00")];
    const mi1300 = new Date("2026-07-01T11:00:00Z"); // Mi 13:00 Berlin — Pause
    expect(openingStatus(rows, mi1300)).toEqual({
      status: "oeffnet_bald",
      label: "Öffnet um 14:00",
    });
    expect(openingStatus(rows, MI_1500_BERLIN)?.status).toBe("geoeffnet");
  });

  it("ohne Büro-Zeilen: null (UI zeigt keinen Status)", () => {
    expect(openingStatus([theorie(2, "19:00", "20:30")], MI_1500_BERLIN)).toBeNull();
    expect(openingStatus([], MI_1500_BERLIN)).toBeNull();
  });

  it("ignoriert unbrauchbare Zeilen (kaputte Zeiten, Wochentag außerhalb 0–6)", () => {
    const rows: ZeitenRow[] = [
      { art: "buero", wochentag: 9, von: "09:00", bis: "18:00" },
      { art: "buero", wochentag: 2, von: "kaputt", bis: "18:00" },
    ];
    expect(openingStatus(rows, MI_1500_BERLIN)).toBeNull();
  });
});

describe("naechsteTheorie", () => {
  it("liefert die nächsten Termine chronologisch mit heute/morgen/Kurztag", () => {
    // Mi 15:00 → heute 19:00 (Mi), dann Fr, dann wieder Mi.
    expect(naechsteTheorie(woche, MI_1500_BERLIN)).toEqual([
      { tagLabel: "heute", von: "19:00", bis: "20:30" },
      { tagLabel: "Fr", von: "19:00", bis: "20:30" },
      { tagLabel: "Mi", von: "19:00", bis: "20:30" },
    ]);
  });

  it("morgen-Label, wenn der nächste Termin am Folgetag liegt", () => {
    const di = new Date("2026-06-30T13:00:00Z"); // Di 15:00 Berlin → Mi = morgen
    expect(naechsteTheorie(woche, di, 1)).toEqual([
      { tagLabel: "morgen", von: "19:00", bis: "20:30" },
    ]);
  });

  it("bereits begonnene Termine zählen nicht mehr als naechste", () => {
    const mi1930 = new Date("2026-07-01T17:30:00Z"); // Mi 19:30 — Termin läuft
    expect(naechsteTheorie(woche, mi1930, 1)[0]).toEqual({
      tagLabel: "Fr",
      von: "19:00",
      bis: "20:30",
    });
  });

  it("respektiert anzahl und leere Eingabe", () => {
    expect(naechsteTheorie(woche, MI_1500_BERLIN, 2)).toHaveLength(2);
    expect(naechsteTheorie([], MI_1500_BERLIN)).toEqual([]);
  });
});

describe("wochenraster", () => {
  it("liefert immer 7 Spalten Mo–So in fester Reihenfolge", () => {
    const raster = wochenraster(woche);
    expect(raster).toHaveLength(7);
    expect(raster.map((t) => t.label)).toEqual(["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]);
    expect(raster[5].bloecke).toEqual([]); // Samstag leer
  });

  it("sortiert Blöcke eines Tags nach Startzeit und trägt Balken-Geometrie", () => {
    const raster = wochenraster(woche);
    const mi = raster[2];
    expect(mi.bloecke).toEqual([
      { art: "buero", von: "09:00", bis: "18:00", startMin: 540, endMin: 1080 },
      { art: "theorie", von: "19:00", bis: "20:30", startMin: 1140, endMin: 1230 },
    ]);
  });

  it("teilt Mitternachts-Blöcke auf zwei Spalten auf (24:00 / 00:00)", () => {
    const raster = wochenraster([buero(4, "22:00", "02:00")]);
    expect(raster[4].bloecke).toEqual([
      { art: "buero", von: "22:00", bis: "24:00", startMin: 1320, endMin: 1440 },
    ]);
    expect(raster[5].bloecke).toEqual([
      { art: "buero", von: "00:00", bis: "02:00", startMin: 0, endMin: 120 },
    ]);
  });

  it("So→Mo-Überlauf landet in der Montags-Spalte", () => {
    const raster = wochenraster([buero(6, "22:00", "01:00")]);
    expect(raster[6].bloecke[0]).toMatchObject({ von: "22:00", bis: "24:00" });
    expect(raster[0].bloecke[0]).toMatchObject({ von: "00:00", bis: "01:00" });
  });
});
