import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { runMigrations, hasOwnTransaction } from "../db/migrate-core.mjs";

const MIGRATIONS_DIR = fileURLToPath(new URL("../db/migrations/", import.meta.url));

/**
 * Verifiziert den Migrations-Kern (Reihenfolge, Idempotenz, Tracking, Drift, dry-run)
 * gegen echtes PostgreSQL (PGlite). Der CLI-Wrapper (scripts/migrate.mjs) nutzt
 * denselben Kern über eine postgres.js-Verbindung.
 */
let pg: PGlite;
const db = {
  exec: (s: string) => pg.exec(s),
  query: async (s: string, p: unknown[] = []) => ({
    rows: (await pg.query(s, p)).rows as Record<string, unknown>[],
  }),
};

beforeAll(async () => {
  pg = new PGlite();
});
afterAll(async () => {
  await pg?.close();
});

describe("migrate-core", () => {
  it("wendet ausstehende Migrationen in Reihenfolge an, trackt sie und ist idempotent", async () => {
    const migs = [
      { name: "0002_b.sql", sql: "create table mtest_b (id int);" },
      { name: "0001_a.sql", sql: "create table mtest_a (id int);" },
    ];
    const r1 = await runMigrations(db, migs);
    expect(r1.applied).toEqual(["0001_a.sql", "0002_b.sql"]); // sortiert nach Name

    const tables = await db.query(
      "select table_name from information_schema.tables where table_name in ('mtest_a','mtest_b')",
    );
    expect(tables.rows.length).toBe(2);

    const tracked = await db.query("select name from _schema_migrations order by name");
    expect(tracked.rows.map((r) => r.name)).toEqual(["0001_a.sql", "0002_b.sql"]);

    const r2 = await runMigrations(db, migs);
    expect(r2.applied).toEqual([]);
    expect(r2.skipped.length).toBe(2);
  });

  it("erkennt Drift bei nachträglich geänderter, bereits angewandter Migration", async () => {
    const changed = [
      { name: "0001_a.sql", sql: "create table mtest_a (id int); -- geändert" },
    ];
    const r = await runMigrations(db, changed);
    expect(r.drift).toContain("0001_a.sql");
    expect(r.applied).toEqual([]);
  });

  it("F-024: unvollständige ('applying') Migration → Abbruch statt stillem Re-Apply/Skip", async () => {
    // Abgebrochener früherer Lauf: Marker 'applying' ohne bestätigte DDL.
    await db.exec("insert into _schema_migrations (name, checksum, status) values ('0099_broken.sql','deadbeef','applying')");
    const migs = [{ name: "0099_broken.sql", sql: "create table mtest_broken (id int);" }];
    await expect(runMigrations(db, migs)).rejects.toThrow(/Unvollständige Migration/);
    // Nichts angewandt — die Tabelle darf NICHT existieren.
    const t = await db.query("select table_name from information_schema.tables where table_name='mtest_broken'");
    expect(t.rows.length).toBe(0);
    // dryRun meldet den Zustand, ohne zu werfen.
    const r = await runMigrations(db, migs, { dryRun: true });
    expect(r.incomplete).toContain("0099_broken.sql");
    // Aufräumen (gemeinsame pg-Instanz über die Testfälle).
    await db.exec("delete from _schema_migrations where name='0099_broken.sql'");
  });

  it("F-024: Runner-verwaltete Migration schreibt Marker atomar mit der DDL (Status 'applied')", async () => {
    await runMigrations(db, [{ name: "0050_atomic.sql", sql: "create table mtest_atomic (id int);" }]);
    const row = await db.query("select status from _schema_migrations where name='0050_atomic.sql'");
    expect(row.rows[0]?.status).toBe("applied");
  });

  it("F-024: hasOwnTransaction erkennt ALLE self-transaktionalen Bestands-Migrationen (Leerzeile vor begin;)", () => {
    // Jede reale Migration hat eine Leerzeile zwischen Kopf-Kommentar und `begin;`. hasOwnTransaction
    // MUSS sie als self-transaktional erkennen (sonst würde der Runner sie fälschlich doppelt-wrappen).
    const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql"));
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      const sql = readFileSync(MIGRATIONS_DIR + f, "utf8");
      const containsTopLevelBegin = /^begin;/m.test(sql);
      expect(hasOwnTransaction(sql)).toBe(containsTopLevelBegin);
    }
  });

  it("dry-run listet Ausstehende, ohne sie anzuwenden", async () => {
    const r = await runMigrations(
      db,
      [{ name: "0003_c.sql", sql: "create table mtest_c (id int);" }],
      { dryRun: true },
    );
    expect(r.pending).toContain("0003_c.sql");
    const t = await db.query(
      "select table_name from information_schema.tables where table_name='mtest_c'",
    );
    expect(t.rows.length).toBe(0);
  });
});
