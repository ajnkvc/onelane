import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb } from "./harness";

describe("Migration 0000 — Smoke", () => {
  let db: PGlite;
  beforeAll(async () => {
    db = await createTestDb();
  });
  afterAll(async () => {
    await db?.close();
  });

  it("spielt sauber ein und aktiviert RLS auf allen public-Tabellen", async () => {
    const res = await db.query<{ relname: string; relrowsecurity: boolean }>(
      `select c.relname, c.relrowsecurity
         from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r'
        order by 1`,
    );
    expect(res.rows.length).toBeGreaterThanOrEqual(25);
    const withoutRls = res.rows.filter((r) => !r.relrowsecurity).map((r) => r.relname);
    expect(withoutRls).toEqual([]);
  });

  it("erzeugt die app.*-Sicherheitshelfer", async () => {
    const res = await db.query<{ proname: string }>(
      `select p.proname
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'app' order by 1`,
    );
    const names = res.rows.map((r) => r.proname);
    for (const fn of [
      "current_user_id",
      "current_account_type",
      "has_platform_role",
      "user_has_school_role",
      "is_member_of_school",
      "is_school_listed",
    ]) {
      expect(names).toContain(fn);
    }
  });

  it("app_user ist weder Superuser noch BYPASSRLS", async () => {
    const res = await db.query<{ rolsuper: boolean; rolbypassrls: boolean }>(
      `select rolsuper, rolbypassrls from pg_roles where rolname = 'app_user'`,
    );
    expect(res.rows[0].rolsuper).toBe(false);
    expect(res.rows[0].rolbypassrls).toBe(false);
  });
});
