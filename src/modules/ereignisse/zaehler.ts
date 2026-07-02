import "server-only";
import { sql } from "drizzle-orm";
import { withPublicSubmissionContext } from "@/server/dal";

/**
 * zaehler.ts — anonymer Ereignis-Zähler (Migration 0024, zunächst Telefon-Klicks).
 * ----------------------------------------------------------------------------
 * STRATEGIE: belegbare Vermittlungs-Zahlen je Fahrschule als B2B-Grundlage —
 * dabei strikt PII-frei: kein Besucher-Bezug, keine Roh-IP, nur das Aggregat
 * school × Typ × Tag. Der eigentliche Schreibvorgang lebt KOMPLETT in der DB
 * (SECURITY-DEFINER-Funktion app.zaehle_ereignis: Slug-Auflösung, Gelistet-Gate,
 * Typ-Whitelist, Tages-Cap) — dieses Modul ist nur der dünne, validierte Aufruf.
 *
 * Kontext: withPublicSubmissionContext, weil withAnonContext transaktionslokal
 * read-only ist (F-054) und der Upsert dort auch in einer DEFINER-Funktion hart
 * scheitern würde. Fail-soft: Zähl-Fehler dürfen NIE eine Nutzerinteraktion
 * stören — der Aufrufer bekommt nur true/false.
 */

export type EreignisTyp = "tel_klick";

const ERLAUBTE_TYPEN: ReadonlySet<string> = new Set(["tel_klick"]);
const SLUG_MUSTER = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Zählt ein Ereignis für eine (gelistete) Schule; false bei Ablehnung/Fehler.
 * `ort` disambiguiert Slug-Kollisionen (Slugs sind nur je (land, ort) eindeutig —
 * Sicherheits-Abnahme 2026-07-02): bei mehrdeutiger Auflösung zählt die DB-Funktion
 * STRIKT NICHT (lieber Untererfassung als Fehlzurechnung).
 */
export async function zaehleEreignis(
  slug: string,
  typ: EreignisTyp,
  ort?: string | null,
): Promise<boolean> {
  if (!ERLAUBTE_TYPEN.has(typ)) return false;
  if (typeof slug !== "string" || slug.length === 0 || slug.length > 200 || !SLUG_MUSTER.test(slug)) {
    return false;
  }
  const ortWert = typeof ort === "string" && ort.length > 0 && ort.length <= 120 ? ort : null;
  try {
    return await withPublicSubmissionContext(async (tx) => {
      const rows = (await tx.execute(
        sql`select app.zaehle_ereignis(${slug}, ${typ}, ${ortWert}) as ok`,
      )) as unknown as Array<{ ok: boolean }>;
      return rows[0]?.ok === true;
    });
  } catch {
    // Fail-soft: Tracking darf nie eine Nutzeraktion beeinträchtigen.
    return false;
  }
}
