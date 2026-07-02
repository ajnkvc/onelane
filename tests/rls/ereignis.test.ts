import { describe, it, expect, beforeAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb, asUser, selectAsUser } from "./harness";
import { seed, type Seed } from "./seed";

/**
 * ereignis.test.ts — RLS-/Funktions-Invarianten der Migration 0024
 * (ereignis_zaehler + app.zaehle_ereignis).
 *
 * Kern-Invarianten:
 *  - Anonyme können AUSSCHLIESSLICH über die DEFINER-Funktion zählen (Upsert +1);
 *    direkter INSERT/UPDATE/DELETE auf die Tabelle ist grant-los (42501).
 *  - Die Funktion zählt NUR für gelistete Schulen und nur Whitelist-Typen —
 *    Rückgabe bewusst true/false ohne Fehler-Orakel.
 *  - SELECT sieht nur der Schul-Manager der eigenen Schule + admin; Anonyme,
 *    Fahrlehrer (kein Manager) und Fremde sehen nichts.
 */

let db: PGlite;
let s: Seed;

async function expectSqlState(p: Promise<unknown>, state: string) {
  await expect(p).rejects.toMatchObject({ code: state });
}
const DENIED = "42501";

async function anzahlFor(schoolId: string): Promise<number | null> {
  const r = await db.query<{ anzahl: number }>(
    "select anzahl from public.ereignis_zaehler where school_id=$1 and ereignis_typ='tel_klick' and tag=current_date",
    [schoolId],
  );
  return r.rows[0]?.anzahl ?? null;
}

beforeAll(async () => {
  db = await createTestDb();
  s = await seed(db);
});

describe("0024 app.zaehle_ereignis (einziger Schreibweg)", () => {
  it("anonym: zählt für gelistete Schule (Upsert +1, zweiter Aufruf = 2)", async () => {
    const r1 = await asUser(db, null, (q) =>
      q.query<{ ok: boolean }>("select app.zaehle_ereignis('a','tel_klick') as ok"),
    );
    expect(r1.rows[0].ok).toBe(true);
    expect(await anzahlFor(s.schoolA)).toBe(1);

    await asUser(db, null, (q) => q.query("select app.zaehle_ereignis('a','tel_klick')"));
    expect(await anzahlFor(s.schoolA)).toBe(2);
  });

  it("anonym: UNGELISTETE Schule wird nicht gezählt (false, keine Zeile)", async () => {
    const r = await asUser(db, null, (q) =>
      q.query<{ ok: boolean }>("select app.zaehle_ereignis('x','tel_klick') as ok"),
    );
    expect(r.rows[0].ok).toBe(false);
    expect(await anzahlFor(s.schoolUnlisted)).toBeNull();
  });

  it("anonym: unbekannter Typ wird abgelehnt (false, kein Fehler-Orakel)", async () => {
    const r = await asUser(db, null, (q) =>
      q.query<{ ok: boolean }>("select app.zaehle_ereignis('a','profil_aufruf') as ok"),
    );
    expect(r.rows[0].ok).toBe(false);
  });

  it("anonym: direkter INSERT/UPDATE/DELETE auf die Tabelle ist gesperrt (42501)", async () => {
    await expectSqlState(
      asUser(db, null, (q) =>
        q.query(
          "insert into public.ereignis_zaehler (school_id,ereignis_typ,anzahl) values ($1,'tel_klick',999)",
          [s.schoolA],
        ),
      ),
      DENIED,
    );
    await expectSqlState(
      asUser(db, null, (q) => q.query("update public.ereignis_zaehler set anzahl=999")),
      DENIED,
    );
    await expectSqlState(
      asUser(db, null, (q) => q.query("delete from public.ereignis_zaehler")),
      DENIED,
    );
  });
});

describe("0024 ereignis_zaehler SELECT-Sichtbarkeit", () => {
  it("anonym: sieht keine Zählerstände (leer)", async () => {
    const rows = await selectAsUser(db, null, "select id from public.ereignis_zaehler");
    expect(rows).toHaveLength(0);
  });

  it("verwaltung (Manager): sieht die Zahlen der EIGENEN Schule", async () => {
    const rows = await selectAsUser<{ anzahl: number }>(
      db, { sub: s.verwaltungA }, "select anzahl from public.ereignis_zaehler",
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].anzahl).toBeGreaterThanOrEqual(2);
  });

  it("fahrlehrer (Mitglied, kein Manager): sieht nichts", async () => {
    const rows = await selectAsUser(db, { sub: s.fahrlehrerA }, "select id from public.ereignis_zaehler");
    expect(rows).toHaveLength(0);
  });

  it("student/fremde: sieht nichts; admin: sieht alles", async () => {
    expect(await selectAsUser(db, { sub: s.studentA }, "select id from public.ereignis_zaehler")).toHaveLength(0);
    const admin = await selectAsUser(db, { sub: s.adminU }, "select id from public.ereignis_zaehler");
    expect(admin.length).toBeGreaterThan(0);
  });
});
