/**
 * db/ingest/apply.mjs — DB-Kern des OSM-Imports (008b), Querier-basiert.
 * ============================================================================
 * Läuft im Test gegen PGlite und im Runner gegen postgres.js (gleiches
 * `{ query(sql, params) }`-Interface, $1-Parameter). KEIN Netz, KEINE Google-
 * Felder, KEINE Kontakte in school_profiles, KEINE Brand-Materialisierung (008c/d).
 * Importierte Schulen sind immer is_listed=false / is_verified=false / needs_review.
 * Idempotent über (source, source_ref). Exclusion greift VOR allem.
 */
import {
  slugify, normName, shortHash, normalizeOsmElement, geoNear, clusterKey, dedupeKey,
} from "./normalize.mjs";

const ODBL = {
  attribution: "© OpenStreetMap contributors",
  license: "ODbL",
  license_url: "https://opendatacommons.org/licenses/odbl/1-0/",
  visible_attribution_required_before_listing: true,
};
const PROV_FIELDS = ["name", "strasse", "plz", "ort", "latitude", "longitude"];
const CONF = 0.3; // OSM-Basis: bewusst niedrige Konfidenz (Verifikation erst 008c)

async function rows(q, sql, params = []) {
  return (await q.query(sql, params)).rows;
}
async function one(q, sql, params = []) {
  return (await rows(q, sql, params))[0] ?? null;
}

function isExcluded(cand, exclusions) {
  const name = normName(cand.name);
  const dom = cand.domain ?? "";
  for (const ex of exclusions) {
    const v = ex.value;
    if (ex.typ === "name" && name.includes(v)) return ex;
    if (ex.typ === "pattern" && (name.includes(v) || (dom && dom.includes(v)))) return ex;
    if (ex.typ === "domain" && dom && (dom === v || dom.endsWith("." + v))) return ex;
    if (ex.typ === "source" && cand.sourceRef.startsWith(v)) return ex;
  }
  return null;
}

/**
 * Startet einen Lauf: import_run + auditiertes security_event (System-Actor NULL).
 * @param {{query: (s: string, p?: unknown[]) => Promise<{rows: any[]}>}} q
 * @param {{sourceVersion?: string|null, query?: string|null}} [opts]
 * @returns {Promise<string>}
 */
export async function startRun(q, { sourceVersion = null, query = null } = {}) {
  const params = { ...ODBL, query, source_version: sourceVersion };
  const run = await one(
    q,
    `insert into public.import_run (source, source_version, query, params, status)
     values ('osm', $1, $2, $3::text::jsonb, 'running') returning id`,
    [sourceVersion, query, JSON.stringify(params)],
  );
  await q.query(
    `insert into public.security_events (actor_user_id, event_type, target_table, target_id, metadata)
     values (null, 'osm_import_started', 'import_run', $1, $2::text::jsonb)`,
    [run.id, JSON.stringify({ source: "osm", source_version: sourceVersion })],
  );
  return run.id;
}

/**
 * Schließt einen Lauf ab: counts/status + auditiertes security_event.
 * @param {{query: (s: string, p?: unknown[]) => Promise<{rows: any[]}>}} q
 * @param {string} runId
 * @param {Record<string, number|boolean>} counts
 * @param {string} [status]
 * @param {string|null} [errorSummary]
 */
export async function finishRun(q, runId, counts, status = "completed", errorSummary = null) {
  await q.query(
    `update public.import_run set status = $2, counts = $3::text::jsonb, error_summary = $4, finished_at = now()
     where id = $1`,
    [runId, status, JSON.stringify(counts), errorSummary],
  );
  await q.query(
    `insert into public.security_events (actor_user_id, event_type, target_table, target_id, metadata)
     values (null, $1, 'import_run', $2, $3::text::jsonb)`,
    // 'completed' UND 'completed_with_errors' = beendet (nur mit Teilfehlern); nur echte Abbrüche → failed.
    [status.startsWith("completed") ? "osm_import_finished" : "osm_import_failed", runId, JSON.stringify(counts)],
  );
}

async function upsertStaging(q, runId, cand, status) {
  const raw = { type: cand.osmType, id: cand.osmId };
  const r = await one(
    q,
    `insert into public.import_staging
       (run_id, source, source_ref, source_url, raw, normalized, content_hash, status)
     values ($1, 'osm', $2, $3, $4::text::jsonb, $5::text::jsonb, $6, $7)
     on conflict (source, source_ref) do update set
       run_id = excluded.run_id, source_url = excluded.source_url, raw = excluded.raw,
       normalized = excluded.normalized, content_hash = excluded.content_hash,
       status = excluded.status, updated_at = now()
     returning id`,
    [runId, cand.sourceRef, cand.sourceUrl, JSON.stringify(raw),
     JSON.stringify(cand), shortHash(JSON.stringify(cand)), status],
  );
  return r.id;
}

async function writeProvenance(q, schoolId, cand, runId) {
  for (const field of PROV_FIELDS) {
    const val = cand[field];
    if (val === null || val === undefined || val === "") continue;
    await q.query(
      `insert into public.field_provenance
         (target_table, target_id, field, value_hash, source, source_url, source_ref, observed_at, confidence, run_id)
       values ('driving_schools', $1, $2, $3, 'osm', $4, $5, now(), $6, $7)
       on conflict (target_table, target_id, field) do update set
         value_hash = excluded.value_hash, source = excluded.source, source_url = excluded.source_url,
         source_ref = excluded.source_ref, observed_at = excluded.observed_at,
         confidence = excluded.confidence, run_id = excluded.run_id`,
      [schoolId, field, shortHash(String(val)), cand.sourceUrl, cand.sourceRef, CONF, runId],
    );
  }
}

async function addReview(q, runId, stagingId, reasons) {
  await q.query(
    `insert into public.import_review_queue (run_id, staging_id, reasons, status)
     select $1, $2, $3::text[], 'pending'
     where not exists (select 1 from public.import_review_queue where staging_id = $2 and status = 'pending')`,
    [runId, stagingId, `{${reasons.join(",")}}`],
  );
}

async function addDedupe(q, runId, stagingId, canonicalId, decision, score, factors) {
  await q.query(
    `insert into public.dedupe_decision
       (run_id, staging_id, canonical_school_id, decision, score, match_factors)
     select $1, $2, $3, $4, $5, $6::text::jsonb
     where not exists (select 1 from public.dedupe_decision where staging_id = $2)`,
    [runId, stagingId, canonicalId, decision, score, factors ? JSON.stringify(factors) : null],
  );
}

function addressKey(cand) {
  return `${cand.land}|${cand.plz ?? ""}|${slugify(cand.strasse ?? "")}|${slugify(cand.ort ?? "")}`;
}

/**
 * Verarbeitet Overpass-Elemente: Normalisierung → Exclusion → Dedupe → Materialisierung
 * (hidden/unlisted) bzw. Review. Gibt Lauf-Zähler zurück.
 * @param {{query: (s: string, p?: unknown[]) => Promise<{rows: any[]}>}} q
 * @param {any[]} elements
 * @param {{runId: string}} opts
 * @returns {Promise<Record<string, number>>}
 */
export async function importCandidates(q, elements, { runId }) {
  const counts = {
    candidates: 0, rejected: 0, excluded: 0, unique_source: 0, with_website: 0,
    materialized: 0, updated: 0, merged: 0, separate_branch: 0, needs_review: 0, errors: 0,
  };

  const exclusions = await rows(
    q, `select typ, lower(value) as value, reason from public.import_exclusion where active = true`,
  );
  const existing = await rows(
    q, `select id, source, source_ref, land, ort, slug, plz, name, latitude, longitude
        from public.driving_schools`,
  );
  // Map über exakte source_ref (source='osm') für Re-Run-Idempotenz
  const osmExisting = new Map(existing.filter((r) => r.source === "osm").map((r) => [r.source_ref, r]));
  const existingSlug = new Set(existing.map((r) => `${r.land}|${r.ort ?? ""}|${r.slug}`));

  // Normalisieren (stabile Reihenfolge nach source_ref → Determinismus)
  const cands = [];
  for (const el of elements) {
    counts.candidates++;
    const c = normalizeOsmElement(el);
    if (!c) { counts.rejected++; continue; }
    cands.push(c);
  }
  cands.sort((a, b) => a.sourceRef.localeCompare(b.sourceRef));

  // Nicht-ausgeschlossene
  const kept = [];
  for (const c of cands) {
    const ex = isExcluded(c, exclusions);
    if (ex) {
      await upsertStaging(q, runId, c, "excluded");
      counts.excluded++;
      continue;
    }
    kept.push(c);
  }
  counts.unique_source = kept.length;

  // Batch-Signale: Domain→Adressen (Filial-Erkennung), Telefon→Adressen, Basis-Slug-Kollision
  const domainAddrs = new Map();
  const phoneAddrs = new Map();
  const baseSlugCount = new Map();
  for (const c of kept) {
    if (c.website && c.domain) (domainAddrs.get(c.domain) ?? domainAddrs.set(c.domain, new Set()).get(c.domain)).add(addressKey(c));
    if (c.phone) (phoneAddrs.get(c.phone) ?? phoneAddrs.set(c.phone, new Set()).get(c.phone)).add(addressKey(c));
    if (c.ort && c.lat != null && c.lng != null) {
      const k = `${c.land}|${slugify(c.ort)}|${slugify(c.name)}`;
      baseSlugCount.set(k, (baseSlugCount.get(k) ?? 0) + 1);
    }
  }

  for (const c of kept) {
    try {
      if (c.website) counts.with_website++;
      // F-044: Dedupe-Schlüssel bei JEDEM materialisierten OSM-Objekt mitschreiben (Insert UND Update),
      // damit Review-Dedupe und B2B-Abgleich (die genau an cluster_key/dedupe_key hängen) OSM-Zeilen
      // nicht verpassen. JS-normName (NFD/ß→ss) ist nicht SQL-replizierbar → hier in JS berechnet.
      const ck = clusterKey(c), dk = dedupeKey(c);

      // Re-Run: gleiches OSM-Objekt existiert → Felder aktualisieren, kein Duplikat/Slug-Wechsel
      const existRow = osmExisting.get(c.sourceRef);
      if (existRow) {
        await q.query(
          `update public.driving_schools set
             name=$2, strasse=$3, plz=$4, ort=$5, latitude=$6, longitude=$7, imported_at=now(),
             cluster_key=$8, dedupe_key=$9,
             verification_status = case
               when verification_status in ('auto_verified', 'manual_verified') then verification_status
               else 'needs_review' end
           where id=$1`,
          [existRow.id, c.name, c.strasse, c.plz, c.ort, c.lat, c.lng, ck, dk],
        );
        await writeProvenance(q, existRow.id, c, runId);
        await upsertStaging(q, runId, c, "imported");
        counts.updated++;
        continue;
      }

      // Materialisierbarkeit: Name + belastbarer Ort + Geo
      if (!c.ort || c.lat == null || c.lng == null) {
        const sid = await upsertStaging(q, runId, c, "review");
        await addReview(q, runId, sid, ["missing_ort_or_geo"]);
        await addDedupe(q, runId, sid, null, "needs_review", null, { reason: "missing_ort_or_geo" });
        counts.needs_review++;
        continue;
      }

      // Konservativer Abgleich gegen bestehende canonical Zeilen
      const sameNamePlzGeo = existing.find(
        (r) => r.plz && c.plz && r.plz === c.plz &&
          slugify(r.name) === slugify(c.name) && geoNear(r.latitude, r.longitude, c.lat, c.lng),
      );
      if (sameNamePlzGeo) {
        const sid = await upsertStaging(q, runId, c, "imported");
        if (!sameNamePlzGeo.source) {
          // sehr starker Beweis → Merge in bestehende (source-lose) Schule
          await q.query(
            `update public.driving_schools set source='osm', source_ref=$2, imported_at=now(),
               cluster_key=$3, dedupe_key=$4,
               verification_status = case
                 when verification_status in ('auto_verified', 'manual_verified') then verification_status
                 else 'needs_review' end
             where id=$1`,
            [sameNamePlzGeo.id, c.sourceRef, ck, dk],
          );
          await writeProvenance(q, sameNamePlzGeo.id, c, runId);
          await addDedupe(q, runId, sid, sameNamePlzGeo.id, "merged", 0.95, { rule: "name_plz_geo" });
          osmExisting.set(c.sourceRef, { ...sameNamePlzGeo, source: "osm", source_ref: c.sourceRef });
          counts.merged++;
        } else {
          await addDedupe(q, runId, sid, sameNamePlzGeo.id, "needs_review", 0.6, { rule: "name_plz_geo_existing_osm" });
          await addReview(q, runId, sid, ["possible_duplicate"]);
          counts.needs_review++;
        }
        continue;
      }

      // Adress-/Geo-Konflikt (gleiche Lage, anderer Name) → Review
      const addrConflict = existing.find(
        (r) => r.plz && c.plz && r.plz === c.plz && geoNear(r.latitude, r.longitude, c.lat, c.lng) &&
          slugify(r.name) !== slugify(c.name),
      );
      // Gleiche Telefonnummer an mehreren Adressen (Batch) → Review
      const phoneMulti = c.phone && (phoneAddrs.get(c.phone)?.size ?? 0) > 1;
      if (addrConflict || phoneMulti) {
        const sid = await upsertStaging(q, runId, c, "review");
        await addReview(q, runId, sid, addrConflict ? ["address_conflict"] : ["phone_multi_address"]);
        await addDedupe(q, runId, sid, null, "needs_review", 0.4,
          { reason: addrConflict ? "address_conflict" : "phone_multi_address" });
        counts.needs_review++;
        continue;
      }

      // Materialisieren (hidden/unlisted). Filiale = gleiche Domain an mehreren Adressen.
      const isBranch = c.domain && (domainAddrs.get(c.domain)?.size ?? 0) > 1;
      const base = slugify(c.name);
      const ortSlug = slugify(c.ort);
      const groupKey = `${c.land}|${ortSlug}|${base}`;
      const colliding = (baseSlugCount.get(groupKey) ?? 0) > 1 || existingSlug.has(`${c.land}|${c.ort}|${base}`);
      const slug = colliding ? `${base}-${shortHash(c.sourceRef)}` : base;

      const created = await one(
        q,
        `insert into public.driving_schools
           (name, slug, strasse, plz, ort, bundesland, land, latitude, longitude,
            is_listed, is_verified, verification_status, source, source_ref, imported_at, cluster_key, dedupe_key)
         values ($1,$2,$3,$4,$5,$6,'DE',$7,$8, false, false, 'needs_review', 'osm', $9, now(), $10, $11)
         returning id`,
        [c.name, slug, c.strasse, c.plz, c.ort, c.bundesland, c.lat, c.lng, c.sourceRef, ck, dk],
      );
      await writeProvenance(q, created.id, c, runId);
      const sid = await upsertStaging(q, runId, c, "imported");
      await addDedupe(q, runId, sid, created.id, isBranch ? "separate_branch" : "not_duplicate",
        isBranch ? 0.5 : null, isBranch ? { brand_signal: "domain", domain: c.domain } : null);
      existingSlug.add(`${c.land}|${c.ort}|${slug}`);
      osmExisting.set(c.sourceRef, { id: created.id, source: "osm", source_ref: c.sourceRef });
      counts.materialized++;
      if (isBranch) counts.separate_branch++;
    } catch (err) {
      counts.errors++;
      // Fehler pro Kandidat dürfen den Lauf nicht abbrechen; im Report sichtbar.
      void err;
    }
  }

  return counts;
}
