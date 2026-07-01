import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb, asUser, selectAsUser } from "./harness";
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

describe("Trigger — Plattformrollen nur für platform_staff", () => {
  it("platform_staff darf eine Plattformrolle erhalten", async () => {
    await expect(
      db.query("insert into public.platform_role_assignments (user_id,role) values ($1,'editor')", [s.adminU]),
    ).resolves.toBeTruthy();
  });
  it("student darf KEINE Plattformrolle erhalten", async () => {
    await expect(
      db.query("insert into public.platform_role_assignments (user_id,role) values ($1,'support')", [s.studentA]),
    ).rejects.toThrow();
  });
  it("school_staff darf KEINE Plattformrolle erhalten", async () => {
    await expect(
      db.query("insert into public.platform_role_assignments (user_id,role) values ($1,'support')", [s.inhaberA]),
    ).rejects.toThrow();
  });
});

describe("security_events — append-only & Actor-Bindung", () => {
  it("Nutzer kann eigenes Event schreiben", async () => {
    // KEIN RETURNING: security_events ist nur für admin lesbar (SELECT-Policy);
    // ein RETURNING würde die SELECT-Policy auslösen. Erfolg via affectedRows prüfen.
    const res = await asUser(db, { sub: s.studentA }, (tx) =>
      tx.query("insert into public.security_events (actor_user_id,event_type) values ($1,'login')", [s.studentA]),
    );
    expect(res.affectedRows).toBe(1);
  });
  it("Nutzer kann KEIN Event mit fremder actor_user_id schreiben", async () => {
    await expect(
      asUser(db, { sub: s.studentA }, (tx) =>
        tx.query("insert into public.security_events (actor_user_id,event_type) values ($1,'login')", [s.studentB]),
      ),
    ).rejects.toThrow();
  });
  it("eingeloggter Nutzer mit actor_user_id=NULL scheitert", async () => {
    await expect(
      asUser(db, { sub: s.studentA }, (tx) =>
        tx.query("insert into public.security_events (actor_user_id,event_type) values (null,'login')"),
      ),
    ).rejects.toThrow();
  });
  it("anonyme app_user-Session kann kein Event schreiben", async () => {
    await expect(
      asUser(db, null, (tx) =>
        tx.query("insert into public.security_events (actor_user_id,event_type) values (null,'login')"),
      ),
    ).rejects.toThrow();
  });
  it("System-/Tooling-Pfad (kein Nutzerkontext) darf actor=NULL schreiben", async () => {
    await expect(
      db.query("insert into public.security_events (actor_user_id,event_type) values (null,'system_job')"),
    ).resolves.toBeTruthy();
  });
  it("System-/Tooling-Pfad mit nicht-NULL actor scheitert", async () => {
    await expect(
      db.query("insert into public.security_events (actor_user_id,event_type) values ($1,'system_job')", [s.studentA]),
    ).rejects.toThrow();
  });
  it("ungültiges event_type-Token scheitert (CHECK)", async () => {
    await expect(
      asUser(db, { sub: s.studentA }, (tx) =>
        tx.query("insert into public.security_events (actor_user_id,event_type) values ($1,'Bad Token!')", [s.studentA]),
      ),
    ).rejects.toThrow();
  });
  it("Admin kann security_events lesen, normaler Nutzer nicht", async () => {
    expect((await selectAsUser(db, { sub: s.adminU }, "select id from public.security_events")).length).toBeGreaterThanOrEqual(1);
    expect(await selectAsUser(db, { sub: s.studentA }, "select id from public.security_events")).toHaveLength(0);
  });
  it("UPDATE/DELETE sind unmöglich (kein Grant, auch nicht für admin)", async () => {
    await expect(
      asUser(db, { sub: s.adminU }, (tx) => tx.query("update public.security_events set event_type='x'")),
    ).rejects.toThrow();
    await expect(
      asUser(db, { sub: s.adminU }, (tx) => tx.query("delete from public.security_events")),
    ).rejects.toThrow();
  });
  it("Tamper-Trigger: UPDATE/DELETE/TRUNCATE auch über elevated/owner-Pfad unmöglich", async () => {
    // Auch der privilegierte Tooling-/System-Pfad (db.query ohne app_user-Rollenwechsel) darf
    // das Audit-Log nicht mutieren — abgesichert per DB-Trigger, nicht nur per Grant.
    // Eine Zeile sicherstellen (System-Insert ist erlaubt), damit der row-level Trigger feuert.
    await db.query("insert into public.security_events (actor_user_id,event_type) values (null,'system_job')");
    await expect(db.query("update public.security_events set event_type='x'")).rejects.toThrow();
    await expect(db.query("delete from public.security_events")).rejects.toThrow();
    await expect(db.query("truncate public.security_events")).rejects.toThrow();
  });
});

describe("messages — deny-by-default (Phase 2/3)", () => {
  it("Student kann (noch) keine Message insertieren", async () => {
    await expect(
      asUser(db, { sub: s.studentA }, (tx) =>
        tx.query("insert into public.messages (von_user_id,an_user_id,inhalt) values ($1,$2,'hi')", [s.studentA, s.studentB]),
      ),
    ).rejects.toThrow();
  });
  it("Student sieht keine messages (deny-by-default)", async () => {
    expect(await selectAsUser(db, { sub: s.studentA }, "select * from public.messages")).toHaveLength(0);
  });
});
