import "server-only";
import { desc, isNotNull } from "drizzle-orm";
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
