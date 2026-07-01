/**
 * review-server.mjs — LOKALE Review-Oberfläche (Tooling, nicht die App).
 * ============================================================================
 * Bindet NUR an 127.0.0.1, liest/schreibt über TOOLING_DATABASE_URL.
 * KARTEN-Layout: 1 Datensatz = 1 Karte → ALLE Felder (Adresse/Telefon/E-Mail/
 * Website) + Buttons immer sichtbar, KEIN seitliches Scrollen.
 * - „✓ Verifizieren" → school_profiles + verification_status='manual_verified'
 *   + Provenienz 'manual_review'. NICHTS wird hart gelöscht.
 * - „🗑 Verwerfen" = Status (wiederherstellbar); „↩︎" + Bereich „Erledigt" zum Retten.
 * - „➕ Standort" → neuer Eintrag an dieselbe Brand (Dachverband) = Multi-Standort.
 * is_listed bleibt unberührt (öffentliches Listing = separater Schritt).
 */
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { getDbSslOption } from "./db-ssl.mjs";
import { slugify, clusterKey, dedupeKey, normName } from "../db/ingest/normalize.mjs";
import { shootSite } from "./shoot-website.mjs";
import { withToolingAudit } from "../db/ingest/lib/tooling-audit.mjs";
import { normalizeToolingUrl } from "./lib/url-normalize.mjs";

/** Interner Screenshot-Ablageort (git-ignoriert) für die assistierte Prüfung. */
const SHOT_DIR = path.resolve("data/untracked/screenshots");

const url = process.env.TOOLING_DATABASE_URL;
if (!url) { console.error("Fehlt: TOOLING_DATABASE_URL (.env.development.local)."); process.exit(1); }
const PORT = Number(process.env.REVIEW_PORT ?? 4321);
// F-050: 127.0.0.1-Bindung reduziert nur die Exposition, ersetzt aber keinen Mutationsschutz.
// Pro Start ein zufälliges Review-Token; jeder mutierende POST MUSS es (Header x-review-token)
// mitschicken. Die ausgelieferte Seite bettet das Token ein → nur DIESE Seite kann mutieren; eine
// bösartige lokale Seite (cross-origin) kann es weder lesen noch als Simple-Request-Header setzen.
const REVIEW_TOKEN = process.env.REVIEW_TOKEN || randomUUID();
const ALLOWED_ORIGINS = new Set([`http://127.0.0.1:${PORT}`, `http://localhost:${PORT}`]);
const sql = postgres(url, { max: 4, prepare: false, ssl: getDbSslOption(url), onnotice: () => {} });
// Basis-Querier (autocommit). F-043: mutierende Handler bekommen im Dispatcher stattdessen einen
// transaktionsgebundenen Querier via Parameter `q` injiziert (sql.begin) → Mehrschritt-Mutationen
// sind atomar. Handler referenzieren durchgängig `q`; der Default (qbase) gilt nur außerhalb einer Tx.
const qbase = (s, p = []) => sql.unsafe(s, p);
const q = qbase;
/** Nächste Kundennummer (für neue Einzelschulen/Gruppen). */
const nextKnr = async (q = qbase) => Number((await q(`select nextval('public.driving_schools_kundennummer_seq') as v`))[0].v);

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
// Robuste URL-Normalisierung (Scheme-case-insensitiv, file:/ftp:/javascript: → null); zentral in lib.
const safeUrl = normalizeToolingUrl;
// F-083: bei zu großem Body sauber REJECTEN statt zu hängen (früher: req.destroy() ohne resolve →
// das Promise blieb pending → Handler hing). Jetzt reject → der Dispatch-catch liefert eine Antwort.
const readBody = (req) => new Promise((resolve, reject) => {
  let d = "";
  let settled = false;
  const done = (fn, arg) => { if (settled) return; settled = true; fn(arg); };
  req.on("data", (c) => {
    if (settled) return;
    d += c;
    if (d.length > 1e6) { req.destroy(); done(reject, new Error("payload_too_large")); }
  });
  req.on("end", () => { try { done(resolve, JSON.parse(d || "{}")); } catch { done(resolve, {}); } });
  // settled-Guard + aborted/close: ein vorzeitig geschlossener Request (ohne 'end') darf das
  // Promise NICHT pending lassen (F-083). Nach normalem 'end' sind diese No-ops (settled=true).
  req.on("aborted", () => done(reject, new Error("request_aborted")));
  req.on("close", () => done(reject, new Error("request_closed")));
  req.on("error", (e) => done(reject, e));
});

async function prov(t, id, field, value, q = qbase) {
  if (value == null || value === "") return;
  await q(`insert into public.field_provenance (target_table,target_id,field,source,verified_at,observed_at,confidence)
           values ($1,$2,$3,'manual_review',now(),now(),1.0)
           on conflict (target_table,target_id,field) do update set source='manual_review', verified_at=now(), confidence=1.0`,
    [t, id, field]);
}

async function doVerify(b, q = qbase) {
  const sid = b.schoolId; if (!sid) return { error: "schoolId fehlt" };
  // website über safeUrl normalisieren (Scheme ergänzen, http(s) erzwingen, sonst null) → verhindert
  // einen 500 am DB-CHECK (0018) UND kein javascript:/data: im Belegdatenbestand.
  const tel = (b.telefon ?? "").trim(), email = (b.email ?? "").trim(), web = safeUrl((b.website ?? "").trim()), wa = (b.whatsapp ?? "").trim();
  const str = (b.strasse ?? "").trim(), plz = (b.plz ?? "").trim(), ort = (b.ort ?? "").trim(), nm = (b.name ?? "").trim(), haus = (b.hausnummer ?? "").trim();
  let pid = (await q(`select id from public.school_profiles where school_id=$1`, [sid]))[0]?.id;
  if (pid) await q(`update public.school_profiles set telefon=$2,email=$3,website=$4,whatsapp=$5,updated_at=now() where id=$1`, [pid, tel || null, email || null, web || null, wa || null]);
  else pid = (await q(`insert into public.school_profiles (school_id,telefon,email,website,whatsapp) values ($1,$2,$3,$4,$5) returning id`, [sid, tel || null, email || null, web || null, wa || null]))[0].id;
  // F-019: Prüfung (manual_verified/is_verified = unsere eigene Live-Menge) ist NICHT gleich
  // Veröffentlichung. is_listed bleibt hier UNBERÜHRT — öffentliches Listing ist ein separater,
  // eigens auditierter Schritt (doPublish) hinter dem Freigabe-Gate. So macht ein einzelner Klick
  // im lokalen Tool keine (PII-/Payment-relevanten) Daten sofort öffentlich.
  await q(`update public.driving_schools set name=coalesce(nullif($5,''),name), strasse=coalesce(nullif($2,''),strasse), plz=coalesce(nullif($3,''),plz), ort=coalesce(nullif($4,''),ort), hausnummer=coalesce(nullif($6,''),hausnummer), verification_status='manual_verified', is_verified=true where id=$1`, [sid, str, plz, ort, nm, haus]);
  const kc = (await q(`select name, plz, strasse, land from public.driving_schools where id=$1`, [sid]))[0]; // Keys nach Edit aktualisieren
  await q(`update public.driving_schools set cluster_key=$2, dedupe_key=$3 where id=$1`, [sid, clusterKey(kc), dedupeKey(kc)]);
  await prov("school_profiles", pid, "telefon", tel, q); await prov("school_profiles", pid, "email", email, q); await prov("school_profiles", pid, "website", web, q);
  await prov("driving_schools", sid, "name", nm, q); await prov("driving_schools", sid, "strasse", str, q); await prov("driving_schools", sid, "plz", plz, q); await prov("driving_schools", sid, "ort", ort, q);
  await q(`update public.import_review_queue set status='approved', decided_at=now() where school_id=$1 and status='pending'`, [sid]);
  // Verifiziert → Datensatz ist in unserer eigenen Live-Menge; Screenshots werden nicht mehr gebraucht → löschen (Speicher sparen).
  try { fs.rmSync(path.join(SHOT_DIR, String(sid)), { recursive: true, force: true }); } catch { /* egal */ }
  return { ok: true };
}
/**
 * F-019: Öffentliches Listing = eigener, expliziter, auditierter Schritt (getrennt von der Prüfung).
 * Nur bereits manuell/auto-verifizierte, nicht-duplizierte Schulen können veröffentlicht werden.
 * doUnpublish nimmt eine Schule wieder aus dem öffentlichen Listing (is_listed=false).
 */
async function doPublish(b, q = qbase) {
  const sid = b.schoolId; if (!sid) return { error: "schoolId fehlt" };
  // Nur MANUELL geprüfte, nicht-duplizierte Schulen sind veröffentlichbar. auto_verified muss erst
  // die manuelle Prüfung durchlaufen (→ manual_verified), bevor es öffentlich gelistet werden darf.
  const upd = await q(`update public.driving_schools set is_listed=true
    where id=$1 and not is_duplicate and verification_status='manual_verified' returning id`, [sid]);
  if (!upd.length) return { error: "Nur manuell geprüfte, nicht-duplizierte Schulen können veröffentlicht werden." };
  return { ok: true };
}
async function doUnpublish(b, q = qbase) {
  const sid = b.schoolId; if (!sid) return { error: "schoolId fehlt" };
  await q(`update public.driving_schools set is_listed=false where id=$1`, [sid]);
  return { ok: true };
}
async function doReject(b, q = qbase) {
  const sid = b.schoolId; if (!sid) return { error: "schoolId fehlt" };
  const upd = await q(`update public.import_review_queue set status='rejected', decided_at=now() where school_id=$1 and status='pending' returning id`, [sid]);
  if (!upd.length) await q(`insert into public.import_review_queue (school_id, reasons, priority, status, decided_at) values ($1,'{manual_reject}',0,'rejected',now())`, [sid]);
  await q(`update public.driving_schools set verification_status='rejected', is_listed=false where id=$1 and verification_status <> 'manual_verified'`, [sid]);
  return { ok: true };
}
async function doUndo(b, q = qbase) {
  const sid = b.schoolId; if (!sid) return { error: "schoolId fehlt" };
  await q(`update public.driving_schools set verification_status='needs_review', is_verified=false, is_listed=false where id=$1`, [sid]);
  // Vorhandene Queue-Einträge auf pending setzen; nur wenn KEINER existiert, einen neuen anlegen (keine Doppel-Einträge).
  const existing = await q(`select id from public.import_review_queue where school_id=$1`, [sid]);
  if (existing.length) await q(`update public.import_review_queue set status='pending', decided_at=null where school_id=$1`, [sid]);
  else await q(`insert into public.import_review_queue (school_id, reasons, priority, status) values ($1,'{undo}',80,'pending')`, [sid]);
  return { ok: true };
}
async function doAddLocation(b, q = qbase) {
  const src = (await q(`select id, name, brand_id, land from public.driving_schools where id=$1`, [b.fromSchoolId]))[0];
  if (!src) return { error: "Quell-Schule nicht gefunden" };
  const name = (b.name ?? src.name ?? "").trim() || src.name;
  const ort = (b.ort ?? "").trim(); if (!ort) return { error: "Ort ist nötig (für die Unterseite/URL)" };
  const strasse = (b.strasse ?? "").trim() || null;
  const plz = (b.plz ?? "").trim() || null;
  const land = src.land ?? "DE";
  const ck = clusterKey({ land, plz, name }), dk = dedupeKey({ land, plz, name, strasse });
  // Ebene 2: Vorab-Duplikat-Check — ähnlicher Eintrag existiert? (außer wenn bewusst erzwungen)
  if (!b.force) {
    const matches = await q(`select id, name, strasse, plz, ort from public.driving_schools
      where not is_duplicate and (dedupe_key=$1 or cluster_key=$2) limit 5`, [dk, ck]);
    if (matches.length) return { warning: true, matches };
  }
  let brandId = src.brand_id;
  if (!brandId) {
    brandId = (await q(`insert into public.school_brands (name, is_portal_managed, kundennummer) values ($1, true, $2) returning id`, [src.name, await nextKnr(q)]))[0].id;
    // Quelle ist jetzt gruppiert → keine eigene Kundennummer mehr (nutzt die der Brand)
    await q(`update public.driving_schools set brand_id=$2, kundennummer=null where id=$1`, [src.id, brandId]);
  }
  const slug = `${slugify(name)}-${randomUUID().slice(0, 4)}`;
  const ds = (await q(`insert into public.driving_schools (name, slug, strasse, plz, ort, land, brand_id, source, verification_status, is_listed, is_verified, cluster_key, dedupe_key)
      values ($1,$2,$3,$4,$5,$6,$7,'manual','needs_review',false,false,$8,$9) returning id`,
    [name, slug, strasse, plz, ort, land, brandId, ck, dk]))[0];
  await q(`insert into public.import_review_queue (school_id, reasons, priority, status) values ($1,'{neuer_standort}',95,'pending')`, [ds.id]);
  return { ok: true, id: ds.id };
}

/** Hauptniederlassung markieren. Legt bei Bedarf eine Brand an; max. EINE je Gruppe. */
async function doSetMain(b, q = qbase) {
  const sid = b.schoolId; if (!sid) return { error: "schoolId fehlt" };
  const src = (await q(`select id, name, brand_id from public.driving_schools where id=$1`, [sid]))[0];
  if (!src) return { error: "nicht gefunden" };
  if (!b.isMain) { await q(`update public.driving_schools set is_main_location=false where id=$1`, [sid]); return { ok: true }; }
  let brandId = src.brand_id;
  if (!brandId) {
    brandId = (await q(`insert into public.school_brands (name, is_portal_managed, kundennummer) values ($1, true, $2) returning id`, [src.name, await nextKnr(q)]))[0].id;
    await q(`update public.driving_schools set brand_id=$2, kundennummer=null where id=$1`, [src.id, brandId]);
  }
  await q(`update public.driving_schools set is_main_location=false where brand_id=$1 and id<>$2`, [brandId, sid]); // nur einer pro Gruppe
  await q(`update public.driving_schools set is_main_location=true where id=$1`, [sid]);
  return { ok: true, brandId };
}

/** Manuell angelegten Standort ENDGÜLTIG löschen (nur source='manual'). */
async function doDeleteLocation(b, q = qbase) {
  const sid = b.schoolId; if (!sid) return { error: "schoolId fehlt" };
  const src = (await q(`select id, source from public.driving_schools where id=$1`, [sid]))[0];
  if (!src) return { error: "nicht gefunden" };
  if (src.source !== "manual") return { error: "Nur manuell angelegte Standorte können gelöscht werden. Importierte bitte verwerfen (wiederherstellbar)." };
  await q(`delete from public.field_provenance where target_table='school_profiles' and target_id in (select id from public.school_profiles where school_id=$1)`, [sid]);
  await q(`delete from public.field_provenance where target_table='driving_schools' and target_id=$1`, [sid]);
  await q(`delete from public.import_review_queue where school_id=$1`, [sid]);
  await q(`delete from public.school_profiles where school_id=$1`, [sid]);
  await q(`delete from public.driving_schools where id=$1`, [sid]);
  return { ok: true };
}

/** Schule einer Gruppe/Brand zuordnen (bestehende per Name oder neu anlegen). */
async function doAttachBrand(b, q = qbase) {
  const sid = b.schoolId; const name = (b.brandName ?? "").trim();
  if (!sid) return { error: "schoolId fehlt" };
  if (!name) return { error: "Gruppenname nötig" };
  const src = (await q(`select id, brand_id from public.driving_schools where id=$1`, [sid]))[0];
  if (!src) return { error: "Schule nicht gefunden" };
  let brand = (await q(`select id from public.school_brands where lower(name)=lower($1) order by created_at asc limit 1`, [name]))[0];
  const brandId = brand ? brand.id
    : (await q(`insert into public.school_brands (name, is_portal_managed, kundennummer) values ($1, true, $2) returning id`, [name, await nextKnr(q)]))[0].id;
  // Gruppierte Standorte nutzen die Kundennummer der Brand → eigene entfernen.
  await q(`update public.driving_schools set brand_id=$2, kundennummer=null where id=$1`, [sid, brandId]);
  return { ok: true, brandId };
}

/** Screenshots der Schul-Website (Startseite/Impressum/Kontakt) für die assistierte Prüfung. */
const mapShots = (sid, shots) => (shots || []).map((s) => ({
  kind: s.kind, pageUrl: s.url ?? null,
  img: s.file ? `/shot/${sid}/${s.kind}.png?t=${Date.now()}` : null,
  skipped: s.skipped ?? null, error: s.error ?? null,
}));
async function doShoot(b) {
  const sid = b.schoolId; if (!sid) return { error: "schoolId fehlt" };
  const website = (await q(`select website from public.school_profiles where school_id=$1`, [sid]))[0]?.website;
  if (!website) return { error: "Keine Website hinterlegt (über die B2B-Brücke/manuell eintragen)." };
  const outDir = path.join(SHOT_DIR, String(sid)), metaPath = path.join(outDir, "meta.json");
  // Bereits vorbereitet (Batch) oder schon geholt → Cache nutzen, kein erneuter Abruf.
  if (!b.force && fs.existsSync(metaPath)) {
    try { const meta = JSON.parse(fs.readFileSync(metaPath, "utf8")); return { ok: true, cached: true, website: meta.start || website, candidates: meta.candidates ?? null, shots: mapShots(sid, meta.shots) }; } catch { /* neu erzeugen */ }
  }
  try {
    const { shots, candidates } = await shootSite(website, outDir);
    return { ok: true, website, candidates, shots: mapShots(sid, shots) };
  } catch (e) { return { error: String(e?.message ?? e).slice(0, 200) }; }
}

/** Gruppen-/Brand-Name ändern. */
async function doRenameBrand(b, q = qbase) {
  const id = b.brandId, name = (b.name ?? "").trim();
  if (!id || !name) return { error: "brandId/name fehlt" };
  await q(`update public.school_brands set name=$2 where id=$1`, [id, name]);
  return { ok: true };
}
/** Standort aus seiner Gruppe lösen (Schule bleibt erhalten, nur Gruppierung weg). */
async function doDetachLocation(b, q = qbase) {
  const sid = b.schoolId; if (!sid) return { error: "schoolId fehlt" };
  // wird wieder eigener Kunde → eigene Kundennummer
  await q(`update public.driving_schools set brand_id=null, is_main_location=false, kundennummer=$2 where id=$1`, [sid, await nextKnr(q)]);
  return { ok: true };
}
/** Gruppe auflösen: alle Standorte entgruppieren (bleiben erhalten), Brand + Domain-Mappings löschen. */
async function doDissolveBrand(b, q = qbase) {
  const id = b.brandId; if (!id) return { error: "brandId fehlt" };
  const members = await q(`select id from public.driving_schools where brand_id=$1`, [id]);
  for (const m of members) { // jeder Standort wird wieder eigener Kunde
    await q(`update public.driving_schools set brand_id=null, is_main_location=false, kundennummer=$2 where id=$1`, [m.id, await nextKnr(q)]);
  }
  await q(`delete from public.school_brand_domains where brand_id=$1`, [id]);
  await q(`delete from public.school_brands where id=$1`, [id]);
  return { ok: true };
}
/** Duplikate weich zusammenführen: Behalten-Eintrag ergänzen, Rest als Duplikat markieren (wiederherstellbar). */
async function doMergeDuplicates(b, q = qbase) {
  const keeper = b.keeperId; const dups = Array.isArray(b.dupIds) ? b.dupIds.filter((x) => x && x !== keeper) : [];
  if (!keeper || !dups.length) return { error: "keeperId/dupIds fehlt" };
  const k = (await q(`select ds.strasse, ds.hausnummer, ds.plz, ds.ort, sp.id pid, sp.telefon, sp.email, sp.website
    from public.driving_schools ds left join public.school_profiles sp on sp.school_id=ds.id where ds.id=$1`, [keeper]))[0];
  if (!k) return { error: "Behalten-Eintrag nicht gefunden" };
  let dsStr = k.strasse, dsPlz = k.plz, dsOrt = k.ort, tel = k.telefon, email = k.email, web = k.website;
  for (const d of dups) {
    const dd = (await q(`select ds.strasse, ds.hausnummer, ds.plz, ds.ort, sp.telefon, sp.email, sp.website
      from public.driving_schools ds left join public.school_profiles sp on sp.school_id=ds.id where ds.id=$1`, [d]))[0];
    if (!dd) continue;
    dsStr ||= dd.strasse; dsPlz ||= dd.plz; dsOrt ||= dd.ort; tel ||= dd.telefon; email ||= dd.email; web ||= dd.website;
    await q(`update public.driving_schools set is_duplicate=true, duplicate_of=$2, is_listed=false, dedupe_checked=true where id=$1`, [d, keeper]);
    await q(`update public.import_review_queue set status='rejected', decided_at=now() where school_id=$1 and status='pending'`, [d]);
    await q(`insert into public.dedupe_decision (canonical_school_id, decision, score, match_factors)
             values ($1,'merged',1.0,$2::text::jsonb)`, [keeper, JSON.stringify({ by: "manual_review", duplicate: d })]);
  }
  await q(`update public.driving_schools set strasse=$2, plz=$3, ort=$4, dedupe_checked=true where id=$1`, [keeper, dsStr, dsPlz, dsOrt]);
  if (tel || email || web) {
    if (k.pid) await q(`update public.school_profiles set telefon=coalesce(telefon,$2), email=coalesce(email,$3), website=coalesce(website,$4), updated_at=now() where id=$1`, [k.pid, tel, email, web]);
    else await q(`insert into public.school_profiles (school_id, telefon, email, website) values ($1,$2,$3,$4)`, [keeper, tel, email, web]);
  }
  const kc = (await q(`select name, plz, strasse, land from public.driving_schools where id=$1`, [keeper]))[0];
  await q(`update public.driving_schools set cluster_key=$2, dedupe_key=$3 where id=$1`, [keeper, clusterKey(kc), dedupeKey(kc)]);
  return { ok: true };
}
/** EINEN Eintrag als Duplikat markieren (weich ausblenden, wiederherstellbar). ofId optional = Behalten-Eintrag. */
async function doMarkDuplicate(b, q = qbase) {
  const sid = b.schoolId; if (!sid) return { error: "schoolId fehlt" };
  const ofId = b.ofId || null;
  await q(`update public.driving_schools set is_duplicate=true, duplicate_of=$2, is_listed=false, dedupe_checked=true where id=$1`, [sid, ofId]);
  await q(`update public.import_review_queue set status='rejected', decided_at=now() where school_id=$1 and status='pending'`, [sid]);
  await q(`insert into public.dedupe_decision (canonical_school_id, decision, score, match_factors)
           values ($1,'merged',1.0,$2::text::jsonb)`, [ofId, JSON.stringify({ by: "manual_review", duplicate: sid })]);
  return { ok: true };
}
/** Cluster als „keine Duplikate / eigene Filialen" abhaken → nicht mehr als Verdacht zeigen. */
async function doNotDuplicate(b, q = qbase) {
  const ids = Array.isArray(b.ids) ? b.ids.filter(Boolean) : [];
  if (!ids.length) return { error: "ids fehlt" };
  await q(`update public.driving_schools set dedupe_checked=true where id = any($1::uuid[])`, [ids]);
  return { ok: true };
}
/** Als Duplikat markierten Eintrag WIEDERHERSTELLEN (nichts geht verloren) → zurück in die Review-Queue. */
async function doUndoDuplicate(b, q = qbase) {
  const sid = b.schoolId; if (!sid) return { error: "schoolId fehlt" };
  await q(`update public.driving_schools set is_duplicate=false, duplicate_of=null, dedupe_checked=false where id=$1`, [sid]);
  const upd = await q(`update public.import_review_queue set status='pending', decided_at=null where school_id=$1 and status in ('approved','rejected') returning id`, [sid]);
  if (!upd.length) await q(`insert into public.import_review_queue (school_id, reasons, priority, status) values ($1,'{wiederhergestellt}',80,'pending')`, [sid]);
  return { ok: true };
}
/** Cluster-Mitglieder als FILIALEN einer Hauptniederlassung gruppieren (keine Duplikate, eigene Standorte). */
async function doGroupAsBranches(b, q = qbase) {
  const mainId = b.mainId; const ids = Array.isArray(b.ids) ? b.ids.filter(Boolean) : [];
  if (!mainId || !ids.length) return { error: "mainId/ids fehlt" };
  const main = (await q(`select id, name, brand_id from public.driving_schools where id=$1`, [mainId]))[0];
  if (!main) return { error: "Hauptniederlassung nicht gefunden" };
  let brandId = main.brand_id;
  if (!brandId) brandId = (await q(`insert into public.school_brands (name, is_portal_managed, kundennummer) values ($1, true, $2) returning id`, [main.name, await nextKnr(q)]))[0].id;
  await q(`update public.driving_schools set brand_id=$2, dedupe_checked=true, kundennummer=null where id = any($1::uuid[])`, [ids, brandId]); // gruppiert → eigene Knr weg
  await q(`update public.driving_schools set is_main_location=false where brand_id=$1`, [brandId]); // genau einer
  await q(`update public.driving_schools set is_main_location=true where id=$1`, [mainId]);
  return { ok: true, brandId };
}

/** Detail-Daten einer Schule laden (Klassen/Preise/Notiz/Maps). */
async function getDetails(id) {
  if (!id) return { error: "id fehlt" };
  const r = (await q(`select ds.name, ds.review_notiz, ds.maps_url, sp.fuehrerscheinklassen, sp.preise, sp.preise_verifiziert, sp.oeffnungszeiten, sp.theoriezeiten
    from public.driving_schools ds left join public.school_profiles sp on sp.school_id=ds.id where ds.id=$1`, [id]))[0];
  if (!r) return { error: "nicht gefunden" };
  return { name: r.name, klassen: r.fuehrerscheinklassen ?? [], preise: r.preise ?? {}, notiz: r.review_notiz ?? "", mapsUrl: r.maps_url ?? "", preiseVerifiziert: !!r.preise_verifiziert, buero: r.oeffnungszeiten ?? {}, theorie: r.theoriezeiten ?? {} };
}
/** Detail-Daten speichern: Klassen + Preise (je Klasse) → school_profiles; Notiz/Maps → driving_schools. */
async function doSaveDetails(b, q = qbase) {
  const sid = b.schoolId; if (!sid) return { error: "schoolId fehlt" };
  const klassen = Array.isArray(b.klassen) ? b.klassen.filter(Boolean) : [];
  const preise = (b.preise && typeof b.preise === "object" && !Array.isArray(b.preise)) ? b.preise : {};
  const notiz = (b.notiz ?? "").trim() || null;
  const maps = (b.mapsUrl ?? "").trim() || null;
  const okObj = (x) => (x && typeof x === "object" && !Array.isArray(x)) ? x : {};
  const buero = okObj(b.buero), theorie = okObj(b.theorie);
  let pid = (await q(`select id from public.school_profiles where school_id=$1`, [sid]))[0]?.id;
  if (pid) await q(`update public.school_profiles set fuehrerscheinklassen=$2, preise=$3::text::jsonb, oeffnungszeiten=$4::text::jsonb, theoriezeiten=$5::text::jsonb, updated_at=now() where id=$1`, [pid, klassen, JSON.stringify(preise), JSON.stringify(buero), JSON.stringify(theorie)]);
  else pid = (await q(`insert into public.school_profiles (school_id, fuehrerscheinklassen, preise, oeffnungszeiten, theoriezeiten) values ($1,$2,$3::text::jsonb,$4::text::jsonb,$5::text::jsonb) returning id`, [sid, klassen, JSON.stringify(preise), JSON.stringify(buero), JSON.stringify(theorie)]))[0].id;
  await q(`update public.driving_schools set review_notiz=$2, maps_url=$3 where id=$1`, [sid, notiz, maps]);
  if (klassen.length) await prov("school_profiles", pid, "fuehrerscheinklassen", "set", q);
  if (Object.keys(preise).length) await prov("school_profiles", pid, "preise", "set", q);
  return { ok: true };
}

const fld = (sid, f, label, v) => `<label>${label}<input data-sid="${esc(sid)}" data-f="${f}" value="${esc(v ?? "")}"></label>`;
const copyCell = (r) => {
  const c = `${r.name ?? ""}${r.strasse ? ", " + r.strasse : ""}, ${r.plz ?? ""} ${r.ort ?? ""}`.replace(/\s+/g, " ").replace(/^,\s*|,\s*$/g, "").trim();
  const g = "https://www.google.com/search?q=" + encodeURIComponent(c);
  const maps = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(c);
  return `<button class="copy" type="button" data-copy="${esc(c)}" title="Name+Adresse kopieren">📋 kopieren</button> <a class="g" href="${esc(g)}" target="_blank" rel="noopener noreferrer">🔍 Google</a> <a class="g" href="${esc(maps)}" target="_blank" rel="noopener noreferrer">🗺 Maps</a>`;
};

async function page() {
  const [s] = await q(`select
      (select count(*)::int from public.driving_schools where verification_status in ('auto_verified','manual_verified')) as verified,
      (select count(*)::int from public.import_review_queue where status='pending') as review,
      (select count(*)::int from public.driving_schools where source='osm') as imported`);
  const GRP = `ds.brand_id, ds.is_main_location, ds.source, ds.cluster_key, ds.kundennummer, (select count(*)::int from public.driving_schools d2 where d2.brand_id=ds.brand_id) as group_size`;
  const reviews = await q(`select rq.priority, array_to_string(rq.reasons,', ') as reasons, rq.proposed,
      ds.id, ds.name, ds.strasse, ds.hausnummer, ds.plz, ds.ort, ${GRP}, coalesce(s.normalized->>'website', spw.website) as website
    from public.import_review_queue rq join public.driving_schools ds on ds.id=rq.school_id
    left join public.import_staging s on s.source=ds.source and s.source_ref=ds.source_ref
    left join public.school_profiles spw on spw.school_id=ds.id
    left join public.school_brands b on b.id=ds.brand_id
    where rq.status='pending' and not ds.is_duplicate
    order by coalesce(b.kundennummer, ds.kundennummer) asc nulls last, ds.is_main_location desc, ds.plz asc nulls last, ds.name asc limit 4000`);
  // Vorbereitete Datensätze (Screenshots im Cache) NACH OBEN sortieren (stabil → sonst Kundennummer-Reihenfolge).
  const prepared = new Set();
  try { if (fs.existsSync(SHOT_DIR)) for (const d of fs.readdirSync(SHOT_DIR)) if (fs.existsSync(path.join(SHOT_DIR, d, "meta.json"))) prepared.add(d); } catch { /* egal */ }
  reviews.sort((a, b2) => (prepared.has(b2.id) ? 1 : 0) - (prepared.has(a.id) ? 1 : 0));
  const readyCount = reviews.filter((r) => prepared.has(r.id)).length;
  const mine = await q(`select ds.id, ds.name, ds.strasse, ds.hausnummer, ds.plz, ds.ort, ds.verification_status, ds.is_listed, ${GRP}, sp.telefon, sp.whatsapp, sp.email, sp.website
    from public.driving_schools ds join public.school_profiles sp on sp.school_id=ds.id
    where ds.verification_status='manual_verified' and not ds.is_duplicate order by sp.updated_at desc nulls last`);
  const verified = await q(`select ds.id, ds.name, ds.strasse, ds.hausnummer, ds.plz, ds.ort, ds.verification_status, ds.is_listed, ${GRP}, sp.telefon, sp.whatsapp, sp.email, sp.website
    from public.driving_schools ds join public.school_profiles sp on sp.school_id=ds.id
    where ds.verification_status='auto_verified' and not ds.is_duplicate order by ds.plz asc nulls last`);
  const gm = await q(`select b.id brand_id, b.name brand_name, b.kundennummer brand_knr, ds.id, ds.name, ds.ort, ds.plz, ds.is_main_location, ds.verification_status
    from public.school_brands b join public.driving_schools ds on ds.brand_id=b.id and not ds.is_duplicate
    where b.id in (select brand_id from public.driving_schools where brand_id is not null and not is_duplicate group by brand_id having count(*)>1)
    order by b.name, ds.is_main_location desc, ds.ort`);
  const groups = [];
  for (const r of gm) {
    let g = groups[groups.length - 1];
    if (!g || g.brand_id !== r.brand_id) { g = { brand_id: r.brand_id, brand_name: r.brand_name, brand_knr: r.brand_knr, members: [] }; groups.push(g); }
    g.members.push(r);
  }
  // Duplikat-Verdacht (Ebene 1): Cluster mit >1 ungeprüften, nicht-duplizierten Mitgliedern.
  const dupRows = await q(`select ds.id, ds.name, ds.strasse, ds.hausnummer, ds.plz, ds.ort, ds.cluster_key, ds.verification_status, sp.telefon, sp.email, sp.website
    from public.driving_schools ds left join public.school_profiles sp on sp.school_id=ds.id
    where ds.cluster_key in (
      select cluster_key from public.driving_schools
      where not is_duplicate and not dedupe_checked and cluster_key is not null
      group by cluster_key having count(*)>1)
      and not ds.is_duplicate and not ds.dedupe_checked
    order by ds.cluster_key, ds.id`);
  const dupClusters = []; const dupCount = new Map();
  for (const r of dupRows) {
    let c = dupClusters[dupClusters.length - 1];
    if (!c || c.key !== r.cluster_key) { c = { key: r.cluster_key, members: [] }; dupClusters.push(c); }
    c.members.push(r);
  }
  for (const c of dupClusters) dupCount.set(c.key, c.members.length);
  // Kundennummer-Label je Schule: <Kundennr>-<Standort-Index> (Haupt=1); Einzelschule ohne Suffix.
  const custRows = await q(`select ds.id, ds.brand_id, ds.is_main_location, ds.plz, ds.name, ds.kundennummer own_knr, b.kundennummer brand_knr
    from public.driving_schools ds left join public.school_brands b on b.id=ds.brand_id where not ds.is_duplicate`);
  const custMap = new Map();
  for (const r of custRows) {
    const key = r.brand_id ? "b:" + r.brand_id : "s:" + r.id;
    let c = custMap.get(key);
    if (!c) { c = { knr: r.brand_id ? r.brand_knr : r.own_knr, members: [] }; custMap.set(key, c); }
    c.members.push(r);
  }
  const custLabel = new Map(), custSort = new Map();
  for (const c of custMap.values()) {
    c.members.sort((a, b2) => (b2.is_main_location ? 1 : 0) - (a.is_main_location ? 1 : 0)
      || String(a.plz ?? "").localeCompare(String(b2.plz ?? "")) || String(a.name).localeCompare(String(b2.name)) || String(a.id).localeCompare(String(b2.id)));
    const multi = c.members.length > 1;
    c.members.forEach((m, i) => {
      custLabel.set(m.id, c.knr == null ? "—" : (multi ? c.knr + "-" + (i + 1) : String(c.knr)));
      // numerischer Sortierschlüssel: Kundennr (8-stellig) + Standort-Index (4-stellig) → Filiale direkt unter Haupt
      const knrPad = c.knr == null ? "99999999" : String(c.knr).padStart(8, "0");
      custSort.set(m.id, knrPad + "-" + String(i + 1).padStart(4, "0"));
    });
  }
  const done = await q(`select rq.status, ds.id, ds.name, ds.plz, ds.ort, ds.verification_status
    from public.import_review_queue rq join public.driving_schools ds on ds.id=rq.school_id
    where rq.status in ('approved','rejected') order by rq.decided_at desc nulls last limit 500`);
  // Ausgeblendete Duplikate (NICHT gelöscht) — jederzeit wiederherstellbar.
  const dups = await q(`select ds.id, ds.name, ds.plz, ds.ort, k.name as keeper
    from public.driving_schools ds left join public.driving_schools k on k.id=ds.duplicate_of
    where ds.is_duplicate order by ds.name asc limit 500`);
  // Mögliche Ketten: gleicher Name + gleicher Ort (echtes Ketten-Signal), noch nicht vollständig in EINER Gruppe.
  const chainRows = await q(`select id, name, plz, ort, brand_id from public.driving_schools where not is_duplicate`);
  const chMap = new Map();
  for (const r of chainRows) {
    const nn = normName(r.name), no = normName(r.ort);
    if (!nn || !no) continue;
    const key = nn + "|" + no;
    if (!chMap.has(key)) chMap.set(key, []);
    chMap.get(key).push(r);
  }
  const chains = [];
  for (const g of chMap.values()) {
    if (g.length < 2) continue;
    const brands = new Set(g.map((x) => x.brand_id || ""));
    if (brands.size === 1 && !brands.has("")) continue; // bereits alle in derselben Gruppe
    chains.push(g);
  }
  chains.sort((a, b) => b.length - a.length);

  const card = (r, mode) => {
    const p = r.proposed || {}; const w = safeUrl(r.website);
    const tel = mode === "v" ? r.telefon : p.phone, mail = mode === "v" ? r.email : p.email, wa = mode === "v" ? r.whatsapp : "";
    return `<div class="card${r.is_main_location ? " main-card" : ""}" id="row-${esc(r.id)}" data-sk="${esc(custSort.get(r.id) ?? "")}" data-web="${r.website ? "1" : "0"}">
      <div class="ch"><span class="knr" title="Kundennummer (Kunde-Standort)">#${esc(custLabel.get(r.id) ?? "—")}</span>${mode === "r" ? `<span class="prio">P${esc(r.priority)}</span>` : ""}
        <b>${esc(r.name)}</b>${mode === "v" ? ` <small>(${esc(r.verification_status)})</small>` : ""}
        ${Number(r.group_size) > 1 ? `<span class="grp">🏢 Gruppe • ${esc(r.group_size)} Standorte</span>` : ""}
        ${r.is_main_location ? `<span class="main">★ Hauptstandort</span>` : ""}
        ${dupCount.get(r.cluster_key) > 1 ? `<span class="dup">⚠ Duplikat-Verdacht (${esc(dupCount.get(r.cluster_key))})</span>` : ""}
        ${mode === "r" && prepared.has(r.id) ? `<span class="rdy">📸 bereit</span>` : ""}
        <span class="cg">${copyCell(r)}</span>
        ${r.reasons ? `<span class="reason">${esc(r.reasons)}</span>` : ""}
        <a class="maplink" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([r.name, r.strasse, r.hausnummer, r.plz, r.ort].filter(Boolean).join(" "))}" target="_blank" rel="noopener noreferrer">📍 Maps</a>
        ${w ? `<a class="weblink2" href="${esc(w)}" target="_blank" rel="noopener noreferrer">Website öffnen ↗</a>` : ""}</div>
      <div class="fields">
        ${fld(r.id, "name", "Fahrschul-Name", r.name)}
        ${fld(r.id, "strasse", "Straße", r.strasse)}
        ${fld(r.id, "hausnummer", "Hausnummer", r.hausnummer)}
        ${fld(r.id, "plz", "PLZ", r.plz)}
        ${fld(r.id, "ort", "Ort", r.ort)}
        ${fld(r.id, "telefon", "Telefon", tel)}
        ${fld(r.id, "whatsapp", "WhatsApp (optional)", wa)}
        ${fld(r.id, "email", "E-Mail", mail)}
        ${fld(r.id, "website", "Website", r.website)}
      </div>
      <div class="bar">
        <button class="b-verify" onclick="verify('${esc(r.id)}')">✓ ${mode === "v" ? "Speichern" : "Verifizieren"}</button>
        <button class="b-loc" onclick="openDetails('${esc(r.id)}')">📋 Klassen/Preise</button>
        <button class="b-loc" onclick="addLoc('${esc(r.id)}')">➕ Standort</button>
        ${mode === "v" && r.verification_status === "manual_verified" ? (r.is_listed
          ? `<button class="b-pub on" onclick="unpublish('${esc(r.id)}')" title="Aus dem öffentlichen Listing nehmen">🌐 Öffentlich ✓</button>`
          : `<button class="b-pub" onclick="publish('${esc(r.id)}')" title="Öffentlich listen (separater Freigabe-Schritt, nur manuell geprüft)">🌐 Veröffentlichen</button>`)
          : (mode === "v" && r.is_listed ? `<button class="b-pub on" onclick="unpublish('${esc(r.id)}')" title="Aus dem öffentlichen Listing nehmen">🌐 Öffentlich ✓</button>` : "")}
        <label class="mainchk"><input type="checkbox" ${r.is_main_location ? "checked" : ""} onclick="setMain('${esc(r.id)}',this.checked)"> ★ Hauptniederlassung (Zentrale)</label>
        <span class="grow"></span>
        <button class="b-undo" onclick="undo('${esc(r.id)}')" title="zurück in die Queue">↩︎ zurück</button>
        ${mode === "r" ? `<button class="b-reject" onclick="reject('${esc(r.id)}')">🗑 Verwerfen</button>` : ""}
        ${r.source === "manual" ? `<button class="b-del" onclick="delLoc('${esc(r.id)}')" title="manuell angelegten Standort endgültig löschen">🗑 Standort löschen</button>` : ""}
        <span class="st" id="st-${esc(r.id)}"></span>
      </div></div>`;
  };
  const dRow = (r) => `<tr><td title="${esc(r.name)}">${esc(r.name)}</td><td>${esc(r.plz)}</td><td>${esc(r.ort)}</td>
      <td>${esc(r.status)} / ${esc(r.verification_status)}</td>
      <td><button class="b-undo" onclick="undo('${esc(r.id)}')">↩︎ Wiederherstellen</button> <span class="st" id="st-${esc(r.id)}"></span></td></tr>`;

  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="robots" content="noindex">
  <title>Daten-Review (lokal)</title><style>
    body{font:14px/1.45 system-ui,sans-serif;margin:0;color:#0f2942;background:#f1f5f9}
    header{position:sticky;top:0;background:#0f2942;color:#fff;padding:12px 20px;z-index:6}
    header b{font-size:16px}.pill{display:inline-block;background:#1e3a5f;border-radius:999px;padding:2px 10px;margin-left:8px}
    main{padding:16px 20px;max-width:1500px;margin:0 auto}h2{margin:22px 0 8px}
    .filter{padding:8px 12px;width:340px;margin:6px 0 12px;border:1px solid #cbd5e1;border-radius:8px}
    .sortbar{margin:0 0 12px;font-size:13px;color:#64748b}
    .card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px;margin-bottom:12px;box-shadow:0 1px 2px rgba(0,0,0,.04)}
    .ch{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px}
    .ch b{font-size:15px}.prio{background:#0369a1;color:#fff;border-radius:6px;padding:1px 8px;font-size:12px;font-weight:700}
    .reason{color:#b45309;font-size:12px}.weblink{margin-left:auto;font-size:13px}
    .maplink{margin-left:auto;font-size:13px;font-weight:600;color:#0369a1}.weblink2{font-size:13px;margin-left:12px}
    .cg .copy,.cg .g{font-size:12px;margin-right:4px}
    .fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px}
    label{display:flex;flex-direction:column;gap:3px;font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:.02em}
    input{padding:10px 12px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;color:#0f2942;text-transform:none;font-weight:400;cursor:text;background:#fff}
    input:hover{border-color:#94a3b8}
    input:focus{outline:none;border-color:#2563eb;box-shadow:0 0 0 3px #bfdbfe}
    .fields label{cursor:text}
    .bar{display:flex;align-items:center;gap:10px;margin-top:12px;flex-wrap:wrap}.grow{flex:1}
    .bar button{cursor:pointer;border:1px solid #cbd5e1;border-radius:9px;padding:9px 16px;font-size:14px;font-weight:600}
    .b-verify{background:#16a34a;color:#fff;border-color:#15803d}.b-verify:hover{background:#15803d}
    .b-pub{background:#0369a1;color:#fff;border-color:#075985}.b-pub:hover{background:#075985}.b-pub.on{background:#e0f2fe;color:#075985;border-color:#7dd3fc}
    .b-loc{background:#eff6ff;color:#0369a1;border-color:#bfdbfe}.b-loc:hover{background:#dbeafe}
    .b-undo{background:#fff;color:#475569}.b-undo:hover{background:#f1f5f9}
    .b-reject{background:#fef2f2;color:#b91c1c;border-color:#fecaca}.b-reject:hover{background:#fee2e2}
    .b-del{background:#7f1d1d;color:#fff;border-color:#7f1d1d}.b-del:hover{background:#991b1b}
    button.copy,a.g{cursor:pointer;border:1px solid #cbd5e1;background:#fff;border-radius:6px;padding:3px 8px;text-decoration:none;color:#0369a1}
    .st{font-weight:700;color:#15803d}.done{opacity:.5}a{color:#0369a1}
    .dup{background:#fee2e2;color:#b91c1c;border-radius:6px;padding:1px 8px;font-size:12px;font-weight:700}
    .dupc{background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:10px 14px;margin-bottom:12px}
    .dupc .dh{font-weight:700;margin-bottom:6px}
    .dupc .dm{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:5px 0;border-top:1px dashed #fed7aa}
    .dupc label.keep{flex-direction:row;gap:5px;text-transform:none;font-size:13px;color:#0f2942;font-weight:600;align-items:center}
    .dupc label.keep input{width:auto;padding:0}
    #locov{display:none;position:fixed;inset:0;background:rgba(15,41,66,.35);z-index:20}
    #locform{display:none;position:fixed;top:12%;left:50%;transform:translateX(-50%);background:#fff;border-radius:14px;padding:18px 20px;box-shadow:0 12px 44px rgba(0,0,0,.3);z-index:21;width:min(480px,92vw)}
    #locform .lf{display:flex;flex-direction:column;gap:3px;font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;margin-bottom:10px}
    #locform input{width:100%;box-sizing:border-box}
    .lf-added{display:flex;flex-direction:column;gap:4px;margin:4px 0 8px;max-height:160px;overflow:auto}
    .lf-aitem{font-size:13px;color:#15803d;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:4px 8px}
    .lf-hint{margin:8px 0 0;font-size:11px;color:#64748b}
    #dtov{display:none;position:fixed;inset:0;background:rgba(15,41,66,.35);z-index:20}
    #dtform{display:none;position:fixed;top:6%;left:50%;transform:translateX(-50%);background:#fff;border-radius:14px;padding:18px 20px;box-shadow:0 12px 44px rgba(0,0,0,.3);z-index:21;width:min(620px,94vw);max-height:86vh;overflow:auto}
    #dtform .lf{display:flex;flex-direction:column;gap:3px;font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;margin-bottom:8px}
    #dtform input{width:100%;box-sizing:border-box}
    .dtsec{font-size:11px;color:#64748b;font-weight:700;text-transform:uppercase;margin:6px 0 4px}
    .dtsub{font-size:12px;color:#0f2942;font-weight:700;margin:8px 0 3px}
    .intern{background:#e2e8f0;color:#475569;border-radius:5px;padding:1px 6px;font-size:11px;font-weight:600}
    .clg{margin-bottom:6px}.cglbl{display:inline-block;min-width:90px;font-size:12px;color:#64748b;font-weight:700}
    .kk{display:inline-flex;align-items:center;gap:4px;margin:0 10px 4px 0;font-size:13px}.kk input{width:auto}
    .pcls{display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:6px 0;border-top:1px dashed #e2e8f0}
    .pcls b{min-width:46px}.pcls input{width:120px;font-size:13px}
    .wd{display:flex;align-items:flex-start;gap:8px;margin-bottom:6px;flex-wrap:wrap}
    .wdk{min-width:64px;font-size:13px;display:inline-flex;align-items:center;gap:5px;text-transform:none;font-weight:600;padding-top:6px}.wdk input{width:auto}
    .termk{font-size:12px;display:inline-flex;align-items:center;gap:4px;text-transform:none;color:#475569;padding-top:6px}.termk input{width:auto}
    .blocks{display:inline-flex;flex-wrap:wrap;gap:6px;align-items:center}
    .blk{display:inline-flex;align-items:center;gap:3px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:3px 6px}
    .blk input[type=time]{width:auto;font-size:13px;padding:3px 5px}
    .xblk{cursor:pointer;border:none;background:transparent;color:#b91c1c;font-weight:700;padding:0 2px;font-size:13px}
    .addblk{cursor:pointer;border:1px dashed #cbd5e1;background:#fff;border-radius:8px;padding:5px 9px;font-size:12px;color:#0369a1}
    .knr{background:#0f2942;color:#fff;border-radius:6px;padding:1px 7px;font-size:12px;font-weight:700;font-variant-numeric:tabular-nums}
    .pdisc{margin-top:10px;font-size:12px;color:#92400e;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:8px 10px}
    .vbadge{background:#16a34a;color:#fff;border-radius:6px;padding:1px 8px;font-weight:700}
    .ubadge{background:#e2e8f0;color:#475569;border-radius:6px;padding:1px 8px;font-weight:700}
    .grp{background:#ede9fe;color:#6d28d9;border-radius:6px;padding:1px 8px;font-size:12px;font-weight:700}
    .main{background:#fef3c7;color:#92400e;border-radius:6px;padding:1px 8px;font-size:12px;font-weight:700}
    .main-card{border-color:#f59e0b;box-shadow:0 0 0 2px #fde68a}
    .card:target{border-color:#0ea5e9;box-shadow:0 0 0 3px #7dd3fc,0 10px 28px rgba(0,0,0,.12);scroll-margin-top:90px}
    .group:target{box-shadow:0 0 0 3px #7dd3fc,0 10px 28px rgba(0,0,0,.12);scroll-margin-top:90px}
    .chlist{margin:4px 0 8px;padding-left:18px;columns:2;font-size:13px;color:#475569}.chlist li{margin:2px 0}
    .mainchk{flex-direction:row;align-items:center;gap:6px;text-transform:none;font-size:12px;color:#92400e;font-weight:700;border:1px solid #fde68a;background:#fffbeb;padding:6px 10px;border-radius:9px}
    .mainchk input{width:auto;padding:0}
    .group{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:10px 14px;margin-bottom:10px}
    .group .gh{display:flex;align-items:center;gap:10px;font-size:15px;margin-bottom:6px;flex-wrap:wrap}
    .group ul{margin:4px 0 0;padding-left:18px}.group li{margin:3px 0}.group .mm{color:#92400e;font-weight:700}
    .gname{font-size:15px;font-weight:700;max-width:340px}
    .mini{cursor:pointer;border:1px solid #cbd5e1;background:#fff;border-radius:6px;padding:2px 8px;font-size:12px;margin-left:6px;font-weight:600}
    table{border-collapse:collapse;width:100%;background:#fff;font-size:13px;border:1px solid #e2e8f0}
    th,td{border-bottom:1px solid #eef2f7;padding:6px 9px;text-align:left}
    .modal-x{position:absolute;top:12px;right:14px;width:34px;height:34px;border-radius:10px;border:1px solid #e2e8f0;background:#fff;color:#475569;font-size:17px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:5}
    .modal-x:hover{background:#fee2e2;color:#b91c1c;border-color:#fecaca}
    #focusbtn{cursor:pointer;border:none;border-radius:12px;padding:12px 22px;font-size:15px;font-weight:800;color:#fff;background:linear-gradient(90deg,#0ea5e9,#2563eb);box-shadow:0 6px 18px rgba(37,99,235,.35);margin:0 0 12px}
    #focusbtn:hover{filter:brightness(1.06)}
    #focusov{display:none;position:fixed;inset:0;background:rgba(8,20,35,.55);backdrop-filter:blur(3px);z-index:14}
    #focus{display:none;position:fixed;inset:0;z-index:15;flex-direction:column;padding:22px 16px;overflow:auto}
    .focus-panel{width:min(900px,96vw);margin:auto;position:relative;display:flex;flex-direction:column;max-height:93vh;background:linear-gradient(180deg,#ffffff,#f6fafe);border:1px solid #dbe7f3;border-radius:22px;box-shadow:0 28px 80px rgba(8,20,35,.5)}
    .focus-head{display:flex;align-items:center;gap:14px;padding:18px 22px 14px;border-bottom:1px solid #eef2f7}
    .focus-head .ft{font-size:18px;font-weight:800;color:#0f2942}
    .focus-pos{font-variant-numeric:tabular-nums;background:#0f2942;color:#fff;border-radius:999px;padding:4px 13px;font-size:13px;font-weight:700;white-space:nowrap}
    .focus-prog{flex:1;height:7px;background:#e2e8f0;border-radius:999px;overflow:hidden;max-width:380px}
    .focus-prog>span{display:block;height:100%;width:0;background:linear-gradient(90deg,#0ea5e9,#2563eb);transition:width .3s}
    #focus-stage{padding:20px 22px;overflow:auto}
    #focus-stage .card{margin:0;border:none;box-shadow:none;padding:0}
    .focus-card .ch{margin-bottom:14px}.focus-card .ch b{font-size:20px}
    .focus-card .fields{grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:14px}
    .focus-card .fields label{font-size:12px}
    .focus-card .fields input{padding:13px 14px;font-size:15px}
    .focus-card .weblink{font-size:14px;font-weight:700}
    .focus-foot{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:14px 22px;border-top:1px solid #eef2f7;background:#f8fafc;border-radius:0 0 22px 22px}
    .focusbtn{cursor:pointer;border:1px solid #cbd5e1;border-radius:11px;padding:9px 15px;font-size:14px;font-weight:700;background:#fff;color:#0f2942}
    .focusbtn:hover{background:#f1f5f9}
    .focusbtn.b-next{background:#16a34a;color:#fff;border-color:#15803d;font-size:15px;padding:11px 22px}
    .focusbtn.b-next:hover{background:#15803d}
    .focusbtn.b-save{background:#ecfdf5;color:#15803d;border-color:#bbf7d0}
    .focusbtn.b-reject{background:#fef2f2;color:#b91c1c;border-color:#fecaca}
    #focus-stage .card.done{opacity:1}
    .focusbtn.b-loc{background:#eff6ff;color:#0369a1;border-color:#bfdbfe}
    .fhint{font-size:12px;color:#94a3b8;margin-left:auto}
    .focusbtn.b-shot{background:#eef2ff;color:#4338ca;border-color:#c7d2fe}
    #focus-shots{display:block;padding:0 22px 10px}
    #focus-shots:empty{display:none}
    .shotrow{display:flex;gap:12px;flex-wrap:wrap}
    .cands{margin:2px 0 10px}
    .crow{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin:4px 0}
    .ctit{font-size:12px;font-weight:700;color:#475569;min-width:88px}
    .cchip{cursor:pointer;border:1px solid #c7d2fe;background:#eef2ff;color:#3730a3;border-radius:999px;padding:5px 11px;font-size:13px;font-weight:600}
    .cchip:hover{background:#e0e7ff}.cchip em{font-style:normal;color:#6366f1;font-size:11px;opacity:.85}
    .cchip.used{background:#dcfce7;border-color:#86efac;color:#15803d}
    .cands .srow{font-size:13px;margin:6px 0;color:#0f2942}.cands .srow b{font-weight:700}
    .cands .chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:4px}
    .cands .sval{font-weight:700}.cands em{font-style:normal;color:#94a3b8;font-size:11px}
    .shot{margin:0;flex:1;min-width:220px;max-width:300px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden}
    .shot figcaption{font-size:12px;font-weight:700;color:#475569;padding:7px 10px;background:#f8fafc;border-bottom:1px solid #eef2f7}
    .shot img{display:block;width:100%;height:210px;object-fit:cover;object-position:top;cursor:zoom-in}
    .shot .noshot{padding:20px 10px;color:#94a3b8;font-size:13px;text-align:center}
    .shots-hint{font-size:13px;color:#475569;padding:8px 22px}.shots-hint.err{color:#b91c1c}
    .shotimg{cursor:zoom-in}
    .hdrbtn{cursor:pointer;border:none;border-radius:9px;padding:7px 14px;margin-left:14px;font-weight:800;color:#0f2942;background:linear-gradient(90deg,#7dd3fc,#bae6fd);font-size:14px}
    .hdrbtn:hover{filter:brightness(1.05)}
    .hdrchk{margin-left:12px;font-size:13px;opacity:.92}.hdrchk input{vertical-align:middle;margin-right:4px}
    .rdy{background:#4338ca;color:#fff;border-radius:6px;padding:1px 8px;font-size:12px;font-weight:700}
    .readybar{display:flex;align-items:center;gap:8px;background:#eef2ff;border:1px solid #c7d2fe;color:#3730a3;border-radius:12px;padding:12px 16px;margin:4px 0 14px;font-size:14px}
    .focus-sub{font-size:12px;color:#64748b;padding:0 22px 12px;margin-top:-4px}
    .focus-sub b{color:#15803d}
    #lightov{display:none;position:fixed;inset:0;background:rgba(8,20,35,.82);z-index:30}
    #light{display:none;position:fixed;inset:22px;z-index:31;flex-direction:column;background:#0f2942;border-radius:16px;overflow:hidden;box-shadow:0 30px 90px rgba(0,0,0,.6)}
    .light-bar{display:flex;align-items:center;gap:10px;padding:10px 58px 10px 16px;color:#fff;background:#0b2036;font-size:14px}
    .light-bar button{cursor:pointer;border:1px solid #33506e;background:#16324f;color:#fff;border-radius:8px;padding:6px 13px;font-size:16px;font-weight:800;min-width:42px;line-height:1}
    .light-bar button:hover{background:#1e425f}
    .light-bar .lcap{font-weight:700}.light-bar a{color:#7dd3fc;margin-left:auto;font-size:13px}
    #light-z{min-width:58px;text-align:center;font-variant-numeric:tabular-nums}
    #light-wrap{flex:1;overflow:auto;background:#1b2a3a}
    #light-img{display:block;width:100%;cursor:zoom-in}
  </style></head><body>
  <header><b>Daten-Review (lokal)</b>
    <span class="pill">importiert: ${s.imported}</span><span class="pill">verifiziert: ${s.verified}</span>
    <span class="pill">Review offen: ${s.review}</span>
    <button class="hdrbtn" onclick="focusOpen()">🎯 Fokus-Modus starten</button>
    <label class="hdrchk"><input type="checkbox" id="onlyweb" checked> nur mit Website</label>
    <span style="float:right;font-size:12px;opacity:.85">nichts wird hart gelöscht · alles wiederherstellbar</span></header>
  <main>
    ${readyCount ? `<div class="readybar">📸 <b>${readyCount}</b> Datensätze mit Screenshots <b>bereit zur Prüfung</b> — stehen ganz oben in der Queue.<button class="hdrbtn" style="margin-left:auto" onclick="focusOpen()">🎯 Jetzt prüfen (Fokus)</button></div>` : ""}
    <div id="locov" onclick="closeLoc()"></div>
    <div id="locform">
      <button class="modal-x" onclick="closeLoc()" title="Schließen">✕</button>
      <h3 style="margin:0 0 10px">➕ Neuer Standort (zur selben Gruppe/Brand)</h3>
      <input type="hidden" id="lf-sid">
      <label class="lf">Fahrschul-Name<input id="lf-name"></label>
      <label class="lf">Straße + Nr.<input id="lf-str"></label>
      <label class="lf">PLZ<input id="lf-plz"></label>
      <label class="lf">Ort (nötig)<input id="lf-ort"></label>
      <div id="lf-added" class="lf-added"></div>
      <div class="bar"><button class="b-verify" onclick="submitLoc()">+ Standort anlegen</button>
        <button class="b-undo" onclick="closeLoc()">Fertig / Schließen</button>
        <span class="st" id="lf-st"></span></div>
      <p class="lf-hint">Mehrere Filialen? Einfach nacheinander anlegen — sie werden derselben Gruppe zugeordnet, ohne Neuladen.</p>
    </div>

    <div id="dtov" onclick="closeDetails()"></div>
    <div id="dtform">
      <button class="modal-x" onclick="closeDetails()" title="Schließen">✕</button>
      <h3 id="dt-title" style="margin:0 0 10px">Details</h3>
      <input type="hidden" id="dt-sid">
      <div class="dtsec">Führerscheinklassen (angeboten)</div>
      <div id="dt-classes"></div>
      <div id="dt-prices"></div>
      <div class="pdisc">⚠ Recherchierte Preise gelten als <b>unbestätigt – ohne Gewähr</b>, bis die Fahrschule sie selbst bestätigt (dann grünes Abzeichen). Status: <span id="dt-pstatus"></span></div>
      <div class="dtsec" style="margin-top:12px">Büroöffnungszeiten</div>
      <div id="dt-buero"></div>
      <div class="dtsec" style="margin-top:10px">Unterrichtszeiten (je Wochentag)</div>
      <div class="dtsub">Präsenzunterricht</div>
      <div id="dt-praesenz"></div>
      <div class="dtsub">Online-Unterricht <span class="intern">intern – noch NICHT öffentlich</span></div>
      <div id="dt-online"></div>
      <label class="lf" style="margin-top:10px">Google-Maps-URL (optional)<input id="dt-maps"></label>
      <label class="lf">Notiz (intern, nicht öffentlich)<textarea id="dt-notiz" rows="3" style="font:inherit;padding:7px 9px;border:1px solid #cbd5e1;border-radius:8px"></textarea></label>
      <div class="bar"><button class="b-verify" onclick="saveDetails()">Speichern</button>
        <button class="b-undo" onclick="closeDetails()">Schließen</button>
        <span class="st" id="dt-st"></span></div>
    </div>

    <div id="focusov" onclick="focusClose()"></div>
    <div id="focus"><div class="focus-panel">
      <button class="modal-x" onclick="focusClose()" title="Schließen (Esc)">✕</button>
      <div class="focus-head"><span class="ft">🎯 Fokus-Review</span><span class="focus-pos" id="focus-pos">–</span><span class="focus-prog"><span id="focus-bar"></span></span></div>
      <div class="focus-sub">„✓ Sichern & weiter" übernimmt den von dir über die Website geprüften Datensatz in <b>unsere eigene, live-fähige Datenbank</b> (losgelöst von OPM/B2B). Der ursprüngliche Eintrag bleibt intern erhalten.</div>
      <div id="focus-stage"></div>
      <div id="focus-shots"></div>
      <div class="focus-foot">
        <button class="focusbtn" onclick="focusPrev()" title="zurück (←)">← zurück</button>
        <button class="focusbtn b-save" onclick="focusSaveStay()" title="nur speichern, hier bleiben (Cmd/Strg+S)">💾 Sichern</button>
        <button class="focusbtn b-next" onclick="focusSave()" title="Sichern &amp; weiter (Enter)">✓ Sichern &amp; weiter</button>
        <button class="focusbtn" onclick="focusNext()" title="ohne Sichern weiter (→)">weiter →</button>
        <button class="focusbtn b-reject" onclick="focusReject()" title="verwerfen">🗑 verwerfen</button>
        <button class="focusbtn b-shot" onclick="focusShots()" title="Website laden: Screenshots + Vorbefüllung (verbatim, Ampel)">📸 Screenshots + Vorbefüllung</button>
        <button class="focusbtn" onclick="focusSplitStreet()" title="Hausnummer vom Straßennamen trennen (nur wenn Hausnummer leer)">✂ Nr. trennen</button>
        <button class="focusbtn b-loc" onclick="focusGroup()" title="zu Gruppe hinzufügen / Gruppe anlegen">🏢 zu Gruppe</button>
        <span class="fhint">💾 Sichern = bleibt hier · Enter = Sichern &amp; weiter · ← → blättern · Esc</span>
      </div>
    </div></div>

    <div id="lightov" onclick="lightClose()"></div>
    <div id="light">
      <button class="modal-x" onclick="lightClose()" title="Schließen (Esc)">✕</button>
      <div class="light-bar"><span class="lcap" id="light-cap">Screenshot</span>
        <button onclick="lightZoom(-1)" title="kleiner">－</button>
        <span id="light-z">100%</span>
        <button onclick="lightZoom(1)" title="größer">＋</button>
        <button onclick="lightZoom(0)" title="zurücksetzen">⟲</button>
        <a id="light-open" href="#" target="_blank" rel="noopener noreferrer">Original in neuem Tab ↗</a></div>
      <div id="light-wrap"><img id="light-img" alt=""></div>
    </div>

    ${dupClusters.length ? `<h2>⚠ Mögliche Duplikate / mehrere Standorte — ${dupClusters.length} Cluster</h2>
    <p style="margin:0 0 10px;color:#64748b;font-size:13px">Pro Cluster den Behalten-/Haupt-Eintrag wählen, dann: <b>🔗 Zusammenführen</b> (echtes Duplikat) · <b>🏢 Als Filialen gruppieren</b> (mehrere Standorte einer Firma) · <b>✓ Verschieden</b> (unabhängige Schulen). Einzeln löschen mit <b>🗑</b>.</p>
    <input class="filter" placeholder="Filtern (Name/Ort/PLZ) …" oninput="filt('tD2',this.value)">
    <div id="tD2">${dupClusters.map((c, i) => `<div class="card dupc" id="dupc-${i}" data-ids="${c.members.map((m) => esc(m.id)).join(",")}">
      <div class="dh">⚠ ${c.members.length} ähnliche Einträge (gleiche PLZ + Name)</div>
      ${c.members.map((m, j) => { const w = safeUrl(m.website); return `<div class="dm" id="dm-${esc(m.id)}">
        <label class="keep"><input type="radio" name="keep-${i}" value="${esc(m.id)}" ${j === 0 ? "checked" : ""}> behalten / Haupt</label>
        <b>${esc(m.name)}</b> — ${esc(m.strasse ?? "")}, ${esc(m.plz ?? "")} ${esc(m.ort ?? "")} <small>(${esc(m.verification_status ?? "—")})</small>${m.telefon ? ` · ☎ ${esc(m.telefon)}` : ""}${m.email ? ` · ✉ ${esc(m.email)}` : ""}${w ? ` · <a href="${esc(w)}" target="_blank" rel="noopener noreferrer">Web↗</a>` : ""}
        ${copyCell(m)} <button class="b-del mini" onclick="markDup(${i},'${esc(m.id)}')">🗑 löschen</button></div>`; }).join("")}
      <div class="bar"><button class="b-verify" onclick="mergeDupes(${i})">🔗 Zusammenführen (= Duplikat)</button>
        <button class="b-loc" onclick="groupBranches(${i})">🏢 Als Filialen gruppieren</button>
        <button class="b-undo" onclick="notDup(${i})">✓ Verschieden (nichts tun)</button>
        <span class="st" id="st-dupc-${i}"></span></div></div>`).join("")}</div>` : ""}

    <h2>Review-Queue (nach Kundennummer — Gruppen zusammen) — ${reviews.length}</h2>
    <div><button id="focusbtn" onclick="focusOpen()">🎯 Fokus-Modus starten — ein Datensatz nach dem anderen</button></div>
    <input class="filter" placeholder="Filtern (PLZ/Name/Ort/Grund) …" oninput="filt('tR',this.value)">
    <div class="sortbar">Sortierung: <button class="mini" onclick="sortCards('tR','knr')">Kundennr ↑ (Standard)</button> <button class="mini" onclick="sortCards('tR','knrd')">Kundennr ↓</button> <button class="mini" onclick="sortCards('tR','plz')">PLZ</button></div>
    <div id="tR">${reviews.map((r) => card(r, "r")).join("")}</div>

    ${chains.length ? `<h2>🏢 Mögliche Ketten — gleicher Name + Ort, noch nicht in einer Gruppe (${chains.length})</h2>
    <p style="margin:0 0 8px;color:#64748b;font-size:13px">Mit einem Klick zu EINER Gruppe zusammenfassen (erster Eintrag wird Hauptstandort). Nichts wird gelöscht — am Ende fein kurierbar.</p>
    <input class="filter" placeholder="Ketten filtern (Name/Ort) …" oninput="filt('tCh',this.value)">
    <div id="tCh">${chains.map((g, i) => `<div class="card dupc" id="chain-${i}" data-ids="${g.map((m) => esc(m.id)).join(",")}" data-main="${esc((g.find((m) => m.brand_id) || g[0]).id)}">
      <div class="dh">🏢 <b>${esc(g[0].name)}</b> · ${esc(g[0].ort)} <span class="grp">${g.length} Standorte</span></div>
      <ul class="chlist">${g.map((m) => `<li>${esc(m.plz ?? "")} ${esc(m.ort ?? "")}${m.brand_id ? ' <small class="reason">(bereits in einer Gruppe)</small>' : ""}</li>`).join("")}</ul>
      <div class="bar"><button class="b-verify" onclick="chainGroup(${i})">🏢 Als eine Gruppe zusammenfassen</button>
        <span class="st" id="st-chain-${i}"></span></div></div>`).join("")}</div>` : ""}

    <h2>Gruppen / Dachverbände (≥2 Standorte) — ${groups.length}</h2>
    <input class="filter" placeholder="Gruppe filtern …" oninput="filt('tG',this.value)">
    <div id="tG">${groups.map((g) => { const mainId = esc((g.members.find((m) => m.is_main_location) || g.members[0]).id); const bid = esc(g.brand_id); return `<div class="card group" id="grp-${bid}"><div class="gh">🏢 <span class="knr" title="Kundennummer">#${esc(g.brand_knr ?? "—")}</span>
        <input class="gname" id="bn-${bid}" value="${esc(g.brand_name)}">
        <button class="b-loc" onclick="renameBrand('${bid}')">Name speichern</button>
        <span class="grp">${g.members.length} Standorte</span>
        <button class="b-loc" onclick="addLoc('${mainId}')">➕ Standort</button>
        <span class="grow"></span>
        <button class="b-del" onclick="dissolve('${bid}')">🗑 Gruppe auflösen</button>
        <span class="st" id="st-grp-${bid}"></span></div>
      <ul>${g.members.map((m) => `<li class="${m.is_main_location ? "mm" : ""}"><span class="knr">#${esc(custLabel.get(m.id) ?? "—")}</span> ${m.is_main_location ? "★ " : ""}${esc(m.name)} — ${esc(m.plz ?? "")} ${esc(m.ort ?? "")} <small>(${esc(m.verification_status ?? "—")})</small>
        ${m.is_main_location ? "" : `<button class="mini" onclick="gmain('${bid}','${esc(m.id)}')">★ Hauptstandort</button>`}
        <button class="mini" onclick="detach('${bid}','${esc(m.id)}')">✂ aus Gruppe lösen</button></li>`).join("")}</ul></div>`; }).join("")}</div>

    ${mine.length ? `<h2>★ Von mir manuell überprüft (nicht von der Fahrschule bestätigt, nicht live) — ${mine.length}</h2>
    <input class="filter" placeholder="Filtern …" oninput="filt('tM',this.value)">
    <div class="sortbar">Sortierung: <button class="mini" onclick="sortCards('tM','plz')">PLZ (Standard)</button> <button class="mini" onclick="sortCards('tM','knr')">Kundennr ↑</button> <button class="mini" onclick="sortCards('tM','knrd')">Kundennr ↓</button></div>
    <div id="tM">${mine.map((r) => card(r, "v")).join("")}</div>` : ""}

    <h2>Auto-verifiziert (bearbeitbar) — ${verified.length}</h2>
    <input class="filter" placeholder="Filtern …" oninput="filt('tV',this.value)">
    <div class="sortbar">Sortierung: <button class="mini" onclick="sortCards('tV','plz')">PLZ (Standard)</button> <button class="mini" onclick="sortCards('tV','knr')">Kundennr ↑</button> <button class="mini" onclick="sortCards('tV','knrd')">Kundennr ↓</button></div>
    <div id="tV">${verified.map((r) => card(r, "v")).join("")}</div>

    ${dups.length ? `<h2>Ausgeblendete Duplikate — nicht gelöscht, wiederherstellbar (${dups.length})</h2>
    <table><thead><tr><th>Name</th><th>PLZ</th><th>Ort</th><th>Duplikat von</th><th>Aktion</th></tr></thead>
    <tbody>${dups.map((r) => `<tr id="duprow-${esc(r.id)}"><td title="${esc(r.name)}">${esc(r.name)}</td><td>${esc(r.plz ?? "")}</td><td>${esc(r.ort ?? "")}</td><td>${esc(r.keeper ?? "—")}</td>
      <td><button class="b-undo" onclick="undoDup('${esc(r.id)}')">↩︎ Wiederherstellen</button> <span class="st" id="st-dup-${esc(r.id)}"></span></td></tr>`).join("")}</tbody></table>` : ""}

    <h2>Erledigt / Verworfen — wiederherstellbar (${done.length})</h2>
    <table><thead><tr><th>Name</th><th>PLZ</th><th>Ort</th><th>Status</th><th>Aktion</th></tr></thead>
    <tbody>${done.map(dRow).join("")}</tbody></table>
  </main>
  <script>
    function filt(id,qq){qq=qq.toLowerCase();for(const el of document.querySelectorAll('#'+id+' .card'))el.style.display=el.textContent.toLowerCase().includes(qq)?'':'none';}
    function sortCards(id,mode){var box=document.getElementById(id);if(!box)return;if(mode==='plz'){location.reload();return;}var cards=Array.prototype.slice.call(box.querySelectorAll(':scope > .card'));cards.sort(function(a,b){var x=a.getAttribute('data-sk')||'',y=b.getAttribute('data-sk')||'';if(x===y)return 0;return mode==='knrd'?(x<y?1:-1):(x<y?-1:1);});cards.forEach(function(c){box.appendChild(c);});}
    function gather(sid){const o={schoolId:sid};for(const el of document.querySelectorAll('input[data-sid="'+sid+'"]'))o[el.dataset.f]=el.value;return o;}
    var RT=${JSON.stringify(REVIEW_TOKEN)};
    async function post(path,body){const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json','x-review-token':RT},body:JSON.stringify(body)});return r.json();}
    function setSt(sid,t){const e=document.getElementById('st-'+sid);if(e)e.textContent=t;}
    async function verify(sid){setSt(sid,'…');const r=await post('/api/verify',gather(sid));if(r.ok){setSt(sid,'✓ gespeichert');document.getElementById('row-'+sid).classList.add('done');}else setSt(sid,'Fehler: '+(r.error||'?'));}
    async function publish(sid){if(!confirm('Diesen Datensatz ÖFFENTLICH listen? (separater Freigabe-Schritt, jederzeit zurücknehmbar)'))return;setSt(sid,'…');const r=await post('/api/publish',{schoolId:sid});setSt(sid,r.ok?'🌐 veröffentlicht — neu laden für Status':'Fehler: '+(r.error||'?'));}
    async function unpublish(sid){setSt(sid,'…');const r=await post('/api/unpublish',{schoolId:sid});setSt(sid,r.ok?'aus Listing genommen — neu laden für Status':'Fehler: '+(r.error||'?'));}
    async function reject(sid){if(!confirm('Diesen Eintrag verwerfen? (wiederherstellbar)'))return;setSt(sid,'…');const r=await post('/api/reject',{schoolId:sid});if(r.ok){setSt(sid,'verworfen');document.getElementById('row-'+sid).classList.add('done');}else setSt(sid,'Fehler');}
    async function undo(sid){setSt(sid,'…');const r=await post('/api/undo',{schoolId:sid});if(r.ok){setSt(sid,'↩︎ wiederhergestellt — springe zum Eintrag …');location.hash='row-'+sid;setTimeout(function(){location.reload();},450);}else setSt(sid,'Fehler');}
    async function setMain(sid,on){setSt(sid,'…');const r=await post('/api/set-main',{schoolId:sid,isMain:on});if(r.ok){setSt(sid,on?'★ als Hauptstandort markiert (neu laden für Gruppe)':'Hauptstandort entfernt');}else setSt(sid,'Fehler: '+(r.error||'?'));}
    async function delLoc(sid){if(!confirm('Diesen manuell angelegten Standort ENDGÜLTIG löschen? (nicht wiederherstellbar)'))return;setSt(sid,'…');const r=await post('/api/delete-location',{schoolId:sid});if(r.ok){const x=document.getElementById('row-'+sid);if(x){x.classList.add('done');setSt(sid,'gelöscht');}}else setSt(sid,'Fehler: '+(r.error||'?'));}
    function gst(bid,t){const e=document.getElementById('st-grp-'+bid);if(e)e.textContent=t;}
    async function renameBrand(bid){const el=document.getElementById('bn-'+bid);gst(bid,'…');const r=await post('/api/rename-brand',{brandId:bid,name:el?el.value:''});gst(bid,r.ok?'✓ Name gespeichert':'Fehler: '+(r.error||'?'));}
    async function gmain(bid,sid){gst(bid,'…');const r=await post('/api/set-main',{schoolId:sid,isMain:true});gst(bid,r.ok?'★ Hauptstandort gesetzt — neu laden':'Fehler: '+(r.error||'?'));}
    async function detach(bid,sid){if(!confirm('Diesen Standort aus der Gruppe lösen? (Schule bleibt erhalten)'))return;gst(bid,'…');const r=await post('/api/detach-location',{schoolId:sid});gst(bid,r.ok?'gelöst — neu laden':'Fehler: '+(r.error||'?'));}
    async function dissolve(bid){if(!confirm('Gruppe auflösen? Die Standorte bleiben erhalten, nur die Gruppierung wird entfernt.'))return;gst(bid,'…');const r=await post('/api/dissolve-brand',{brandId:bid});if(r.ok){const g=document.getElementById('grp-'+bid);if(g)g.classList.add('done');gst(bid,'aufgelöst — neu laden');}else gst(bid,'Fehler: '+(r.error||'?'));}
    function addLoc(sid){const ne=document.querySelector('input[data-sid="'+sid+'"][data-f="name"]');document.getElementById('lf-sid').value=sid;document.getElementById('lf-name').value=ne?ne.value:'';document.getElementById('lf-str').value='';document.getElementById('lf-plz').value='';document.getElementById('lf-ort').value='';document.getElementById('lf-st').textContent='';document.getElementById('locov').style.display='block';document.getElementById('locform').style.display='block';document.body.style.overflow='hidden';document.getElementById('lf-ort').focus();}
    function closeLoc(){document.getElementById('locov').style.display='none';document.getElementById('locform').style.display='none';document.body.style.overflow='';document.getElementById('lf-added').innerHTML='';document.getElementById('lf-st').textContent='';}
    var KL_ALL=[['Kraftrad',['Mofa','AM','A1','A2','A']],['Pkw',['B','B78','B96','B196','B197','BF17','BE']],['Lkw',['C1','C1E','C','CE']],['Bus',['D1','D1E','D','DE']],['Land/Forst',['L','T']]];
    var PF=[['pauschal','Pauschalpreis (gesamt)'],['anmelde','Anmelde-/Grundgebühr'],['app','App-/Lernsoftware'],['material','Lehrmaterial'],['uebung','Übungsfahrt'],['ueberland','Überlandfahrt'],['autobahn','Autobahnfahrt'],['nacht','Nachtfahrt'],['simstd','Simulator je Stunde'],['simpausch','Simulator pauschal'],['theorie','Vorstellung Theorie'],['praxis','Vorstellung Praxis']];
    var DT_PREISE={};
    var WD=['Mo','Di','Mi','Do','Fr','Sa','So'];
    function esc2(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');}
    function normBlocks(v){if(Array.isArray(v))return v.filter(function(x){return x&&(x.von||x.bis);});if(typeof v==='string'&&v.trim()){var p=v.split(/[–-]/);return [{von:(p[0]||'').trim(),bis:(p[1]||'').trim()}];}return [];}
    function blkHtml(von,bis){return '<span class="blk"><input type="time" class="bv" value="'+esc2(von||'')+'"> – <input type="time" class="bb" value="'+esc2(bis||'')+'"> <button type="button" class="xblk" title="Block entfernen">✕</button></span>';}
    var TERMIN='nach Vereinbarung';
    function toggleTermin(cb){var row=cb.closest('.wd');var on=cb.checked;var bs=row.querySelector('.blocks');var ab=row.querySelector('.addblk');if(bs)bs.style.display=on?'none':'';if(ab)ab.style.display=on?'none':'';if(on){var c=row.querySelector('.wdc');if(c)c.checked=true;}}
    function renderHours(id,data){data=data||{};var h='';for(var i=0;i<WD.length;i++){var d=WD[i];var t=(data[d]===TERMIN);var arr=t?[]:normBlocks(data[d]);var on=t||arr.length>0;var bl=arr.length?arr:[{von:'',bis:''}];h+='<div class="wd"><label class="wdk"><input type="checkbox" class="wdc" '+(on?'checked':'')+'> '+d+'</label><label class="termk"><input type="checkbox" class="wdv" '+(t?'checked':'')+' onchange="toggleTermin(this)"> nach Vereinbarung</label><span class="blocks" data-d="'+d+'"'+(t?' style="display:none"':'')+'>';for(var j=0;j<bl.length;j++)h+=blkHtml(bl[j].von,bl[j].bis);h+='</span><button type="button" class="addblk"'+(t?' style="display:none"':'')+'>+ Block</button></div>';}document.getElementById(id).innerHTML=h;}
    function collectHours(id){var o={};Array.prototype.slice.call(document.querySelectorAll('#'+id+' .wd')).forEach(function(row){var cb=row.querySelector('.wdc');if(!cb||!cb.checked)return;var blks=row.querySelector('.blocks');var d=blks.getAttribute('data-d');var v=row.querySelector('.wdv');if(v&&v.checked){o[d]=TERMIN;return;}var arr=[];Array.prototype.slice.call(blks.querySelectorAll('.blk')).forEach(function(bk){var von=bk.querySelector('.bv').value,bis=bk.querySelector('.bb').value;if(von||bis)arr.push({von:von,bis:bis});});if(arr.length)o[d]=arr;});return o;}
    document.addEventListener('click',function(e){var add=e.target.closest?e.target.closest('.addblk'):null;if(add){var bs=add.previousElementSibling;if(bs&&bs.classList.contains('blocks')){bs.insertAdjacentHTML('beforeend',blkHtml('',''));}return;}var x=e.target.closest?e.target.closest('.xblk'):null;if(x){var b=x.closest('.blk');if(b){var box=b.parentNode;b.remove();if(box&&!box.querySelector('.blk'))box.insertAdjacentHTML('beforeend',blkHtml('',''));}}});
    async function openDetails(sid){var r=await (await fetch('/api/details?id='+encodeURIComponent(sid))).json();document.getElementById('dt-sid').value=sid;document.getElementById('dt-title').textContent='Details — '+(r.name||'');document.getElementById('dt-maps').value=r.mapsUrl||'';document.getElementById('dt-notiz').value=r.notiz||'';DT_PREISE=r.preise||{};var sel={};(r.klassen||[]).forEach(function(k){sel[k]=1;});var h='';for(var gi=0;gi<KL_ALL.length;gi++){var g=KL_ALL[gi];h+='<div class="clg"><span class="cglbl">'+g[0]+'</span>';for(var ki=0;ki<g[1].length;ki++){var k=g[1][ki];h+='<label class="kk"><input type="checkbox" value="'+k+'" '+(sel[k]?'checked':'')+' onchange="renderPrices()"> '+k+'</label>';}h+='</div>';}document.getElementById('dt-classes').innerHTML=h;renderPrices();renderHours('dt-buero',r.buero);var th=r.theorie||{};var pr=th.praesenz;if(!pr){pr={};WD.forEach(function(d){if(th[d])pr[d]=th[d];});}renderHours('dt-praesenz',pr);renderHours('dt-online',th.online||{});document.getElementById('dt-pstatus').innerHTML=r.preiseVerifiziert?'<span class="vbadge">✓ von der Fahrschule bestätigt</span>':'<span class="ubadge">● unbestätigt (recherchiert)</span>';document.getElementById('dt-st').textContent='';document.getElementById('dtov').style.display='block';document.getElementById('dtform').style.display='block';document.body.style.overflow='hidden';}
    function selectedClasses(){return Array.prototype.slice.call(document.querySelectorAll('#dt-classes input:checked')).map(function(x){return x.value;});}
    function renderPrices(){var cls=selectedClasses();var h='';if(cls.length){h+='<div class="dtsec" style="margin-top:8px">Preise je Klasse (€)</div>';for(var i=0;i<cls.length;i++){var k=cls[i];h+='<div class="pcls"><b>'+k+'</b>';for(var p=0;p<PF.length;p++){var f=PF[p][0],lbl=PF[p][1];var v=(DT_PREISE[k]&&DT_PREISE[k][f])?DT_PREISE[k][f]:'';h+='<input data-k="'+k+'" data-pf="'+f+'" placeholder="'+esc2(lbl)+'" title="'+esc2(lbl)+'" value="'+esc2(v)+'">';}h+='</div>';}}document.getElementById('dt-prices').innerHTML=h;}
    async function saveDetails(){var sid=document.getElementById('dt-sid').value;var klassen=selectedClasses();var preise={};Array.prototype.slice.call(document.querySelectorAll('#dt-prices input')).forEach(function(el){var v=el.value.trim();if(v){var k=el.getAttribute('data-k'),f=el.getAttribute('data-pf');if(!preise[k])preise[k]={};preise[k][f]=v;}});var st=document.getElementById('dt-st');st.textContent='…';var r=await post('/api/save-details',{schoolId:sid,klassen:klassen,preise:preise,buero:collectHours('dt-buero'),theorie:{praesenz:collectHours('dt-praesenz'),online:collectHours('dt-online')},mapsUrl:document.getElementById('dt-maps').value,notiz:document.getElementById('dt-notiz').value});st.textContent=r.ok?'✓ gespeichert':'Fehler: '+(r.error||'?');}
    function closeDetails(){document.getElementById('dtov').style.display='none';document.getElementById('dtform').style.display='none';document.body.style.overflow='';}
    async function submitLoc(){const sid=document.getElementById('lf-sid').value;const name=document.getElementById('lf-name').value;const strasse=document.getElementById('lf-str').value;const plz=document.getElementById('lf-plz').value;const ort=document.getElementById('lf-ort').value;const st=document.getElementById('lf-st');if(!ort.trim()){st.textContent='Ort ist nötig.';return;}st.textContent='…';let r=await post('/api/add-location',{fromSchoolId:sid,name,strasse,plz,ort});if(r.warning){const list=r.matches.map(m=>'• '+m.name+' — '+(m.strasse||'')+', '+(m.plz||'')+' '+(m.ort||'')).join('\\n');if(!confirm('Achtung – ähnlicher Eintrag existiert bereits:\\n'+list+'\\n\\nTrotzdem als NEUEN Standort anlegen?')){st.textContent='abgebrochen';return;}r=await post('/api/add-location',{fromSchoolId:sid,name,strasse,plz,ort,force:true});}if(r.ok){const box=document.getElementById('lf-added');const row=document.createElement('div');row.className='lf-aitem';row.textContent='✓ '+(name||'Standort')+' — '+(strasse?strasse+', ':'')+(plz?plz+' ':'')+ort;box.appendChild(row);st.textContent='✓ angelegt';if(r.id&&document.getElementById('focus').style.display==='flex'){await focusInsertNew(r.id);st.textContent='✓ angelegt — folgt als nächster Datensatz';}document.getElementById('lf-str').value='';document.getElementById('lf-plz').value='';document.getElementById('lf-ort').value='';document.getElementById('lf-ort').focus();}else st.textContent='Fehler: '+(r.error||'?');}
    function dropCluster(c){c.style.transition='opacity .25s ease';c.style.opacity='0';setTimeout(function(){c.remove();},250);}
    async function markDup(i,sid){const c=document.getElementById('dupc-'+i);const sel=c.querySelector('input[name="keep-'+i+'"]:checked');const ofId=sel?sel.value:'';if(ofId===sid){alert('Das ist der Behalten-Eintrag — bitte einen anderen Eintrag als Duplikat wählen.');return;}if(!confirm('Diesen Eintrag als Duplikat markieren? (ausgeblendet, jederzeit wiederherstellbar)'))return;const e=document.getElementById('st-dupc-'+i);if(e)e.textContent='…';const r=await post('/api/mark-duplicate',{schoolId:sid,ofId});if(r.ok){const row=document.getElementById('dm-'+sid);if(row)row.remove();if(c.querySelectorAll('.dm').length<2){dropCluster(c);}else if(e)e.textContent='✓ als Duplikat markiert';}else if(e)e.textContent='Fehler: '+(r.error||'?');}
    async function groupBranches(i){const c=document.getElementById('dupc-'+i);const ids=(c.dataset.ids||'').split(',').filter(Boolean);const sel=c.querySelector('input[name="keep-'+i+'"]:checked');const mainId=sel?sel.value:'';if(!mainId)return;if(!confirm('Als Filialen einer Hauptniederlassung gruppieren? Der gewählte Eintrag wird Hauptstandort, die anderen bleiben eigene Standorte (kein Duplikat).'))return;const e=document.getElementById('st-dupc-'+i);if(e)e.textContent='…';const r=await post('/api/group-as-branches',{mainId,ids});if(r.ok&&r.brandId){if(e)e.textContent='✓ gruppiert — springe zur Gruppe …';location.hash='grp-'+r.brandId;setTimeout(function(){location.reload();},450);}else if(e)e.textContent='Fehler: '+(r.error||'?');}
    async function chainGroup(i){const c=document.getElementById('chain-'+i);const ids=(c.dataset.ids||'').split(',').filter(Boolean);const mainId=c.dataset.main||ids[0];if(ids.length<2)return;if(!confirm('Diese '+ids.length+' Standorte als EINE Gruppe zusammenfassen? Erster/branded wird Hauptstandort. Nichts wird gelöscht — später fein kurierbar.'))return;const e=document.getElementById('st-chain-'+i);if(e)e.textContent='…';const r=await post('/api/group-as-branches',{mainId,ids});if(r.ok&&r.brandId){if(e)e.textContent='✓ gruppiert — springe zur Gruppe …';location.hash='grp-'+r.brandId;setTimeout(function(){location.reload();},450);}else if(e)e.textContent='Fehler: '+(r.error||'?');}
    async function mergeDupes(i){const c=document.getElementById('dupc-'+i);const ids=(c.dataset.ids||'').split(',').filter(Boolean);const sel=c.querySelector('input[name="keep-'+i+'"]:checked');const keeper=sel?sel.value:'';if(!keeper)return;const dupIds=ids.filter(x=>x!==keeper);if(!dupIds.length)return;const e=document.getElementById('st-dupc-'+i);if(!confirm('Zusammenführen? '+dupIds.length+' Eintrag/Einträge werden als Duplikat markiert (jederzeit wiederherstellbar). Es bleibt EIN Datensatz.'))return;if(e)e.textContent='…';const r=await post('/api/merge-duplicates',{keeperId:keeper,dupIds});if(r.ok){dropCluster(c);}else if(e)e.textContent='Fehler: '+(r.error||'?');}
    async function notDup(i){const c=document.getElementById('dupc-'+i);const ids=(c.dataset.ids||'').split(',').filter(Boolean);const e=document.getElementById('st-dupc-'+i);if(e)e.textContent='…';const r=await post('/api/not-duplicate',{ids});if(r.ok){dropCluster(c);}else if(e)e.textContent='Fehler: '+(r.error||'?');}
    async function undoDup(sid){const e=document.getElementById('st-dup-'+sid);if(e)e.textContent='…';const r=await post('/api/undo-duplicate',{schoolId:sid});if(r.ok){if(e)e.textContent='✓ wiederhergestellt — springe zum Eintrag …';location.hash='row-'+sid;setTimeout(function(){location.reload();},450);}else if(e)e.textContent='Fehler: '+(r.error||'?');}
    document.addEventListener('click',async(e)=>{const b=e.target.closest('button.copy');if(!b)return;const t=b.getAttribute('data-copy')||'';let ok=false;try{await navigator.clipboard.writeText(t);ok=true;}catch(_){try{const ta=document.createElement('textarea');ta.value=t;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();ok=document.execCommand('copy');ta.remove();}catch(__){}}const o=b.textContent;b.textContent=ok?'✓ kopiert':'✗';setTimeout(()=>b.textContent=o,900);});
    var FOCUS_CARDS=[],FOCUS_I=0,FOCUS_INS=0;
    function focusReturn(){var st=document.getElementById('focus-stage');var cur=st.querySelector('.card');if(cur){if(cur.__ph){cur.__ph.parentNode.insertBefore(cur,cur.__ph);cur.__ph.remove();cur.__ph=null;}cur.classList.remove('focus-card');}}
    function focusShow(i){if(!FOCUS_CARDS.length)return;if(i<0)i=0;if(i>=FOCUS_CARDS.length)i=FOCUS_CARDS.length-1;focusReturn();FOCUS_I=i;var card=FOCUS_CARDS[i];var ph=document.createElement('span');ph.style.display='none';card.parentNode.insertBefore(ph,card);card.__ph=ph;card.classList.add('focus-card');document.getElementById('focus-stage').appendChild(card);var sb=document.getElementById('focus-shots');if(sb)sb.innerHTML='';FOCUS_INS=i+1;focusUpdatePos();var f=card.querySelector('.fields input');if(f)setTimeout(function(){try{f.focus();}catch(e){}},40);document.getElementById('focus-stage').scrollTop=0;}
    function focusOpen(){var ow=document.getElementById('onlyweb');ow=ow?ow.checked:false;FOCUS_CARDS=Array.prototype.slice.call(document.querySelectorAll('#tR > .card')).filter(function(c){return c.style.display!=='none'&&!c.classList.contains('done')&&(!ow||c.getAttribute('data-web')==='1');});if(!FOCUS_CARDS.length){alert(ow?'Keine offenen Einträge MIT Website in der Queue (Filter „nur mit Website").':'Keine offenen Einträge in der Queue.');return;}document.getElementById('focusov').style.display='block';document.getElementById('focus').style.display='flex';document.body.style.overflow='hidden';focusShow(0);}
    function focusClose(){focusReturn();document.getElementById('focusov').style.display='none';document.getElementById('focus').style.display='none';document.body.style.overflow='';}
    function focusNext(){if(FOCUS_I+1>=FOCUS_CARDS.length){focusClose();return;}focusShow(FOCUS_I+1);}
    function focusPrev(){focusShow(FOCUS_I-1);}
    function focusCurId(){var card=FOCUS_CARDS[FOCUS_I];return card?card.id.replace('row-',''):null;}
    function focusUpdatePos(){var n=FOCUS_CARDS.length;document.getElementById('focus-pos').textContent='Nr. '+(FOCUS_I+1)+' / '+n;document.getElementById('focus-bar').style.width=(n?((FOCUS_I+1)/n*100):0)+'%';}
    async function focusInsertNew(id){try{var resp=await (await fetch('/api/card?id='+encodeURIComponent(id))).json();if(!resp||!resp.html)return;var holder=document.createElement('div');holder.innerHTML=resp.html.trim();var nc=holder.firstElementChild;if(!nc)return;document.getElementById('tR').appendChild(nc);if(FOCUS_INS<FOCUS_I+1)FOCUS_INS=FOCUS_I+1;FOCUS_CARDS.splice(FOCUS_INS,0,nc);FOCUS_INS++;focusUpdatePos();}catch(e){}}
    async function focusSave(){var sid=focusCurId();if(!sid)return;await verify(sid);setTimeout(focusNext,280);}
    async function focusSaveStay(){var sid=focusCurId();if(!sid)return;await verify(sid);}
    async function focusReject(){var sid=focusCurId();if(!sid)return;await reject(sid);setTimeout(focusNext,280);}
    function focusSplitStreet(){var sid=focusCurId();if(!sid)return;var sEl=document.querySelector('input[data-sid="'+sid+'"][data-f="strasse"]');var hEl=document.querySelector('input[data-sid="'+sid+'"][data-f="hausnummer"]');if(!sEl){return;}if(hEl&&hEl.value.trim()){alert('Hausnummer ist bereits gefüllt — nichts geändert.');return;}var v=(sEl.value||'').trim();var m=v.match(/^(.*\\S)\\s+(\\d+\\s?[a-zA-Z]?(?:\\s?[-\\/]\\s?\\d+\\s?[a-zA-Z]?)?)$/);if(!m){alert('Keine Hausnummer am Ende erkannt: "'+v+'"');return;}sEl.value=m[1].replace(/[,]\\s*$/,'').trim();if(hEl)hEl.value=m[2].replace(/\\s+/g,'');sEl.style.background='#ecfdf5';if(hEl)hEl.style.background='#ecfdf5';}
    async function focusGroup(){var sid=focusCurId();if(!sid)return;var nm=document.querySelector('input[data-sid="'+sid+'"][data-f="name"]');var name=prompt('Gruppenname (neue oder bestehende Gruppe — gleichnamige teilen die Kundennummer):',nm?nm.value:'');if(!name)return;var r=await post('/api/attach-brand',{schoolId:sid,brandName:name});var stx=document.getElementById('st-'+sid);if(stx)stx.textContent=r.ok?'🏢 zu Gruppe hinzugefügt (neu laden für Gruppenansicht)':'Fehler: '+(r.error||'?');}
    var FOCUS_LBL={start:'Startseite',impressum:'Impressum',kontakt:'Kontakt'};
    function focusSetField(sid,f,val,sugg){var el=document.querySelector('input[data-sid="'+sid+'"][data-f="'+f+'"]');if(el){el.value=val;if(sugg){el.style.background='#fff7ed';el.title='Vorschlag aus der Website – bitte gegen Screenshot prüfen';}}}
    function fEmpty(sid,f){var el=document.querySelector('input[data-sid="'+sid+'"][data-f="'+f+'"]');return el&&el.value.trim()==='';}
    function applyOne(sid,key,arr){
      if(!arr||arr.length===0)return 'none';
      if(arr.length===1){var v=arr[0].val;
        if(key==='telefon'){if(fEmpty(sid,'telefon'))focusSetField(sid,'telefon',v,true);}
        else if(key==='email'){if(fEmpty(sid,'email'))focusSetField(sid,'email',v,true);}
        else if(key==='plz_ort'){var m=v.match(/^(\\d{5})\\s+(.*)$/);if(m){if(fEmpty(sid,'plz'))focusSetField(sid,'plz',m[1],true);if(fEmpty(sid,'ort'))focusSetField(sid,'ort',m[2],true);}}
        else if(key==='strasse'){var sm=v.match(/^(.*?)(\\s+\\d+\\s?[a-zA-Z]?)$/);if(sm){if(fEmpty(sid,'hausnummer'))focusSetField(sid,'hausnummer',sm[2].trim(),true);if(fEmpty(sid,'strasse'))focusSetField(sid,'strasse',sm[1].trim(),true);}else if(fEmpty(sid,'strasse'))focusSetField(sid,'strasse',v,true);}
        return 'one';}
      return 'many';
    }
    function chipRow(field,arr){var h='';for(var i=0;i<arr.length;i++)h+='<button class="cchip" data-field="'+field+'" data-v="'+esc2(arr[i].val)+'">'+esc2(arr[i].val)+' <em>'+esc2(arr[i].src||'')+'</em></button>';return h;}
    function suggBlock(sid,c){
      var defs=[['telefon','Telefon','telefon'],['email','E-Mail','email'],['plz_ort','PLZ + Ort','plzort'],['strasse','Straße + Nr.','strnr']];
      var rows='';
      for(var i=0;i<defs.length;i++){var key=defs[i][0],label=defs[i][1],field=defs[i][2];var arr=(c&&c[key])||[];var st=applyOne(sid,key,arr);
        if(st==='one')rows+='<div class="srow">🟢 <b>'+label+':</b> übernommen — <span class="sval">'+esc2(arr[0].val)+'</span> <em>('+esc2(arr[0].src||'')+')</em></div>';
        else if(st==='many')rows+='<div class="srow">🟠 <b>'+label+':</b> mehrere Treffer — bitte wählen:<div class="chips">'+chipRow(field,arr)+'</div></div>';
        else rows+='<div class="srow">🔴 <b>'+label+':</b> nicht gefunden — aus Screenshot eintragen</div>';
      }
      // Zusatz-Infos (in „📋 Klassen/Preise" bzw. Details prüfen/übernehmen):
      var cl=(c&&c.classes)||[];
      rows+='<div class="srow">'+(cl.length?'🟢':'🔴')+' <b>Klassen:</b> '+(cl.length?esc2(cl.join(', '))+' <em>(in 📋 Klassen/Preise übernehmen)</em>':'nicht erkannt')+'</div>';
      var hrs=c&&c.hours, hs=(c&&c.hoursText)||[], WDc=['Mo','Di','Mi','Do','Fr','Sa','So'];
      if(hrs){var ht=WDc.filter(function(d){return hrs[d];}).map(function(d){return d+' '+hrs[d].map(function(x){return x.von+'–'+x.bis;}).join(', ');}).join(' · ');rows+='<div class="srow">🟠 <b>Öffnungszeiten (Vorschlag, prüfen!):</b> '+esc2(ht)+'</div>';}
      else if(hs.length)rows+='<div class="srow">🟠 <b>Öffnungszeiten (Roh-Text):</b> '+esc2(hs.slice(0,3).join(' / '))+'</div>';
      else rows+='<div class="srow">🔴 <b>Öffnungszeiten:</b> nicht gefunden — von der Website eintragen</div>';
      if(c&&c.multiLoc&&c.multiLoc.flag)rows+='<div class="srow">⚠ <b>Mehrere Standorte erkannt</b> (PLZ:'+c.multiLoc.distinctPlz+(c.multiLoc.keyword?', „weitere Standorte"':'')+') — ggf. Gruppe bilden</div>';
      return '<div class="cands"><div class="shots-hint">🔎 Vorbefüllung aus Website/Impressum (🟢 übernommen · 🟠 du wählst · 🔴 du trägst ein) — gelb = ungeprüfter Vorschlag, bitte gegen Screenshot prüfen, dann „Sichern".</div>'+rows+'</div>';
    }
    async function focusShots(){var sid=focusCurId();if(!sid)return;var box=document.getElementById('focus-shots');box.innerHTML='<div class="shots-hint">📸 Lade Website (Screenshots + Vorbefüllung) …</div>';var r=await post('/api/shoot',{schoolId:sid});if(!r.ok){box.innerHTML='<div class="shots-hint err">Fehler: '+((r&&r.error)||'?')+'</div>';return;}var sh='';for(var i=0;i<r.shots.length;i++){var s=r.shots[i];var lbl=FOCUS_LBL[s.kind]||s.kind;var cap=lbl+(s.pageUrl?' · <a href="'+s.pageUrl+'" target="_blank" rel="noopener noreferrer">öffnen ↗</a>':'');if(s.img){sh+='<figure class="shot"><figcaption>'+cap+'</figcaption><img class="shotimg" data-full="'+s.img+'" data-cap="'+lbl+'" src="'+s.img+'" loading="lazy"></figure>';}else{sh+='<figure class="shot"><figcaption>'+cap+'</figcaption><div class="noshot">'+(s.skipped?('— '+s.skipped):('Fehler: '+(s.error||'?')))+'</div></figure>';}}box.innerHTML=suggBlock(sid,r.candidates)+'<div class="shotrow">'+sh+'</div>';}
    document.addEventListener('click',function(e){var ch=e.target.closest?e.target.closest('.cchip'):null;if(!ch)return;var cur=focusCurId();if(!cur)return;var f=ch.getAttribute('data-field'),v=ch.getAttribute('data-v')||'';function set(field,val){var el=document.querySelector('input[data-sid="'+cur+'"][data-f="'+field+'"]');if(el){el.value=val;el.style.background='#ecfdf5';}}if(f==='plzort'){var mm=v.match(/^(\\d{5})\\s+(.*)$/);if(mm){set('plz',mm[1]);set('ort',mm[2]);}else set('ort',v);}else if(f==='strnr'){var sm=v.match(/^(.*?)(\\s+\\d+\\s?[a-zA-Z]?)$/);if(sm){set('strasse',sm[1].trim());set('hausnummer',sm[2].trim());}else set('strasse',v);}else set(f,v);ch.classList.add('used');});
    var LIGHT_Z=1;
    function lightApply(){var im=document.getElementById('light-img');im.style.width=(LIGHT_Z*100)+'%';document.getElementById('light-z').textContent=Math.round(LIGHT_Z*100)+'%';im.style.cursor=LIGHT_Z>=6?'zoom-out':'zoom-in';}
    function lightZoom(d){if(d===0)LIGHT_Z=1;else LIGHT_Z=Math.max(0.5,Math.min(6,Math.round((LIGHT_Z+(d>0?0.25:-0.25))*100)/100));lightApply();}
    function lightOpen(src,cap){document.getElementById('light-img').src=src;document.getElementById('light-open').href=src;document.getElementById('light-cap').textContent=cap||'Screenshot';LIGHT_Z=1;lightApply();document.getElementById('lightov').style.display='block';document.getElementById('light').style.display='flex';document.getElementById('light-wrap').scrollTop=0;}
    function lightClose(){document.getElementById('light').style.display='none';document.getElementById('lightov').style.display='none';document.getElementById('light-img').src='';}
    document.addEventListener('click',function(e){var t=e.target.closest?e.target.closest('.shotimg'):null;if(t){lightOpen(t.getAttribute('data-full'),t.getAttribute('data-cap'));return;}var z=e.target&&e.target.id==='light-img';if(z){if(LIGHT_Z>=6)lightZoom(0);else lightZoom(1);}});
    document.addEventListener('keydown',function(e){if(document.getElementById('light').style.display==='flex'){if(e.key==='Escape'){e.preventDefault();lightClose();}else if(e.key==='+'||e.key==='='){e.preventDefault();lightZoom(1);}else if(e.key==='-'){e.preventDefault();lightZoom(-1);}return;}if(document.getElementById('focus').style.display!=='flex')return;var tn=(e.target.tagName||'').toLowerCase();if((e.metaKey||e.ctrlKey)&&(e.key==='s'||e.key==='S')){e.preventDefault();focusSaveStay();return;}if(e.key==='Escape'){e.preventDefault();focusClose();return;}if(e.key==='Enter'&&tn!=='textarea'){e.preventDefault();focusSave();return;}if(tn==='input'||tn==='textarea')return;if(e.key==='ArrowRight'){e.preventDefault();focusNext();}else if(e.key==='ArrowLeft'){e.preventDefault();focusPrev();}});
  </script></body></html>`;
}

/** Eigenständige Karte (mode 'r') für eine EINZELNE Schule — für im Fokus neu angelegte Standorte. */
function miniCardHtml(r) {
  const w = safeUrl(r.website);
  return `<div class="card${r.is_main_location ? " main-card" : ""}" id="row-${esc(r.id)}" data-sk="" data-web="${r.website ? "1" : "0"}">
      <div class="ch"><span class="knr" title="neuer Standort">#neu</span>
        <b>${esc(r.name)}</b>
        ${r.is_main_location ? `<span class="main">★ Hauptstandort</span>` : ""}
        <span class="reason">neuer Standort (Gruppe)</span>
        <a class="maplink" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([r.name, r.strasse, r.hausnummer, r.plz, r.ort].filter(Boolean).join(" "))}" target="_blank" rel="noopener noreferrer">📍 Maps</a>
        ${w ? `<a class="weblink2" href="${esc(w)}" target="_blank" rel="noopener noreferrer">Website öffnen ↗</a>` : ""}</div>
      <div class="fields">
        ${fld(r.id, "name", "Fahrschul-Name", r.name)}
        ${fld(r.id, "strasse", "Straße", r.strasse)}
        ${fld(r.id, "hausnummer", "Hausnummer", r.hausnummer)}
        ${fld(r.id, "plz", "PLZ", r.plz)}
        ${fld(r.id, "ort", "Ort", r.ort)}
        ${fld(r.id, "telefon", "Telefon", r.telefon)}
        ${fld(r.id, "whatsapp", "WhatsApp (optional)", r.whatsapp)}
        ${fld(r.id, "email", "E-Mail", r.email)}
        ${fld(r.id, "website", "Website", r.website)}
      </div>
      <div class="bar">
        <button class="b-verify" onclick="verify('${esc(r.id)}')">✓ Verifizieren</button>
        <button class="b-loc" onclick="openDetails('${esc(r.id)}')">📋 Klassen/Preise</button>
        <button class="b-loc" onclick="addLoc('${esc(r.id)}')">➕ Standort</button>
        <label class="mainchk"><input type="checkbox" ${r.is_main_location ? "checked" : ""} onclick="setMain('${esc(r.id)}',this.checked)"> ★ Hauptniederlassung (Zentrale)</label>
        <span class="grow"></span>
        <button class="b-undo" onclick="undo('${esc(r.id)}')" title="zurück in die Queue">↩︎ zurück</button>
        <button class="b-reject" onclick="reject('${esc(r.id)}')">🗑 Verwerfen</button>
        ${r.source === "manual" ? `<button class="b-del" onclick="delLoc('${esc(r.id)}')" title="manuell angelegten Standort endgültig löschen">🗑 Standort löschen</button>` : ""}
        <span class="st" id="st-${esc(r.id)}"></span>
      </div></div>`;
}
async function getCard(id) {
  if (!id) return { error: "id fehlt" };
  const r = (await q(`select ds.id, ds.name, ds.strasse, ds.hausnummer, ds.plz, ds.ort, ds.source, ds.is_main_location,
      p.telefon, p.whatsapp, p.email, p.website
    from public.driving_schools ds left join public.school_profiles p on p.school_id=ds.id where ds.id=$1`, [id]))[0];
  if (!r) return { error: "nicht gefunden" };
  return { html: miniCardHtml(r) };
}

const routes = { "/api/verify": doVerify, "/api/publish": doPublish, "/api/unpublish": doUnpublish, "/api/reject": doReject, "/api/undo": doUndo, "/api/add-location": doAddLocation, "/api/set-main": doSetMain, "/api/delete-location": doDeleteLocation, "/api/rename-brand": doRenameBrand, "/api/detach-location": doDetachLocation, "/api/dissolve-brand": doDissolveBrand, "/api/merge-duplicates": doMergeDuplicates, "/api/not-duplicate": doNotDuplicate, "/api/mark-duplicate": doMarkDuplicate, "/api/group-as-branches": doGroupAsBranches, "/api/save-details": doSaveDetails, "/api/undo-duplicate": doUndoDuplicate, "/api/attach-brand": doAttachBrand, "/api/shoot": doShoot };
// F-043: doShoot startet einen Browser/Netz-Fetch (langlaufend) → NICHT in eine DB-Transaktion
// packen (Verbindung/Lock würde unnötig gehalten). Alle anderen Mutationen laufen transaktional.
const NON_TX_ROUTES = new Set(["/api/shoot"]);
const server = createServer(async (req, res) => {
  try {
    if (req.method === "POST" && routes[req.url]) {
      // F-050: CSRF-/Origin-/Token-Schranke für mutierende POSTs.
      const origin = req.headers["origin"];
      const sfs = req.headers["sec-fetch-site"];
      const ctype = String(req.headers["content-type"] ?? "");
      if (origin && !ALLOWED_ORIGINS.has(origin)) { res.writeHead(403, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: "forbidden_origin" })); return; }
      if (sfs && sfs !== "same-origin" && sfs !== "none") { res.writeHead(403, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: "forbidden_site" })); return; }
      if (!ctype.includes("application/json")) { res.writeHead(415, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: "unsupported_media_type" })); return; }
      if (req.headers["x-review-token"] !== REVIEW_TOKEN) { res.writeHead(403, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: "invalid_token" })); return; }
      const body = await readBody(req);
      // F-018: jede mutierende Review-Aktion (erhöhter Tooling-Pfad) wird auditiert.
      const action = req.url.replace("/api/", "");
      // F-043: mutierende Handler laufen in EINER Transaktion (sql.begin) → Mehrschritt-Mutationen
      // (Profil+Schule+Provenienz+Queue …) sind atomar; bei Fehler rollt alles zurück.
      const handler = routes[req.url];
      const runWork = NON_TX_ROUTES.has(req.url)
        ? () => handler(body)
        : () => sql.begin((tx) => handler(body, (s, p = []) => tx.unsafe(s, p)));
      const out = await withToolingAudit(
        sql,
        {
          eventType: "review_" + action.replace(/[^a-z0-9]+/g, "_"),
          initiatorType: "manual_review",
          metadata: { action: req.url, school_id: body?.schoolId ?? body?.keeperId ?? null },
        },
        runWork,
      );
      res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify(out)); return;
    }
    if (req.method === "POST") { res.writeHead(404, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: "not_found" })); return; }
    if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: "method_not_allowed" })); return; }
    if (req.method === "GET" && req.url.startsWith("/api/details")) {
      const id = new URL(req.url, "http://x").searchParams.get("id");
      res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify(await getDetails(id))); return;
    }
    if (req.method === "GET" && req.url.startsWith("/api/card")) {
      const id = new URL(req.url, "http://x").searchParams.get("id");
      res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify(await getCard(id))); return;
    }
    if (req.method === "GET" && req.url.startsWith("/shot/")) {
      const rel = decodeURIComponent(req.url.split("?")[0].slice("/shot/".length));
      const fp = path.resolve(SHOT_DIR, rel);
      if (!fp.startsWith(SHOT_DIR + path.sep) || !fp.endsWith(".png") || !fs.existsSync(fp)) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { "Content-Type": "image/png", "Cache-Control": "no-store" }); res.end(fs.readFileSync(fp)); return;
    }
    if (req.url === "/favicon.ico") { res.writeHead(204); res.end(); return; }
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }); res.end(await page());
  } catch (e) {
    res.writeHead(500, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: String(e?.message ?? e) }));
  }
});
server.listen(PORT, "127.0.0.1", () => console.log(`Review-Oberfläche: http://127.0.0.1:${PORT}  (Strg+C zum Beenden)`));
