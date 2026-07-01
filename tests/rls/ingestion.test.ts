import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb, selectAsUser, asUser } from "./harness";
import { seed, type Seed } from "./seed";

/**
 * 008a-Fundament: Ingestion-Tabellen sind DENY-BY-DEFAULT (nur admin im app_user-
 * Pfad), importierte Datensätze sind ohne Gate anonym unsichtbar, Brand kann
 * portal-verwaltet (ohne Owner) sein, Idempotenz greift, und 123fahrschule ist
 * als Ausschluss geseedet.
 */
let db: PGlite;
let s: Seed;

const INGESTION_TABLES = [
  "import_run",
  "import_staging",
  "field_provenance",
  "import_review_queue",
  "dedupe_decision",
  "import_exclusion",
  "school_brand_domains",
  "import_fetch_log",
];

beforeAll(async () => {
  db = await createTestDb();
  s = await seed(db);
});
afterAll(async () => {
  await db?.close();
});

describe("RLS — Ingestion-Tabellen deny-by-default", () => {
  it("anonym sieht 0 Zeilen in allen Ingestion-Tabellen", async () => {
    for (const t of INGESTION_TABLES) {
      expect(await selectAsUser(db, null, `select * from public.${t}`)).toHaveLength(0);
    }
  });

  it("Student sieht 0 Zeilen in allen Ingestion-Tabellen", async () => {
    for (const t of INGESTION_TABLES) {
      expect(await selectAsUser(db, { sub: s.studentA }, `select * from public.${t}`)).toHaveLength(0);
    }
  });

  it("Schulmitglied (Inhaber/Fahrlehrer) sieht 0 Zeilen in allen Ingestion-Tabellen", async () => {
    for (const t of INGESTION_TABLES) {
      expect(await selectAsUser(db, { sub: s.inhaberA }, `select * from public.${t}`)).toHaveLength(0);
      expect(await selectAsUser(db, { sub: s.fahrlehrerA }, `select * from public.${t}`)).toHaveLength(0);
    }
  });

  it("Support (Plattform, nicht admin) sieht 0 Zeilen (Ingestion-Interna)", async () => {
    for (const t of INGESTION_TABLES) {
      expect(await selectAsUser(db, { sub: s.supportU }, `select * from public.${t}`)).toHaveLength(0);
    }
  });
});

describe("RLS — Ingestion-Schreiben nur admin", () => {
  it("Admin darf import_run anlegen und lesen", async () => {
    const ins = await asUser(db, { sub: s.adminU }, (tx) =>
      tx.query("insert into public.import_run (source, status) values ('osm','running')"),
    );
    expect(ins.affectedRows).toBe(1);
    const rows = await selectAsUser(db, { sub: s.adminU }, "select * from public.import_run");
    expect(rows.length).toBeGreaterThanOrEqual(1);
  });

  it("Student darf NICHT in import_run schreiben", async () => {
    await expect(
      asUser(db, { sub: s.studentA }, (tx) =>
        tx.query("insert into public.import_run (source) values ('osm')"),
      ),
    ).rejects.toThrow();
  });

  it("Schulmitglied darf NICHT in import_exclusion schreiben", async () => {
    await expect(
      asUser(db, { sub: s.inhaberA }, (tx) =>
        tx.query("insert into public.import_exclusion (typ,value,reason) values ('name','x','other')"),
      ),
    ).rejects.toThrow();
  });
});

describe("Ausschlussliste — 123fahrschule geseedet", () => {
  it("Admin sieht die 123fahrschule-Ausschlüsse; anonym sieht nichts", async () => {
    const adminRows = await selectAsUser<{ typ: string }>(
      db, { sub: s.adminU },
      "select typ from public.import_exclusion where value = '123fahrschule' and active = true",
    );
    expect(adminRows.length).toBeGreaterThanOrEqual(2); // 'name' + 'pattern'
    expect(await selectAsUser(db, null, "select * from public.import_exclusion")).toHaveLength(0);
  });
});

describe("Import-Gate: is_listed=false bleibt anonym unsichtbar", () => {
  it("importierter Datensatz (is_listed=false) ist anonym unsichtbar; erst nach Freigabe sichtbar", async () => {
    // Erhöhter Pfad (Bootstrap-Rolle, RLS-frei) legt einen Importkandidaten an.
    const { rows } = await db.query<{ id: string }>(
      `insert into public.driving_schools
         (name, slug, land, ort, source, source_ref, is_listed, verification_status)
       values ('Import Kandidat','import-kandidat','DE','Muenchen','osm','node/999999', false, 'needs_review')
       returning id`,
    );
    const id = rows[0].id;

    const anonIdsBefore = (await selectAsUser<{ id: string }>(db, null, "select id from public.driving_schools")).map((r) => r.id);
    expect(anonIdsBefore).not.toContain(id);

    await db.query("update public.driving_schools set is_listed = true where id = $1", [id]);
    const anonIdsAfter = (await selectAsUser<{ id: string }>(db, null, "select id from public.driving_schools")).map((r) => r.id);
    expect(anonIdsAfter).toContain(id);
  });

  it("Idempotenz: gleiche (source, source_ref) ist eindeutig", async () => {
    await db.query(
      `insert into public.driving_schools (name, slug, land, ort, source, source_ref, is_listed)
       values ('Dup A','dup-a','DE','Koeln','osm','node/dup', false)`,
    );
    await expect(
      db.query(
        `insert into public.driving_schools (name, slug, land, ort, source, source_ref, is_listed)
         values ('Dup B','dup-b','DE','Koeln','osm','node/dup', false)`,
      ),
    ).rejects.toThrow();
  });
});

describe("Brand: portal-verwaltet ohne Owner", () => {
  it("portal-verwaltete Brand ohne Owner ist erlaubt und nur für admin sichtbar", async () => {
    const { rows } = await db.query<{ id: string }>(
      "insert into public.school_brands (name, is_portal_managed) values ('Portal Brand', true) returning id",
    );
    const brandId = rows[0].id;
    const adminRows = await selectAsUser(db, { sub: s.adminU }, "select id from public.school_brands where id=$1", [brandId]);
    expect(adminRows).toHaveLength(1);
    expect(await selectAsUser(db, null, "select id from public.school_brands where id=$1", [brandId])).toHaveLength(0);
    expect(await selectAsUser(db, { sub: s.inhaberA }, "select id from public.school_brands where id=$1", [brandId])).toHaveLength(0);
  });

  it("Brand ohne Owner UND nicht portal-verwaltet ist verboten (Check-Constraint)", async () => {
    await expect(
      db.query("insert into public.school_brands (name, is_portal_managed) values ('Verwaist', false)"),
    ).rejects.toThrow();
  });
});
