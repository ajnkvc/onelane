import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb, selectAsUser, asUser } from "./harness";
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

describe("RLS — privat / deny-by-default", () => {
  it("anonym: private Tabellen liefern 0 Zeilen", async () => {
    expect(await selectAsUser(db, null, "select * from public.school_billing")).toHaveLength(0);
    // enrollments/invoices: nur granted Spalten (id) — Stripe-/SEPA-Token sind nicht selektierbar.
    expect(await selectAsUser(db, null, "select id from public.enrollments")).toHaveLength(0);
    expect(await selectAsUser(db, null, "select id from public.invoices")).toHaveLength(0);
    expect(await selectAsUser(db, null, "select * from public.security_events")).toHaveLength(0);
  });

  it("Student sieht nur eigenes Enrollment, kein fremdes", async () => {
    const rows = await selectAsUser<{ id: string }>(
      db, { sub: s.studentA }, "select id from public.enrollments",
    );
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(s.enrA);
    expect(ids).not.toContain(s.enrB);
  });

  it("Student sieht keine Billing-Daten", async () => {
    expect(await selectAsUser(db, { sub: s.studentA }, "select * from public.school_billing")).toHaveLength(0);
  });
});

describe("RLS — Public Reads", () => {
  it("driving_schools öffentlich nur is_listed=true", async () => {
    const ids = (await selectAsUser<{ id: string }>(db, null, "select id from public.driving_schools")).map((r) => r.id);
    expect(ids).toContain(s.schoolA);
    expect(ids).not.toContain(s.schoolUnlisted);
  });

  it("school_profiles öffentlich nur bei gelisteter Schule", async () => {
    const ids = (await selectAsUser<{ school_id: string }>(db, null, "select school_id from public.school_profiles")).map((r) => r.school_id);
    expect(ids).toContain(s.schoolA);
    expect(ids).not.toContain(s.schoolUnlisted);
  });

  it("reviews öffentlich nur published UND Schule gelistet", async () => {
    const ids = (await selectAsUser<{ school_id: string }>(db, null, "select school_id from public.reviews")).map((r) => r.school_id);
    expect(ids).toContain(s.schoolA);
    expect(ids).not.toContain(s.schoolUnlisted); // published, aber Schule nicht gelistet
  });

  it("blog_posts öffentlich nur published und nicht zukünftig", async () => {
    const titles = (await selectAsUser<{ title: string }>(db, null, "select title from public.blog_posts")).map((r) => r.title);
    expect(titles).toEqual(["Pub"]);
  });
});

describe("RLS — Rollen", () => {
  it("Inhaber sieht eigenes Billing", async () => {
    const rows = await selectAsUser(db, { sub: s.inhaberA }, "select * from public.school_billing where school_id=$1", [s.schoolA]);
    expect(rows).toHaveLength(1);
  });

  it("Fahrlehrer sieht KEIN Billing", async () => {
    expect(await selectAsUser(db, { sub: s.fahrlehrerA }, "select * from public.school_billing")).toHaveLength(0);
  });

  it("Support liest NUR die eigene users-Zeile (F-008) und KEIN Billing", async () => {
    // F-008: Support ist aus users/enrollments/invoices entfernt (kein Support-UI in Phase 0).
    // Support sieht nur noch die eigene Zeile (id = current_user) — kein fremdes PII.
    const users = await selectAsUser<{ id: string }>(db, { sub: s.supportU }, "select id from public.users");
    expect(users.map((u) => u.id)).toEqual([s.supportU]);
    expect(await selectAsUser(db, { sub: s.supportU }, "select * from public.school_billing")).toHaveLength(0);
  });

  it("Support liest KEINE fremden enrollments/invoices (F-008)", async () => {
    expect(await selectAsUser(db, { sub: s.supportU }, "select id from public.enrollments")).toHaveLength(0);
    expect(await selectAsUser(db, { sub: s.supportU }, "select id from public.invoices")).toHaveLength(0);
  });

  it("Support ist read-only (UPDATE betrifft 0 Zeilen)", async () => {
    const res = await asUser(db, { sub: s.supportU }, (tx) =>
      tx.query("update public.driving_schools set is_partner=true where id=$1", [s.schoolA]),
    );
    expect(res.affectedRows).toBe(0);
  });

  it("Schulmitglied darf driving_schools NICHT ändern (Plattform-kontrolliert)", async () => {
    const r = await asUser(db, { sub: s.inhaberA }, (tx) =>
      tx.query("update public.driving_schools set is_partner=true where id=$1", [s.schoolA]),
    );
    expect(r.affectedRows).toBe(0);
  });

  it("Editor darf Blog schreiben, Moderator nicht", async () => {
    const ok = await asUser(db, { sub: s.editorU }, (tx) =>
      tx.query("insert into public.blog_posts (title,slug,status) values ('E','e-slug','draft')"),
    );
    expect(ok.affectedRows).toBe(1);
    await expect(
      asUser(db, { sub: s.moderatorU }, (tx) =>
        tx.query("insert into public.blog_posts (title,slug,status) values ('M','m-slug','draft')"),
      ),
    ).rejects.toThrow();
  });

  it("Moderator darf Reviews moderieren, Editor nicht", async () => {
    // Student legt eine pending Bewertung an (gültiges enrollment enrA2). enrollment_id ist
    // für app_user nach F-003 nicht mehr lesbar → Adressierung über die zurückgegebene id.
    const ins = await asUser(db, { sub: s.studentA }, (tx) =>
      tx.query<{ id: string }>(
        "insert into public.reviews (school_id,enrollment_id,author_user_id,rating,text) values ($1,$2,$3,4,'mod-test') returning id",
        [s.schoolA, s.enrA2, s.studentA],
      ),
    );
    const rid = ins.rows[0].id;
    const mod = await asUser(db, { sub: s.moderatorU }, (tx) =>
      tx.query("update public.reviews set moderation_status='published', published_at=now() where id=$1", [rid]),
    );
    expect(mod.affectedRows).toBe(1);
    const ed = await asUser(db, { sub: s.editorU }, (tx) =>
      tx.query("update public.reviews set moderation_status='rejected' where id=$1", [rid]),
    );
    expect(ed.affectedRows).toBe(0);
  });

  it("Admin sieht Billing und darf Plattform-Felder ändern", async () => {
    expect((await selectAsUser(db, { sub: s.adminU }, "select * from public.school_billing")).length).toBeGreaterThanOrEqual(1);
    const res = await asUser(db, { sub: s.adminU }, (tx) =>
      tx.query("update public.driving_schools set name='Admin-Neu', is_partner=true where id=$1", [s.schoolA]),
    );
    expect(res.affectedRows).toBe(1);
  });
});

describe("F-003/F-010 — sensible Spalten für app_user gesperrt (Spaltenprivilegien)", () => {
  // Beweist, dass der Zugriff an der SPALTEN-/TABELLEN-BERECHTIGUNG scheitert (SQLSTATE 42501,
  // insufficient_privilege) — NICHT bloß an 0 RLS-Zeilen. Hinweis: Da 0016 `revoke select on
  // table` setzt, meldet Postgres/PGlite "permission denied for table <t>" (table-level), nicht
  // "for column" — beides ist 42501 und PG-konform.
  const expectDenied = async (run: () => Promise<unknown>): Promise<void> => {
    let code: string | undefined;
    try {
      await run();
    } catch (e) {
      code = (e as { code?: string }).code;
    }
    expect(code).toBe("42501");
  };

  it("Student liest eigenes Enrollment, aber KEINE Zahl-/Vertrags-/Token-Felder", async () => {
    const ok = await selectAsUser(db, { sub: s.studentA }, "select id, status from public.enrollments");
    expect(ok.length).toBeGreaterThan(0);
    for (const col of ["stripe_customer_ref", "sepa_mandat_ref", "zahlungsmethode", "vertragsabschluss_datum"]) {
      await expectDenied(() => selectAsUser(db, { sub: s.studentA }, `select ${col} from public.enrollments`));
    }
  });

  it("Verwaltung liest Rechnung, aber KEINEN stripe_payment_ref", async () => {
    const ok = await selectAsUser(db, { sub: s.inhaberA }, "select id, betrag, status from public.invoices");
    expect(ok.length).toBeGreaterThan(0);
    await expectDenied(() => selectAsUser(db, { sub: s.inhaberA }, "select stripe_payment_ref from public.invoices"));
  });

  it("Anonym liest driving_schools, aber KEINE internen Provenienz-/Dedup-Spalten", async () => {
    for (const col of ["source_ref", "dedupe_key", "verification_status", "kundennummer", "review_notiz"]) {
      await expectDenied(() => selectAsUser(db, null, `select ${col} from public.driving_schools`));
    }
  });

  it("Anonym liest reviews_public, aber KEINE De-Anonymisierungs-Spalten der Basistabelle", async () => {
    for (const col of ["author_user_id", "enrollment_id", "moderated_by_user_id"]) {
      await expectDenied(() => selectAsUser(db, null, `select ${col} from public.reviews`));
    }
  });
});
