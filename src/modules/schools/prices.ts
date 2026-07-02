import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { withAnonContext } from "@/server/dal";
import { schoolPrices } from "../../../db/schema/schools";
import type { PreisKomponentenKey, SchoolPriceRow } from "@/lib/preise";
import { MAX_VERGLEICH } from "@/lib/vergleich";
import { PAGE_SIZE as SEARCH_PAGE_SIZE } from "./search";

/**
 * prices.ts — öffentliche Lese-Use-Cases zu strukturierten Preisangaben (Migration 0021).
 * ----------------------------------------------------------------------------
 * Reine Helfer/Labels/Typen liegen client-tauglich in src/lib/preise.ts — dort ist
 * auch der Rechtsrahmen dokumentiert (§ 32 FahrlG: Komponenten-Darstellung, KEINE
 * Gesamt-/Pauschalpreise, keine blickfangmäßigen Kostenschätzungen). Dieses Modul
 * liefert ausschließlich DB-Reads über den DAL.
 *
 * RLS: anonym sind NUR Preise gelisteter Schulen mit aktiv=true sichtbar; die
 * interne Spalte `quelle` ist spalten-gesperrt und wird hier nie selektiert.
 */

export type { SchoolPriceRow } from "@/lib/preise";

/** numeric kommt aus Drizzle als String — defensiv zu number (oder null) wandeln. */
function toAmount(v: string | null): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

type PriceSelectRow = {
  schoolId: string;
  klasse: string;
  grundbetrag: string | null;
  fahrstunde45: string | null;
  sonderfahrtUeberland45: string | null;
  sonderfahrtAutobahn45: string | null;
  sonderfahrtDaemmerung45: string | null;
  vorstellungTheorie: string | null;
  vorstellungPraxis: string | null;
  lehrmaterial: string | null;
  status: "recherchiert" | "bestaetigt";
  stand: string | null;
};

function mapRow(r: PriceSelectRow): SchoolPriceRow {
  const komponenten: Record<PreisKomponentenKey, number | null> = {
    grundbetrag: toAmount(r.grundbetrag),
    fahrstunde45: toAmount(r.fahrstunde45),
    sonderfahrtUeberland45: toAmount(r.sonderfahrtUeberland45),
    sonderfahrtAutobahn45: toAmount(r.sonderfahrtAutobahn45),
    sonderfahrtDaemmerung45: toAmount(r.sonderfahrtDaemmerung45),
    vorstellungTheorie: toAmount(r.vorstellungTheorie),
    vorstellungPraxis: toAmount(r.vorstellungPraxis),
    lehrmaterial: toAmount(r.lehrmaterial),
  };
  return { schoolId: r.schoolId, klasse: r.klasse, komponenten, status: r.status, stand: r.stand };
}

// Bewusst OHNE `quelle` (öffentlich spalten-gesperrt) und ohne interne Felder.
const PUBLIC_SELECT = {
  schoolId: schoolPrices.schoolId,
  klasse: schoolPrices.klasse,
  grundbetrag: schoolPrices.grundbetrag,
  fahrstunde45: schoolPrices.fahrstunde45,
  sonderfahrtUeberland45: schoolPrices.sonderfahrtUeberland45,
  sonderfahrtAutobahn45: schoolPrices.sonderfahrtAutobahn45,
  sonderfahrtDaemmerung45: schoolPrices.sonderfahrtDaemmerung45,
  vorstellungTheorie: schoolPrices.vorstellungTheorie,
  vorstellungPraxis: schoolPrices.vorstellungPraxis,
  lehrmaterial: schoolPrices.lehrmaterial,
  status: schoolPrices.status,
  stand: schoolPrices.stand,
} as const;

/** Alle aktiven Preiszeilen EINER Schule (RLS: anonym nur wenn Schule gelistet). */
export async function getPricesForSchool(schoolId: string): Promise<SchoolPriceRow[]> {
  return withAnonContext(async (tx) => {
    const rows = await tx
      .select(PUBLIC_SELECT)
      .from(schoolPrices)
      .where(and(eq(schoolPrices.schoolId, schoolId), eq(schoolPrices.aktiv, true)))
      .orderBy(schoolPrices.klasse)
      .limit(50); // defensiv: mehr Klassen je Schule gibt es nicht
    return rows.map(mapRow);
  });
}

/**
 * Preiszeilen für ERGEBNISLISTEN-Preisspalten (eine Suchergebnis-Seite).
 * Wie getPricesForSchools, aber Cap = PAGE_SIZE der Suche (12 Schulen) statt 3
 * und mit optionalem Klassen-Filter (exakte Übereinstimmung, gebundener
 * Parameter). Gleicher PUBLIC_SELECT (nie `quelle`), gleiche RLS-Garantien:
 * anonym nur gelistete Schulen, nur aktiv=true.
 */
export async function listPricesForSchools(schoolIds: string[], klasse?: string): Promise<SchoolPriceRow[]> {
  const ids = [...new Set(schoolIds)].slice(0, SEARCH_PAGE_SIZE);
  if (ids.length === 0) return [];
  return withAnonContext(async (tx) => {
    const conds = [inArray(schoolPrices.schoolId, ids), eq(schoolPrices.aktiv, true)];
    if (klasse) conds.push(eq(schoolPrices.klasse, klasse));
    const rows = await tx
      .select(PUBLIC_SELECT)
      .from(schoolPrices)
      .where(and(...conds))
      .orderBy(schoolPrices.schoolId, schoolPrices.klasse)
      .limit(SEARCH_PAGE_SIZE * 50); // defensiv: max. 50 Klassen je Schule (wie getPricesForSchool)
    return rows.map(mapRow);
  });
}

/**
 * Preiszeilen MEHRERER Schulen (Vergleichsmodus /vergleich). Harte Obergrenze
 * MAX_VERGLEICH (4) Schulen — mehr vergleicht das Produkt bewusst nicht
 * (M3-Kontrakt, zentral in src/lib/vergleich.ts).
 */
export async function getPricesForSchools(schoolIds: string[]): Promise<SchoolPriceRow[]> {
  const ids = [...new Set(schoolIds)].slice(0, MAX_VERGLEICH);
  if (ids.length === 0) return [];
  return withAnonContext(async (tx) => {
    const rows = await tx
      .select(PUBLIC_SELECT)
      .from(schoolPrices)
      .where(and(inArray(schoolPrices.schoolId, ids), eq(schoolPrices.aktiv, true)))
      .orderBy(schoolPrices.schoolId, schoolPrices.klasse)
      .limit(MAX_VERGLEICH * 50); // defensiv: max. 50 Klassen je Schule (wie getPricesForSchool)
    return rows.map(mapRow);
  });
}
