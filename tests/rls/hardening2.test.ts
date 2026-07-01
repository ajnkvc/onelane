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

describe("enrollments — Schüler dürfen nicht selbst aktivieren", () => {
  it("Schüler darf ein pending Enrollment für sich anlegen", async () => {
    const r = await asUser(db, { sub: s.studentA }, (tx) =>
      tx.query("insert into public.enrollments (student_user_id,school_id,status) values ($1,$2,'pending')", [s.studentA, s.schoolA]),
    );
    expect(r.affectedRows).toBe(1);
  });

  it("Schüler darf KEIN active Enrollment anlegen", async () => {
    await expect(
      asUser(db, { sub: s.studentA }, (tx) =>
        tx.query("insert into public.enrollments (student_user_id,school_id,status) values ($1,$2,'active')", [s.studentA, s.schoolA]),
      ),
    ).rejects.toThrow();
  });

  it("Schüler darf keine Vertrags-/Payment-Refs setzen", async () => {
    await expect(
      asUser(db, { sub: s.studentA }, (tx) =>
        tx.query(
          "insert into public.enrollments (student_user_id,school_id,status,stripe_customer_ref) values ($1,$2,'pending','cus_x')",
          [s.studentA, s.schoolA],
        ),
      ),
    ).rejects.toThrow();
  });

  it("Schüler kann eigenes Enrollment nicht selbst auf active ändern", async () => {
    const r = await asUser(db, { sub: s.studentA }, (tx) =>
      tx.query("update public.enrollments set status='active' where id=$1", [s.enrA]),
    );
    expect(r.affectedRows).toBe(0);
  });

  it("Schule (inhaber) kann Enrollment-Status ändern", async () => {
    const r = await asUser(db, { sub: s.inhaberA }, (tx) =>
      tx.query("update public.enrollments set status='completed' where id=$1", [s.enrA]),
    );
    expect(r.affectedRows).toBe(1);
  });
});

describe("driving_schools — Plattform-kontrolliert", () => {
  it("Inhaber darf school_profiles pflegen", async () => {
    const r = await asUser(db, { sub: s.inhaberA }, (tx) =>
      tx.query("update public.school_profiles set beschreibung='aktualisiert' where school_id=$1", [s.schoolA]),
    );
    expect(r.affectedRows).toBe(1);
  });

  it("Inhaber darf school_billing NICHT schreiben (F-004: nur Admin)", async () => {
    // stripe_account_ref (Auszahlungsziel) + abo_status (Tarif) sind server-/admin-only.
    // Write-Policy ist admin-only → für den Inhaber matcht keine Zeile (0 Zeilen, kein Throw).
    const r = await asUser(db, { sub: s.inhaberA }, (tx) =>
      tx.query("update public.school_billing set stripe_account_ref='acct_neu' where school_id=$1", [s.schoolA]),
    );
    expect(r.affectedRows).toBe(0);
  });

  it("Admin darf school_billing schreiben (F-004)", async () => {
    const r = await asUser(db, { sub: s.adminU }, (tx) =>
      tx.query("update public.school_billing set stripe_account_ref='acct_admin' where school_id=$1", [s.schoolA]),
    );
    expect(r.affectedRows).toBe(1);
  });

  it("Inhaber darf is_verified/is_listed NICHT ändern", async () => {
    const r = await asUser(db, { sub: s.inhaberA }, (tx) =>
      tx.query("update public.driving_schools set is_verified=true, is_listed=false where id=$1", [s.schoolA]),
    );
    expect(r.affectedRows).toBe(0);
  });

  it("Admin darf Plattform-Felder ändern", async () => {
    const r = await asUser(db, { sub: s.adminU }, (tx) =>
      tx.query("update public.driving_schools set is_verified=true where id=$1", [s.schoolA]),
    );
    expect(r.affectedRows).toBe(1);
  });
});

describe("reviews — Kernfelder immutable, nur Moderation änderbar", () => {
  // Adressierung über reviewA-id: enrollment_id ist für app_user nach F-003 nicht mehr lesbar.
  it("Moderator darf Moderationsfelder ändern", async () => {
    const r = await asUser(db, { sub: s.moderatorU }, (tx) =>
      tx.query(
        "update public.reviews set moderation_status='rejected', moderated_at=now(), moderated_by_user_id=$2 where id=$1",
        [s.reviewA, s.moderatorU],
      ),
    );
    expect(r.affectedRows).toBe(1);
  });

  it("Moderator darf rating NICHT ändern", async () => {
    await expect(
      asUser(db, { sub: s.moderatorU }, (tx) =>
        tx.query("update public.reviews set rating=1 where id=$1", [s.reviewA]),
      ),
    ).rejects.toThrow();
  });

  it("Moderator darf enrollment_id/school_id NICHT ändern", async () => {
    await expect(
      asUser(db, { sub: s.moderatorU }, (tx) =>
        tx.query("update public.reviews set enrollment_id=$2 where id=$1", [s.reviewA, s.enrA2]),
      ),
    ).rejects.toThrow();
  });

  it("Student kann eine Bewertung nach Insert nicht manipulieren", async () => {
    const r = await asUser(db, { sub: s.studentA }, (tx) =>
      tx.query("update public.reviews set text='manipuliert' where id=$1", [s.reviewA]),
    );
    expect(r.affectedRows).toBe(0);
  });
});
