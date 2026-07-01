import "server-only";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { withAnonContext } from "@/server/dal";

/**
 * search.ts — öffentliche Fahrschul-Suche (Phase F).
 * ----------------------------------------------------------------------------
 * Läuft über den DAL (`withAnonContext` → RLS als `app_user`): es sind anonym
 * NUR gelistete Schulen sichtbar — die DB erzwingt das, nicht dieser Code.
 *
 * Umkreissuche: Bounding-Box-Vorfilter über den `(latitude,longitude)`-Index +
 * exakte Haversine-Distanz (KEIN PostGIS). Filter: Klasse (school_profiles),
 * Sprache, Partner. Sortierung dokumentiert; Partner wird NICHT heimlich
 * nach oben sortiert (nur sichtbar als Label gekennzeichnet, separat in der UI).
 * Parameter werden Zod-validiert; alle Werte sind gebundene SQL-Parameter.
 */
export const PAGE_SIZE = 12;
// Harte Seiten-Obergrenze (gegen teure Tiefen-Paginierung). EINE Konstante für Schema (seite.max)
// UND seiten-Berechnung, damit die UI nie eine Seite verlinkt, die das Schema ablehnt.
export const MAX_PAGE = 50;
// F-063: Obergrenze für den Count-Scan (führende Wildcard-`ilike` ist nicht indexiert). Bei breiten
// Suchen wird nur bis COUNT_CAP Treffern gezählt → gebundene DB-Last. „COUNT_CAP+" = mehr Treffer.
// (Exakte, indizierte Zählung käme mit pg_trgm-GIN — Folgeschritt.)
export const COUNT_CAP = 1000;

// F-095: leere Query-Parameter (?lat=&seite=) NICHT per coerce zu 0 machen — sonst würde `?lat=&lng=`
// als Geo-Suche bei (0,0) interpretiert bzw. umkreisKm/seite="" → 0 → Validierungsfehler. Leerstring
// → undefined, damit optional/Default korrekt greifen.
const emptyToUndef = (v: unknown) => (v === "" ? undefined : v);
export const searchParamsSchema = z.object({
  ort: z.string().trim().min(1).max(120).optional(),
  lat: z.preprocess(emptyToUndef, z.coerce.number().min(-90).max(90).optional()),
  lng: z.preprocess(emptyToUndef, z.coerce.number().min(-180).max(180).optional()),
  umkreisKm: z.preprocess(emptyToUndef, z.coerce.number().min(1).max(200).default(25)),
  klasse: z.string().trim().max(12).optional(),
  sprache: z.string().trim().max(12).optional(),
  // Nur der String "true" aktiviert den Partnerfilter; alles andere = kein Filter
  // (z.coerce.boolean() würde "false" fälschlich zu true machen).
  partner: z.preprocess((v) => (v === "true" || v === true ? true : undefined), z.boolean().optional()),
  sort: z.enum(["distanz", "bewertung", "relevanz"]).optional(),
  // Harte Obergrenze gegen teure Tiefen-Paginierung (Offset-Scan): max. Seite 50
  // → Offset ≤ 588. Tiefere Treffer über Verfeinerung der Suche, nicht Blättern.
  seite: z.preprocess(emptyToUndef, z.coerce.number().int().min(1).max(MAX_PAGE).default(1)),
});
export type SearchParams = z.infer<typeof searchParamsSchema>;

export interface SearchResultItem {
  id: string;
  name: string;
  slug: string;
  ort: string | null;
  stadtbezirk: string | null;
  googleRating: string | null;
  googleReviewsCount: number | null;
  sprachen: string[];
  klassen: string[];
  isPartner: boolean;
  isVerified: boolean;
  latitude: number | null;
  longitude: number | null;
  distanzKm: number | null;
}

export interface SearchResult {
  items: SearchResultItem[];
  total: number;
  seite: number;
  proSeite: number;
  seiten: number;
  zentrum: { lat: number; lng: number } | null;
  /** true, wenn mehr als COUNT_CAP Treffer existieren (total ist dann gedeckelt → UI zeigt „1000+"). */
  hasMore: boolean;
}

export async function searchSchools(raw: unknown): Promise<SearchResult> {
  const p = searchParamsSchema.parse(raw);
  const hasGeo = p.lat !== undefined && p.lng !== undefined;
  const offset = (p.seite - 1) * PAGE_SIZE;

  return withAnonContext(async (tx) => {
    const conds = [];
    if (hasGeo) {
      const dLat = p.umkreisKm / 111.0;
      const cosLat = Math.cos((p.lat! * Math.PI) / 180) || 1e-6;
      const dLng = p.umkreisKm / (111.0 * Math.abs(cosLat));
      conds.push(sql`s.latitude between ${p.lat! - dLat} and ${p.lat! + dLat}`);
      conds.push(sql`s.longitude between ${p.lng! - dLng} and ${p.lng! + dLng}`);
    } else if (p.ort) {
      const like = `%${p.ort}%`;
      conds.push(sql`(s.ort ilike ${like} or s.stadtbezirk ilike ${like} or s.plz ilike ${like})`);
    }
    if (p.klasse) conds.push(sql`pr.fuehrerscheinklassen @> array[${p.klasse}]::text[]`);
    if (p.sprache) conds.push(sql`s.sprachen @> array[${p.sprache}]::text[]`);
    if (p.partner) conds.push(sql`s.is_partner = true`);

    const distExpr = hasGeo
      ? sql`6371 * acos(least(1, greatest(-1,
          cos(radians(${p.lat!})) * cos(radians(s.latitude)) * cos(radians(s.longitude) - radians(${p.lng!}))
          + sin(radians(${p.lat!})) * sin(radians(s.latitude)))))`
      : sql`null::double precision`;
    if (hasGeo) conds.push(sql`(${distExpr}) <= ${p.umkreisKm}`);

    const whereSql = conds.length ? sql`where ${sql.join(conds, sql` and `)}` : sql``;

    // Sortierung (dokumentiert): bewertung | distanz | relevanz(=Standard).
    // Standard: Distanz wenn Geo, sonst Bewertung. KEIN heimliches Partner-Boosting.
    const effectiveSort = p.sort ?? (hasGeo ? "distanz" : "bewertung");
    const orderSql =
      effectiveSort === "bewertung"
        ? sql`order by s.google_rating desc nulls last, s.google_reviews_count desc nulls last`
        : effectiveSort === "distanz" && hasGeo
          ? sql`order by distanz_km asc nulls last`
          : sql`order by s.google_rating desc nulls last, s.google_reviews_count desc nulls last`;

    const fromSql = sql`
      from public.driving_schools s
      left join lateral (
        select fuehrerscheinklassen from public.school_profiles where school_id = s.id limit 1
      ) pr on true
      ${whereSql}`;

    const rows = (await tx.execute(sql`
      select s.id, s.name, s.slug, s.ort, s.stadtbezirk,
             s.google_rating, s.google_reviews_count, s.sprachen,
             coalesce(pr.fuehrerscheinklassen, '{}'::text[]) as klassen,
             s.is_partner, s.is_verified, s.latitude, s.longitude,
             ${distExpr} as distanz_km
      ${fromSql}
      ${orderSql}
      limit ${PAGE_SIZE} offset ${offset}
    `)) as unknown as Record<string, unknown>[];

    // F-063: Count-Scan hart begrenzen — zählt bis COUNT_CAP+1 Treffer und stoppt (kein Full-Scan
    // über die nicht-indizierte führende Wildcard). `total` wird auf COUNT_CAP gedeckelt; `hasMore`
    // signalisiert „es gibt mehr" (UI zeigt dann „COUNT_CAP+").
    const countRows = (await tx.execute(
      sql`select count(*)::int as total from (select 1 ${fromSql} limit ${COUNT_CAP + 1}) t`,
    )) as unknown as Record<string, unknown>[];
    const rawTotal = Number(countRows[0]?.total ?? 0);
    const hasMore = rawTotal > COUNT_CAP;
    const total = Math.min(rawTotal, COUNT_CAP);

    const items: SearchResultItem[] = rows.map((r) => ({
      id: String(r.id),
      name: String(r.name),
      slug: String(r.slug),
      ort: (r.ort as string | null) ?? null,
      stadtbezirk: (r.stadtbezirk as string | null) ?? null,
      googleRating: r.google_rating != null ? String(r.google_rating) : null,
      googleReviewsCount: r.google_reviews_count != null ? Number(r.google_reviews_count) : null,
      sprachen: (r.sprachen as string[] | null) ?? [],
      klassen: (r.klassen as string[] | null) ?? [],
      isPartner: r.is_partner === true,
      isVerified: r.is_verified === true,
      latitude: r.latitude != null ? Number(r.latitude) : null,
      longitude: r.longitude != null ? Number(r.longitude) : null,
      distanzKm: r.distanz_km != null ? Math.round(Number(r.distanz_km) * 10) / 10 : null,
    }));

    return {
      items,
      total,
      seite: p.seite,
      proSeite: PAGE_SIZE,
      // seiten auf MAX_PAGE deckeln — konsistent mit seite.max(MAX_PAGE); die UI verlinkt so nie
      // eine Seite, die das Schema ablehnt (bei gedeckeltem total sonst z. B. 84 > 50).
      seiten: Math.max(1, Math.min(MAX_PAGE, Math.ceil(total / PAGE_SIZE))),
      zentrum: hasGeo ? { lat: p.lat!, lng: p.lng! } : null,
      hasMore,
    };
  });
}
