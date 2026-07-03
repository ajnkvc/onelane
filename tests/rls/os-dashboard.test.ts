import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb, selectAsUser } from "./harness";
import { seed, type Seed } from "./seed";

/**
 * RLS-Tests Migration 0030 (OS-P2 Dashboard-Lesepfade):
 *  - instructor_availability: Schulmitglieder lesen NUR die Slots der eigenen
 *    Schule; kein public/student/support; admin alles; Writes fail-closed.
 *  - app.own_instructor_ids(): liefert ausschließlich EIGENE instructors-IDs
 *    (kein user_id-Leak, kein Eskalationspfad für Ghost-User ohne Schulrolle).
 */
let db: PGlite;
let s: Seed;

beforeAll(async () => {
  db = await createTestDb();
  s = await seed(db);
  // Verfügbarkeits-Zeilen (Bootstrap = erhöhter Pfad): Schule A (instrA,
  // instrGhost) + nicht gelistete Schule (instrX).
  await db.query(
    `insert into public.instructor_availability (instructor_id, datum, von, bis, ist_blockiert)
     values ($1, current_date, '08:00', '12:00', false),
            ($2, current_date, '09:00', '10:00', false),
            ($3, current_date, '13:00', '17:00', false)`,
    [s.instrA, s.instrGhost, s.instrX],
  );
});
afterAll(async () => {
  await db?.close();
});

const SEL = "select instructor_id from public.instructor_availability";

describe("0030 — instructor_availability: rollenscharfer Lesepfad", () => {
  it("anonym und Student sehen KEINE Verfügbarkeiten", async () => {
    expect(await selectAsUser(db, null, SEL)).toHaveLength(0);
    expect(await selectAsUser(db, { sub: s.studentA }, SEL)).toHaveLength(0);
  });

  it("Schulmitglieder (alle drei Rollen) lesen die Slots der EIGENEN Schule", async () => {
    for (const sub of [s.inhaberA, s.verwaltungA, s.fahrlehrerA]) {
      const ids = (await selectAsUser<{ instructor_id: string }>(db, { sub }, SEL)).map(
        (r) => r.instructor_id,
      );
      expect(ids).toContain(s.instrA);
      expect(ids).toContain(s.instrGhost); // gehört zu Schule A
      expect(ids).not.toContain(s.instrX); // fremde Schule
    }
  });

  it("Support liest NICHTS (PII-/Betriebsdaten-Linie)", async () => {
    expect(await selectAsUser(db, { sub: s.supportU }, SEL)).toHaveLength(0);
  });

  it("admin liest alles", async () => {
    expect(await selectAsUser(db, { sub: s.adminU }, SEL)).toHaveLength(3);
  });

  it("Ghost-User (instructors.user_id OHNE Schulrolle) sieht keine Slots", async () => {
    expect(await selectAsUser(db, { sub: s.ghostU }, SEL)).toHaveLength(0);
  });

  it("Writes bleiben für Unbeteiligte fail-closed (seit 0031 policy-gebunden — Detail in tests/rls/os-welle2.test.ts)", async () => {
    // 0030 hatte Writes komplett entzogen; 0031 öffnet sie GEZIELT (Manager
    // schulweit, Fahrlehrer:in eigene Zeilen). Hier bleibt die Außengrenze:
    // Student/anonym/Ghost schreiben weiterhin NICHT.
    const INSERT =
      "insert into public.instructor_availability (instructor_id, datum, von, bis) values ($1, current_date, '08:00', '09:00') returning id";
    await expect(selectAsUser(db, { sub: s.studentA }, INSERT, [s.instrA])).rejects.toThrow();
    await expect(selectAsUser(db, null, INSERT, [s.instrA])).rejects.toThrow();
    await expect(selectAsUser(db, { sub: s.ghostU }, INSERT, [s.instrGhost])).rejects.toThrow();
    // UPDATE/DELETE: Grant existiert (0031), aber die USING-Policy lässt für
    // Studenten KEINE Zeile durch → 0 betroffene Zeilen (kein stiller Treffer).
    expect(
      await selectAsUser(db, { sub: s.studentA },
        "update public.instructor_availability set ist_blockiert = true returning id"),
    ).toHaveLength(0);
    expect(
      await selectAsUser(db, { sub: s.studentA },
        "delete from public.instructor_availability returning id"),
    ).toHaveLength(0);
  });
});

describe("0030 — app.own_instructor_ids()", () => {
  const OWN = "select app.own_instructor_ids() as id";

  it("Fahrlehrer erhält GENAU die eigene instructors-Zeile", async () => {
    const ids = (await selectAsUser<{ id: string }>(db, { sub: s.fahrlehrerA }, OWN)).map(
      (r) => r.id,
    );
    expect(ids).toEqual([s.instrA]);
  });

  it("Student/Inhaber ohne instructors-Zeile erhalten nichts", async () => {
    expect(await selectAsUser(db, { sub: s.studentA }, OWN)).toHaveLength(0);
    expect(await selectAsUser(db, { sub: s.inhaberA }, OWN)).toHaveLength(0);
  });

  it("anonym erhält nichts (kein current_user_id)", async () => {
    expect(await selectAsUser(db, null, OWN)).toHaveLength(0);
  });

  it("KEIN Eskalationspfad: Ghost sieht die eigene ID, aber weiterhin keine Termine/Slots", async () => {
    // Die Funktion selbst liefert die eigene Zeile (instrGhost) …
    const ids = (await selectAsUser<{ id: string }>(db, { sub: s.ghostU }, OWN)).map((r) => r.id);
    expect(ids).toEqual([s.instrGhost]);
    // … aber alle abhängigen Tabellen bleiben membership-gegated (0 Zeilen).
    expect(
      await selectAsUser(db, { sub: s.ghostU },
        "select id from public.appointments where instructor_id in (select app.own_instructor_ids())"),
    ).toHaveLength(0);
    expect(
      await selectAsUser(db, { sub: s.ghostU },
        "select id from public.instructor_availability where instructor_id in (select app.own_instructor_ids())"),
    ).toHaveLength(0);
  });

  it("Fahrlehrer findet über die Funktion die EIGENEN Termine (Mein-Tag-Pfad)", async () => {
    const rows = await selectAsUser<{ id: string }>(db, { sub: s.fahrlehrerA },
      "select id from public.appointments where instructor_id in (select app.own_instructor_ids())");
    expect(rows.map((r) => r.id)).toEqual([s.apptA]);
  });
});
