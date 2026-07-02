import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb, asUser, selectAsUser } from "./harness";
import { seed, type Seed } from "./seed";

/**
 * jobs-kuratierung.test.ts — Invarianten der Migration 0025 (Jobbörse M5):
 *
 *  - Public-SELECT: Gültigkeitsfenster bleibt (aktiv + gelistet + nicht
 *    abgelaufen), NEUE Spalten (Gehalt/Klassen/Flags) sind anonym lesbar.
 *  - Gehalts-Integrität DB-HART (chk_school_jobs_gehalt): entweder alle vier
 *    Felder NULL oder komplett + plausibel + bestätigt — Teilangaben existieren
 *    nie in der Tabelle (nichts kann leaken).
 *  - Klassen-Allowlist + Cap + Duplikat-Schutz (app.array_eindeutig).
 *  - Rechte-Modell Phase 1 KURATIERT: school_jobs-Writes nur admin/editor;
 *    Schul-Manager (verwaltung/inhaber) und Fahrlehrer sind raus.
 *  - job_applications: Insert-Pfad verlangt BEIDE Einwilligungen (0025-WITH-
 *    CHECK), bewerber_status-/Verfügbarkeits-/Unterlagen-CHECKs, Status-
 *    Allowlist; UPDATE bleibt status-only.
 *  - Purge: app.purge_job_applications ist NUR privilegiert aufrufbar
 *    (kein EXECUTE für app_user), respektiert die 6-Monats-Retention und
 *    schreibt ein auditierbares security_events-Event.
 */

let db: PGlite;
let s: Seed;
let jobGehaltId: string;

async function expectSqlState(p: Promise<unknown>, state: string) {
  await expect(p).rejects.toMatchObject({ code: state });
}
const DENIED = "42501";
const RLS_VIOLATION = "42501";
const CHECK_VIOLATION = "23514";
const INVALID_PARAM = "22023";

const APP_COLS =
  "(job_id,name,email,bewerber_status,klassen,verfuegbar_status,verfuegbar_ab," +
  "cv_dateiname,cv_groesse_bytes,einwilligung_datenschutz_at,einwilligung_weitergabe_at)";

beforeAll(async () => {
  db = await createTestDb();
  s = await seed(db);

  // Bootstrap-Anzeigen: gültig mit KOMPLETT bestätigtem Gehalt (schoolA),
  // abgelaufen (schoolA), ungelistete Schule.
  const r = await db.query<{ id: string }>(
    `insert into public.school_jobs
       (school_id,titel,slug,aktiv,gueltig_bis,
        gehalt_von_euro,gehalt_bis_euro,gehalt_zeitraum,gehalt_bestaetigt_am,
        klassen,quereinsteiger_willkommen,quereinsteiger_finanzierung,
        arbeitszeit_modell,samstag_dienst,geprueft_am)
     values ($1,'Mit Gehalt','k-job-gehalt',true,null,
             3400,3900,'monat',current_date,
             '{B,B197}',true,'anteilig','vollzeit',false,current_date)
     returning id`,
    [s.schoolA],
  );
  jobGehaltId = r.rows[0].id;
  await db.query(
    `insert into public.school_jobs (school_id,titel,slug,aktiv,gueltig_bis) values
       ($1,'Abgelaufen K','k-job-abgelaufen',true,'2020-01-01'),
       ($2,'Unsichtbar K','k-job-unsichtbar',true,null)`,
    [s.schoolA, s.schoolUnlisted],
  );
});

afterAll(async () => {
  await db?.close();
});

describe("0025 school_jobs — Public-SELECT: Fenster + neue Spalten", () => {
  it("anonym: gültige Anzeige inkl. Gehalts-/Flag-Spalten lesbar; abgelaufen/ungelistet unsichtbar", async () => {
    const rows = await selectAsUser<{
      slug: string; gehalt_von_euro: string | null; klassen: string[];
      quereinsteiger_finanzierung: string; geprueft_am: string | null;
    }>(
      db, null,
      "select slug, gehalt_von_euro, klassen, quereinsteiger_finanzierung, geprueft_am from public.school_jobs",
    );
    const slugs = rows.map((r) => r.slug);
    expect(slugs).toContain("k-job-gehalt");
    expect(slugs).not.toContain("k-job-abgelaufen");
    expect(slugs).not.toContain("k-job-unsichtbar");
    const g = rows.find((r) => r.slug === "k-job-gehalt")!;
    expect(Number(g.gehalt_von_euro)).toBe(3400);
    expect(g.klassen).toEqual(["B", "B197"]);
    expect(g.quereinsteiger_finanzierung).toBe("anteilig");
    expect(g.geprueft_am).toBeTruthy();
  });
});

describe("0025 school_jobs — Gehalts-CHECK ist DB-hart (alles-oder-nichts)", () => {
  const insert = (spalten: string, werte: string) =>
    db.query(
      `insert into public.school_jobs (school_id,titel,slug,${spalten}) values ($1,'G','g-${Math.random().toString(36).slice(2, 10)}',${werte})`,
      [s.schoolA],
    );

  it("unvollständige Spanne (nur von) wird abgelehnt (23514)", async () => {
    await expectSqlState(insert("gehalt_von_euro", "3000"), CHECK_VIOLATION);
  });

  it("Spanne ohne gehalt_bestaetigt_am wird abgelehnt — unbestätigt EXISTIERT nie (23514)", async () => {
    await expectSqlState(
      insert("gehalt_von_euro,gehalt_bis_euro,gehalt_zeitraum", "3000,3500,'monat'"),
      CHECK_VIOLATION,
    );
  });

  it("bis < von wird abgelehnt (23514)", async () => {
    await expectSqlState(
      insert(
        "gehalt_von_euro,gehalt_bis_euro,gehalt_zeitraum,gehalt_bestaetigt_am",
        "3900,3400,'monat',current_date",
      ),
      CHECK_VIOLATION,
    );
  });

  it("unplausible Obergrenze (Monat > 50.000) und unbekannter Zeitraum werden abgelehnt", async () => {
    await expectSqlState(
      insert(
        "gehalt_von_euro,gehalt_bis_euro,gehalt_zeitraum,gehalt_bestaetigt_am",
        "3000,90000,'monat',current_date",
      ),
      CHECK_VIOLATION,
    );
    await expectSqlState(
      insert(
        "gehalt_von_euro,gehalt_bis_euro,gehalt_zeitraum,gehalt_bestaetigt_am",
        "3000,3500,'woche',current_date",
      ),
      CHECK_VIOLATION,
    );
  });

  it("Bestätigungsdatum in der Zukunft wird abgelehnt (23514)", async () => {
    await expectSqlState(
      insert(
        "gehalt_von_euro,gehalt_bis_euro,gehalt_zeitraum,gehalt_bestaetigt_am",
        "3000,3500,'monat',current_date + 1",
      ),
      CHECK_VIOLATION,
    );
  });

  it("komplette bestätigte Spanne wird angenommen (Stunden-Zeitraum)", async () => {
    await insert(
      "gehalt_von_euro,gehalt_bis_euro,gehalt_zeitraum,gehalt_bestaetigt_am",
      "18.50,24,'stunde',current_date",
    );
  });

  it("klassen: Duplikate, fremde Tokens und > 12 Einträge werden abgelehnt", async () => {
    await expectSqlState(insert("klassen", "'{B,B}'"), CHECK_VIOLATION);
    await expectSqlState(insert("klassen", "'{XY}'"), CHECK_VIOLATION);
    await expectSqlState(
      insert("klassen", "'{AM,A1,A2,A,B,B196,B197,BE,C1,C1E,C,CE,D1}'"),
      CHECK_VIOLATION,
    );
  });
});

describe("0025 school_jobs — Rechte-Modell kuratiert (admin/editor)", () => {
  it("verwaltung: INSERT scheitert (RLS WITH CHECK, 42501)", async () => {
    await expectSqlState(
      asUser(db, { sub: s.verwaltungA }, (q) =>
        q.query(
          "insert into public.school_jobs (school_id,titel,slug) values ($1,'Selbst','selbst-anzeige')",
          [s.schoolA],
        ),
      ),
      RLS_VIOLATION,
    );
  });

  it("verwaltung/fahrlehrer: UPDATE trifft 0 Zeilen", async () => {
    for (const sub of [s.verwaltungA, s.fahrlehrerA]) {
      const r = await asUser(db, { sub }, (q) =>
        q.query("update public.school_jobs set titel='hack' where school_id=$1", [s.schoolA]),
      );
      expect(r.affectedRows ?? 0).toBe(0);
    }
  });

  it("editor (Kurator): darf Anzeigen pflegen (UPDATE ≥ 1 Zeile)", async () => {
    const r = await asUser(db, { sub: s.editorU }, (q) =>
      q.query("update public.school_jobs set geprueft_am=current_date where slug='k-job-gehalt'"),
    );
    expect(r.affectedRows).toBe(1);
  });

  it("admin: darf Anzeigen anlegen (Spalten-Allowlist genügt)", async () => {
    await asUser(db, { sub: s.adminU }, (q) =>
      q.query(
        `insert into public.school_jobs (school_id,titel,slug,klassen,arbeitszeit_modell)
         values ($1,'Kuratiert','k-job-kuratiert','{B}','teilzeit')`,
        [s.schoolA],
      ),
    );
    const check = await db.query<{ id: string }>(
      "select id from public.school_jobs where slug='k-job-kuratiert'",
    );
    expect(check.rows).toHaveLength(1);
  });

  it("admin: id/created_at bleiben INSERT-gesperrt (Spalten-Grant, 42501)", async () => {
    await expectSqlState(
      asUser(db, { sub: s.adminU }, (q) =>
        q.query(
          "insert into public.school_jobs (school_id,titel,slug,created_at) values ($1,'X','k-x',now())",
          [s.schoolA],
        ),
      ),
      DENIED,
    );
  });

  it("school_id ist UPDATE-gesperrt — Zeilen-Identität fix (42501)", async () => {
    await expectSqlState(
      asUser(db, { sub: s.adminU }, (q) =>
        q.query("update public.school_jobs set school_id=$1 where slug='k-job-gehalt'", [
          s.schoolUnlisted,
        ]),
      ),
      DENIED,
    );
  });
});

describe("0025 job_applications — Insert-Pfad, CHECKs, Status-Allowlist", () => {
  it("anonym: mit BEIDEN Einwilligungen + gültigen Feldern wird angenommen", async () => {
    await asUser(db, null, (q) =>
      q.query(
        `insert into public.job_applications ${APP_COLS}
         values ($1,'Kim Muster','kim@test.de','quereinsteiger','{B}','zum_datum','2027-01-01',
                 'lebenslauf.pdf',123456,now(),now())`,
        [jobGehaltId],
      ),
    );
    const check = await db.query<{ status: string; bewerber_status: string }>(
      "select status, bewerber_status from public.job_applications where job_id=$1 and name='Kim Muster'",
      [jobGehaltId],
    );
    expect(check.rows[0]?.status).toBe("neu");
    expect(check.rows[0]?.bewerber_status).toBe("quereinsteiger");
  });

  it("anonym: OHNE Weitergabe-Einwilligung → 42501 (0025-WITH-CHECK)", async () => {
    await expectSqlState(
      asUser(db, null, (q) =>
        q.query(
          "insert into public.job_applications (job_id,name,email,einwilligung_datenschutz_at) values ($1,'Ohne W','w@test.de',now())",
          [jobGehaltId],
        ),
      ),
      RLS_VIOLATION,
    );
  });

  it("anonym: OHNE Datenschutz-Einwilligung → 42501", async () => {
    await expectSqlState(
      asUser(db, null, (q) =>
        q.query(
          "insert into public.job_applications (job_id,name,email,einwilligung_weitergabe_at) values ($1,'Ohne D','d@test.de',now())",
          [jobGehaltId],
        ),
      ),
      RLS_VIOLATION,
    );
  });

  it("bewerber_status: nur Allowlist (23514); Backfill-Wert 'unbekannt' bleibt gültig", async () => {
    await expectSqlState(
      asUser(db, null, (q) =>
        q.query(
          `insert into public.job_applications ${APP_COLS}
           values ($1,'Chef','c@test.de','chef','{B}','sofort',null,'cv.pdf',1,now(),now())`,
          [jobGehaltId],
        ),
      ),
      CHECK_VIOLATION,
    );
    // Bootstrap (Bestands-Simulation): 'unbekannt' ist als Backfill-Wert erlaubt.
    await db.query(
      "insert into public.job_applications (job_id,name,email,bewerber_status,einwilligung_datenschutz_at) values ($1,'Bestand','alt@test.de','unbekannt',now())",
      [jobGehaltId],
    );
  });

  it("Verfügbarkeit: Datum GENAU DANN, wenn 'zum_datum' (beide Richtungen, 23514)", async () => {
    await expectSqlState(
      asUser(db, null, (q) =>
        q.query(
          `insert into public.job_applications ${APP_COLS}
           values ($1,'Ohne Datum','od@test.de','fahrlehrer','{B}','zum_datum',null,'cv.pdf',1,now(),now())`,
          [jobGehaltId],
        ),
      ),
      CHECK_VIOLATION,
    );
    await expectSqlState(
      asUser(db, null, (q) =>
        q.query(
          `insert into public.job_applications ${APP_COLS}
           values ($1,'Datum Trotzdem','dt@test.de','fahrlehrer','{B}','sofort','2027-01-01','cv.pdf',1,now(),now())`,
          [jobGehaltId],
        ),
      ),
      CHECK_VIOLATION,
    );
  });

  it("Unterlagen-Metadaten: Pfad-/Sonderzeichen-Namen, fehlende Größe, Über-Cap → 23514", async () => {
    const faelle: Array<[string, string]> = [
      ["'../../evil.pdf',123", "Pfadanteile im Dateinamen"],
      ["'cv.pdf',null", "Name ohne Größe"],
      ["'cv.pdf',6000000", "CV über 5-MB-Cap"],
      ["'cv.pdf',0", "leere Datei"],
    ];
    for (const [werte] of faelle) {
      await expectSqlState(
        asUser(db, null, (q) =>
          q.query(
            `insert into public.job_applications
               (job_id,name,email,bewerber_status,verfuegbar_status,cv_dateiname,cv_groesse_bytes,
                einwilligung_datenschutz_at,einwilligung_weitergabe_at)
             values ($1,'U','u@test.de','fahrlehrer','sofort',${werte},now(),now())`,
            [jobGehaltId],
          ),
        ),
        CHECK_VIOLATION,
      );
    }
  });

  it("klassen der Bewerbung: Allowlist + Duplikat-Schutz (23514)", async () => {
    await expectSqlState(
      asUser(db, null, (q) =>
        q.query(
          `insert into public.job_applications ${APP_COLS}
           values ($1,'K','k@test.de','fahrlehrer','{B,B}','sofort',null,'cv.pdf',1,now(),now())`,
          [jobGehaltId],
        ),
      ),
      CHECK_VIOLATION,
    );
  });

  it("Status-Allowlist: verwaltung pflegt status (1+ Zeilen); unbekannter Status → 23514; PII bleibt gesperrt", async () => {
    const ok = await asUser(db, { sub: s.verwaltungA }, (q) =>
      q.query("update public.job_applications set status='erledigt' where job_id=$1", [jobGehaltId]),
    );
    expect(ok.affectedRows).toBeGreaterThan(0);
    await expectSqlState(
      asUser(db, { sub: s.verwaltungA }, (q) =>
        q.query("update public.job_applications set status='kaputt' where job_id=$1", [jobGehaltId]),
      ),
      CHECK_VIOLATION,
    );
    await expectSqlState(
      asUser(db, { sub: s.verwaltungA }, (q) =>
        q.query("update public.job_applications set bewerber_status='fahrlehrer' where job_id=$1", [jobGehaltId]),
      ),
      DENIED,
    );
  });
});

describe("0025 Purge — nur privilegiert, Retention fail-closed, auditierbar", () => {
  it("app_user (selbst admin-Claims) darf die Purge-Funktion NICHT ausführen (42501)", async () => {
    await expectSqlState(
      asUser(db, { sub: s.adminU }, (q) => q.query("select app.purge_job_applications()")),
      DENIED,
    );
  });

  it("Retention-Gate: Stichtag jünger als 6 Monate wird abgelehnt (22023)", async () => {
    await expectSqlState(db.query("select app.purge_job_applications(now())"), INVALID_PARAM);
  });

  it("Betreiber-Pfad: Soft-Delete → Hard-Purge in zwei Stufen + security_events-Audit", async () => {
    // Bestands-Simulation via Bootstrap-INSERT (updated_at/deleted_at direkt setzbar;
    // der updated_at-Trigger feuert nur bei UPDATE).
    await db.query(
      `insert into public.job_applications
         (job_id,name,email,status,einwilligung_datenschutz_at,updated_at)
       values ($1,'Alt Erledigt','alt-erledigt@test.de','erledigt',now(),now() - interval '8 months')`,
      [jobGehaltId],
    );
    await db.query(
      `insert into public.job_applications
         (job_id,name,email,status,einwilligung_datenschutz_at,deleted_at)
       values ($1,'Alt Geloescht','alt-geloescht@test.de','erledigt',now(),now() - interval '7 months')`,
      [jobGehaltId],
    );

    const res = await db.query<{ r: { soft_geloescht: number; hart_geloescht: number } }>(
      "select app.purge_job_applications() as r",
    );
    expect(res.rows[0].r.soft_geloescht).toBeGreaterThanOrEqual(1);
    expect(res.rows[0].r.hart_geloescht).toBeGreaterThanOrEqual(1);

    // Stufe 1: alte erledigte Bewerbung ist SOFT gelöscht (Zeile existiert noch).
    const soft = await db.query<{ deleted_at: string | null }>(
      "select deleted_at from public.job_applications where name='Alt Erledigt'",
    );
    expect(soft.rows).toHaveLength(1);
    expect(soft.rows[0].deleted_at).not.toBeNull();

    // Stufe 2: lange soft-gelöschte Bewerbung ist HART entfernt.
    const hard = await db.query(
      "select 1 from public.job_applications where name='Alt Geloescht'",
    );
    expect(hard.rows).toHaveLength(0);

    // Audit-Event vorhanden (System-Event ohne actor, mit Zählern).
    const audit = await db.query<{ metadata: { soft_geloescht: number } }>(
      "select metadata from public.security_events where event_type='job_applications_purge' order by created_at desc limit 1",
    );
    expect(audit.rows).toHaveLength(1);
    expect(audit.rows[0].metadata.soft_geloescht).toBeGreaterThanOrEqual(1);
  });

  it("frische/offene Bewerbungen bleiben vom Purge unberührt", async () => {
    const rows = await db.query(
      "select 1 from public.job_applications where name='Kim Muster' and deleted_at is null",
    );
    expect(rows.rows).toHaveLength(1);
  });
});
