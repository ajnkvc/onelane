import { z } from "zod";
import { TELEFON_REGEX } from "../leads/schema";

/**
 * schema.ts — Zod-Grenzvalidierung des öffentlichen Bewerbungs-Funnels (Jobbörse M5).
 * ----------------------------------------------------------------------------
 * EINZIGE fachliche Validierung vor dem anonymen Schreibpfad (Migration 0025);
 * die DB-CHECKs sind der grobe Backstop. Bewusst OHNE `server-only`: rein,
 * deterministisch, unit-testbar (tests/jobs-schema.test.ts). Die Server Action
 * (actions.ts) übernimmt FormData-/Datei-Extraktion, Rate-Limit, Slug-Auflösung
 * und den DAL-Insert.
 *
 * Regeln (Spiegel der DB-CHECKs aus 0023/0025, aber strenger):
 *  - E-Mail ist PFLICHT (anders als beim Anmelde-Lead), Telefon optional.
 *  - bewerber_status: nur die drei UI-Werte (DB kennt zusätzlich 'unbekannt'
 *    als Backfill-Wert für den Bestand — im Formular NICHT wählbar).
 *  - klassen: Allowlist JOB_KLASSEN (synchron mit chk_*_klassen in 0025),
 *    max. 12, ohne Duplikate.
 *  - Verfügbarkeit: Datum GENAU DANN, wenn 'zum_datum'.
 *  - KEINE Gehaltshistorie-Felder — das Formular fragt NIEMALS nach bisherigem
 *    Gehalt (Review-Auflagen, AGG-/Datenminimierungs-Linie).
 *  - Einwilligungen Datenschutz + Weitergabe sind Pflicht (Policy 0025 verlangt
 *    beide Timestamps; gesetzt werden sie serverseitig in der Action).
 *  - Anti-Bot: Honeypot `website` + Zeitfalle (wiederverwendet aus modules/leads —
 *    identische Semantik, keine Kopie).
 *
 * DATEI-REGELN (Durchleitungs-Prinzip): CV ist PFLICHT (PDF/DOC/DOCX, max. 5 MB),
 * Foto FREIWILLIG (JPG/PNG/WebP, max. 3 MB; im UI ausdrücklich „freiwillig — für
 * deine Bewerbung nicht nötig" labeln, AGG-sensibel). Geprüft werden Größe, MIME
 * UND Magic-Bytes; Dateinamen werden auf [A-Za-z0-9._-] sanitisiert. Die Dateien
 * werden NIE gespeichert — nur als Mail-Anhang durchgereicht (actions.ts).
 */

// Zeitfalle wiederverwenden (reine Funktionen; Semantik identisch zum Anmelde-Funnel).
export { zeitfalleBestanden, MIN_AUSFUELL_MS, MAX_FORMULAR_ALTER_MS } from "../leads/schema";

/**
 * Führerschein-Klassen-Allowlist der Jobbörse.
 * MUSS synchron bleiben mit chk_school_jobs_klassen / chk_job_applications_klassen
 * (Migration 0025) — die DB lehnt alles außerhalb dieser Liste hart ab (23514).
 */
export const JOB_KLASSEN = [
  "AM", "A1", "A2", "A",
  "B", "B196", "B197", "BE",
  "C1", "C1E", "C", "CE",
  "D1", "D1E", "D", "DE",
  "L", "T",
] as const;
export type JobKlasse = (typeof JOB_KLASSEN)[number];

/** Selbstauskunft im Formular — 'unbekannt' ist NUR Backfill-Wert der DB, nie wählbar. */
export const BEWERBER_STATUS_WERTE = ["fahrlehrer", "anwaerter", "quereinsteiger"] as const;
export const VERFUEGBAR_WERTE = ["sofort", "zum_datum", "flexibel"] as const;

/** UTF-8-Bytelänge (DB-Caps sind BYTE-Grenzen, nicht Zeichen). */
const byteLaenge = (s: string): number => new TextEncoder().encode(s).length;

/** Leere/Whitespace-Strings zu undefined normalisieren (leere Formularfelder). */
const leerZuUndefined = (v: unknown): unknown =>
  typeof v === "string" && v.trim() === "" ? undefined : v;

const optionalesTelefon = z.preprocess(
  leerZuUndefined,
  z.string().trim().regex(TELEFON_REGEX).optional(),
);

/** ISO-Datum (YYYY-MM-DD), real existierend — Spiegel des date-Typs von verfuegbar_ab. */
const ISO_DATUM_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const optionalesDatum = z.preprocess(
  leerZuUndefined,
  z
    .string()
    .trim()
    .regex(ISO_DATUM_REGEX)
    .refine((s) => {
      const d = new Date(`${s}T00:00:00Z`);
      return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
    }, "Kein gültiges Datum.")
    .optional(),
);

export const bewerbungEingabeSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    email: z.email().max(254),
    telefon: optionalesTelefon,
    bewerberStatus: z.enum(BEWERBER_STATUS_WERTE),
    klassen: z
      .array(z.enum(JOB_KLASSEN))
      .max(12)
      .default([])
      .refine((k) => new Set(k).size === k.length, "Klassen dürfen sich nicht wiederholen."),
    verfuegbarStatus: z.enum(VERFUEGBAR_WERTE),
    verfuegbarAb: optionalesDatum,
    nachricht: z.preprocess(
      leerZuUndefined,
      z
        .string()
        .trim()
        .max(2000)
        // DB-Cap ist octet_length ≤ 4000 — Puffer für Multibyte lassen (0022-Linie).
        .refine((s) => byteLaenge(s) <= 3800, "Nachricht ist zu lang.")
        .optional(),
    ),
    // Beide Einwilligungen PFLICHT (Policy 0025 verlangt gesetzte Timestamps; die
    // Timestamps setzt die Action serverseitig — nie der Client). Die Weitergabe-
    // Einwilligung deckt die Voll-Weiterleitung samt Unterlagen an die Fahrschule.
    datenschutz: z.literal(true),
    weitergabe: z.literal(true),
    // Honeypot: für Menschen unsichtbares Feld — jede Eingabe ⇒ Ablehnung.
    website: z.string().max(0),
  })
  .superRefine((d, ctx) => {
    // Datum GENAU DANN, wenn 'zum_datum' (Spiegel chk_job_applications_verfuegbar).
    if (d.verfuegbarStatus === "zum_datum" && !d.verfuegbarAb) {
      ctx.addIssue({
        code: "custom",
        path: ["verfuegbarAb"],
        message: "Bei Verfügbarkeit zum Datum bitte das Datum angeben.",
      });
    }
    if (d.verfuegbarStatus !== "zum_datum" && d.verfuegbarAb) {
      ctx.addIssue({
        code: "custom",
        path: ["verfuegbarAb"],
        message: "Datum nur bei Verfügbarkeit zum Datum angeben.",
      });
    }
  });

export type BewerbungEingabe = z.infer<typeof bewerbungEingabeSchema>;

// ----------------------------------------------------------------------------
// Datei-Validierung (rein & testbar; die Action liest die Bytes aus FormData)
// ----------------------------------------------------------------------------

/** Modul-Caps — Spiegel von chk_job_applications_unterlagen (Migration 0025). */
export const MAX_CV_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_FOTO_BYTES = 3 * 1024 * 1024; // 3 MB

const CV_MIME = new Set([
  "application/pdf",
  "application/msword", // .doc
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
]);
const FOTO_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

/** Byte-Präfix-Vergleich (Magic-Bytes). */
const beginntMit = (kopf: Uint8Array, sig: number[], offset = 0): boolean =>
  sig.every((b, i) => kopf[offset + i] === b);

/** Magic-Bytes CV: PDF `%PDF`, DOCX = ZIP `PK..`, DOC = OLE2-Container. */
export function istCvKopf(kopf: Uint8Array): boolean {
  return (
    beginntMit(kopf, [0x25, 0x50, 0x44, 0x46]) || // %PDF
    beginntMit(kopf, [0x50, 0x4b, 0x03, 0x04]) || // PK\x03\x04 (docx)
    beginntMit(kopf, [0xd0, 0xcf, 0x11, 0xe0]) // OLE2 (legacy .doc)
  );
}

/** Magic-Bytes Foto: JPEG-, PNG- oder WebP-Header (RIFF….WEBP). */
export function istFotoKopf(kopf: Uint8Array): boolean {
  return (
    beginntMit(kopf, [0xff, 0xd8, 0xff]) || // JPEG
    beginntMit(kopf, [0x89, 0x50, 0x4e, 0x47]) || // PNG
    (beginntMit(kopf, [0x52, 0x49, 0x46, 0x46]) && // RIFF
      beginntMit(kopf, [0x57, 0x45, 0x42, 0x50], 8)) // WEBP an Offset 8
  );
}

/**
 * Dateinamen sanitisieren: nur [A-Za-z0-9._-], Länge gekappt (DB-CHECK-Spiegel).
 * Pfad-Anteile werden verworfen; leere/unbrauchbare Namen fallen auf `fallback`.
 */
export function dateinameSanitisieren(roh: unknown, fallback: string): string {
  const basis = typeof roh === "string" ? roh.split(/[\\/]/).pop() ?? "" : "";
  const sauber = basis
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^[-.]+/, "")
    .replace(/-+/g, "-")
    .slice(0, 120);
  return /^[A-Za-z0-9._-]{1,120}$/.test(sauber) ? sauber : fallback;
}

export type DateiPruefung = { ok: true; dateiname: string } | { ok: false };

/** CV-Prüfung: Größe (1..5 MB) + MIME + Magic-Bytes + sanitisierter Name. */
export function pruefeCvDatei(
  name: unknown,
  mime: string,
  groesseBytes: number,
  kopf: Uint8Array,
): DateiPruefung {
  if (groesseBytes <= 0 || groesseBytes > MAX_CV_BYTES) return { ok: false };
  if (!CV_MIME.has(mime)) return { ok: false };
  if (!istCvKopf(kopf)) return { ok: false };
  return { ok: true, dateiname: dateinameSanitisieren(name, "lebenslauf.pdf") };
}

/** Foto-Prüfung: Größe (1..3 MB) + MIME + Magic-Bytes + sanitisierter Name. */
export function pruefeFotoDatei(
  name: unknown,
  mime: string,
  groesseBytes: number,
  kopf: Uint8Array,
): DateiPruefung {
  if (groesseBytes <= 0 || groesseBytes > MAX_FOTO_BYTES) return { ok: false };
  if (!FOTO_MIME.has(mime)) return { ok: false };
  if (!istFotoKopf(kopf)) return { ok: false };
  return { ok: true, dateiname: dateinameSanitisieren(name, "foto.jpg") };
}
