import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb, selectAsUser, asUser } from "./harness";
import { seed, type Seed } from "./seed";

/**
 * os-fundament.test.ts — Migration 0029 (OS-V1 P1): RLS-Fix Bestand + neue Tabellen.
 * - Support-Ausschluss enrollments/appointments/invoices (PII-Linie).
 * - appointments: Spalten-Minimierung (preis/abgerechnet server-only) + Write-Deny.
 * - Plattformrolle 'vertrieb' (Allowlist, kein 'lehrer').
 * - api_partners/api_partner_members/api_keys/api_idempotency/time_entries/
 *   feature_flags/webhook_subscriptions/subscription_plans: Policies + Grants.
 */
let db: PGlite;
let s: Seed;

// Bootstrap-Daten (erhöhter Pfad, umgeht RLS — wie tests/rls/seed.ts).
let vertriebU: string;
let partnerA: string;
let partnerB: string;
let keyA: string;
let flagSchoolA: string;
let webhookA: string;

const SHA = (n: string) => n.repeat(64).slice(0, 64); // 64 hex-Zeichen

beforeAll(async () => {
  db = await createTestDb();
  s = await seed(db);

  const id = async (sqlText: string, params: unknown[] = []) =>
    (await db.query<{ id: string }>(sqlText, params)).rows[0].id;

  vertriebU = await id(
    "insert into public.users (id,email,account_typ) values (gen_random_uuid(),'vertrieb@test.de','platform_staff') returning id",
  );
  await db.query("insert into public.platform_role_assignments (user_id,role) values ($1,'vertrieb')", [vertriebU]);

  partnerA = await id("insert into public.api_partners (name) values ('Partner A') returning id");
  partnerB = await id("insert into public.api_partners (name) values ('Partner B') returning id");
  // ghostU dient als Partner-Mitglied von Partner A (hat KEINE Schulrolle).
  await db.query("insert into public.api_partner_members (partner_id,user_id) values ($1,$2)", [partnerA, s.ghostU]);

  keyA = await id(
    "insert into public.api_keys (partner_id,key_hash,prefix,scopes) values ($1,$2,'olk_testa','{mcp}') returning id",
    [partnerA, SHA("a")],
  );
  await db.query(
    "insert into public.api_keys (partner_id,key_hash,prefix,scopes) values ($1,$2,'olk_testb','{rest_read}')",
    [partnerB, SHA("b")],
  );

  await db.query("insert into public.feature_flags (scope,key,aktiv) values ('global','pay',false)");
  flagSchoolA = await id(
    "insert into public.feature_flags (scope,school_id,key,aktiv) values ('school',$1,'pay',true) returning id",
    [s.schoolA],
  );

  webhookA = await id(
    "insert into public.webhook_subscriptions (partner_id,url,events,secret_hash) values ($1,'https://partner-a.example/hook','{lead.eingegangen}',$2) returning id",
    [partnerA, SHA("c")],
  );
});
afterAll(async () => {
  await db?.close();
});

const ids = (rows: { id: string }[]) => rows.map((r) => r.id);

describe("0029 — Support-Ausschluss (PII-Linie) auf enrollments/appointments/invoices", () => {
  it("support sieht KEINE appointments mehr (0000-Policy ersetzt)", async () => {
    expect(await selectAsUser(db, { sub: s.supportU }, "select id from public.appointments")).toHaveLength(0);
  });
  it("support sieht weiterhin keine enrollments/invoices", async () => {
    expect(await selectAsUser(db, { sub: s.supportU }, "select id from public.enrollments")).toHaveLength(0);
    expect(await selectAsUser(db, { sub: s.supportU }, "select id from public.invoices")).toHaveLength(0);
  });
  it("fahrlehrer liest weiterhin ALLE Termine der Schule (Quer-Routing bleibt)", async () => {
    const got = ids(await selectAsUser<{ id: string }>(db, { sub: s.fahrlehrerA }, "select id from public.appointments"));
    expect(got).toEqual(expect.arrayContaining([s.apptA, s.apptUnassigned, s.apptGhost]));
  });
});

describe("0029 — appointments: Spalten-Minimierung + Write-Deny", () => {
  it("preis/abgerechnet sind für app_user gesperrt (42501)", async () => {
    await expect(
      selectAsUser(db, { sub: s.inhaberA }, "select preis from public.appointments"),
    ).rejects.toThrow();
    await expect(
      selectAsUser(db, { sub: s.inhaberA }, "select abgerechnet from public.appointments"),
    ).rejects.toThrow();
  });
  it("auch die Verwaltung kann appointments (noch) nicht schreiben (Grant entzogen)", async () => {
    await expect(
      asUser(db, { sub: s.inhaberA }, (tx) =>
        tx.query("insert into public.appointments (enrollment_id,typ) values ($1,'theorie')", [s.enrA]),
      ),
    ).rejects.toThrow();
    await expect(
      asUser(db, { sub: s.inhaberA }, (tx) =>
        tx.query("update public.appointments set status='cancelled' where id=$1", [s.apptA]),
      ),
    ).rejects.toThrow();
  });
});

describe("0029 — Plattformrolle 'vertrieb'", () => {
  it("Rolle ist zugewiesen und wirkt authentifiziert (keine vertraulichen Flags, kein PII-Zugriff)", async () => {
    const flags = await selectAsUser<{ key: string; scope: string }>(
      db, { sub: vertriebU }, "select key, scope from public.feature_flags",
    );
    // Nach 0032: globale Flags sind admin-only (kein Existenz-Leak vertraulicher
    // Flags). vertrieb ist weder admin noch Schul-Mitglied → sieht KEINE Zeilen.
    expect(flags).toHaveLength(0);
    expect(await selectAsUser(db, { sub: vertriebU }, "select id from public.enrollments")).toHaveLength(0);
  });
  it("'lehrer' bleibt außerhalb der Allowlist (CHECK lehnt ab)", async () => {
    await expect(
      db.query("insert into public.platform_role_assignments (user_id,role) values ($1,'lehrer')", [s.adminU]),
    ).rejects.toThrow();
  });
});

describe("0029 — api_partners / api_partner_members", () => {
  it("Partner-Mitglied liest NUR den eigenen Partner; Fremde sehen nichts", async () => {
    const eigene = ids(await selectAsUser<{ id: string }>(db, { sub: s.ghostU }, "select id from public.api_partners"));
    expect(eigene).toEqual([partnerA]);
    expect(await selectAsUser(db, { sub: s.studentA }, "select id from public.api_partners")).toHaveLength(0);
  });
  it("admin liest alle Partner; Nicht-Admin kann keinen Partner anlegen", async () => {
    const alle = ids(await selectAsUser<{ id: string }>(db, { sub: s.adminU }, "select id from public.api_partners"));
    expect(alle).toEqual(expect.arrayContaining([partnerA, partnerB]));
    await expect(
      asUser(db, { sub: s.ghostU }, (tx) =>
        tx.query("insert into public.api_partners (name) values ('Einbruch')"),
      ),
    ).rejects.toThrow();
  });
  it("Mitglied sieht die eigene Zuordnung, nicht fremde", async () => {
    const rows = await selectAsUser<{ partner_id: string }>(
      db, { sub: s.ghostU }, "select partner_id from public.api_partner_members",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].partner_id).toBe(partnerA);
  });
});

describe("0029 — api_keys (Hash unsichtbar, Verwaltung admin-only)", () => {
  it("Partner-Mitglied liest die eigenen Keys (prefix/scopes), NIE key_hash (42501)", async () => {
    const rows = await selectAsUser<{ id: string; prefix: string }>(
      db, { sub: s.ghostU }, "select id, prefix from public.api_keys",
    );
    expect(ids(rows)).toEqual([keyA]);
    await expect(
      selectAsUser(db, { sub: s.ghostU }, "select key_hash from public.api_keys"),
    ).rejects.toThrow();
    await expect(
      selectAsUser(db, { sub: s.adminU }, "select key_hash from public.api_keys"),
    ).rejects.toThrow();
  });
  it("Mitglied kann Keys nicht ändern (0 Zeilen); admin widerruft (status)", async () => {
    const r = await asUser(db, { sub: s.ghostU }, (tx) =>
      tx.query("update public.api_keys set status='widerrufen' where id=$1", [keyA]),
    );
    expect(r.affectedRows).toBe(0);
    const ok = await asUser(db, { sub: s.adminU }, (tx) =>
      tx.query("update public.api_keys set status='widerrufen', rotated_at=now() where id=$1", [keyA]),
    );
    expect(ok.affectedRows).toBe(1);
  });
  it("Scope-Allowlist: unbekannter Scope wird DB-hart abgelehnt", async () => {
    await expect(
      db.query(
        "insert into public.api_keys (partner_id,key_hash,prefix,scopes) values ($1,$2,'olk_testx','{rest_write}')",
        [partnerA, SHA("d")],
      ),
    ).rejects.toThrow();
  });
});

describe("0029 — api_idempotency: deny-by-default (auch admin via app_user)", () => {
  it("SELECT/INSERT sind für app_user komplett gesperrt", async () => {
    await expect(
      selectAsUser(db, { sub: s.adminU }, "select id from public.api_idempotency"),
    ).rejects.toThrow();
    await expect(
      asUser(db, { sub: s.adminU }, (tx) =>
        tx.query(
          "insert into public.api_idempotency (key_hash,endpoint,expires_at) values ($1,'/v1/ping',now()+interval '1 day')",
          [SHA("e")],
        ),
      ),
    ).rejects.toThrow();
  });
});

describe("0029 — time_entries: eigene schreiben, Verwaltung liest Schule", () => {
  it("fahrlehrer stempelt sich selbst ein und liest den eigenen Eintrag", async () => {
    await asUser(db, { sub: s.fahrlehrerA }, (tx) =>
      tx.query(
        "insert into public.time_entries (school_id,member_user_id,start_at,kategorie) values ($1,$2,now(),'fahrstunde')",
        [s.schoolA, s.fahrlehrerA],
      ),
    );
    const eigene = await selectAsUser(db, { sub: s.fahrlehrerA }, "select id from public.time_entries");
    expect(eigene).toHaveLength(1);
  });
  it("Einträge für ANDERE sind unmöglich (RLS with check)", async () => {
    await expect(
      asUser(db, { sub: s.fahrlehrerA }, (tx) =>
        tx.query(
          "insert into public.time_entries (school_id,member_user_id,start_at) values ($1,$2,now())",
          [s.schoolA, s.verwaltungA],
        ),
      ),
    ).rejects.toThrow();
  });
  it("Nicht-Mitglieder (student/ghost) können nicht stempeln; Verwaltung liest die Schule", async () => {
    await expect(
      asUser(db, { sub: s.studentA }, (tx) =>
        tx.query(
          "insert into public.time_entries (school_id,member_user_id,start_at) values ($1,$2,now())",
          [s.schoolA, s.studentA],
        ),
      ),
    ).rejects.toThrow();
    expect(await selectAsUser(db, { sub: s.inhaberA }, "select id from public.time_entries")).toHaveLength(1);
    expect(await selectAsUser(db, { sub: s.studentA }, "select id from public.time_entries")).toHaveLength(0);
  });
  it("fahrlehrer beendet den EIGENEN Eintrag; school_id ist unveränderlich (42501)", async () => {
    const r = await asUser(db, { sub: s.fahrlehrerA }, (tx) =>
      tx.query("update public.time_entries set ende_at = start_at + interval '1 hour' where member_user_id=$1", [s.fahrlehrerA]),
    );
    expect(r.affectedRows).toBe(1);
    await expect(
      asUser(db, { sub: s.fahrlehrerA }, (tx) =>
        tx.query("update public.time_entries set school_id=$1 where member_user_id=$2", [s.schoolUnlisted, s.fahrlehrerA]),
      ),
    ).rejects.toThrow();
  });
});

describe("0029 — feature_flags: Scope-Lesen, Schreiben nur admin", () => {
  it("anonym + Nicht-Admin: keine globalen Flags; admin: global sichtbar (0032)", async () => {
    expect(await selectAsUser(db, null, "select id from public.feature_flags")).toHaveLength(0);
    // Nach 0032: globale Flags NUR für admin — Student darf die EXISTENZ eines
    // vertraulichen Flags nicht ableiten (kein Schul-Flag der eigenen Schule hier).
    expect(
      await selectAsUser(db, { sub: s.studentA }, "select id from public.feature_flags where scope='global'"),
    ).toHaveLength(0);
    const adminRows = await selectAsUser<{ scope: string }>(
      db, { sub: s.adminU }, "select scope from public.feature_flags",
    );
    expect(adminRows.some((r) => r.scope === "global")).toBe(true);
  });
  it("Schul-Flag sehen nur Mitglieder (fahrlehrerA ja, studentB nein)", async () => {
    const mitglied = ids(await selectAsUser<{ id: string }>(
      db, { sub: s.fahrlehrerA }, "select id from public.feature_flags where scope='school'",
    ));
    expect(mitglied).toEqual([flagSchoolA]);
    expect(
      await selectAsUser(db, { sub: s.studentB }, "select id from public.feature_flags where scope='school'"),
    ).toHaveLength(0);
  });
  it("Nicht-Admin kann aktiv nicht schalten (0 Zeilen); admin schon; Key-Allowlist hart", async () => {
    const r = await asUser(db, { sub: s.inhaberA }, (tx) =>
      tx.query("update public.feature_flags set aktiv=true where id=$1", [flagSchoolA]),
    );
    expect(r.affectedRows).toBe(0);
    const ok = await asUser(db, { sub: s.adminU }, (tx) =>
      tx.query("update public.feature_flags set aktiv=false where id=$1", [flagSchoolA]),
    );
    expect(ok.affectedRows).toBe(1);
    await expect(
      asUser(db, { sub: s.adminU }, (tx) =>
        tx.query("insert into public.feature_flags (scope,key,aktiv) values ('global','geheim',true)"),
      ),
    ).rejects.toThrow();
  });
});

describe("0029 — webhook_subscriptions: https-Pflicht, Secret unsichtbar", () => {
  it("Partner-Mitglied liest eigene Subscription ohne secret_hash (42501)", async () => {
    const rows = ids(await selectAsUser<{ id: string }>(
      db, { sub: s.ghostU }, "select id from public.webhook_subscriptions",
    ));
    expect(rows).toEqual([webhookA]);
    await expect(
      selectAsUser(db, { sub: s.ghostU }, "select secret_hash from public.webhook_subscriptions"),
    ).rejects.toThrow();
  });
  it("http-URL und unbekannte Events werden DB-hart abgelehnt", async () => {
    await expect(
      db.query(
        "insert into public.webhook_subscriptions (partner_id,url,events,secret_hash) values ($1,'http://unsicher.example/h','{lead.eingegangen}',$2)",
        [partnerA, SHA("f")],
      ),
    ).rejects.toThrow();
    await expect(
      db.query(
        "insert into public.webhook_subscriptions (partner_id,url,events,secret_hash) values ($1,'https://ok.example/h','{alles.abgreifen}',$2)",
        [partnerA, SHA("f")],
      ),
    ).rejects.toThrow();
  });
  it("Mitglied kann die Subscription nicht ändern (0 Zeilen)", async () => {
    const r = await asUser(db, { sub: s.ghostU }, (tx) =>
      tx.query("update public.webhook_subscriptions set status='pausiert' where id=$1", [webhookA]),
    );
    expect(r.affectedRows).toBe(0);
  });
});

describe("0029 — subscription_plans: Referenzdaten + Lese-Policy", () => {
  it("anonym: keine Pläne; authentifiziert: start (0) und os (9900/2900, Aktion 4900/3)", async () => {
    expect(await selectAsUser(db, null, "select id from public.subscription_plans")).toHaveLength(0);
    const rows = await selectAsUser<{
      code: string; name: string; preis_monat_netto_cent: number; seat_preis_monat_netto_cent: number | null; aktion_preis_monat_netto_cent: number | null; aktion_monate: number | null;
    }>(db, { sub: s.studentA }, "select code, name, preis_monat_netto_cent, seat_preis_monat_netto_cent, aktion_preis_monat_netto_cent, aktion_monate from public.subscription_plans order by code");
    const start = rows.find((r) => r.code === "start");
    const os = rows.find((r) => r.code === "os");
    expect(start?.name).toBe("onelane start");
    expect(start?.preis_monat_netto_cent).toBe(0);
    expect(os?.name).toBe("onelane os");
    expect(os?.preis_monat_netto_cent).toBe(9900);
    expect(os?.aktion_preis_monat_netto_cent).toBe(4900);
    expect(os?.aktion_monate).toBe(3);
    expect(os?.seat_preis_monat_netto_cent).toBe(2900);
  });
  it("Schreiben ist auch für admin via app_user gesperrt (Grant entzogen)", async () => {
    await expect(
      asUser(db, { sub: s.adminU }, (tx) =>
        tx.query("update public.subscription_plans set preis_monat_netto_cent=1 where code='os'"),
      ),
    ).rejects.toThrow();
  });
});
