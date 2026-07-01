import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb } from "./rls/harness";
import { slugify as slugifyTs } from "../src/lib/slug";
import { slugify as slugifyMjs, normalizeOsmElement } from "../db/ingest/normalize.mjs";
import { startRun, finishRun, importCandidates } from "../db/ingest/apply.mjs";

/**
 * 008b OSMImportCore — Offline-Pipeline-Tests gegen OSM-Fixtures + PGlite.
 * KEIN Netz. Belegt: Exclusion-vor-Match, hidden/unlisted, keine Google-Felder,
 * keine Kontakte in Profilen, Provenienz, Slug-Determinismus/Kollision, ort=NULL,
 * Dedupe-Fälle, Filialen, Re-Run-Idempotenz, Audit.
 */
let db: PGlite;
// Erhöhter/Tooling-Pfad: direkte Querier-Anbindung (RLS-frei, wie seed/runner).
let q: { query: (s: string, p?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> };

beforeEach(async () => {
  db = await createTestDb();
  q = { query: (s, p = []) => db.query(s, p) as Promise<{ rows: Record<string, unknown>[] }> };
});
afterEach(async () => {
  await db?.close();
});

const node = (id: number, tags: Record<string, string>, lat?: number, lon?: number) =>
  ({ type: "node", id, lat, lon, tags });

const count = async (table: string, where = "") =>
  Number(((await db.query(`select count(*)::int as n from public.${table} ${where}`)).rows[0] as { n: number }).n);

async function run(elements: unknown[]) {
  const runId = await startRun(q, { sourceVersion: "2026-06-24T20:20:59Z", query: "fixture" });
  const counts = await importCandidates(q, elements, { runId });
  await finishRun(q, runId, counts, "completed");
  return { runId, counts };
}

describe("slugify-Parität (Import ↔ App)", () => {
  it("erzeugt identische Slugs wie src/lib/slug.ts", () => {
    for (const s of ["Fahrschule Müller", "ABC Drive & Go!", "Straße 1", "  Über-Eck  ", "123 Fahrschule"]) {
      expect(slugifyMjs(s)).toBe(slugifyTs(s));
    }
  });
});

describe("Materialisierung (hidden/unlisted) + Provenienz", () => {
  it("legt canonical Zeile is_listed=false/is_verified=false/needs_review mit Provenienz an", async () => {
    const { counts } = await run([
      node(1, { name: "Fahrschule Alpha", "addr:city": "München", "addr:postcode": "80331",
        "addr:street": "Astr", "addr:housenumber": "1", website: "https://alpha-fs.de", phone: "+49 89 1" },
        48.137, 11.575),
    ]);
    expect(counts.materialized).toBe(1);
    expect(counts.with_website).toBe(1);
    const row = (await db.query(
      `select slug, is_listed, is_verified, verification_status, source, source_ref
       from public.driving_schools where source='osm'`,
    )).rows[0] as Record<string, unknown>;
    expect(row.slug).toBe("fahrschule-alpha");
    expect(row.is_listed).toBe(false);
    expect(row.is_verified).toBe(false);
    expect(row.verification_status).toBe("needs_review");
    expect(row.source_ref).toBe("node/1");
    expect(await count("field_provenance", "where source='osm'")).toBeGreaterThanOrEqual(4);
  });

  it("F-044: materialisierte OSM-Zeile bekommt cluster_key UND dedupe_key (Insert + Re-Run)", async () => {
    const el = node(7, { name: "Fahrschule Keys", "addr:city": "München", "addr:postcode": "80331",
      "addr:street": "Keystr", "addr:housenumber": "3" }, 48.10, 11.55);
    await run([el]);
    const first = (await db.query(
      `select cluster_key, dedupe_key from public.driving_schools where source_ref='node/7'`,
    )).rows[0] as Record<string, unknown>;
    expect(first.cluster_key).toBeTruthy();
    expect(first.dedupe_key).toBeTruthy();
    // dedupe_key ist strenger als cluster_key (enthält zusätzlich die Straße).
    expect(String(first.dedupe_key).startsWith(String(first.cluster_key))).toBe(true);
    // Re-Run desselben OSM-Objekts hält die Keys gesetzt (Update-Pfad schreibt sie mit).
    await run([el]);
    const again = (await db.query(
      `select cluster_key, dedupe_key from public.driving_schools where source_ref='node/7'`,
    )).rows[0] as Record<string, unknown>;
    expect(again.cluster_key).toBe(first.cluster_key);
    expect(again.dedupe_key).toBe(first.dedupe_key);
  });

  it("schreibt KEINE Kontakte in school_profiles und KEINE Google-Felder", async () => {
    await run([
      node(1, { name: "Fahrschule Beta", "addr:city": "München", "addr:postcode": "80331",
        website: "https://beta-fs.de", phone: "+49 89 2", email: "info@beta-fs.de" }, 48.20, 11.50),
    ]);
    expect(await count("school_profiles")).toBe(0);
    const g = (await db.query(
      `select google_place_id, google_rating, google_reviews_count from public.driving_schools where source='osm'`,
    )).rows[0] as Record<string, unknown>;
    expect(g.google_place_id).toBeNull();
    expect(g.google_rating).toBeNull();
    expect(g.google_reviews_count).toBeNull();
  });
});

describe("Exclusion VOR Match (123fahrschule)", () => {
  it("schließt aus, ohne canonical/Provenienz/Dedupe-Nebenwirkung", async () => {
    const { counts } = await run([
      node(1, { name: "123 Fahrschule München", "addr:city": "München", "addr:postcode": "80331" }, 48.1, 11.5),
    ]);
    expect(counts.excluded).toBe(1);
    expect(counts.materialized).toBe(0);
    expect(await count("driving_schools", "where source='osm'")).toBe(0);
    expect(await count("field_provenance")).toBe(0);
    expect(await count("dedupe_decision")).toBe(0);
    expect(await count("import_staging", "where status='excluded'")).toBe(1);
  });
});

describe("ort=NULL → Review statt Materialisierung", () => {
  it("ort-loser Kandidat landet in Review, nicht canonical", async () => {
    const { counts } = await run([
      node(1, { name: "Fahrschule Ohne Ort", "addr:postcode": "80331" }, 48.1, 11.5),
    ]);
    expect(counts.materialized).toBe(0);
    expect(counts.needs_review).toBe(1);
    expect(await count("driving_schools", "where source='osm'")).toBe(0);
    expect(await count("import_review_queue", "where status='pending'")).toBe(1);
  });

  it("0003: zwei ort=NULL-Zeilen mit gleichem (land, slug) sind verboten", async () => {
    await db.query(`insert into public.driving_schools (name, slug, land) values ('A','dup-null','DE')`);
    await expect(
      db.query(`insert into public.driving_schools (name, slug, land) values ('B','dup-null','DE')`),
    ).rejects.toThrow();
  });
});

describe("Slug-Kollision: deterministisch + reihenfolge-unabhängig", () => {
  const a = node(1, { name: "Fahrschule Nord", "addr:city": "Köln", "addr:postcode": "50667" }, 50.94, 6.96);
  const b = node(2, { name: "Fahrschule Nord", "addr:city": "Köln", "addr:postcode": "50939" }, 50.90, 6.90);

  it("zwei gleichnamige Schulen einer Stadt erhalten deterministisch unterschiedliche Slugs", async () => {
    await run([a, b]);
    const slugs = (await db.query(
      `select source_ref, slug from public.driving_schools where source='osm' order by source_ref`,
    )).rows as Record<string, string>[];
    expect(slugs).toHaveLength(2);
    expect(slugs[0].slug).not.toBe(slugs[1].slug);
  });

  it("ergibt dieselben Slugs unabhängig von der Eingabereihenfolge", async () => {
    await run([a, b]);
    const rowsFwd = (await db.query(
      `select source_ref, slug from public.driving_schools where source='osm'`,
    )).rows as Record<string, string>[];
    const fwd = Object.fromEntries(rowsFwd.map((r) => [r.source_ref, r.slug]));
    // Frische DB, umgekehrte Reihenfolge
    await db.close();
    db = await createTestDb();
    q = { query: (s, p = []) => db.query(s, p) as Promise<{ rows: Record<string, unknown>[] }> };
    await run([b, a]);
    const rowsRev = (await db.query(
      `select source_ref, slug from public.driving_schools where source='osm'`,
    )).rows as Record<string, string>[];
    const rev = Object.fromEntries(rowsRev.map((r) => [r.source_ref, r.slug]));
    expect(rev).toEqual(fwd);
  });
});

describe("Dedupe-Fälle", () => {
  it("Filialen (gleiche Domain, andere Adresse/Stadt) bleiben getrennt + separate_branch", async () => {
    const { counts } = await run([
      node(1, { name: "Fahrschule City", "addr:city": "München", "addr:postcode": "80331",
        website: "https://city-fs.de" }, 48.13, 11.57),
      node(2, { name: "Fahrschule City Süd", "addr:city": "München", "addr:postcode": "81539",
        website: "https://city-fs.de" }, 48.10, 11.60),
    ]);
    expect(counts.materialized).toBe(2);
    expect(counts.separate_branch).toBeGreaterThanOrEqual(1);
    expect(await count("driving_schools", "where source='osm'")).toBe(2);
    expect(await count("dedupe_decision", "where decision='separate_branch'")).toBeGreaterThanOrEqual(1);
  });

  it("gleiche Telefonnummer an mehreren Adressen → Review", async () => {
    const { counts } = await run([
      node(1, { name: "Fahrschule Eins", "addr:city": "Berlin", "addr:postcode": "10115", phone: "+49 30 999" }, 52.53, 13.38),
      node(2, { name: "Fahrschule Zwei", "addr:city": "Berlin", "addr:postcode": "10117", phone: "+49 30 999" }, 52.51, 13.40),
    ]);
    expect(counts.needs_review).toBe(2);
    expect(counts.materialized).toBe(0);
    expect(await count("import_review_queue", "where 'phone_multi_address' = any(reasons)")).toBe(2);
  });

  it("starker Beweis (Name+PLZ+Geo) merged in bestehende source-lose Schule, kein Duplikat", async () => {
    await db.query(
      `insert into public.driving_schools (name, slug, plz, ort, land, latitude, longitude)
       values ('Fahrschule Gamma','fahrschule-gamma','04109','Leipzig','DE',51.339,12.374)`,
    );
    const { counts } = await run([
      node(5, { name: "Fahrschule Gamma", "addr:city": "Leipzig", "addr:postcode": "04109" }, 51.3392, 12.3741),
    ]);
    expect(counts.merged).toBe(1);
    expect(counts.materialized).toBe(0);
    expect(await count("driving_schools")).toBe(1);
    const row = (await db.query(`select source, source_ref from public.driving_schools`)).rows[0] as Record<string, unknown>;
    expect(row.source).toBe("osm");
    expect(row.source_ref).toBe("node/5");
    expect(await count("dedupe_decision", "where decision='merged'")).toBe(1);
  });
});

describe("Re-Run-Idempotenz", () => {
  it("zweiter Lauf erzeugt keine Duplikate/Provenienz-Dubletten und ändert keine Slugs", async () => {
    const els = [
      node(1, { name: "Fahrschule Delta", "addr:city": "Hamburg", "addr:postcode": "20095" }, 53.55, 10.00),
      node(2, { name: "Fahrschule Echo", "addr:city": "Hamburg", "addr:postcode": "20097" }, 53.54, 10.01),
    ];
    await run(els);
    const schoolsAfter1 = await count("driving_schools", "where source='osm'");
    const provAfter1 = await count("field_provenance");
    const slugs1 = (await db.query(`select source_ref, slug from public.driving_schools where source='osm' order by source_ref`)).rows;

    const { counts } = await run(els);
    expect(counts.updated).toBe(2);
    expect(counts.materialized).toBe(0);
    expect(await count("driving_schools", "where source='osm'")).toBe(schoolsAfter1);
    expect(await count("field_provenance")).toBe(provAfter1);
    const slugs2 = (await db.query(`select source_ref, slug from public.driving_schools where source='osm' order by source_ref`)).rows;
    expect(slugs2).toEqual(slugs1);
  });
});

describe("Audit + Lauf-Report", () => {
  it("erzeugt import_run + security_events (Actor NULL, target import_run) mit ODbL-Attribution", async () => {
    const { runId } = await run([
      node(1, { name: "Fahrschule Foxtrot", "addr:city": "Köln", "addr:postcode": "50667" }, 50.94, 6.96),
    ]);
    const runRow = (await db.query(`select status, counts, params from public.import_run where id=$1`, [runId])).rows[0] as Record<string, unknown>;
    expect(runRow.status).toBe("completed");
    expect(JSON.stringify(runRow.params)).toContain("ODbL");
    const ev = (await db.query(
      `select event_type, actor_user_id, target_table, target_id from public.security_events where target_table='import_run'`,
    )).rows as Record<string, unknown>[];
    expect(ev.length).toBeGreaterThanOrEqual(2); // started + finished
    for (const e of ev) {
      expect(e.actor_user_id).toBeNull();
      expect(e.target_id).toBe(runId);
    }
  });
});

describe("normalizeOsmElement (Way-Center, kein Raten)", () => {
  it("nutzt center für Ways und lässt fehlende Felder null (kein Erfinden)", () => {
    const c = normalizeOsmElement({
      type: "way", id: 7, center: { lat: 48.1, lon: 11.5 },
      tags: { name: "Fahrschule Way", "addr:city": "München" },
    });
    expect(c).not.toBeNull();
    if (!c) return;
    expect(c.lat).toBe(48.1);
    expect(c.lng).toBe(11.5);
    expect(c.plz).toBeNull();
    expect(c.strasse).toBeNull();
    expect(c.sourceRef).toBe("way/7");
  });
});
