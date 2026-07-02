import { describe, it, expect } from "vitest";
import {
  bewerbungEingabeSchema,
  zeitfalleBestanden,
  MIN_AUSFUELL_MS,
  JOB_KLASSEN,
  MAX_CV_BYTES,
  MAX_FOTO_BYTES,
  dateinameSanitisieren,
  pruefeCvDatei,
  pruefeFotoDatei,
} from "@/modules/jobs/schema";

/**
 * jobs-schema.test.ts — Zod-Grenze + Datei-Prüfer des Bewerbungs-Funnels
 * (src/modules/jobs/schema.ts). Sichert die fachlichen Gates VOR dem anonymen
 * Schreibpfad (Migration 0025): Status-/Klassen-Allowlist, Verfügbarkeits-
 * Kopplung, Einwilligungen, Honeypot/Zeitfalle (wiederverwendet aus leads)
 * sowie Magic-Bytes/Größen/Dateinamen-Sanitisierung der Durchleitungs-Dateien.
 */

const gueltig = () => ({
  name: "Alex Muster",
  email: "alex@example.org",
  telefon: "",
  bewerberStatus: "fahrlehrer",
  klassen: ["B", "BE"],
  verfuegbarStatus: "sofort",
  verfuegbarAb: "",
  nachricht: "Ich habe fünf Jahre Erfahrung.",
  datenschutz: true,
  weitergabe: true,
  website: "",
});

describe("bewerbungEingabeSchema — Grundfälle", () => {
  it("akzeptiert eine vollständige, gültige Eingabe", () => {
    const r = bewerbungEingabeSchema.safeParse(gueltig());
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.name).toBe("Alex Muster");
      expect(r.data.telefon).toBeUndefined();
      expect(r.data.klassen).toEqual(["B", "BE"]);
    }
  });

  it("strippt unbekannte Felder (z. B. eingeschleustes job_id/status)", () => {
    const r = bewerbungEingabeSchema.safeParse({
      ...gueltig(),
      job_id: "boese-uuid",
      status: "erledigt",
      gehalt_bisher: "3000", // Gehaltshistorie wird NIE abgefragt/akzeptiert
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect("job_id" in r.data).toBe(false);
      expect("status" in r.data).toBe(false);
      expect("gehalt_bisher" in r.data).toBe(false);
    }
  });

  it("E-Mail ist PFLICHT (anders als beim Anmelde-Lead)", () => {
    expect(bewerbungEingabeSchema.safeParse({ ...gueltig(), email: "" }).success).toBe(false);
    expect(bewerbungEingabeSchema.safeParse({ ...gueltig(), email: "keine-mail" }).success).toBe(false);
  });

  it("bewerber_status: nur die drei UI-Werte ('unbekannt' ist nicht wählbar)", () => {
    for (const ok of ["fahrlehrer", "anwaerter", "quereinsteiger"]) {
      expect(bewerbungEingabeSchema.safeParse({ ...gueltig(), bewerberStatus: ok }).success).toBe(true);
    }
    expect(bewerbungEingabeSchema.safeParse({ ...gueltig(), bewerberStatus: "unbekannt" }).success).toBe(false);
    expect(bewerbungEingabeSchema.safeParse({ ...gueltig(), bewerberStatus: "chef" }).success).toBe(false);
  });

  it("klassen: Allowlist, max. 12, keine Duplikate", () => {
    expect(bewerbungEingabeSchema.safeParse({ ...gueltig(), klassen: ["XY"] }).success).toBe(false);
    expect(bewerbungEingabeSchema.safeParse({ ...gueltig(), klassen: ["B", "B"] }).success).toBe(false);
    expect(
      bewerbungEingabeSchema.safeParse({ ...gueltig(), klassen: [...JOB_KLASSEN].slice(0, 13) }).success,
    ).toBe(false);
    expect(bewerbungEingabeSchema.safeParse({ ...gueltig(), klassen: [] }).success).toBe(true);
  });

  it("verlangt beide Einwilligungen (Datenschutz + Weitergabe der Unterlagen)", () => {
    expect(bewerbungEingabeSchema.safeParse({ ...gueltig(), datenschutz: false }).success).toBe(false);
    expect(bewerbungEingabeSchema.safeParse({ ...gueltig(), weitergabe: false }).success).toBe(false);
  });

  it("Honeypot `website` muss leer sein", () => {
    expect(
      bewerbungEingabeSchema.safeParse({ ...gueltig(), website: "https://spam.example" }).success,
    ).toBe(false);
  });
});

describe("Verfügbarkeit — Datum genau dann, wenn 'zum_datum'", () => {
  it("'zum_datum' ohne Datum wird abgelehnt", () => {
    const r = bewerbungEingabeSchema.safeParse({ ...gueltig(), verfuegbarStatus: "zum_datum" });
    expect(r.success).toBe(false);
  });

  it("'zum_datum' mit gültigem ISO-Datum ist gültig", () => {
    const r = bewerbungEingabeSchema.safeParse({
      ...gueltig(),
      verfuegbarStatus: "zum_datum",
      verfuegbarAb: "2027-01-01",
    });
    expect(r.success).toBe(true);
  });

  it("Datum ohne 'zum_datum' wird abgelehnt (Spiegel des DB-CHECKs)", () => {
    const r = bewerbungEingabeSchema.safeParse({ ...gueltig(), verfuegbarAb: "2027-01-01" });
    expect(r.success).toBe(false);
  });

  it("nicht existierende Kalendertage werden abgelehnt", () => {
    const r = bewerbungEingabeSchema.safeParse({
      ...gueltig(),
      verfuegbarStatus: "zum_datum",
      verfuegbarAb: "2027-02-30",
    });
    expect(r.success).toBe(false);
  });
});

describe("Größen-Caps + Zeitfalle (wiederverwendet)", () => {
  it("Nachricht: Zeichen- und BYTE-Cap (Multibyte)", () => {
    expect(bewerbungEingabeSchema.safeParse({ ...gueltig(), nachricht: "x".repeat(2001) }).success).toBe(false);
    expect(bewerbungEingabeSchema.safeParse({ ...gueltig(), nachricht: "🚗".repeat(1500) }).success).toBe(false);
  });

  it("Zeitfalle ist identisch zur Leads-Semantik nutzbar", () => {
    const now = 1_750_000_000_000;
    expect(zeitfalleBestanden(String(now - 1_000), now)).toBe(false);
    expect(zeitfalleBestanden(String(now - MIN_AUSFUELL_MS), now)).toBe(true);
  });
});

// ----------------------------------------------------------------------------
// Datei-Prüfer (Durchleitungs-Prinzip)
// ----------------------------------------------------------------------------
const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);
const DOCX = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]);
const DOC = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
const TEXT = new Uint8Array([0x68, 0x61, 0x6c, 0x6c, 0x6f, 0x21, 0x21, 0x21]);

describe("Datei-Prüfer — CV (Pflicht: PDF/DOC/DOCX ≤ 5 MB)", () => {
  it("akzeptiert PDF/DOCX/DOC mit passendem MIME + Magic-Bytes", () => {
    expect(pruefeCvDatei("cv.pdf", "application/pdf", 1000, PDF).ok).toBe(true);
    expect(
      pruefeCvDatei(
        "cv.docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        1000,
        DOCX,
      ).ok,
    ).toBe(true);
    expect(pruefeCvDatei("cv.doc", "application/msword", 1000, DOC).ok).toBe(true);
  });

  it("lehnt MIME-Lügen ab (PDF-MIME, aber Text-/Bild-Inhalt)", () => {
    expect(pruefeCvDatei("cv.pdf", "application/pdf", 1000, TEXT).ok).toBe(false);
    expect(pruefeCvDatei("cv.pdf", "application/pdf", 1000, JPEG).ok).toBe(false);
  });

  it("lehnt fremde MIME-Typen und Über-/Nullgrößen ab", () => {
    expect(pruefeCvDatei("cv.exe", "application/x-msdownload", 1000, PDF).ok).toBe(false);
    expect(pruefeCvDatei("cv.pdf", "application/pdf", MAX_CV_BYTES + 1, PDF).ok).toBe(false);
    expect(pruefeCvDatei("cv.pdf", "application/pdf", 0, PDF).ok).toBe(false);
  });

  it("sanitisiert den Dateinamen (Pfade/Umlaute/Sonderzeichen)", () => {
    const r = pruefeCvDatei("../../Lebenslauf Müller (final).pdf", "application/pdf", 1000, PDF);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.dateiname).toMatch(/^[A-Za-z0-9._-]{1,120}$/);
      expect(r.dateiname).not.toContain("/");
    }
  });
});

describe("Datei-Prüfer — Foto (freiwillig: JPG/PNG/WebP ≤ 3 MB)", () => {
  it("akzeptiert JPEG/PNG/WebP mit passendem MIME + Magic-Bytes", () => {
    expect(pruefeFotoDatei("foto.jpg", "image/jpeg", 1000, JPEG).ok).toBe(true);
    expect(pruefeFotoDatei("foto.png", "image/png", 1000, PNG).ok).toBe(true);
    expect(pruefeFotoDatei("foto.webp", "image/webp", 1000, WEBP).ok).toBe(true);
  });

  it("lehnt Nicht-Bilder, MIME-Lügen und Über-Cap ab", () => {
    expect(pruefeFotoDatei("foto.jpg", "image/jpeg", 1000, PDF).ok).toBe(false);
    expect(pruefeFotoDatei("foto.svg", "image/svg+xml", 1000, TEXT).ok).toBe(false);
    expect(pruefeFotoDatei("foto.jpg", "image/jpeg", MAX_FOTO_BYTES + 1, JPEG).ok).toBe(false);
  });
});

describe("dateinameSanitisieren", () => {
  it("kappt Länge, entfernt Pfade und fällt bei Unbrauchbarem auf den Fallback", () => {
    expect(dateinameSanitisieren("a".repeat(300) + ".pdf", "f.pdf").length).toBeLessThanOrEqual(120);
    expect(dateinameSanitisieren("C:\\Users\\x\\cv.pdf", "f.pdf")).toBe("cv.pdf");
    expect(dateinameSanitisieren("", "f.pdf")).toBe("f.pdf");
    expect(dateinameSanitisieren(null, "f.pdf")).toBe("f.pdf");
    expect(dateinameSanitisieren("....", "f.pdf")).toBe("f.pdf");
  });
});
