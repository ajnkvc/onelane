import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb } from "./harness";

/**
 * url-constraints.test.ts — Migration 0018 (F-040 + H3 defense-in-depth):
 * DB-CHECK auf öffentlich ausgegebene URL-Felder. Bootstrap-Rolle (umgeht RLS), damit
 * ausschließlich die CHECK-Constraints geprüft werden.
 */
let db: PGlite;
let schoolId: string;

beforeAll(async () => {
  db = await createTestDb();
  const r = await db.query<{ id: string }>(
    `insert into public.driving_schools (name, slug, land, ort, is_listed, is_verified)
     values ('S', 'url-check', 'DE', 'Koeln', true, true) returning id`,
  );
  schoolId = r.rows[0].id;
});
afterAll(async () => {
  await db?.close();
});

async function rejects(p: Promise<unknown>): Promise<void> {
  let threw = false;
  try {
    await p;
  } catch {
    threw = true;
  }
  expect(threw).toBe(true);
}

describe("0018 — school_profiles.website CHECK (nur http(s), Längen-Cap)", () => {
  it("akzeptiert https + null", async () => {
    const r = await db.query<{ id: string }>(
      `insert into public.school_profiles (school_id, website) values ($1, 'https://schule.de/kontakt') returning id`,
      [schoolId],
    );
    expect(r.rows[0].id).toBeTruthy();
    await db.query(`update public.school_profiles set website=null where school_id=$1`, [schoolId]);
  });

  it("lehnt javascript:-URL ab", async () => {
    await rejects(
      db.query(`update public.school_profiles set website='javascript:alert(1)' where school_id=$1`, [schoolId]),
    );
  });

  it("lehnt schema-lose URL ab", async () => {
    await rejects(
      db.query(`update public.school_profiles set website='schule.de' where school_id=$1`, [schoolId]),
    );
  });

  it("lehnt überlange URL (>2048) ab", async () => {
    const long = "https://schule.de/" + "a".repeat(2050);
    await rejects(
      db.query(`update public.school_profiles set website=$2 where school_id=$1`, [schoolId, long]),
    );
  });
});
