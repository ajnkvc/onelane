import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb } from "./rls/harness";
import {
  startVerifyRun, verifyCandidate, emptyCounts,
} from "../db/ingest/verify.mjs";

/**
 * 008c — Verifikations-/Persistenz-Kern (PGlite, offline). Strenges Gate,
 * keine Halluzination, manuelle Provenienz geschützt, Brand-Gruppierung, idempotent.
 */
let db: PGlite;
let q: { query: (s: string, p?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> };

beforeEach(async () => {
  db = await createTestDb();
  q = { query: (s, p = []) => db.query(s, p) as Promise<{ rows: Record<string, unknown>[] }> };
});
afterEach(async () => { await db?.close(); });

async function seedSchool(opts: Partial<{ name: string; slug: string; plz: string; ort: string; brandId: string | null }> = {}) {
  const { name = "Fahrschule Müller", slug = "fahrschule-mueller", plz = "80331", ort = "München", brandId = null } = opts;
  const r = await db.query(
    `insert into public.driving_schools
       (name, slug, plz, ort, land, latitude, longitude, source, source_ref, is_listed, is_verified, verification_status, brand_id)
     values ($1,$2,$3,$4,'DE',48.13,11.57,'osm',$5,false,false,'needs_review',$6) returning id`,
    [name, slug, plz, ort, "node/" + slug, brandId],
  );
  return (r.rows[0] as { id: string }).id;
}
const count = async (t: string, where = "") =>
  Number(((await db.query(`select count(*)::int n from public.${t} ${where}`)).rows[0] as { n: number }).n);

const evidenceFull = (dom = "fahrschule-mueller.de") => ({
  emails: [`info@${dom}`],
  phones: ["+498912345678"],
  addresses: [{ strasse: "Musterstraße 12", plz: "80331", ort: "München" }],
  pageUrl: `https://${dom}/impressum`,
});

describe("verifyCandidate — Voll-Verifikation", () => {
  it("schreibt Kontakte, setzt auto_verified/is_verified, NICHT is_listed", async () => {
    const id = await seedSchool();
    const runId = await startVerifyRun(q);
    const counts = emptyCounts();
    const res = await verifyCandidate(q, { schoolId: id, domain: "fahrschule-mueller.de" }, evidenceFull(), { runId, counts });
    expect(res.decision).toBe("verified");

    const ds = (await db.query(`select is_listed, is_verified, verification_status, brand_id, strasse from public.driving_schools where id=$1`, [id])).rows[0] as Record<string, unknown>;
    expect(ds.is_listed).toBe(false);
    expect(ds.is_verified).toBe(true);
    expect(ds.verification_status).toBe("auto_verified");
    expect(ds.brand_id).not.toBeNull();
    expect(ds.strasse).toBe("Musterstraße 12");

    const prof = (await db.query(`select id, telefon, email, website from public.school_profiles where school_id=$1`, [id])).rows[0] as Record<string, unknown>;
    expect(prof.telefon).toBe("+498912345678");
    expect(prof.email).toBe("info@fahrschule-mueller.de");
    expect(prof.website).toBe("https://fahrschule-mueller.de");

    // Provenienz für Profil zeigt auf school_profiles.id (NICHT driving_schools.id)
    const prov = (await db.query(
      `select target_id, source from public.field_provenance where target_table='school_profiles'`,
    )).rows as Record<string, string>[];
    expect(prov.length).toBe(3);
    for (const p of prov) expect(p.target_id).toBe(prof.id);
    expect(counts.verified).toBe(1);
  });
});

describe("verifyCandidate — Gate streng / Review", () => {
  it("fehlende E-Mail → Review, kein Profil, kein auto_verified", async () => {
    const id = await seedSchool();
    const runId = await startVerifyRun(q);
    const counts = emptyCounts();
    const ev = { ...evidenceFull(), emails: [] };
    const res = await verifyCandidate(q, { schoolId: id, domain: "fahrschule-mueller.de" }, ev, { runId, counts });
    expect(res.decision).toBe("review");
    expect(res.reasons).toContain("missing_email");
    expect(await count("school_profiles", `where school_id='${id}'`)).toBe(0);
    const vs = (await db.query(`select verification_status from public.driving_schools where id=$1`, [id])).rows[0] as Record<string, unknown>;
    expect(vs.verification_status).toBe("needs_review");
    expect(await count("import_review_queue", "where status='pending'")).toBe(1);
  });

  it("Multi-Standort (mehrere Adressen) → Review", async () => {
    const id = await seedSchool();
    const runId = await startVerifyRun(q);
    const counts = emptyCounts();
    // Zwei Adressen mit DERSELBEN PLZ wie die Schule → nicht eindeutig zuordenbar.
    const ev = { ...evidenceFull(), addresses: [
      { strasse: "Musterstraße 12", plz: "80331", ort: "München" },
      { strasse: "Filialweg 3", plz: "80331", ort: "München" },
    ] };
    const res = await verifyCandidate(q, { schoolId: id, domain: "fahrschule-mueller.de" }, ev, { runId, counts });
    expect(res.decision).toBe("review");
    expect(res.reasons).toContain("multi_location_ambiguous");
  });

  it("Adress-Mismatch (andere PLZ) → Review", async () => {
    const id = await seedSchool({ plz: "10115", ort: "Berlin" });
    const runId = await startVerifyRun(q);
    const res = await verifyCandidate(q, { schoolId: id, domain: "x.de" }, evidenceFull("x.de"), { runId, counts: emptyCounts() });
    expect(res.decision).toBe("review");
    expect(res.reasons).toContain("address_mismatch");
  });
});

describe("verifyCandidate — Exclusion + manuelle Provenienz", () => {
  it("opt_out-Domain → excluded, nichts geschrieben", async () => {
    const id = await seedSchool();
    await db.query(`insert into public.import_exclusion (typ,value,reason) values ('domain','fahrschule-mueller.de','opt_out')`);
    const res = await verifyCandidate(q, { schoolId: id, domain: "fahrschule-mueller.de" }, evidenceFull(), { runId: await startVerifyRun(q), counts: emptyCounts() });
    expect(res.decision).toBe("excluded");
    expect(await count("school_profiles", `where school_id='${id}'`)).toBe(0);
  });

  it("manuell gepflegtes Profil wird NICHT überschrieben → Review", async () => {
    const id = await seedSchool();
    const prof = (await db.query(`insert into public.school_profiles (school_id, telefon, email) values ($1,'MANUELL','manuell@x.de') returning id`, [id])).rows[0] as { id: string };
    await db.query(
      `insert into public.field_provenance (target_table, target_id, field, source) values ('school_profiles',$1,'telefon','manual_review')`,
      [prof.id],
    );
    const res = await verifyCandidate(q, { schoolId: id, domain: "fahrschule-mueller.de" }, evidenceFull(), { runId: await startVerifyRun(q), counts: emptyCounts() });
    expect(res.decision).toBe("review");
    const after = (await db.query(`select telefon from public.school_profiles where id=$1`, [prof.id])).rows[0] as Record<string, unknown>;
    expect(after.telefon).toBe("MANUELL");
  });
});

describe("verifyCandidate — Verzeichnis & E-Mail-Regel", () => {
  it("Verzeichnis-Domain (fahrschulefinder.de) → Review, nie verifiziert", async () => {
    const id = await seedSchool();
    const res = await verifyCandidate(q, { schoolId: id, domain: "fahrschulefinder.de" }, evidenceFull("fahrschulefinder.de"), { runId: await startVerifyRun(q), counts: emptyCounts() });
    expect(res.decision).toBe("review");
    expect(res.reasons).toContain("third_party_website");
    expect(await count("driving_schools", `where id='${id}' and verification_status='auto_verified'`)).toBe(0);
  });

  it("Freemail (gmx.de) wird akzeptiert; fremde Firmen-/Agentur-Domain NICHT", async () => {
    const ok = await seedSchool({ slug: "fs-ok" });
    const r1 = await verifyCandidate(q, { schoolId: ok, domain: "charly.de" }, { emails: ["charly@gmx.de"], phones: ["+4989123456"], addresses: [{ strasse: "A 1", plz: "80331", ort: "München" }], pageUrl: "https://charly.de/impressum" }, { runId: await startVerifyRun(q), counts: emptyCounts() });
    expect(r1.decision).toBe("verified");

    const bad = await seedSchool({ slug: "fs-bad" });
    const r2 = await verifyCandidate(q, { schoolId: bad, domain: "charly.de" }, { emails: ["info@agentur-xy.com"], phones: ["+4989123456"], addresses: [{ strasse: "A 1", plz: "80331", ort: "München" }], pageUrl: "https://charly.de/impressum" }, { runId: await startVerifyRun(q), counts: emptyCounts() });
    expect(r2.decision).toBe("review");
    expect(r2.reasons).toContain("missing_email");
  });
});

describe("verifyCandidate — Brand-Gruppierung", () => {
  it("gleiche Domain → gleiche Brand, Filialen bleiben getrennte Schulen", async () => {
    const a = await seedSchool({ slug: "fs-a", plz: "80331", ort: "München" });
    const b = await seedSchool({ slug: "fs-b", plz: "80999", ort: "München" });
    const dom = "kette.de";
    const runId = await startVerifyRun(q);
    const counts = emptyCounts();
    await verifyCandidate(q, { schoolId: a, domain: dom }, { emails: [`info@${dom}`], phones: ["+4930123456"], addresses: [{ strasse: "A 1", plz: "80331", ort: "München" }], pageUrl: `https://${dom}/impressum` }, { runId, counts });
    await verifyCandidate(q, { schoolId: b, domain: dom }, { emails: [`info@${dom}`], phones: ["+4930234567"], addresses: [{ strasse: "B 2", plz: "80999", ort: "München" }], pageUrl: `https://${dom}/impressum` }, { runId, counts });

    const brandA = (await db.query(`select brand_id from public.driving_schools where id=$1`, [a])).rows[0] as Record<string, string>;
    const brandB = (await db.query(`select brand_id from public.driving_schools where id=$1`, [b])).rows[0] as Record<string, string>;
    expect(brandA.brand_id).toBe(brandB.brand_id);
    expect(await count("school_brand_domains", `where lower(domain)='${dom}'`)).toBe(1);
    expect(await count("driving_schools", "where source='osm'")).toBe(2); // Filialen getrennt
    expect(counts.brands_created).toBe(1);
  });

  it("Domain bereits anderer Brand zugeordnet → Review, kein Umhängen", async () => {
    const brandB = (await db.query(`insert into public.school_brands (name, is_portal_managed) values ('B', true) returning id`)).rows[0] as { id: string };
    const id = await seedSchool({ brandId: brandB.id });
    const brandA = (await db.query(`insert into public.school_brands (name, is_portal_managed) values ('A', true) returning id`)).rows[0] as { id: string };
    await db.query(`insert into public.school_brand_domains (brand_id, domain) values ($1,'fahrschule-mueller.de')`, [brandA.id]);
    await verifyCandidate(q, { schoolId: id, domain: "fahrschule-mueller.de" }, evidenceFull(), { runId: await startVerifyRun(q), counts: emptyCounts() });
    const ds = (await db.query(`select brand_id from public.driving_schools where id=$1`, [id])).rows[0] as Record<string, string>;
    expect(ds.brand_id).toBe(brandB.id); // nicht umgehängt
    expect(await count("import_review_queue", "where 'domain_brand_conflict' = any(reasons)")).toBe(1);
  });
});

describe("verifyCandidate — Re-Run idempotent", () => {
  it("zweiter Lauf: kein Profil-/Provenienz-/Brand-Duplikat", async () => {
    const id = await seedSchool();
    const cand = { schoolId: id, domain: "fahrschule-mueller.de" };
    await verifyCandidate(q, cand, evidenceFull(), { runId: await startVerifyRun(q), counts: emptyCounts() });
    await verifyCandidate(q, cand, evidenceFull(), { runId: await startVerifyRun(q), counts: emptyCounts() });
    expect(await count("school_profiles", `where school_id='${id}'`)).toBe(1);
    expect(await count("field_provenance", "where target_table='school_profiles'")).toBe(3);
    expect(await count("school_brand_domains")).toBe(1);
  });
});
