import { describe, it, expect, beforeAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb, selectAsUser } from "./rls/harness";

/**
 * search.test.ts — verifiziert die Such-SQL-Semantik (Phase F) gegen echtes
 * PostgreSQL (PGlite), aus Sicht des anonymen `app_user` (RLS aktiv):
 *  - nur GELISTETE Schulen sichtbar (RLS),
 *  - Klassenfilter über school_profiles.fuehrerscheinklassen,
 *  - Haversine-Umkreis (Bounding-Box + Distanz) wie in src/modules/schools/search.ts.
 * Server-only-Module (search.ts) sind in Vitest nicht importierbar; daher wird die
 * maßgebliche DB-Semantik mit der gleichen Query geprüft.
 */
const CENTER = { lat: 48.137, lng: 11.575 }; // München
const RADIUS_KM = 25;

const DLAT = RADIUS_KM / 111;
const DLNG = RADIUS_KM / (111 * Math.abs(Math.cos((CENTER.lat * Math.PI) / 180)));

const SEARCH_SQL = `
  select s.name, s.latitude, s.longitude,
    6371 * acos(least(1, greatest(-1,
      cos(radians($1)) * cos(radians(s.latitude)) * cos(radians(s.longitude) - radians($2))
      + sin(radians($1)) * sin(radians(s.latitude))))) as distanz_km
  from public.driving_schools s
  left join lateral (
    select fuehrerscheinklassen from public.school_profiles where school_id = s.id limit 1
  ) pr on true
  where s.latitude between $3 and $4
    and s.longitude between $5 and $6
    and (6371 * acos(least(1, greatest(-1,
      cos(radians($1)) * cos(radians(s.latitude)) * cos(radians(s.longitude) - radians($2))
      + sin(radians($1)) * sin(radians(s.latitude)))))) <= $7
    and ($8::text is null or pr.fuehrerscheinklassen @> array[$8]::text[])
  order by distanz_km asc`;

const params = (klasse: string | null) => [
  CENTER.lat, CENTER.lng,
  CENTER.lat - DLAT, CENTER.lat + DLAT,
  CENTER.lng - DLNG, CENTER.lng + DLNG,
  RADIUS_KM, klasse,
];

let db: PGlite;

beforeAll(async () => {
  db = await createTestDb();
  // Bootstrap-Insert (Superuser, RLS umgangen; Trigger feuern).
  const school = async (name: string, slug: string, lat: number, lng: number, listed: boolean, klassen: string[]) => {
    const r = await db.query<{ id: string }>(
      `insert into public.driving_schools (name,slug,land,ort,latitude,longitude,is_listed)
       values ($1,$2,'DE','München',$3,$4,$5) returning id`,
      [name, slug, lat, lng, listed],
    );
    await db.query(
      `insert into public.school_profiles (school_id,fuehrerscheinklassen) values ($1,$2)`,
      [r.rows[0].id, klassen],
    );
  };
  await school("A nah gelistet BA", "a", 48.14, 11.58, true, ["B", "A"]);
  await school("D nah gelistet B", "d", 48.13, 11.56, true, ["B"]);
  await school("C nah UNgelistet B", "c", 48.135, 11.57, false, ["B"]);
  await school("H fern gelistet B", "h", 53.55, 9.99, true, ["B"]); // Hamburg, außerhalb Radius
});

describe("Fahrschul-Suche (RLS + Filter + Umkreis)", () => {
  it("anonym: nur gelistete Schulen im Umkreis (kein ungelistetes, kein fernes)", async () => {
    const rows = await selectAsUser<{ name: string; latitude: number; longitude: number }>(
      db, null, SEARCH_SQL, params(null),
    );
    const names = rows.map((r) => r.name);
    expect(names).toContain("A nah gelistet BA");
    expect(names).toContain("D nah gelistet B");
    expect(names).not.toContain("C nah UNgelistet B"); // RLS
    expect(names).not.toContain("H fern gelistet B"); // außerhalb Umkreis
    // Koordinaten für Kartenmarker vorhanden:
    expect(rows.every((r) => Number.isFinite(Number(r.latitude)) && Number.isFinite(Number(r.longitude)))).toBe(true);
  });

  it("Klassenfilter A liefert nur Schulen mit Klasse A", async () => {
    const rows = await selectAsUser<{ name: string }>(db, null, SEARCH_SQL, params("A"));
    const names = rows.map((r) => r.name);
    expect(names).toEqual(["A nah gelistet BA"]);
  });

  it("Ergebnisse sind nach Distanz aufsteigend sortiert", async () => {
    const rows = await selectAsUser<{ distanz_km: number }>(db, null, SEARCH_SQL, params(null));
    const ds = rows.map((r) => Number(r.distanz_km));
    expect(ds).toEqual([...ds].sort((a, b) => a - b));
    expect(ds.every((d) => d <= RADIUS_KM)).toBe(true);
  });
});
