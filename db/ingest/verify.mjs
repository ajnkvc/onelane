/**
 * db/ingest/verify.mjs — DB-Kern der Website-Verifikation (008c), Querier-basiert.
 * ============================================================================
 * KEIN Netz hier (Fetch macht der Runner). Bekommt je Kandidat die bereits
 * extrahierte Evidenz (Adressen/Telefon/E-Mail aus eigener Website/Impressum) und
 * entscheidet streng: nur bei Adresse+Telefon+E-Mail der KONKRETEN Lage →
 * verifiziert; sonst Review. Schreibt bestätigte Kontakte in school_profiles +
 * field_provenance, setzt verification_status='auto_verified'/is_verified, NIE
 * is_listed. Brand-Gruppierung je verifizierter Domain (school_brand_domains).
 * Nichts raten; manuelle Provenienz nie überschreiben; idempotent.
 */
import { slugify, normName, shortHash } from "./normalize.mjs";
import { normalizePhone } from "./extract.mjs";

const CONF = 0.9;

// Verzeichnisse/Aggregatoren/Plattformen — NIE die eigene Website einer Schule.
const DIRECTORY_DOMAINS = new Set([
  "fahrschulefinder.de", "fahrschule-finder.de", "fahrschulen.de", "fahrschulcheck.de",
  "meinefahrschule.de", "drivolino.de", "fahrschulvergleich.de",
  "gelbeseiten.de", "dasoertliche.de", "dastelefonbuch.de", "11880.com", "yelp.de", "yelp.com",
  "facebook.com", "instagram.com", "linkedin.com", "tiktok.com", "youtube.com",
  "google.com", "google.de", "goo.gl", "wordpress.com", "jimdo.com", "wixsite.com",
]);
// Freie Webmail-Provider — bei Einzelschulen legitime Inhaber-Kontakte (kein Fremd-Firma).
const FREEMAIL = new Set([
  "gmx.de", "gmx.net", "web.de", "gmail.com", "googlemail.com", "t-online.de",
  "outlook.de", "outlook.com", "hotmail.de", "hotmail.com", "yahoo.de", "yahoo.com",
  "freenet.de", "aol.com", "mail.de", "posteo.de", "mailbox.org", "icloud.com", "gmail.de",
]);

/** Plausible DE-Telefonnummer? Auffällige (zu kurz/Format) → NICHT verifizieren, Review. */
function plausiblePhone(p) {
  if (!p) return false;
  if (p.startsWith("+")) return /^49[1-9]\d{7,12}$/.test(p.slice(1)); // +49, keine führende 0, 8–13 Ziffern
  return /^0[1-9]\d{7,11}$/.test(p);                                   // 0 + Vorwahl + Nummer (≥9 Ziffern)
}

/** E-Mail nur akzeptieren, wenn eigene Domain ODER Freemail — NIE fremde Firmen-/Agentur-Domain. */
function pickEmail(emails, dom) {
  const list = emails ?? [];
  const onDom = dom ? list.find((e) => e.endsWith("@" + dom)) : null;
  if (onDom) return onDom;
  return list.find((e) => FREEMAIL.has((e.split("@")[1] ?? "").toLowerCase())) ?? null;
}

async function rows(q, sql, p = []) { return (await q.query(sql, p)).rows; }
async function one(q, sql, p = []) { return (await rows(q, sql, p))[0] ?? null; }

export async function startVerifyRun(q) {
  const run = await one(
    q,
    `insert into public.import_run (source, params, status)
     values ('site', $1::text::jsonb, 'running') returning id`,
    [JSON.stringify({ kind: "own_site_verification" })],
  );
  await q.query(
    `insert into public.security_events (actor_user_id, event_type, target_table, target_id, metadata)
     values (null, 'site_verify_started', 'import_run', $1, '{}'::jsonb)`,
    [run.id],
  );
  return run.id;
}

export async function finishVerifyRun(q, runId, counts, status = "completed") {
  await q.query(
    `update public.import_run set status=$2, counts=$3::text::jsonb, finished_at=now() where id=$1`,
    [runId, status, JSON.stringify(counts)],
  );
  await q.query(
    `insert into public.security_events (actor_user_id, event_type, target_table, target_id, metadata)
     values (null, $1, 'import_run', $2, $3::text::jsonb)`,
    // 'completed'/'completed_with_errors' = beendet; nur echte Abbrüche → failed (F-045).
    [status.startsWith("completed") ? "site_verify_finished" : "site_verify_failed", runId, JSON.stringify(counts)],
  );
}

function ortEq(a, b) {
  const x = slugify(a ?? ""), y = slugify(b ?? "");
  return x.length > 0 && y.length > 0 && (x === y || x.startsWith(y) || y.startsWith(x));
}

/**
 * Review-Eintrag (idempotent + priorisierend). `priority`: höher = in der manuellen
 * Review weiter oben. Website-gestützte 008c-Teildaten (gute Datenlage) bekommen hohe
 * Priorität, damit sie VOR den website-losen 008b-Fällen (priority 0) geprüft werden.
 * Upsert via CTE (treiberunabhängig: aktualisiert bestehenden pending-Eintrag, sonst neu).
 */
async function addReview(q, runId, schoolId, reasons, proposed, priority = 50) {
  await q.query(
    `with upd as (
       update public.import_review_queue
         set run_id=$1, reasons=$3::text[], proposed=$4::text::jsonb, priority=$5, updated_at=now()
         where school_id=$2 and status='pending'
         returning id
     )
     insert into public.import_review_queue (run_id, school_id, reasons, proposed, priority, status)
     select $1, $2, $3::text[], $4::text::jsonb, $5, 'pending'
     where not exists (select 1 from upd)`,
    [runId, schoolId, `{${reasons.join(",")}}`, proposed ? JSON.stringify(proposed) : null, priority],
  );
}

async function writeProv(q, targetTable, targetId, field, value, source, sourceUrl, runId) {
  await q.query(
    `insert into public.field_provenance
       (target_table, target_id, field, value_hash, source, source_url, observed_at, verified_at, confidence, run_id)
     values ($1, $2, $3, $4, $5, $6, now(), now(), $7, $8)
     on conflict (target_table, target_id, field) do update set
       value_hash=excluded.value_hash, source=excluded.source, source_url=excluded.source_url,
       observed_at=excluded.observed_at, verified_at=excluded.verified_at,
       confidence=excluded.confidence, run_id=excluded.run_id`,
    [targetTable, targetId, field, shortHash(String(value)), source, sourceUrl, CONF, runId],
  );
}

/** Brand je verifizierter Domain idempotent zuordnen; Konflikt → Review. */
async function assignBrand(q, school, domain, runId, counts) {
  const dom = domain.toLowerCase();
  const mapping = await one(q, `select brand_id from public.school_brand_domains where lower(domain)=$1`, [dom]);
  const cur = school.brand_id ?? null;
  if (mapping) {
    if (cur && cur !== mapping.brand_id) {
      await addReview(q, runId, school.id, ["domain_brand_conflict"], { domain: dom }, 40);
      return false;
    }
    if (!cur) {
      await q.query(`update public.driving_schools set brand_id=$2 where id=$1`, [school.id, mapping.brand_id]);
      counts.brands_reused++;
    }
    return true;
  }
  // Domain noch nicht gemappt
  if (cur) {
    await q.query(
      `insert into public.school_brand_domains (brand_id, domain) values ($1, $2)
       on conflict (lower(domain)) do nothing`,
      [cur, dom],
    );
    counts.brands_reused++;
    return true;
  }
  const brand = await one(
    q,
    `insert into public.school_brands (name, is_portal_managed) values ($1, true) returning id`,
    [school.name],
  );
  await q.query(
    `insert into public.school_brand_domains (brand_id, domain) values ($1, $2)
     on conflict (lower(domain)) do nothing`,
    [brand.id, dom],
  );
  await q.query(`update public.driving_schools set brand_id=$2 where id=$1`, [school.id, brand.id]);
  counts.brands_created++;
  return true;
}

/**
 * Verifiziert EINEN Kandidaten gegen die Evidenz seiner eigenen Website.
 * @param {{query:(s:string,p?:unknown[])=>Promise<{rows:any[]}>}} q
 * @param {{schoolId:string, sourceRef?:string, domain?:string|null}} candidate
 * @param {{emails:string[], phones:string[], addresses:{strasse:string|null,plz:string,ort:string}[], pageUrl:string}} evidence
 * @param {{runId:string, counts:Record<string,number>}} ctx
 * @returns {Promise<{decision:string, reasons:string[]}>}
 */
export async function verifyCandidate(q, candidate, evidence, ctx) {
  const { runId, counts } = ctx;
  counts.processed++;
  const school = await one(
    q,
    `select id, name, plz, ort, brand_id, verification_status from public.driving_schools where id=$1`,
    [candidate.schoolId],
  );
  if (!school) { counts.review++; return { decision: "review", reasons: ["school_missing"] }; }

  // Exclusion (opt_out/takedown/legal_hold etc.) vor allem
  const exclusions = await rows(q, `select typ, lower(value) as value from public.import_exclusion where active=true`);
  const nameKey = normName(school.name);
  const dom = (candidate.domain ?? "").toLowerCase();
  const excluded = exclusions.some((e) =>
    ((e.typ === "name" || e.typ === "pattern") && nameKey.includes(e.value)) ||
    ((e.typ === "domain" || e.typ === "pattern") && dom && (dom === e.value || dom.endsWith("." + e.value) || dom.includes(e.value))));
  if (excluded) {
    await addReview(q, runId, school.id, ["excluded"], null, 0); // Ausschluss: nicht oben
    counts.excluded++; return { decision: "excluded", reasons: ["excluded"] };
  }

  // Manuelle Provenienz schützen: existiert manuell gepflegtes Profil → nicht anfassen
  const profile = await one(q, `select id from public.school_profiles where school_id=$1`, [school.id]);
  if (profile) {
    const manual = await rows(
      q,
      `select 1 from public.field_provenance
       where target_table='school_profiles' and target_id=$1 and source='manual_review' limit 1`,
      [profile.id],
    );
    if (manual.length) {
      await addReview(q, runId, school.id, ["manual_provenance_conflict"], null, 60);
      counts.review++; return { decision: "review", reasons: ["manual_provenance_conflict"] };
    }
  }

  // Verzeichnis/Aggregator als „eigene Website" ausschließen (z. B. fahrschulefinder.de)
  if (DIRECTORY_DOMAINS.has(dom)) {
    await addReview(q, runId, school.id, ["third_party_website"], { domain: dom }, 50);
    counts.review++; return { decision: "review", reasons: ["third_party_website"] };
  }

  // Lage-Match: PLZ ist der präzise Schlüssel (OSM hat sie meist). Adresse(n) der eigenen
  // Website nach OSM-PLZ filtern → bei Filialen die richtige Zeile; sonst Ort-Fallback
  // (falls OSM keine PLZ hatte). PLZ/Straße kommen von der Website. Mehrere passende →
  // nicht eindeutig dem Standort zuzuordnen → Review, kein Raten.
  // Adressen über ALLE gefetchten Seiten (Start + Impressum + Kontakt) deduplizieren
  // (gleiche Adresse je PLZ + Hausnummer nur einmal).
  const seenA = new Set();
  const addrs = [];
  for (const a of (evidence.addresses ?? [])) {
    const k = `${a.plz}|${(a.strasse ?? "").match(/\d{1,4}/)?.[0] ?? ""}`;
    if (seenA.has(k)) continue;
    seenA.add(k);
    addrs.push(a);
  }
  let matching = school.plz ? addrs.filter((a) => a.plz === school.plz) : [];
  if (matching.length === 0) matching = addrs.filter((a) => ortEq(a.ort, school.ort));
  const reasons = [];
  let addr = null;
  if (addrs.length === 0) reasons.push("missing_address");
  else if (matching.length === 0) reasons.push("address_mismatch");
  else if (matching.length > 1) reasons.push("multi_location_ambiguous");
  else addr = matching[0];

  const email = pickEmail(evidence.emails, dom);
  const phonesNorm = (evidence.phones ?? []).map(normalizePhone).filter(Boolean);
  const phone = phonesNorm.find(plausiblePhone) ?? null; // nur plausible Nummern verifizieren
  if (!email) reasons.push("missing_email");
  if (!phone) reasons.push(phonesNorm.length ? "phone_suspect" : "missing_phone");
  if (reasons.length > 0 || !addr) {
    // Website-gestützte Teildaten zuerst prüfen: „nur Kontakt fehlt" (Adresse passt) → 100,
    // sonstige website-gestützte Fälle → 70; beides klar über website-losen 008b-Fällen (0).
    const partialOnly = reasons.length > 0 && reasons.every((r) => r === "missing_email" || r === "missing_phone");
    const priority = partialOnly ? 100 : 70;
    await addReview(q, runId, school.id, reasons.length ? reasons : ["incomplete"], { email, phone }, priority);
    counts.review++; return { decision: "review", reasons };
  }

  // VERIFIZIERT — Profil-Kontakte schreiben (nur diese Felder), Provenienz, Status.
  const website = `https://${dom}`;
  let profileId = profile?.id ?? null;
  if (profileId) {
    await q.query(
      `update public.school_profiles set telefon=$2, email=$3, website=$4, updated_at=now() where id=$1`,
      [profileId, phone, email, website],
    );
  } else {
    profileId = (await one(
      q,
      `insert into public.school_profiles (school_id, telefon, email, website) values ($1,$2,$3,$4) returning id`,
      [school.id, phone, email, website],
    )).id;
  }
  await writeProv(q, "school_profiles", profileId, "telefon", phone, "impressum", evidence.pageUrl, runId);
  await writeProv(q, "school_profiles", profileId, "email", email, "impressum", evidence.pageUrl, runId);
  await writeProv(q, "school_profiles", profileId, "website", website, "school_website", evidence.pageUrl, runId);

  // Adresse von der eigenen Website übernehmen (Straße + PLZ — auch wenn OSM keine
  // PLZ hatte) + feldgenaue Provenienz auf driving_schools.
  if (addr.strasse) {
    await q.query(`update public.driving_schools set strasse=$2 where id=$1`, [school.id, addr.strasse]);
    await writeProv(q, "driving_schools", school.id, "strasse", addr.strasse, "impressum", evidence.pageUrl, runId);
  }
  if (addr.plz) {
    await q.query(`update public.driving_schools set plz=$2 where id=$1`, [school.id, addr.plz]);
    await writeProv(q, "driving_schools", school.id, "plz", addr.plz, "impressum", evidence.pageUrl, runId);
  }

  await q.query(
    `update public.driving_schools set verification_status='auto_verified', is_verified=true where id=$1`,
    [school.id],
  );
  // Obsoletes Review-Item entfernen (Kandidat ist jetzt verifiziert).
  await q.query(`delete from public.import_review_queue where school_id=$1 and status='pending'`, [school.id]);
  counts.profiles_updated++;
  counts.verified++;

  if (dom) await assignBrand(q, school, dom, runId, counts);
  return { decision: "verified", reasons: [] };
}

export function emptyCounts() {
  return {
    processed: 0, verified: 0, review: 0, excluded: 0,
    profiles_updated: 0, brands_created: 0, brands_reused: 0,
    fetched_pages: 0, robots_blocked: 0, errors: 0,
  };
}
