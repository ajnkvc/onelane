import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb, selectAsUser, asUser } from "./harness";
import { seed, type Seed } from "./seed";

/**
 * rollenscharf.test.ts — Migration 0013: rollenscharfe RLS für Schulrollen.
 * Fahrlehrer LESEN alle Schüler/Termine der Schule (Quer-Routing bei Engpässen),
 * dürfen aber NICHT enrollments/Profile/Instructors schreiben und sehen KEINE
 * invoices. Verwaltung (inhaber/verwaltung) = volle Schul-Sicht + Schreiben.
 */
let db: PGlite;
let s: Seed;

beforeAll(async () => {
  db = await createTestDb();
  s = await seed(db);
});
afterAll(async () => {
  await db?.close();
});

const ids = (rows: { id: string }[]) => rows.map((r) => r.id);

describe("0013 — Fahrlehrer: liest alle Schul-Schüler, eingeschränkte Schreib-/Finanzrechte", () => {
  it("liest ALLE Enrollments der Schule (enrA, enrA2), nicht fremde (enrB)", async () => {
    const got = ids(await selectAsUser<{ id: string }>(db, { sub: s.fahrlehrerA }, "select id from public.enrollments"));
    expect(got).toEqual(expect.arrayContaining([s.enrA, s.enrA2]));
    expect(got).not.toContain(s.enrB);
  });

  it("liest ALLE Termine der Schule (apptA, apptUnassigned, apptGhost)", async () => {
    const got = ids(await selectAsUser<{ id: string }>(db, { sub: s.fahrlehrerA }, "select id from public.appointments"));
    expect(got).toEqual(expect.arrayContaining([s.apptA, s.apptUnassigned, s.apptGhost]));
  });

  it("sieht KEINE invoices (Finanzdaten)", async () => {
    expect(await selectAsUser(db, { sub: s.fahrlehrerA }, "select id from public.invoices")).toHaveLength(0);
  });

  it("kann ein Enrollment NICHT ändern (0 Zeilen)", async () => {
    const r = await asUser(db, { sub: s.fahrlehrerA }, (tx) =>
      tx.query("update public.enrollments set status='completed' where id=$1", [s.enrA]),
    );
    expect(r.affectedRows).toBe(0);
  });

  it("kann ein Enrollment NICHT einfügen (Trigger/RLS wirft)", async () => {
    await expect(
      asUser(db, { sub: s.fahrlehrerA }, (tx) =>
        tx.query("insert into public.enrollments (student_user_id,school_id,status) values ($1,$2,'pending')", [s.studentB, s.schoolA]),
      ),
    ).rejects.toThrow();
  });

  it("kann school_profiles NICHT schreiben (0 Zeilen)", async () => {
    const r = await asUser(db, { sub: s.fahrlehrerA }, (tx) =>
      tx.query("update public.school_profiles set beschreibung='hack' where school_id=$1", [s.schoolA]),
    );
    expect(r.affectedRows).toBe(0);
  });

  it("kann instructors NICHT schreiben — auch die eigene Zeile nicht (0 Zeilen)", async () => {
    const r = await asUser(db, { sub: s.fahrlehrerA }, (tx) =>
      tx.query("update public.instructors set name='hack' where id=$1", [s.instrA]),
    );
    expect(r.affectedRows).toBe(0);
  });

  it("kann school_jobs (Untertabelle) NICHT schreiben (0 Zeilen)", async () => {
    const r = await asUser(db, { sub: s.fahrlehrerA }, (tx) =>
      tx.query("update public.school_jobs set titel='hack' where school_id=$1", [s.schoolA]),
    );
    expect(r.affectedRows).toBe(0);
  });
});

describe("0013 — Self-Insert-Guard (account_typ)", () => {
  it("Fahrlehrer kann sich NICHT selbst als Schüler anlegen (account_typ-Guard)", async () => {
    await expect(
      asUser(db, { sub: s.fahrlehrerA }, (tx) =>
        tx.query("insert into public.enrollments (student_user_id,school_id,status) values ($1,$2,'pending')", [s.fahrlehrerA, s.schoolA]),
      ),
    ).rejects.toThrow();
  });

  it("ein echter Schüler DARF sich selbst ein pending-Enrollment anlegen (1 Zeile)", async () => {
    const r = await asUser(db, { sub: s.studentB }, (tx) =>
      tx.query("insert into public.enrollments (student_user_id,school_id,status) values ($1,$2,'pending')", [s.studentB, s.schoolA]),
    );
    expect(r.affectedRows).toBe(1);
  });
});

describe("0013 — Eskalationsschutz: instructors.user_id ohne Schulmitgliedschaft", () => {
  it("ghostU (nur instructors.user_id, KEINE Schulmitgliedschaft) sieht NICHTS", async () => {
    expect(await selectAsUser(db, { sub: s.ghostU }, "select id from public.enrollments")).toHaveLength(0);
    expect(await selectAsUser(db, { sub: s.ghostU }, "select * from public.appointments")).toHaveLength(0);
    expect(await selectAsUser(db, { sub: s.ghostU }, "select id from public.invoices")).toHaveLength(0);
  });
});

describe("0013 — Verwaltung (inhaber/verwaltung): volle Schul-Sicht + Schreiben", () => {
  it("verwaltung liest alle Schul-Enrollments (enrA, enrA2), nicht fremde (enrB)", async () => {
    const got = ids(await selectAsUser<{ id: string }>(db, { sub: s.verwaltungA }, "select id from public.enrollments"));
    expect(got).toEqual(expect.arrayContaining([s.enrA, s.enrA2]));
    expect(got).not.toContain(s.enrB);
  });

  it("verwaltung sieht invoices der eigenen Schule (invIn, invOut), nicht fremde", async () => {
    const got = ids(await selectAsUser<{ id: string }>(db, { sub: s.verwaltungA }, "select id from public.invoices"));
    expect(got).toEqual(expect.arrayContaining([s.invIn, s.invOut]));
    expect(got).not.toContain(s.invForeign);
  });

  it("verwaltung darf ein Enrollment ändern (1 Zeile)", async () => {
    const r = await asUser(db, { sub: s.verwaltungA }, (tx) =>
      tx.query("update public.enrollments set status='completed' where id=$1", [s.enrA2]),
    );
    expect(r.affectedRows).toBe(1);
  });

  it("inhaber sieht alle Schul-Termine (apptA, apptUnassigned, apptGhost)", async () => {
    const got = ids(await selectAsUser<{ id: string }>(db, { sub: s.inhaberA }, "select id from public.appointments"));
    expect(got).toEqual(expect.arrayContaining([s.apptA, s.apptUnassigned, s.apptGhost]));
  });

  it("verwaltung darf school_jobs NICHT mehr schreiben (0025: Phase 1 kuratiert, 0 Zeilen)", async () => {
    // Seit Migration 0025 sind Stellenanzeigen kuratiert: Writes nur admin/editor.
    // Positivfälle (editor/admin) deckt tests/rls/jobs-kuratierung.test.ts ab.
    const r = await asUser(db, { sub: s.verwaltungA }, (tx) =>
      tx.query("update public.school_jobs set titel='Aktualisiert' where school_id=$1", [s.schoolA]),
    );
    expect(r.affectedRows ?? 0).toBe(0);
  });
});

describe("0013 — Student: nur eigene Sicht (Regression)", () => {
  it("student sieht eigene Enrollments + eigene Termine, keine fremden", async () => {
    const e = ids(await selectAsUser<{ id: string }>(db, { sub: s.studentA }, "select id from public.enrollments"));
    expect(e).toEqual(expect.arrayContaining([s.enrA, s.enrA2]));
    expect(e).not.toContain(s.enrB);
    const a = ids(await selectAsUser<{ id: string }>(db, { sub: s.studentA }, "select id from public.appointments"));
    expect(a).toEqual(expect.arrayContaining([s.apptA, s.apptUnassigned, s.apptGhost]));
  });
});
