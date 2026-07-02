import { describe, it, expect } from "vitest";
import {
  leadEingabeSchema,
  zeitfalleBestanden,
  MIN_AUSFUELL_MS,
  MAX_FORMULAR_ALTER_MS,
  KLASSE_REGEX,
  TELEFON_REGEX,
} from "@/modules/leads/schema";

/**
 * leads-schema.test.ts — Zod-Grenze des Anmelde-Funnels (src/modules/leads/schema.ts).
 * Sichert die fachlichen Gates VOR dem anonymen Schreibpfad (Migration 0022):
 * Kontakt-Mindestregel, U18-Guardian-Gate, Größen-Caps, Honeypot, Zeitfalle,
 * Verwerfen unbekannter Felder.
 */

const gueltig = () => ({
  klasse: "B",
  zeitraum: "sofort",
  vorname: "Anna",
  nachname: "Muster",
  email: "anna@example.org",
  telefon: "",
  nachricht: "Ich möchte im August anfangen.",
  istMinderjaehrig: false,
  guardianName: "",
  guardianEmail: "",
  guardianTelefon: "",
  rueckruf: "abends",
  datenschutz: true,
  weitergabe: true,
  website: "",
});

describe("leadEingabeSchema — Grundfälle", () => {
  it("akzeptiert eine vollständige, gültige Eingabe", () => {
    const r = leadEingabeSchema.safeParse(gueltig());
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.vorname).toBe("Anna");
      expect(r.data.telefon).toBeUndefined(); // leer → undefined normalisiert
    }
  });

  it("strippt unbekannte Felder (z. B. eingeschleustes school_id)", () => {
    const r = leadEingabeSchema.safeParse({ ...gueltig(), school_id: "boese-uuid", status: "erledigt" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect("school_id" in r.data).toBe(false);
      expect("status" in r.data).toBe(false);
    }
  });

  it("lehnt ungültige Klasse und ungültigen Zeitraum ab", () => {
    expect(leadEingabeSchema.safeParse({ ...gueltig(), klasse: "b17!" }).success).toBe(false);
    expect(leadEingabeSchema.safeParse({ ...gueltig(), zeitraum: "irgendwann" }).success).toBe(false);
  });

  it("verlangt beide Einwilligungen (Datenschutz + Weitergabe)", () => {
    expect(leadEingabeSchema.safeParse({ ...gueltig(), datenschutz: false }).success).toBe(false);
    expect(leadEingabeSchema.safeParse({ ...gueltig(), weitergabe: false }).success).toBe(false);
  });
});

describe("Kontakt-Mindestregel (E-Mail ODER Telefon)", () => {
  it("lehnt ab, wenn weder E-Mail noch Telefon angegeben ist", () => {
    const r = leadEingabeSchema.safeParse({ ...gueltig(), email: "", telefon: "" });
    expect(r.success).toBe(false);
  });

  it("akzeptiert nur Telefon (ohne E-Mail)", () => {
    const r = leadEingabeSchema.safeParse({ ...gueltig(), email: "", telefon: "+49 89 1234567" });
    expect(r.success).toBe(true);
  });

  it("lehnt unbrauchbare Telefonformate ab (DB-Regex-Spiegel)", () => {
    expect(TELEFON_REGEX.test("+49 89 1234567")).toBe(true);
    expect(leadEingabeSchema.safeParse({ ...gueltig(), email: "", telefon: "ruf mich an" }).success).toBe(false);
  });
});

describe("U18-Guardian-Gate", () => {
  it("U18 ohne Guardian-Angaben wird abgelehnt", () => {
    const r = leadEingabeSchema.safeParse({ ...gueltig(), istMinderjaehrig: true });
    expect(r.success).toBe(false);
  });

  it("U18 mit Guardian-Name, aber ohne Guardian-Kontakt wird abgelehnt", () => {
    const r = leadEingabeSchema.safeParse({
      ...gueltig(),
      istMinderjaehrig: true,
      guardianName: "Petra Muster",
    });
    expect(r.success).toBe(false);
  });

  it("U18 mit Guardian-Name + Telefon ist gültig", () => {
    const r = leadEingabeSchema.safeParse({
      ...gueltig(),
      istMinderjaehrig: true,
      guardianName: "Petra Muster",
      guardianTelefon: "089 7654321",
    });
    expect(r.success).toBe(true);
  });

  it("volljährig: Guardian-Felder bleiben optional/leer", () => {
    expect(leadEingabeSchema.safeParse(gueltig()).success).toBe(true);
  });
});

describe("Größen-Caps", () => {
  it("Nachricht über 2000 Zeichen wird abgelehnt", () => {
    const r = leadEingabeSchema.safeParse({ ...gueltig(), nachricht: "x".repeat(2001) });
    expect(r.success).toBe(false);
  });

  it("Nachricht unter 2000 Zeichen, aber über dem BYTE-Cap wird abgelehnt (Multibyte)", () => {
    // 1500 × „🚗" (4 Bytes) = 6000 Bytes > 3800 — Zeichen-Cap allein reicht nicht.
    const r = leadEingabeSchema.safeParse({ ...gueltig(), nachricht: "🚗".repeat(1500) });
    expect(r.success).toBe(false);
  });

  it("Vorname: min. 2, max. 100 Zeichen", () => {
    expect(leadEingabeSchema.safeParse({ ...gueltig(), vorname: "A" }).success).toBe(false);
    expect(leadEingabeSchema.safeParse({ ...gueltig(), vorname: "A".repeat(101) }).success).toBe(false);
  });

  it("Klasse-Regex spiegelt den DB-CHECK", () => {
    expect(KLASSE_REGEX.test("B")).toBe(true);
    expect(KLASSE_REGEX.test("A1")).toBe(true);
    expect(KLASSE_REGEX.test("b")).toBe(false);
    expect(KLASSE_REGEX.test("LANGEKLASSE")).toBe(false);
  });
});

describe("Anti-Bot: Honeypot + Zeitfalle", () => {
  it("gefülltes Honeypot-Feld `website` wird abgelehnt", () => {
    const r = leadEingabeSchema.safeParse({ ...gueltig(), website: "https://spam.example" });
    expect(r.success).toBe(false);
  });

  it("Zeitfalle: unter 3 s Ausfüllzeit fällt durch", () => {
    const now = 1_750_000_000_000;
    expect(zeitfalleBestanden(String(now - 1_000), now)).toBe(false);
    expect(zeitfalleBestanden(String(now - MIN_AUSFUELL_MS), now)).toBe(true);
  });

  it("Zeitfalle: fehlender/kaputter/zukünftiger Timestamp fällt durch", () => {
    const now = 1_750_000_000_000;
    expect(zeitfalleBestanden("", now)).toBe(false);
    expect(zeitfalleBestanden("abc", now)).toBe(false);
    expect(zeitfalleBestanden(undefined, now)).toBe(false);
    expect(zeitfalleBestanden(String(now + 60_000), now)).toBe(false);
  });

  it("Zeitfalle: abgestandene Formulare (> 24 h) fallen durch (Replay-Schutz)", () => {
    const now = 1_750_000_000_000;
    expect(zeitfalleBestanden(String(now - MAX_FORMULAR_ALTER_MS - 1), now)).toBe(false);
  });
});
