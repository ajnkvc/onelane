import "server-only";
import { asc, count, countDistinct, desc, isNotNull } from "drizzle-orm";
import { withAnonContext } from "@/server/dal";
import { drivingSchools } from "../../../db/schema/schools";

/**
 * queries.ts — öffentliche Lese-Use-Cases zu Fahrschulen (Geschäftslogik-Schicht).
 * ----------------------------------------------------------------------------
 * Läuft über den DAL (`withAnonContext` → RLS aktiv als `app_user`): anonym sind
 * NUR gelistete Schulen sichtbar — die Filterung erzwingt die Datenbank (RLS),
 * nicht der Anwendungscode. Die Präsentationsschicht ruft NUR diese Modul-Funktion
 * (kein direkter `@/server/*`-Import in `src/app`).
 *
 * Phase C-lokal: dünner „Proof-of-life"-Read, der die ganze Kette
 * (Seite → Modul → DAL → RLS → DB) end-to-end belegt. Die echte Suche folgt in F/G.
 */
export interface ListedSchool {
  name: string;
  slug: string;
  ort: string | null;
  stadtbezirk: string | null;
  googleRating: string | null;
}

export async function listListedSchools(limit = 12): Promise<ListedSchool[]> {
  // Harte Obergrenze: nie mehr als 50 Zeilen, egal was der Aufrufer übergibt.
  const safeLimit = Math.min(Math.max(Math.trunc(limit) || 12, 1), 50);
  return withAnonContext(async (tx) =>
    tx
      .select({
        name: drivingSchools.name,
        slug: drivingSchools.slug,
        ort: drivingSchools.ort,
        stadtbezirk: drivingSchools.stadtbezirk,
        googleRating: drivingSchools.googleRating,
      })
      .from(drivingSchools)
      .orderBy(desc(drivingSchools.googleRating))
      .limit(safeLimit),
  );
}

/** Minimalfelder für die Sitemap-Erzeugung (F-102): nur veröffentlichte Profile mit brauchbarer URL. */
export interface SitemapSchool {
  slug: string;
  ort: string | null;
}

/**
 * F-102: veröffentlichte (RLS: is_listed) Schulen für die Sitemap. Nur Einträge mit `ort`
 * (nötig für den Stadt-Slug der Profil-URL). Harte Obergrenze 5000 (ein sitemap.xml fasst 50k
 * URLs / 50 MB) — Sitemap-Index-Splitting fürs Wachstum ist der dokumentierte Folgeschritt.
 * RLS erzwingt, dass anonym NUR gelistete Schulen sichtbar sind (nicht der Anwendungscode).
 */
export async function listPublishedForSitemap(limit = 5000): Promise<SitemapSchool[]> {
  const safeLimit = Math.min(Math.max(Math.trunc(limit) || 5000, 1), 5000);
  return withAnonContext(async (tx) =>
    tx
      .select({ slug: drivingSchools.slug, ort: drivingSchools.ort })
      .from(drivingSchools)
      .where(isNotNull(drivingSchools.ort))
      .orderBy(drivingSchools.slug)
      .limit(safeLimit),
  );
}

/** Portal-Kennzahlen für die Startseite (nur gelistete Schulen — RLS erzwingt das). */
export interface PortalStats {
  schulen: number;
  staedte: number;
}

/**
 * Portal-Kennzahlen: Anzahl gelisteter Fahrschulen + Anzahl Städte (distinct `ort`,
 * NULL zählt SQL-seitig nicht mit). EINE Aggregat-Query über den DAL
 * (`withAnonContext` → RLS als `app_user`): anonym zählt die Datenbank
 * ausschließlich gelistete Schulen — nicht der Anwendungscode. Fehler werden hier
 * bewusst NICHT gefangen; der Aufrufer (Startseite) lädt fail-soft (try/catch →
 * qualitative Formulierung statt Zahl).
 */
export async function getPortalStats(): Promise<PortalStats> {
  return withAnonContext(async (tx) => {
    const rows = await tx
      .select({ schulen: count(), staedte: countDistinct(drivingSchools.ort) })
      .from(drivingSchools);
    return { schulen: rows[0]?.schulen ?? 0, staedte: rows[0]?.staedte ?? 0 };
  });
}

/** Stadt mit Anzahl gelisteter Fahrschulen (Städte-Einstiege der Startseite). */
export interface CityCount {
  ort: string;
  anzahl: number;
}

/**
 * Städte mit den meisten gelisteten Fahrschulen: `group by ort`, absteigend nach
 * Anzahl, sekundär alphabetisch (stabile Reihenfolge). Nur Zeilen mit gesetztem
 * `ort`; harte Obergrenze 12, egal was der Aufrufer übergibt. RLS
 * (`withAnonContext`) stellt sicher, dass anonym NUR gelistete Schulen in die
 * Zählung eingehen. Fail-soft-Verhalten liegt beim Aufrufer (Startseite).
 */
export async function listCityCounts(limit = 8): Promise<CityCount[]> {
  const safeLimit = Math.min(Math.max(Math.trunc(limit) || 8, 1), 12);
  return withAnonContext(async (tx) => {
    const rows = await tx
      .select({ ort: drivingSchools.ort, anzahl: count() })
      .from(drivingSchools)
      .where(isNotNull(drivingSchools.ort))
      .groupBy(drivingSchools.ort)
      .orderBy(desc(count()), asc(drivingSchools.ort))
      .limit(safeLimit);
    // `isNotNull` filtert bereits; das flatMap macht den Typ `string` beweisbar.
    return rows.flatMap((r) => (r.ort ? [{ ort: r.ort, anzahl: r.anzahl }] : []));
  });
}
