import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb, selectAsUser } from "./harness";
import { seed, type Seed } from "./seed";

let db: PGlite;
let s: Seed;

beforeAll(async () => {
  db = await createTestDb();
  s = await seed(db);
});
afterAll(async () => {
  await db?.close();
});

describe("Öffentliche Views — Spalten-Minimierung + RLS bleibt aktiv", () => {
  it("reviews_public zeigt nur gelistete, veröffentlichte Bewertungen", async () => {
    const rows = await selectAsUser(db, null, "select * from public.reviews_public");
    const schoolIds = rows.map((r) => r.school_id);
    expect(schoolIds).toContain(s.schoolA);
    expect(schoolIds).not.toContain(s.schoolUnlisted); // unlisted → trotz published nicht sichtbar
  });

  it("reviews_public enthält KEINE identifizierenden Spalten", async () => {
    const rows = await selectAsUser(db, null, "select * from public.reviews_public");
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0]).not.toHaveProperty("author_user_id");
    expect(rows[0]).not.toHaveProperty("enrollment_id");
    expect(rows[0]).not.toHaveProperty("moderated_by_user_id");
  });

  it("instructors_public zeigt nur Fahrlehrer gelisteter Schulen, ohne user_id", async () => {
    const rows = await selectAsUser(db, null, "select * from public.instructors_public");
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(s.instrA);
    expect(ids).not.toContain(s.instrX); // unlisted Schule → Fahrlehrer nicht öffentlich
    expect(rows[0]).not.toHaveProperty("user_id");
  });
});
