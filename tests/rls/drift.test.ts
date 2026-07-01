import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { is } from "drizzle-orm";
import { PgTable, getTableConfig } from "drizzle-orm/pg-core";
import { createTestDb } from "./harness";
import * as schema from "../../db/schema";

/**
 * Drift-Wächter: stellt sicher, dass das hand-gespiegelte Drizzle-Schema NICHT von
 * der maßgeblichen SQL-Migration abweicht. Jede in Drizzle definierte Tabelle/Spalte
 * MUSS nach Einspielen der Migration real existieren. Schlägt fehl, sobald jemand
 * eine Drizzle-Spalte hinzufügt/umbenennt, ohne die Migration nachzuziehen.
 */
let db: PGlite;
beforeAll(async () => {
  db = await createTestDb();
});
afterAll(async () => {
  await db?.close();
});

const tables = (Object.values(schema) as unknown[]).filter(
  (x): x is PgTable => is(x, PgTable),
);

describe("Schema-Drift: Drizzle ↔ Migration", () => {
  it("erkennt die erwartete Anzahl Tabellen", () => {
    expect(tables.length).toBeGreaterThanOrEqual(20);
  });

  it("jede Drizzle-Tabelle/-Spalte existiert in der Migration", async () => {
    const missing: string[] = [];
    for (const t of tables) {
      const cfg = getTableConfig(t);
      const res = await db.query<{ column_name: string }>(
        "select column_name from information_schema.columns where table_schema='public' and table_name=$1",
        [cfg.name],
      );
      if (res.rows.length === 0) {
        missing.push(`Tabelle fehlt: ${cfg.name}`);
        continue;
      }
      const dbCols = new Set(res.rows.map((r) => r.column_name));
      for (const col of cfg.columns) {
        if (!dbCols.has(col.name)) missing.push(`${cfg.name}.${col.name}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
