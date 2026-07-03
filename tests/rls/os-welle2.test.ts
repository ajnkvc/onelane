import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHash } from "node:crypto";
import type { PGlite } from "@electric-sql/pglite";
import { asUser, createTestDb, selectAsUser } from "./harness";
import { seed, type Seed } from "./seed";

/**
 * RLS-Tests Migration 0031 (OS Welle 2 — Modul-Lesepfade + Kalender-Writes):
 *  1. app.schueler_namen: NUR Schul-Mitglieder, NUR vorname/nachname, NUR
 *     aktive Enrollments (pending|active); kein Enumerations-/Ghost-Pfad.
 *  2. app.api_key_pruefen/api_key_beruehren: GUC-Gate (app.api_key_auth),
 *     nur AKTIVE Schlüssel, nie key_hash in der Rückgabe, Drossel wirkt.
 *  3. app.termin_finanzen: preis/abgerechnet NUR für Schul-Manager; der
 *     direkte Spalten-SELECT bleibt für ALLE app_user verboten.
 *  4. instructor_availability-Writes: Manager schulweit, Fahrlehrer:in nur
 *     eigene Zeilen; Ghost/Student/fremde Schule fail-closed.
 *  5. school_subscriptions: Manager liest (ohne stripe_subscription_ref),
 *     Fahrlehrer/Student/anon nicht; Writes entzogen.
 *  6. app.plan_katalog: anon-tauglich, liefert die 0029-Referenzpläne.
 */
let db: PGlite;
let s: Seed;
let studentC: string;
let keyAktivHash: string;
let keyRotiertHash: string;
let keyPausiertHash: string;
let keyAktivId: string;

const hash = (token: string) => createHash("sha256").update(token, "utf8").digest("hex");

beforeAll(async () => {
  db = await createTestDb();
  s = await seed(db);

  // Namen für den schueler_namen-Pfad (Bootstrap = erhöhter Pfad).
  await db.query("update public.users set vorname='Sana', nachname='Beispiel' where id=$1", [s.studentA]);
  await db.query("update public.users set vorname='Bruno', nachname='Beispiel' where id=$1", [s.studentB]);
  // studentC: PENDING-Enrollment an Schule A (Name sichtbar).
  const c = await db.query<{ id: string }>(
    "insert into public.users (id,email,vorname,nachname,account_typ) values (gen_random_uuid(),'studentc@test.de','Cem','Beispiel','student') returning id",
  );
  studentC = c.rows[0].id;
  await db.query(
    "insert into public.enrollments (student_user_id,school_id,status) values ($1,$2,'pending')",
    [studentC, s.schoolA],
  );
  // studentB: NUR beendete Enrollments an Schule A (cancelled) → Name TABU.
  await db.query(
    "insert into public.enrollments (student_user_id,school_id,status) values ($1,$2,'cancelled')",
    [s.studentB, s.schoolA],
  );

  // API-Partner + Schlüssel (aktiv / rotiert / aktiver Key eines pausierten Partners).
  const partner = await db.query<{ id: string }>(
    "insert into public.api_partners (name,status) values ('RLS Partner','aktiv') returning id",
  );
  const partnerPausiert = await db.query<{ id: string }>(
    "insert into public.api_partners (name,status) values ('RLS Partner Pausiert','pausiert') returning id",
  );
  keyAktivHash = hash("olk_rls_aktiv_0123456789abcdef");
  keyRotiertHash = hash("olk_rls_rotiert_0123456789abcdef");
  keyPausiertHash = hash("olk_rls_pausiert_0123456789abcdef");
  const k1 = await db.query<{ id: string }>(
    `insert into public.api_keys (partner_id,key_hash,prefix,scopes,status)
     values ($1,$2,'olk_rls_aktiv','{rest_read,mcp}','aktiv') returning id`,
    [partner.rows[0].id, keyAktivHash],
  );
  keyAktivId = k1.rows[0].id;
  await db.query(
    `insert into public.api_keys (partner_id,key_hash,prefix,scopes,status)
     values ($1,$2,'olk_rls_rotiert','{rest_read}','rotiert')`,
    [partner.rows[0].id, keyRotiertHash],
  );
  await db.query(
    `insert into public.api_keys (partner_id,key_hash,prefix,scopes,status)
     values ($1,$2,'olk_rls_paus','{mcp}','aktiv')`,
    [partnerPausiert.rows[0].id, keyPausiertHash],
  );

  // Finanzfelder am Seed-Termin (apptA, Schule A).
  await db.query("update public.appointments set preis=68.00, abgerechnet=false where id=$1", [s.apptA]);

  // Abo: Schule A auf den 0029-Referenzplan 'os'.
  await db.query(
    `insert into public.school_subscriptions (school_id, plan_id, anzahl_lizenzen, status, stripe_subscription_ref)
     select $1, p.id, 3, 'active', 'sub_geheim_123' from public.subscription_plans p where p.code='os'`,
    [s.schoolA],
  );
});
afterAll(async () => {
  await db?.close();
});

// ----------------------------------------------------------------------------
// 1) app.schueler_namen
// ----------------------------------------------------------------------------
describe("0031 — app.schueler_namen", () => {
  const SEL = "select student_user_id, vorname, nachname from app.schueler_namen($1)";

  it("alle drei Schul-Rollen lesen die Namen aktiver Schüler der EIGENEN Schule", async () => {
    for (const sub of [s.inhaberA, s.verwaltungA, s.fahrlehrerA]) {
      const rows = await selectAsUser<{ student_user_id: string; vorname: string }>(
        db, { sub }, SEL, [s.schoolA],
      );
      const ids = rows.map((r) => r.student_user_id);
      expect(ids).toContain(s.studentA); // active
      expect(ids).toContain(studentC); // pending zählt als aktiv
      expect(ids).not.toContain(s.studentB); // nur cancelled → TABU
      expect(rows.find((r) => r.student_user_id === s.studentA)?.vorname).toBe("Sana");
    }
  });

  it("liefert GENAU 3 Spalten — keine E-Mail/Telefon (Datenminimierung)", async () => {
    const rows = await selectAsUser<Record<string, unknown>>(
      db, { sub: s.inhaberA }, "select * from app.schueler_namen($1) limit 1", [s.schoolA],
    );
    expect(Object.keys(rows[0] ?? {}).sort()).toEqual(["nachname", "student_user_id", "vorname"]);
  });

  it("fremde Schule / Ghost / Student / support / anonym → 0 Zeilen", async () => {
    expect(await selectAsUser(db, { sub: s.inhaberA }, SEL, [s.schoolUnlisted])).toHaveLength(0);
    expect(await selectAsUser(db, { sub: s.ghostU }, SEL, [s.schoolA])).toHaveLength(0);
    expect(await selectAsUser(db, { sub: s.studentA }, SEL, [s.schoolA])).toHaveLength(0);
    expect(await selectAsUser(db, { sub: s.supportU }, SEL, [s.schoolA])).toHaveLength(0);
    expect(await selectAsUser(db, null, SEL, [s.schoolA])).toHaveLength(0);
  });

  it("users-Direktzugriff bleibt für Schul-Personal zu (Policy unverändert)", async () => {
    const rows = await selectAsUser<{ id: string }>(
      db, { sub: s.inhaberA }, "select id from public.users where id=$1", [s.studentA],
    );
    expect(rows).toHaveLength(0);
  });
});

// ----------------------------------------------------------------------------
// 2) app.api_key_pruefen / app.api_key_beruehren (GUC-Gate)
// ----------------------------------------------------------------------------
describe("0031 — api_key_pruefen/beruehren", () => {
  const PRUEF = "select * from app.api_key_pruefen($1)";
  const GUC = "select set_config('app.api_key_auth','1',true)";

  it("OHNE GUC: bekannter Hash liefert NICHTS (sanktionierter Pfad nötig)", async () => {
    expect(await selectAsUser(db, null, PRUEF, [keyAktivHash])).toHaveLength(0);
    expect(await selectAsUser(db, { sub: s.adminU }, PRUEF, [keyAktivHash])).toHaveLength(0);
  });

  it("MIT GUC: aktiver Schlüssel kommt zurück — ohne key_hash-Spalte", async () => {
    const rows = await asUser(db, null, async (q) => {
      await q.query(GUC);
      return (await q.query<Record<string, unknown>>(PRUEF, [keyAktivHash])).rows;
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      prefix: "olk_rls_aktiv",
      status: "aktiv",
      partner_name: "RLS Partner",
      partner_status: "aktiv",
    });
    expect(Object.keys(rows[0])).not.toContain("key_hash");
  });

  it("rotierter Schlüssel = wie unbekannt (kein Orakel); Junk-Hash → nichts", async () => {
    const rows = await asUser(db, null, async (q) => {
      await q.query(GUC);
      const rotiert = (await q.query(PRUEF, [keyRotiertHash])).rows;
      const junk = (await q.query(PRUEF, ["nicht-hex"])).rows;
      return { rotiert, junk };
    });
    expect(rows.rotiert).toHaveLength(0);
    expect(rows.junk).toHaveLength(0);
  });

  it("aktiver Schlüssel eines PAUSIERTEN Partners kommt MIT partner_status (Kette entscheidet 403)", async () => {
    const rows = await asUser(db, null, async (q) => {
      await q.query(GUC);
      return (await q.query<Record<string, unknown>>(PRUEF, [keyPausiertHash])).rows;
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].partner_status).toBe("pausiert");
  });

  it("beruehren: ohne GUC false; mit GUC einmal true, dann gedrosselt false", async () => {
    const ohneGuc = await selectAsUser<{ ok: boolean }>(
      db, null, "select app.api_key_beruehren($1) as ok", [keyAktivId],
    );
    expect(ohneGuc[0].ok).toBe(false);

    const mitGuc = await asUser(db, null, async (q) => {
      await q.query(GUC);
      const erster = (await q.query<{ ok: boolean }>("select app.api_key_beruehren($1) as ok", [keyAktivId])).rows;
      const zweiter = (await q.query<{ ok: boolean }>("select app.api_key_beruehren($1) as ok", [keyAktivId])).rows;
      return { erster: erster[0].ok, zweiter: zweiter[0].ok };
    });
    expect(mitGuc.erster).toBe(true);
    expect(mitGuc.zweiter).toBe(false); // Drossel (5 Minuten)

    const gesetzt = await db.query<{ last_used_at: string | null }>(
      "select last_used_at from public.api_keys where id=$1", [keyAktivId],
    );
    expect(gesetzt.rows[0].last_used_at).not.toBeNull();
  });
});

// ----------------------------------------------------------------------------
// 3) app.termin_finanzen + Spalten-Grants
// ----------------------------------------------------------------------------
describe("0031 — termin_finanzen (Finanzfelder nur Manager)", () => {
  const SEL = "select appointment_id, preis, abgerechnet from app.termin_finanzen($1)";

  it("inhaber/verwaltung sehen preis/abgerechnet der eigenen Schule", async () => {
    for (const sub of [s.inhaberA, s.verwaltungA]) {
      const rows = await selectAsUser<{ appointment_id: string; preis: string }>(
        db, { sub }, SEL, [s.schoolA],
      );
      const zeile = rows.find((r) => r.appointment_id === s.apptA);
      expect(zeile).toBeDefined();
      expect(Number(zeile?.preis)).toBe(68);
    }
  });

  it("fahrlehrer/Student/anon/fremde Schule → 0 Zeilen", async () => {
    expect(await selectAsUser(db, { sub: s.fahrlehrerA }, SEL, [s.schoolA])).toHaveLength(0);
    expect(await selectAsUser(db, { sub: s.studentA }, SEL, [s.schoolA])).toHaveLength(0);
    expect(await selectAsUser(db, null, SEL, [s.schoolA])).toHaveLength(0);
    expect(await selectAsUser(db, { sub: s.inhaberA }, SEL, [s.schoolUnlisted])).toHaveLength(0);
  });

  it("direkter Spalten-SELECT auf preis bleibt für ALLE verboten (auch Manager)", async () => {
    await expect(
      selectAsUser(db, { sub: s.inhaberA }, "select preis from public.appointments limit 1"),
    ).rejects.toThrow();
    await expect(
      selectAsUser(db, { sub: s.adminU }, "select abgerechnet from public.appointments limit 1"),
    ).rejects.toThrow();
  });
});

// ----------------------------------------------------------------------------
// 4) instructor_availability — Schreibpfad Kalender V1
// ----------------------------------------------------------------------------
describe("0031 — instructor_availability-Writes", () => {
  const INSERT =
    "insert into public.instructor_availability (instructor_id, datum, von, bis) values ($1, current_date, '08:00', '09:00') returning id";

  it("Manager legt Slots für ALLE Fahrlehrer der eigenen Schule an (auch fremde Spur)", async () => {
    for (const [sub, instr] of [
      [s.inhaberA, s.instrA],
      [s.verwaltungA, s.instrGhost],
    ] as const) {
      const rows = await selectAsUser<{ id: string }>(db, { sub }, INSERT, [instr]);
      expect(rows).toHaveLength(1);
      await db.query("delete from public.instructor_availability where id=$1", [rows[0].id]);
    }
  });

  it("Fahrlehrer:in pflegt NUR die eigene Spur (fremde Spur der Schule → abgelehnt)", async () => {
    const eigene = await selectAsUser<{ id: string }>(db, { sub: s.fahrlehrerA }, INSERT, [s.instrA]);
    expect(eigene).toHaveLength(1);

    await expect(selectAsUser(db, { sub: s.fahrlehrerA }, INSERT, [s.instrGhost])).rejects.toThrow();

    // eigene Zeile: UPDATE + DELETE erlaubt
    const upd = await selectAsUser<{ id: string }>(
      db, { sub: s.fahrlehrerA },
      "update public.instructor_availability set von='09:00', bis='10:00' where id=$1 returning id",
      [eigene[0].id],
    );
    expect(upd).toHaveLength(1);
    const del = await selectAsUser<{ id: string }>(
      db, { sub: s.fahrlehrerA },
      "delete from public.instructor_availability where id=$1 returning id",
      [eigene[0].id],
    );
    expect(del).toHaveLength(1);
  });

  it("Ghost (eigene instructors-Zeile OHNE Schulrolle) / Student / fremde Schule → fail-closed", async () => {
    await expect(selectAsUser(db, { sub: s.ghostU }, INSERT, [s.instrGhost])).rejects.toThrow();
    await expect(selectAsUser(db, { sub: s.studentA }, INSERT, [s.instrA])).rejects.toThrow();
    await expect(selectAsUser(db, { sub: s.inhaberA }, INSERT, [s.instrX])).rejects.toThrow();
  });

  it("instructor_id ist nach INSERT unveränderlich (kein UPDATE-Spalten-Grant)", async () => {
    const rows = await selectAsUser<{ id: string }>(db, { sub: s.inhaberA }, INSERT, [s.instrA]);
    await expect(
      selectAsUser(
        db, { sub: s.inhaberA },
        "update public.instructor_availability set instructor_id=$1 where id=$2",
        [s.instrGhost, rows[0].id],
      ),
    ).rejects.toThrow();
    await db.query("delete from public.instructor_availability where id=$1", [rows[0].id]);
  });

  it("appointments bleibt OHNE Write-Pfad (Termin-Anlage = eigenes Modul)", async () => {
    await expect(
      selectAsUser(
        db, { sub: s.inhaberA },
        "insert into public.appointments (enrollment_id, typ) values ($1, 'fahrstunde')",
        [s.enrA],
      ),
    ).rejects.toThrow();
  });
});

// ----------------------------------------------------------------------------
// 5) school_subscriptions — Lesepfad Abo (Manager)
// ----------------------------------------------------------------------------
describe("0031 — school_subscriptions", () => {
  const SEL = "select school_id, status, anzahl_lizenzen from public.school_subscriptions";

  it("inhaber/verwaltung lesen das Abo der eigenen Schule; admin alles", async () => {
    for (const sub of [s.inhaberA, s.verwaltungA, s.adminU]) {
      const rows = await selectAsUser<{ school_id: string }>(db, { sub }, SEL);
      expect(rows.map((r) => r.school_id)).toContain(s.schoolA);
    }
  });

  it("fahrlehrer/Student/support/anon lesen NICHTS", async () => {
    for (const claims of [{ sub: s.fahrlehrerA }, { sub: s.studentA }, { sub: s.supportU }, null]) {
      expect(await selectAsUser(db, claims, SEL)).toHaveLength(0);
    }
  });

  it("stripe_subscription_ref bleibt spalten-gesperrt (auch für Manager)", async () => {
    await expect(
      selectAsUser(db, { sub: s.inhaberA }, "select stripe_subscription_ref from public.school_subscriptions"),
    ).rejects.toThrow();
  });

  it("Writes sind entzogen (auch admin über app_user-Rolle)", async () => {
    await expect(
      selectAsUser(
        db, { sub: s.adminU },
        "update public.school_subscriptions set anzahl_lizenzen = 99",
      ),
    ).rejects.toThrow();
  });
});

// ----------------------------------------------------------------------------
// 6) app.plan_katalog — anon-tauglicher, PII-freier Katalog
// ----------------------------------------------------------------------------
describe("0031 — plan_katalog", () => {
  it("anonym lesbar: liefert die 0029-Referenzpläne (start + os)", async () => {
    const rows = await selectAsUser<{ code: string; preis_monat_netto_cent: number }>(
      db, null, "select code, preis_monat_netto_cent from app.plan_katalog()",
    );
    const codes = rows.map((r) => r.code);
    expect(codes).toContain("start");
    expect(codes).toContain("os");
  });

  it("direkter subscription_plans-SELECT bleibt anonym zu (nur der Definer)", async () => {
    expect(await selectAsUser(db, null, "select id from public.subscription_plans")).toHaveLength(0);
  });
});
