import { describe, it, expect } from "vitest";
import { begruessung, datumZeile } from "@/lib/begruessung";

/** Zeitabhängige Begrüßung + Datumszeile (OS-P2, TZ-fest Europe/Berlin). */

// 2026-07-15 ist MESZ (UTC+2): UTC-Stunde + 2 = Berlin-Stunde.
const utc = (stunde: number) => new Date(Date.UTC(2026, 6, 15, stunde, 0, 0));

describe("begruessung (Europe/Berlin)", () => {
  it("Morgen: 05:00–10:59 Berlin", () => {
    expect(begruessung(utc(3))).toBe("Guten Morgen"); // 05:00 Berlin
    expect(begruessung(utc(8))).toBe("Guten Morgen"); // 10:00 Berlin
  });

  it("Tag: 11:00–17:59 Berlin", () => {
    expect(begruessung(utc(9))).toBe("Guten Tag"); // 11:00 Berlin
    expect(begruessung(utc(15))).toBe("Guten Tag"); // 17:00 Berlin
  });

  it("Abend: ab 18:00 Berlin und nachts vor 5", () => {
    expect(begruessung(utc(16))).toBe("Guten Abend"); // 18:00 Berlin
    expect(begruessung(utc(22))).toBe("Guten Abend"); // 00:00 Berlin (Folgetag)
    expect(begruessung(utc(1))).toBe("Guten Abend"); // 03:00 Berlin
  });

  it("Grenze ist TZ-fest: 23:30 UTC = 01:30 Berlin ⇒ Abend", () => {
    expect(begruessung(new Date(Date.UTC(2026, 6, 15, 23, 30)))).toBe("Guten Abend");
  });
});

describe("datumZeile", () => {
  it("formatiert de-DE mit Wochentag in Europe/Berlin", () => {
    // 2026-07-15 22:30 UTC = 16.07.2026 00:30 Berlin (Datumssprung!)
    expect(datumZeile(new Date(Date.UTC(2026, 6, 15, 22, 30)))).toBe(
      "Donnerstag, 16. Juli 2026",
    );
    expect(datumZeile(utc(10))).toBe("Mittwoch, 15. Juli 2026");
  });
});
