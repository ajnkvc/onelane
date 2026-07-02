import { z } from "zod";

/**
 * schema.ts — Zod-Grenzvalidierung des öffentlichen Anmelde-Funnels (Leads).
 * ----------------------------------------------------------------------------
 * Dies ist die EINZIGE fachliche Validierung vor dem anonymen Schreibpfad
 * (Migration 0022); die DB-CHECKs sind bewusst nur grobe Plausibilität.
 * Bewusst OHNE `server-only`: rein, deterministisch, unit-testbar
 * (tests/leads-schema.test.ts). Die Server Action (actions.ts) übernimmt
 * FormData-Extraktion, Rate-Limit, Slug-Auflösung und den DAL-Insert.
 *
 * Regeln (Spiegel der DB-CHECKs aus 0022, aber strenger):
 *  - Kontakt-Mindestregel: E-Mail ODER Telefon (mind. eines).
 *  - Minderjährigen-Gate: U18 ⇒ Guardian-Name + Guardian-Kontakt (Datenminimierung:
 *    KEIN Geburtsdatum — nur die Selbstauskunft „unter 18").
 *  - Größen-Caps unter den DB-Byte-Grenzen (0022: octet_length), inkl. Byte-Cap
 *    für die Nachricht (Multibyte-Zeichen zählen in der DB mehrfach).
 *  - Anti-Bot: Honeypot-Feld `website` MUSS leer sein; Zeitfalle (min. 3 s
 *    Ausfüllzeit) als reine Funktion mit explizitem now-Parameter.
 *  - Unbekannte Felder werden verworfen (z.object strippt per Default).
 */

/** Führerscheinklasse — Spiegel des DB-CHECKs chk_leads_klasse (0022). */
export const KLASSE_REGEX = /^[A-Z][A-Z0-9]{0,5}$/;
/** Telefon — Spiegel des DB-CHECKs chk_leads_telefon_format (0022). */
export const TELEFON_REGEX = /^[0-9+][0-9 ()/\-]{2,63}$/;

export const ZEITRAUM_WERTE = ["sofort", "in_1_3_monaten", "spaeter"] as const;
export const RUECKRUF_WERTE = ["vormittags", "nachmittags", "abends", "egal"] as const;

/** Anzeige-/Weitergabe-Labels der Wunsch-Rückrufzeit (landet strukturiert in `nachricht`). */
export const RUECKRUF_LABEL: Record<(typeof RUECKRUF_WERTE)[number], string> = {
  vormittags: "vormittags",
  nachmittags: "nachmittags",
  abends: "abends",
  egal: "jederzeit",
};

/** UTF-8-Bytelänge (DB-Caps sind BYTE-Grenzen, nicht Zeichen). */
const byteLaenge = (s: string): number => new TextEncoder().encode(s).length;

/** Leere/Whitespace-Strings zu undefined normalisieren (leere Formularfelder). */
const leerZuUndefined = (v: unknown): unknown =>
  typeof v === "string" && v.trim() === "" ? undefined : v;

const optionalerName = z.preprocess(
  leerZuUndefined,
  z.string().trim().min(2).max(100).optional(),
);
const optionaleEmail = z.preprocess(leerZuUndefined, z.email().max(254).optional());
const optionalesTelefon = z.preprocess(
  leerZuUndefined,
  z.string().trim().regex(TELEFON_REGEX).optional(),
);

export const leadEingabeSchema = z
  .object({
    klasse: z.string().trim().regex(KLASSE_REGEX),
    zeitraum: z.enum(ZEITRAUM_WERTE),
    vorname: z.string().trim().min(2).max(100),
    nachname: optionalerName,
    email: optionaleEmail,
    telefon: optionalesTelefon,
    nachricht: z.preprocess(
      leerZuUndefined,
      z
        .string()
        .trim()
        .max(2000)
        // DB-Cap ist octet_length ≤ 4000 — Puffer für den Rückruf-Anhang lassen.
        .refine((s) => byteLaenge(s) <= 3800, "Nachricht ist zu lang.")
        .optional(),
    ),
    /** Optionaler Wunsch-Fahrlehrer (Gründer 2026-07-02): Wert wird serverseitig
     *  gegen instructors_public der ZIEL-Schule validiert (kein freier Text in
     *  der DB) — hier nur Form-/Längen-Grenze. */
    wunschFahrlehrer: z.preprocess(leerZuUndefined, z.string().trim().min(1).max(120).optional()),
    istMinderjaehrig: z.boolean().default(false),
    guardianName: optionalerName,
    guardianEmail: optionaleEmail,
    guardianTelefon: optionalesTelefon,
    rueckruf: z.enum(RUECKRUF_WERTE).default("egal"),
    // Beide Einwilligungen sind PFLICHT (Policy 0022 verlangt gesetzte Timestamps;
    // die Timestamps selbst setzt die Action serverseitig — nie der Client).
    datenschutz: z.literal(true),
    weitergabe: z.literal(true),
    // Honeypot: für Menschen unsichtbares Feld — jede Eingabe ⇒ Ablehnung.
    website: z.string().max(0),
  })
  .superRefine((d, ctx) => {
    if (!d.email && !d.telefon) {
      ctx.addIssue({
        code: "custom",
        path: ["email"],
        message: "E-Mail oder Telefonnummer angeben (mindestens eines).",
      });
    }
    if (d.istMinderjaehrig) {
      if (!d.guardianName) {
        ctx.addIssue({
          code: "custom",
          path: ["guardianName"],
          message: "Bei unter 18: Name eines Erziehungsberechtigten angeben.",
        });
      }
      if (!d.guardianEmail && !d.guardianTelefon) {
        ctx.addIssue({
          code: "custom",
          path: ["guardianEmail"],
          message: "Bei unter 18: Kontakt des Erziehungsberechtigten angeben.",
        });
      }
    }
  });

export type LeadEingabe = z.infer<typeof leadEingabeSchema>;

/** Mindest-Ausfüllzeit der Zeitfalle (Bots posten in Millisekunden). */
export const MIN_AUSFUELL_MS = 3_000;
/** Obergrenze gegen abgestandene/replayte Formulare (24 h). */
export const MAX_FORMULAR_ALTER_MS = 24 * 60 * 60 * 1_000;

/**
 * Zeitfalle: `tsRaw` ist der beim Rendern gesetzte Epoch-ms-Wert des Formulars.
 * Bestanden, wenn zwischen Rendern und Absenden mindestens MIN_AUSFUELL_MS und
 * höchstens MAX_FORMULAR_ALTER_MS liegen. Explizites `nowMs` → testbar.
 */
export function zeitfalleBestanden(tsRaw: unknown, nowMs: number): boolean {
  const ts =
    typeof tsRaw === "number" ? tsRaw : typeof tsRaw === "string" ? Number(tsRaw) : NaN;
  if (!Number.isFinite(ts)) return false;
  const alter = nowMs - ts;
  return alter >= MIN_AUSFUELL_MS && alter <= MAX_FORMULAR_ALTER_MS;
}
