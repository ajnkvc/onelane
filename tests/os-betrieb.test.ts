import { describe, expect, it, vi } from "vitest";

// os-betrieb.ts ist ein Server-Modul (server-only + DAL) — für die PUREN
// Helfer werden beide Nachbarn gemockt (Muster tests/shell-actions.test.ts).
vi.mock("server-only", () => ({}));
vi.mock("@/server/dal", () => ({ withCurrentUserContext: vi.fn() }));

import {
  jobStatusVon,
  minutenLabel,
  minutenVon,
  parseWochenParam,
  rasterFenster,
  spaltenLayout,
  verschiebeTage,
  wochenLabel,
} from "@/modules/portal/os-betrieb";

/**
 * os-betrieb.test.ts — pure Helfer der OS-Betriebs-Module (OS-P3 Paket B):
 * Wochen-Parameter/-Navigation, Raster-Geometrie (Fenster + Spur-Layout für
 * überlappende Termine), Job-Status und Zeit-Formatierung.
 */

describe("parseWochenParam", () => {
  it("akzeptiert gültige ISO-Daten", () => {
    expect(parseWochenParam("2026-07-06")).toBe("2026-07-06");
    expect(parseWochenParam("2026-01-01")).toBe("2026-01-01");
  });

  it("verwirft Format-Müll, fremde Typen und absurde Jahre", () => {
    expect(parseWochenParam("06.07.2026")).toBeNull();
    expect(parseWochenParam("2026-7-6")).toBeNull();
    expect(parseWochenParam("'; drop table--")).toBeNull();
    expect(parseWochenParam(undefined)).toBeNull();
    expect(parseWochenParam(["2026-07-06"])).toBeNull();
    expect(parseWochenParam("1999-01-01")).toBeNull();
    expect(parseWochenParam("2101-01-01")).toBeNull();
  });

  it("verwirft Kalender-Überläufe (2026-02-31 rollt NICHT weiter)", () => {
    expect(parseWochenParam("2026-02-31")).toBeNull();
    expect(parseWochenParam("2026-13-01")).toBeNull();
  });
});

describe("verschiebeTage / wochenLabel", () => {
  it("verschiebt über Monats- und Jahresgrenzen", () => {
    expect(verschiebeTage("2026-06-29", 7)).toBe("2026-07-06");
    expect(verschiebeTage("2026-06-29", -7)).toBe("2026-06-22");
    expect(verschiebeTage("2025-12-29", 7)).toBe("2026-01-05");
  });

  it("baut das Wochen-Label aus den Tages-ISO-Strings", () => {
    const tage = Array.from({ length: 7 }, (_, i) => verschiebeTage("2026-06-29", i));
    expect(wochenLabel(tage)).toBe("29.06. – 05.07.2026");
    expect(wochenLabel([])).toBe("");
  });
});

describe("minutenVon / minutenLabel", () => {
  it("parst HH:MM und verwirft Unfug", () => {
    expect(minutenVon("08:30")).toBe(510);
    expect(minutenVon("00:00")).toBe(0);
    expect(minutenVon("24:00")).toBeNull();
    expect(minutenVon("8:30")).toBeNull();
    expect(minutenVon(null)).toBeNull();
  });

  it("formatiert Minuten menschenlesbar", () => {
    expect(minutenLabel(0)).toBe("0 Min.");
    expect(minutenLabel(45)).toBe("45 Min.");
    expect(minutenLabel(60)).toBe("1 Std.");
    expect(minutenLabel(90)).toBe("1 Std. 30 Min.");
    expect(minutenLabel(-5)).toBe("0 Min.");
  });
});

describe("rasterFenster", () => {
  it("liefert den Standard 06:00–20:00 ohne Daten", () => {
    expect(rasterFenster([])).toEqual({ startMin: 360, endMin: 1200 });
  });

  it("erweitert auf volle Stunden, wenn Zeiten außerhalb liegen", () => {
    expect(rasterFenster([{ von: "05:15", bis: "07:00" }])).toEqual({
      startMin: 300,
      endMin: 1200,
    });
    expect(rasterFenster([{ von: "21:30", bis: "22:15" }])).toEqual({
      startMin: 360,
      endMin: 1380,
    });
  });

  it("klappt Über-Mitternacht-Blöcke ans Tagesende (24:00-Kante)", () => {
    expect(rasterFenster([{ von: "23:00", bis: "00:30" }]).endMin).toBe(1440);
  });
});

describe("spaltenLayout", () => {
  it("gibt getrennten Blöcken die volle Breite", () => {
    expect(
      spaltenLayout([
        { vonMin: 0, bisMin: 30 },
        { vonMin: 40, bisMin: 70 },
      ]),
    ).toEqual([
      { spur: 0, spuren: 1 },
      { spur: 0, spuren: 1 },
    ]);
  });

  it("teilt überlappende Blöcke in Spuren", () => {
    expect(
      spaltenLayout([
        { vonMin: 0, bisMin: 60 },
        { vonMin: 30, bisMin: 90 },
      ]),
    ).toEqual([
      { spur: 0, spuren: 2 },
      { spur: 1, spuren: 2 },
    ]);
  });

  it("verkettete Überlappungen bilden EINE Gruppe, Spuren werden wiederverwendet", () => {
    // A(0–60) ∩ B(30–90); C(70–120) ∩ B, aber nicht A → C erbt Spur 0.
    expect(
      spaltenLayout([
        { vonMin: 0, bisMin: 60 },
        { vonMin: 30, bisMin: 90 },
        { vonMin: 70, bisMin: 120 },
      ]),
    ).toEqual([
      { spur: 0, spuren: 2 },
      { spur: 1, spuren: 2 },
      { spur: 0, spuren: 2 },
    ]);
  });

  it("bewahrt die Eingabe-Reihenfolge auch bei unsortierter Eingabe", () => {
    const plaetze = spaltenLayout([
      { vonMin: 30, bisMin: 90 },
      { vonMin: 0, bisMin: 60 },
    ]);
    expect(plaetze[1]).toEqual({ spur: 0, spuren: 2 }); // früherer Block → Spur 0
    expect(plaetze[0]).toEqual({ spur: 1, spuren: 2 });
  });
});

describe("jobStatusVon", () => {
  const heute = "2026-07-03";
  it("leitet den Anzeigen-Status aus aktiv + gueltig_bis ab", () => {
    expect(jobStatusVon(true, null, heute)).toBe("aktiv");
    expect(jobStatusVon(true, "2026-07-03", heute)).toBe("aktiv");
    expect(jobStatusVon(true, "2026-07-02", heute)).toBe("abgelaufen");
    expect(jobStatusVon(false, "2026-12-31", heute)).toBe("deaktiviert");
  });
});
