import { describe, it, expect, beforeAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb, selectAsUser } from "./harness";

/**
 * profile.test.ts — RLS der Phase-H-Strukturtabellen (Migration 0001).
 * Anonyme Public-Reads dürfen NUR Zeilen GELISTETER Schulen mit `aktiv=true`
 * sehen — ungelistete ODER inaktive Zeilen bleiben verborgen (Muster wie
 * veröffentlichte Reviews; erzwingt das „im Backend deaktivieren").
 */
let db: PGlite;
let listed: string;
let unlisted: string;

beforeAll(async () => {
  db = await createTestDb();
  // Bootstrap (Superuser, RLS umgangen; Trigger feuern).
  const mk = async (slug: string, isListed: boolean) => {
    const r = await db.query<{ id: string }>(
      `insert into public.driving_schools (name,slug,land,ort,is_listed)
       values ($1,$2,'DE','München',$3) returning id`,
      ["Fahrschule " + slug, slug, isListed],
    );
    return r.rows[0].id;
  };
  listed = await mk("listed", true);
  unlisted = await mk("unlisted", false);

  // je Tabelle: (gelistet+aktiv) | (gelistet+inaktiv) | (ungelistet+aktiv)
  await db.query(`insert into public.school_images (school_id,url,aktiv) values ($1,'/a.svg',true),($1,'/b.svg',false),($2,'/c.svg',true)`, [listed, unlisted]);
  await db.query(`insert into public.school_vehicles (school_id,marke,aktiv) values ($1,'VW',true),($1,'Audi',false),($2,'BMW',true)`, [listed, unlisted]);
  await db.query(`insert into public.school_faq_items (school_id,frage,antwort,aktiv) values ($1,'F1','A1',true),($1,'F2','A2',false),($2,'F3','A3',true)`, [listed, unlisted]);
  await db.query(`insert into public.school_opening_hours (school_id,art,wochentag,von,bis,aktiv) values ($1,'buero',0,'09:00','17:00',true),($1,'buero',1,'09:00','17:00',false),($2,'buero',0,'09:00','17:00',true)`, [listed, unlisted]);
  await db.query(`insert into public.school_jobs (school_id,titel,slug,aktiv) values ($1,'Fahrlehrer (m/w/d)','job-l-aktiv',true),($1,'Entwurf','job-l-entwurf',false),($2,'Job U','job-u',true)`, [listed, unlisted]);
});

const TABLES = [
  "school_images",
  "school_vehicles",
  "school_faq_items",
  "school_opening_hours",
  "school_jobs",
] as const;

describe("Phase-H-Profil-RLS: Public-Read = gelistet UND aktiv", () => {
  for (const t of TABLES) {
    it(`${t}: anonym genau 1 Zeile (gelistet+aktiv); inaktiv & ungelistet verborgen`, async () => {
      const rows = await selectAsUser<{ c: number }>(
        db, null, `select count(*)::int as c from public.${t}`,
      );
      expect(Number(rows[0].c)).toBe(1);
    });
  }
});
