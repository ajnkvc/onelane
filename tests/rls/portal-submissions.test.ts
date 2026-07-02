import { describe, it, expect, beforeAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb, asUser, selectAsUser } from "./harness";
import { seed, type Seed } from "./seed";

/**
 * portal-submissions.test.ts — RLS-Invarianten der Migrationen 0021–0023:
 * school_prices (öffentliche Preisdaten, Spalten-Allowlist) sowie leads und
 * job_applications (PII; ERSTER anonymer Schreibpfad der Plattform).
 *
 * Abgedeckte Kern-Invarianten:
 *  - Preise: Public-Read nur gelistet+aktiv; `quelle` spalten-gesperrt; Schreiben
 *    nur Schul-Manager (kein Fahrlehrer), Zeilen-Identität (school_id/klasse) fix.
 *  - Leads/Bewerbungen: anonymer INSERT nur unter präzisem WITH CHECK (gelistete
 *    Schule / gültige Anzeige, Einwilligungen, Status-Default); KEIN anonymes
 *    SELECT (auch nicht via RETURNING); UPDATE nur `status`; kein DELETE-Grant;
 *    KEIN support-Zugriff (0016-PII-Linie); Guardian-Gate für Minderjährige.
 *  - school_jobs: Public-Read respektiert das Gültigkeitsfenster (0023/K8).
 */

let db: PGlite;
let s: Seed;

// SQLSTATE-genaue Ablehnungs-Helfer (Muster der bestehenden Suiten).
async function expectSqlState(p: Promise<unknown>, state: string) {
  await expect(p).rejects.toMatchObject({ code: state });
}
const DENIED = "42501"; // insufficient_privilege (Spalten-/Tabellen-Grant oder RLS-Verstoß-Fehlerpfad)
const RLS_VIOLATION = "42501"; // new row violates row-level security policy → ebenfalls 42501
const CHECK_VIOLATION = "23514";
const NOT_NULL = "23502";

beforeAll(async () => {
  db = await createTestDb();
  s = await seed(db);

  // Preiszeilen (Bootstrap = erhöhter Pfad): gelistete Schule aktiv+inaktiv, ungelistete Schule.
  await db.query(
    `insert into public.school_prices
       (school_id,klasse,grundbetrag,fahrstunde_45,sonderfahrt_ueberland_45,status,stand,quelle,aktiv)
     values
       ($1,'B',450.00,65.00,75.00,'recherchiert','2026-06-01','intern: aushang-foto',true),
       ($1,'A1',400.00,60.00,70.00,'bestaetigt','2026-06-01',null,true),
       ($1,'BE',300.00,55.00,65.00,'recherchiert','2026-06-01',null,false),
       ($2,'B',500.00,70.00,80.00,'recherchiert','2026-06-01',null,true)`,
    [s.schoolA, s.schoolUnlisted],
  );

  // Zusätzliche Jobs: abgelaufen (schoolA) + ungelistete Schule (für Bewerbungs-Negativtests).
  await db.query(
    `insert into public.school_jobs (school_id,titel,slug,aktiv,gueltig_bis) values
       ($1,'Abgelaufen','job-abgelaufen',true,'2020-01-01'),
       ($2,'Unsichtbar','job-unsichtbar',true,null)`,
    [s.schoolA, s.schoolUnlisted],
  );
});

async function jobIdBySlug(slug: string): Promise<string> {
  const r = await db.query<{ id: string }>(
    "select id from public.school_jobs where slug=$1",
    [slug],
  );
  return r.rows[0].id;
}

const LEAD_COLS =
  "(school_id,klasse,zeitraum,vorname,email,ist_minderjaehrig,einwilligung_datenschutz_at,einwilligung_weitergabe_at,quelle_pfad)";
const LEAD_VALS = "($1,'B','sofort','Anna','anna@test.de',false,now(),now(),'/fahrschulen/muenchen/a/anfrage')";

describe("0021 school_prices — Public-Read + Spalten-Allowlist + Manager-Write", () => {
  it("anonym: sieht nur aktive Preise gelisteter Schulen (nicht inaktiv, nicht ungelistet)", async () => {
    const rows = await selectAsUser<{ school_id: string; klasse: string }>(
      db, null, "select school_id, klasse from public.school_prices",
    );
    const keys = rows.map((r) => `${r.school_id}:${r.klasse}`);
    expect(keys).toContain(`${s.schoolA}:B`);
    expect(keys).toContain(`${s.schoolA}:A1`);
    expect(keys).not.toContain(`${s.schoolA}:BE`); // aktiv=false
    expect(keys).not.toContain(`${s.schoolUnlisted}:B`); // ungelistet
  });

  it("anonym: `quelle` ist spalten-gesperrt (42501)", async () => {
    await expectSqlState(
      selectAsUser(db, null, "select quelle from public.school_prices"),
      DENIED,
    );
  });

  it("anonym: INSERT in school_prices scheitert (keine anonyme Write-Policy)", async () => {
    await expectSqlState(
      asUser(db, null, (q) =>
        q.query(
          "insert into public.school_prices (school_id,klasse,grundbetrag) values ($1,'C',999)",
          [s.schoolA],
        ),
      ),
      RLS_VIOLATION,
    );
  });

  it("fahrlehrer: darf Preise NICHT schreiben (kein Manager; 0 Zeilen)", async () => {
    const res = await asUser(db, { sub: s.fahrlehrerA }, (q) =>
      q.query("update public.school_prices set grundbetrag=1 where school_id=$1", [s.schoolA]),
    );
    expect(res.affectedRows ?? 0).toBe(0);
  });

  it("verwaltung: darf Preise der EIGENEN Schule pflegen (Status bestätigen)", async () => {
    const res = await asUser(db, { sub: s.verwaltungA }, (q) =>
      q.query(
        "update public.school_prices set status='bestaetigt', stand=current_date where school_id=$1 and klasse='B'",
        [s.schoolA],
      ),
    );
    expect(res.affectedRows).toBe(1);
  });

  it("verwaltung: fremde Schule bleibt unantastbar (0 Zeilen)", async () => {
    const res = await asUser(db, { sub: s.verwaltungA }, (q) =>
      q.query("update public.school_prices set grundbetrag=1 where school_id=$1", [s.schoolUnlisted]),
    );
    expect(res.affectedRows ?? 0).toBe(0);
  });

  it("verwaltung: school_id/klasse sind UPDATE-gesperrt (Zeilen-Identität fix, 42501)", async () => {
    await expectSqlState(
      asUser(db, { sub: s.verwaltungA }, (q) =>
        q.query("update public.school_prices set klasse='C' where school_id=$1", [s.schoolA]),
      ),
      DENIED,
    );
  });

  it("verwaltung: `quelle` ist auch fürs Schreiben gesperrt (42501)", async () => {
    await expectSqlState(
      asUser(db, { sub: s.verwaltungA }, (q) =>
        q.query("update public.school_prices set quelle='x' where school_id=$1", [s.schoolA]),
      ),
      DENIED,
    );
  });

  it("CHECK: negative Entgelte werden abgelehnt (23514, Bootstrap-Pfad)", async () => {
    await expectSqlState(
      db.query(
        "insert into public.school_prices (school_id,klasse,grundbetrag) values ($1,'C',-1)",
        [s.schoolA],
      ),
      CHECK_VIOLATION,
    );
  });
});

describe("0022 leads — anonymer INSERT eng, kein anonymes Lesen, PII unveränderlich", () => {
  it("anonym: Lead an gelistete Schule wird angenommen (ohne RETURNING)", async () => {
    await asUser(db, null, (q) =>
      q.query(`insert into public.leads ${LEAD_COLS} values ${LEAD_VALS}`, [s.schoolA]),
    );
    // Verifikation über den erhöhten Pfad (anonym gibt es bewusst kein SELECT).
    const check = await db.query<{ status: string }>(
      "select status from public.leads where school_id=$1 and vorname='Anna'",
      [s.schoolA],
    );
    expect(check.rows[0]?.status).toBe("neu");
  });

  it("anonym: RETURNING scheitert (SELECT-Policy greift auf RETURNING — kein Datenrückfluss)", async () => {
    await expectSqlState(
      asUser(db, null, (q) =>
        q.query(`insert into public.leads ${LEAD_COLS} values ${LEAD_VALS} returning id`, [s.schoolA]),
      ),
      DENIED,
    );
  });

  it("anonym: Lead an UNGELISTETE Schule wird abgelehnt (RLS WITH CHECK)", async () => {
    await expectSqlState(
      asUser(db, null, (q) =>
        q.query(`insert into public.leads ${LEAD_COLS} values ${LEAD_VALS}`, [s.schoolUnlisted]),
      ),
      RLS_VIOLATION,
    );
  });

  it("anonym: status ist nicht INSERT-grantbar (Status-Wahl unmöglich, 42501)", async () => {
    await expectSqlState(
      asUser(db, null, (q) =>
        q.query(
          "insert into public.leads (school_id,klasse,vorname,email,status,einwilligung_datenschutz_at,einwilligung_weitergabe_at) values ($1,'B','Eve','eve@test.de','erledigt',now(),now())",
          [s.schoolA],
        ),
      ),
      DENIED,
    );
  });

  it("anonym: ohne Einwilligung kein Lead (RLS-WITH-CHECK greift VOR NOT NULL → 42501)", async () => {
    await expectSqlState(
      asUser(db, null, (q) =>
        q.query(
          "insert into public.leads (school_id,klasse,vorname,email,einwilligung_weitergabe_at) values ($1,'B','Eve','eve@test.de',now())",
          [s.schoolA],
        ),
      ),
      RLS_VIOLATION,
    );
  });

  it("erhöhter Pfad: NOT NULL bleibt Backstop für Einwilligungen (23502, Bootstrap)", async () => {
    await expectSqlState(
      db.query(
        "insert into public.leads (school_id,klasse,vorname,email,einwilligung_weitergabe_at) values ($1,'B','Eve','eve@test.de',now())",
        [s.schoolA],
      ),
      NOT_NULL,
    );
  });

  it("anonym: Minderjährig ohne Guardian-Kontakt wird abgelehnt (Guardian-Gate, 23514)", async () => {
    await expectSqlState(
      asUser(db, null, (q) =>
        q.query(
          "insert into public.leads (school_id,klasse,vorname,email,ist_minderjaehrig,einwilligung_datenschutz_at,einwilligung_weitergabe_at) values ($1,'B','Kim','kim@test.de',true,now(),now())",
          [s.schoolA],
        ),
      ),
      CHECK_VIOLATION,
    );
  });

  it("anonym: weder E-Mail noch Telefon → abgelehnt (Kontakt-Mindestregel, 23514)", async () => {
    await expectSqlState(
      asUser(db, null, (q) =>
        q.query(
          "insert into public.leads (school_id,klasse,vorname,einwilligung_datenschutz_at,einwilligung_weitergabe_at) values ($1,'B','Niemand',now(),now())",
          [s.schoolA],
        ),
      ),
      CHECK_VIOLATION,
    );
  });

  it("anonym: SELECT liefert 0 Zeilen (keine anonyme Lese-Policy)", async () => {
    const rows = await selectAsUser(db, null, "select id from public.leads");
    expect(rows).toHaveLength(0);
  });

  it("verwaltung: sieht Leads der eigenen Schule; fahrlehrer NICHT; support NICHT (PII-Linie)", async () => {
    const mgr = await selectAsUser(db, { sub: s.verwaltungA }, "select id from public.leads");
    expect(mgr.length).toBeGreaterThan(0);
    const lehrer = await selectAsUser(db, { sub: s.fahrlehrerA }, "select id from public.leads");
    expect(lehrer).toHaveLength(0);
    const support = await selectAsUser(db, { sub: s.supportU }, "select id from public.leads");
    expect(support).toHaveLength(0);
  });

  it("verwaltung: darf status pflegen, PII-Felder NICHT (42501)", async () => {
    const ok = await asUser(db, { sub: s.verwaltungA }, (q) =>
      q.query("update public.leads set status='gesehen' where school_id=$1", [s.schoolA]),
    );
    expect(ok.affectedRows).toBeGreaterThan(0);
    await expectSqlState(
      asUser(db, { sub: s.verwaltungA }, (q) =>
        q.query("update public.leads set vorname='Manipuliert' where school_id=$1", [s.schoolA]),
      ),
      DENIED,
    );
  });

  it("DELETE ist für app_user komplett gesperrt — selbst als admin (42501)", async () => {
    await expectSqlState(
      asUser(db, { sub: s.adminU }, (q) => q.query("delete from public.leads")),
      DENIED,
    );
  });
});

describe("0023 school_jobs Gültigkeitsfenster + job_applications", () => {
  it("anonym: abgelaufene Anzeige ist öffentlich unsichtbar (K8)", async () => {
    const rows = await selectAsUser<{ slug: string }>(
      db, null, "select slug from public.school_jobs",
    );
    const slugs = rows.map((r) => r.slug);
    expect(slugs).toContain("fahrlehrer-m-w-d-seed-a");
    expect(slugs).not.toContain("job-abgelaufen");
    expect(slugs).not.toContain("job-unsichtbar"); // ungelistete Schule
  });

  it("verwaltung: sieht auch die eigene abgelaufene Anzeige (Reaktivierungs-Pfad)", async () => {
    const rows = await selectAsUser<{ slug: string }>(
      db, { sub: s.verwaltungA }, "select slug from public.school_jobs",
    );
    expect(rows.map((r) => r.slug)).toContain("job-abgelaufen");
  });

  it("anonym: Bewerbung auf gültige Anzeige gelisteter Schule wird angenommen", async () => {
    const jobId = await jobIdBySlug("fahrlehrer-m-w-d-seed-a");
    await asUser(db, null, (q) =>
      q.query(
        "insert into public.job_applications (job_id,name,email,einwilligung_datenschutz_at,einwilligung_weitergabe_at) values ($1,'Bewerber B','b@test.de',now(),now())",
        [jobId],
      ),
    );
    const check = await db.query<{ status: string }>(
      "select status from public.job_applications where job_id=$1", [jobId],
    );
    expect(check.rows[0]?.status).toBe("neu");
  });

  it("anonym: ohne Weitergabe-Einwilligung wird die Bewerbung abgelehnt (0025-WITH-CHECK)", async () => {
    const jobId = await jobIdBySlug("fahrlehrer-m-w-d-seed-a");
    await expectSqlState(
      asUser(db, null, (q) =>
        q.query(
          "insert into public.job_applications (job_id,name,email,einwilligung_datenschutz_at) values ($1,'Ohne W','ow@test.de',now())",
          [jobId],
        ),
      ),
      RLS_VIOLATION,
    );
  });

  it("anonym: Bewerbung auf ABGELAUFENE Anzeige wird abgelehnt (RLS WITH CHECK)", async () => {
    const jobId = await jobIdBySlug("job-abgelaufen");
    await expectSqlState(
      asUser(db, null, (q) =>
        q.query(
          "insert into public.job_applications (job_id,name,email,einwilligung_datenschutz_at,einwilligung_weitergabe_at) values ($1,'Zu Spät','z@test.de',now(),now())",
          [jobId],
        ),
      ),
      RLS_VIOLATION,
    );
  });

  it("anonym: Bewerbung bei UNGELISTETER Schule wird abgelehnt (RLS WITH CHECK)", async () => {
    const jobId = await jobIdBySlug("job-unsichtbar");
    await expectSqlState(
      asUser(db, null, (q) =>
        q.query(
          "insert into public.job_applications (job_id,name,email,einwilligung_datenschutz_at,einwilligung_weitergabe_at) values ($1,'Geist','g@test.de',now(),now())",
          [jobId],
        ),
      ),
      RLS_VIOLATION,
    );
  });

  it("anonym: SELECT auf Bewerbungen liefert 0 Zeilen; support ebenfalls (PII-Linie)", async () => {
    expect(await selectAsUser(db, null, "select id from public.job_applications")).toHaveLength(0);
    expect(await selectAsUser(db, { sub: s.supportU }, "select id from public.job_applications")).toHaveLength(0);
  });

  it("verwaltung: sieht Bewerbungen der eigenen Schule und pflegt nur status", async () => {
    const rows = await selectAsUser(db, { sub: s.verwaltungA }, "select id from public.job_applications");
    expect(rows.length).toBeGreaterThan(0);
    await expectSqlState(
      asUser(db, { sub: s.verwaltungA }, (q) =>
        q.query("update public.job_applications set name='X'"),
      ),
      DENIED,
    );
  });

  it("DELETE auf Bewerbungen ist für app_user gesperrt — selbst als admin (42501)", async () => {
    await expectSqlState(
      asUser(db, { sub: s.adminU }, (q) => q.query("delete from public.job_applications")),
      DENIED,
    );
  });
});
