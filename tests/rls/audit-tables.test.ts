import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb } from "./harness";

/**
 * audit-tables.test.ts — F-038 (Block 4): Import-/Fetch-Audit-Tabellen.
 * Trigger feuern für JEDE Rolle (auch den Owner/Bootstrap-Pfad hier).
 *   - append-only: dedupe_decision, import_fetch_log (kein UPDATE/DELETE/TRUNCATE)
 *   - no-erase:    import_run, import_exclusion (UPDATE-Lifecycle ok, kein DELETE/TRUNCATE)
 *   - mutierbar:   field_provenance, import_review_queue (Tooling löscht/überschreibt regulär)
 */
let db: PGlite;
beforeAll(async () => {
  db = await createTestDb();
});
afterAll(async () => {
  await db?.close();
});

async function expectDenied(p: Promise<unknown>): Promise<void> {
  let code: string | undefined;
  try {
    await p;
  } catch (e) {
    code = (e as { code?: string }).code;
  }
  expect(code).toBe("42501");
}

/** Abgelehnt durch Trigger (42501) ODER FK-Schutz (0A000, TRUNCATE referenzierter Tabellen) — nichts anderes. */
async function expectRejected(p: Promise<unknown>): Promise<void> {
  let code: string | undefined;
  try {
    await p;
  } catch (e) {
    code = (e as { code?: string }).code;
  }
  expect(["42501", "0A000"]).toContain(code);
}

describe("F-038 — append-only Belege", () => {
  it("dedupe_decision: INSERT ok, UPDATE/DELETE/TRUNCATE blockiert", async () => {
    const r = await db.query<{ id: string }>(
      "insert into public.dedupe_decision (decision) values ('not_duplicate') returning id",
    );
    const id = r.rows[0].id;
    await expectDenied(db.query("update public.dedupe_decision set decision='merged' where id=$1", [id]));
    await expectDenied(db.query("delete from public.dedupe_decision where id=$1", [id]));
    await expectDenied(db.query("truncate public.dedupe_decision"));
  });

  it("import_fetch_log: INSERT ok, UPDATE/DELETE blockiert", async () => {
    const r = await db.query<{ id: string }>(
      "insert into public.import_fetch_log (url) values ('https://example.de') returning id",
    );
    const id = r.rows[0].id;
    await expectDenied(db.query("update public.import_fetch_log set http_status=200 where id=$1", [id]));
    await expectDenied(db.query("delete from public.import_fetch_log where id=$1", [id]));
    await expectDenied(db.query("truncate public.import_fetch_log"));
  });
});

describe("F-038 — no-erase Belege (Lifecycle erlaubt, Löschen verboten)", () => {
  it("import_run: status-UPDATE erlaubt, DELETE/TRUNCATE blockiert", async () => {
    const r = await db.query<{ id: string }>(
      "insert into public.import_run (source, status) values ('osm','running') returning id",
    );
    const id = r.rows[0].id;
    const upd = await db.query(
      "update public.import_run set status='completed', finished_at=now() where id=$1",
      [id],
    );
    expect(upd.affectedRows).toBe(1);
    await expectDenied(db.query("delete from public.import_run where id=$1", [id]));
    // TRUNCATE wird bereits durch eingehende FKs (import_staging/field_provenance/…) verhindert
    // (0A000) — der no-erase-Trigger (42501) greift ansonsten; in jedem Fall abgelehnt.
    await expectRejected(db.query("truncate public.import_run"));
  });

  it("import_exclusion: active-Toggle erlaubt, DELETE blockiert", async () => {
    const r = await db.query<{ id: string }>(
      "insert into public.import_exclusion (typ, value, reason) values ('name','beispiel','other') returning id",
    );
    const id = r.rows[0].id;
    const upd = await db.query("update public.import_exclusion set active=false where id=$1", [id]);
    expect(upd.affectedRows).toBe(1);
    await expectDenied(db.query("delete from public.import_exclusion where id=$1", [id]));
    await expectDenied(db.query("truncate public.import_exclusion"));
  });
});

describe("F-038 — bewusst mutierbar (Arbeits-/Aktualzustand)", () => {
  it("field_provenance: DELETE bleibt erlaubt (Tooling-Re-Sourcing)", async () => {
    const fp = await db.query<{ id: string }>(
      "insert into public.field_provenance (target_table, target_id, field, source) " +
        "values ('driving_schools', gen_random_uuid(), 'name', 'osm') returning id",
    );
    const del = await db.query("delete from public.field_provenance where id=$1", [fp.rows[0].id]);
    expect(del.affectedRows).toBe(1);
  });
});

describe("F-039 — jsonb-Payload-Caps (Migration 0019)", () => {
  // CHECK-Verletzung = SQLSTATE 23514.
  const expectCheckViolation = async (p: Promise<unknown>): Promise<void> => {
    let code: string | undefined;
    try {
      await p;
    } catch (e) {
      code = (e as { code?: string }).code;
    }
    expect(code).toBe("23514");
  };

  it("import_staging.raw > 256 KB (ASCII) wird abgelehnt, im Rahmen akzeptiert", async () => {
    const big = JSON.stringify({ x: "a".repeat(262145) });
    await expectCheckViolation(
      db.query("insert into public.import_staging (source, source_ref, raw) values ('osm','node/1',$1::jsonb)", [big]),
    );
    const ok = await db.query(
      "insert into public.import_staging (source, source_ref, raw) values ('osm','node/2',$1::jsonb) returning id",
      [JSON.stringify({ x: "a".repeat(100) })],
    );
    expect(ok.rows.length).toBe(1);
  });

  it("Bytecap greift bei Multibyte (octet_length, nicht Zeichen)", async () => {
    // 131073 × 'ä' (2 Bytes) ≈ 262146 Bytes > 256 KB, aber < 256K ZEICHEN → nur octet_length fängt es.
    const big = JSON.stringify({ x: "ä".repeat(131073) });
    await expectCheckViolation(
      db.query("insert into public.import_staging (source, source_ref, raw) values ('osm','node/3',$1::jsonb)", [big]),
    );
  });

  it("dedupe_decision.match_factors > 16 KB wird abgelehnt", async () => {
    const big = JSON.stringify({ f: "b".repeat(16385) });
    await expectCheckViolation(
      db.query("insert into public.dedupe_decision (decision, match_factors) values ('not_duplicate',$1::jsonb)", [big]),
    );
  });
});

describe("F-054 — withAnonContext read-only Mechanik", () => {
  it("transaction_read_only='on' lehnt Writes hart ab (25006)", async () => {
    // Exakt der Riegel, den withAnonContext transaktionslokal setzt: ein Write scheitert auf DB-Ebene.
    let code: string | undefined;
    try {
      await db.transaction(async (tx) => {
        await tx.query("select set_config('transaction_read_only','on',true)");
        await tx.query("update public.driving_schools set name = name where false");
      });
    } catch (e) {
      code = (e as { code?: string }).code;
    }
    expect(code).toBe("25006"); // read_only_sql_transaction
  });
});

describe("Migration 0020 — Ingestion-Run-Status + Fetch-Log-Idempotenz", () => {
  it("F-045: import_run erlaubt 'completed_with_errors', lehnt Unbekanntes ab (23514)", async () => {
    const ok = await db.query<{ id: string }>(
      "insert into public.import_run (source, status) values ('osm','completed_with_errors') returning id",
    );
    expect(ok.rows.length).toBe(1);
    let code: string | undefined;
    try {
      await db.query("insert into public.import_run (source, status) values ('osm','bogus_status')");
    } catch (e) { code = (e as { code?: string }).code; }
    expect(code).toBe("23514");
  });

  it("F-080: Fetch-Log-Unique dedupliziert auch bei NULL run_id/source_ref (NULLS NOT DISTINCT)", async () => {
    await db.query("insert into public.import_fetch_log (url) values ('https://dup.example.de')");
    let code: string | undefined;
    try {
      // run_id + source_ref sind NULL, url identisch → mit NULLS NOT DISTINCT eine Dublette (23505).
      await db.query("insert into public.import_fetch_log (url) values ('https://dup.example.de')");
    } catch (e) { code = (e as { code?: string }).code; }
    expect(code).toBe("23505");
  });
});
