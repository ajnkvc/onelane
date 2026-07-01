import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb, asUser } from "./harness";
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

describe("Trigger — reviews (Bindung an verifiziertes Enrollment)", () => {
  it("falscher Autor scheitert", async () => {
    await expect(
      asUser(db, { sub: s.studentB }, (tx) =>
        tx.query(
          "insert into public.reviews (school_id,enrollment_id,author_user_id,rating,text) values ($1,$2,$3,5,'x')",
          [s.schoolA, s.enrA2, s.studentB],
        ),
      ),
    ).rejects.toThrow();
  });

  it("falsche Schule scheitert", async () => {
    await expect(
      asUser(db, { sub: s.studentA }, (tx) =>
        tx.query(
          "insert into public.reviews (school_id,enrollment_id,author_user_id,rating,text) values ($1,$2,$3,5,'x')",
          [s.schoolUnlisted, s.enrA2, s.studentA],
        ),
      ),
    ).rejects.toThrow();
  });

  it("fremder Instructor (andere Schule) scheitert", async () => {
    await expect(
      asUser(db, { sub: s.studentA }, (tx) =>
        tx.query(
          "insert into public.reviews (school_id,enrollment_id,author_user_id,instructor_id,rating,text) values ($1,$2,$3,$4,5,'x')",
          [s.schoolA, s.enrA2, s.studentA, s.instrX],
        ),
      ),
    ).rejects.toThrow();
  });

  it("Student kann NICHT direkt publishen (wird auf pending erzwungen)", async () => {
    const res = await asUser(db, { sub: s.studentA }, (tx) =>
      tx.query<{ moderation_status: string }>(
        "insert into public.reviews (school_id,enrollment_id,author_user_id,rating,text,moderation_status,published_at) values ($1,$2,$3,5,'x','published',now()) returning moderation_status",
        [s.schoolA, s.enrA2, s.studentA],
      ),
    );
    expect(res.rows[0].moderation_status).toBe("pending");
  });
});

describe("Trigger — users (Self-Update von E-Mail/account_typ gesperrt)", () => {
  it("Profilfeld (vorname) darf der Nutzer selbst ändern", async () => {
    const res = await asUser(db, { sub: s.studentA }, (tx) =>
      tx.query("update public.users set vorname='Neu' where id=$1", [s.studentA]),
    );
    expect(res.affectedRows).toBe(1);
  });

  it("E-Mail-Self-Update scheitert", async () => {
    await expect(
      asUser(db, { sub: s.studentA }, (tx) =>
        tx.query("update public.users set email='hack@example.com' where id=$1", [s.studentA]),
      ),
    ).rejects.toThrow();
  });

  it("account_typ-Self-Update (Eskalation) scheitert", async () => {
    await expect(
      asUser(db, { sub: s.studentA }, (tx) =>
        tx.query("update public.users set account_typ='platform_staff' where id=$1", [s.studentA]),
      ),
    ).rejects.toThrow();
  });

  it("Admin darf E-Mail ändern (System-/Admin-Pfad)", async () => {
    const res = await asUser(db, { sub: s.adminU }, (tx) =>
      tx.query("update public.users set email='neu@example.com' where id=$1", [s.studentA]),
    );
    expect(res.affectedRows).toBe(1);
  });
});

describe("Trigger — DATEV accounting_export_items (Schule + Zeitraum)", () => {
  it("gültige Rechnung (eigene Schule, im Zeitraum) wird akzeptiert", async () => {
    await expect(
      db.query("insert into public.accounting_export_items (export_id,invoice_id) values ($1,$2)", [s.exportA, s.invIn]),
    ).resolves.toBeTruthy();
  });

  it("Rechnung einer fremden Schule scheitert", async () => {
    await expect(
      db.query("insert into public.accounting_export_items (export_id,invoice_id) values ($1,$2)", [s.exportA, s.invForeign]),
    ).rejects.toThrow();
  });

  it("Rechnung außerhalb des Exportzeitraums scheitert", async () => {
    await expect(
      db.query("insert into public.accounting_export_items (export_id,invoice_id) values ($1,$2)", [s.exportA, s.invOut]),
    ).rejects.toThrow();
  });
});
