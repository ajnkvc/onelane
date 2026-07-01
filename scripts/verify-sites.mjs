/**
 * verify-sites.mjs — Website-Verifikations-Runner (008c), erhöhter/Tooling-Pfad.
 * ============================================================================
 * Holt je 008b-Kandidat dessen EIGENE Website (Startseite + Impressum/Kontakt-
 * Fallbacks), extrahiert Kontaktdaten (reine Logik aus db/ingest/*) und verifiziert
 * sie streng (db/ingest/verify.mjs). Verbindet über TOOLING_DATABASE_URL (Owner),
 * nie Request-Pfad. SSRF-sicher (nur eigene Domain, keine privaten/lokalen Ziele,
 * jede Redirect-Stufe geprüft), robots-bewusst, höflich (UA/Timeout/max Seiten),
 * jeder Abruf in import_fetch_log auditiert. KEINE Suchmaschine/Google/Brave.
 *
 * Aufruf (neutraler UA, KEINE Marke/Privat-Daten; Kontakt = dedizierte Projekt-
 * Mail ODER -URL — `mailto:` genügt, keine eigene Domain nötig):
 *   VERIFY_USER_AGENT="FahrschulDatenBot/0.1 (+mailto:<projekt-mail>)" \
 *   VERIFY_CONTACT_URL="mailto:<projekt-mail>" \
 *   node --env-file=.env.development.local scripts/verify-sites.mjs --limit 50
 */
import postgres from "postgres";
import { getDbSslOption } from "./db-ssl.mjs";
import { extractFromHtml, findContactLinks } from "../db/ingest/extract.mjs";
import { registrableDomain, checkFetchTarget, isUsableContact } from "../db/ingest/siteguard.mjs";
import { assertPublicUrl } from "./lib/ssrf-check.mjs";
import { shortHash } from "../db/ingest/normalize.mjs";
import { startVerifyRun, finishVerifyRun, verifyCandidate, emptyCounts } from "../db/ingest/verify.mjs";

const CONTACT_PATHS = ["/impressum", "/kontakt", "/contact", "/ueber-uns", "/uber-uns", "/about"];
const MAX_PAGES = 5;
const PAGE_TIMEOUT_MS = 15_000;
const MAX_BYTES = 2_000_000;

const args = process.argv.slice(2);
const argVal = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
// F-047: CLI-Argumente hart clampen — Fehlbedienung darf DB und fremde Websites nicht überlasten.
// Nur NaN/nicht-finit → Default; danach echtes Clamp (0/negativ → min, nicht Default).
const clampInt = (v, def, min, max) => {
  const n = Math.trunc(Number(v));
  return Math.max(min, Math.min(max, Number.isFinite(n) ? n : def));
};
const LIMIT = clampInt(argVal("--limit", "50"), 50, 1, 5000);

/** Liest den Response-Body als Text, aber HART begrenzt (F-046): bei Überschreiten wird der
 *  Download abgebrochen (kein Speicher-/CPU-Auflauf durch riesige/endlose Antworten). */
async function readCappedText(res, maxBytes) {
  const body = res.body;
  if (!body) return "";
  const reader = body.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      chunks.push(value.slice(0, value.byteLength - (total - maxBytes)));
      await reader.cancel().catch(() => {});
      break;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString("utf8");
}
const UA = process.env.VERIFY_USER_AGENT ?? "";
const CONTACT = process.env.VERIFY_CONTACT_URL ?? "";

const url = process.env.TOOLING_DATABASE_URL;
if (!url) { console.error("Fehlt: TOOLING_DATABASE_URL."); process.exit(1); }
// Live-Fetch-Gate: ohne echten, projektbezogenen UA/Kontakt kein Lauf.
if (!isUsableContact(UA, CONTACT)) {
  console.error("Abbruch: VERIFY_USER_AGENT/VERIFY_CONTACT_URL fehlen oder sind Platzhalter (example.com/localhost).");
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** robots.txt minimal: Disallow für unseren UA bzw. '*'. */
async function robotsDecision(origin, path) {
  let txt;
  try {
    await assertPublicUrl(origin); // F-021: robots-Origin muss auf eine öffentliche IP auflösen
    const res = await fetch(origin + "/robots.txt", { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(PAGE_TIMEOUT_MS), redirect: "manual" });
    if (res.status === 404) return "absent";
    if (!res.ok) return "unreachable";
    txt = await readCappedText(res, 100_000); // robots.txt klein halten (F-046)
  } catch { return "unreachable"; }
  try {
    const lines = txt.split(/\r?\n/).map((l) => l.replace(/#.*/, "").trim());
    let active = false;
    const disallows = [];
    for (const l of lines) {
      const m = l.match(/^user-agent:\s*(.+)$/i);
      if (m) { active = m[1].trim() === "*" || UA.toLowerCase().includes(m[1].trim().toLowerCase()); continue; }
      const d = l.match(/^disallow:\s*(.*)$/i);
      if (d && active && d[1].trim()) disallows.push(d[1].trim());
    }
    return disallows.some((p) => path.startsWith(p)) ? "disallowed" : "allowed";
  } catch { return "malformed"; }
}

/** SSRF-sicherer Fetch: manuelle Redirect-Verfolgung, jede Stufe geprüft. */
async function safeFetch(startUrl, allowed) {
  let current = startUrl;
  for (let hop = 0; hop < 5; hop++) {
    const chk = checkFetchTarget(current, allowed);
    if (!chk.ok) return { error: chk.reason, finalUrl: current };
    // F-021: zusätzlich zur Host-String-Prüfung die DNS-Zieladresse auflösen und private/interne
    // IPs blocken (private-IP-DNS-/Rebinding-Mitigation) — pro Redirect-Hop. (Grenze: das nachfolgende
    // fetch löst DNS erneut auf → kein voller Rebinding-Schutz wie beim IP-gepinnten safeFetch der App.)
    try { await assertPublicUrl(current); }
    catch (e) { return { error: "ssrf_dns", message: String(e?.message ?? e), finalUrl: current }; }
    let res;
    try {
      res = await fetch(current, { headers: { "User-Agent": UA }, redirect: "manual", signal: AbortSignal.timeout(PAGE_TIMEOUT_MS) });
    } catch (e) { return { error: "fetch_error", message: String(e?.name ?? e), finalUrl: current }; }
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      try { current = new URL(res.headers.get("location"), current).toString(); }
      catch { return { error: "bad_redirect", finalUrl: current }; }
      continue;
    }
    if (!res.ok) return { status: res.status, finalUrl: current, error: "http_" + res.status };
    const html = await readCappedText(res, MAX_BYTES); // Stream-Cap VOR vollständigem Download (F-046)
    return { status: res.status, finalUrl: current, html };
  }
  return { error: "too_many_redirects", finalUrl: current };
}

async function logFetch(q, runId, sourceRef, reqUrl, r, robots) {
  await q.query(
    `insert into public.import_fetch_log
       (run_id, source_ref, url, final_url, robots_decision, http_status, content_hash, error_code, duration_ms)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     on conflict (run_id, source_ref, url) do nothing`,
    [runId, sourceRef, reqUrl, r?.finalUrl ?? null, robots, r?.status ?? null,
     r?.html ? shortHash(r.html) : null, r?.error ?? null, null],
  );
}

const CONCURRENCY = clampInt(argVal("--concurrency", "6"), 6, 1, 16); // versch. Domains parallel (F-047 geclampt)
const sql = postgres(url, { max: CONCURRENCY + 2, prepare: false, ssl: getDbSslOption(url), onnotice: () => {} });
const q = { query: async (s, p = []) => ({ rows: await sql.unsafe(s, p) }) };

let runId = null;
try {
  const candidates = (await q.query(
    `select ds.id, ds.name, ds.plz, ds.ort, ds.source_ref,
            s.normalized->>'website' as website, s.normalized->>'domain' as domain
     from public.driving_schools ds
     join public.import_staging s on s.source = ds.source and s.source_ref = ds.source_ref
     where ds.source='osm' and ds.verification_status='needs_review'
       and s.normalized->>'website' is not null
     order by ds.id limit $1`,
    [LIMIT],
  )).rows;
  console.log(`Kandidaten mit Website: ${candidates.length}`);

  runId = await startVerifyRun(q);
  const counts = emptyCounts();

  // Ein Kandidat: eigene Domain crawlen (höflich, ≤ MAX_PAGES, Pause pro Seite) →
  // Evidenz sammeln → verifizieren. Verschiedene Kandidaten = verschiedene Domains,
  // daher parallelisierbar, ohne einen einzelnen Host zu belasten.
  async function processCandidate(c) {
    const allowed = registrableDomain(c.domain ?? (() => { try { return new URL(c.website).hostname; } catch { return null; } })());
    if (!allowed) { counts.review++; return; }
    let start;
    try { start = new URL(c.website.startsWith("http") ? c.website : "https://" + c.website).toString(); }
    catch { counts.review++; return; }
    const origin = new URL(start).origin;

    const evidence = { emails: [], phones: [], addresses: [], pageUrl: start };
    const planned = [start];
    let robotsBlocked = false;

    for (let i = 0; i < planned.length && i < MAX_PAGES; i++) {
      const pageUrl = planned[i];
      const robots = await robotsDecision(origin, new URL(pageUrl).pathname);
      if (robots === "disallowed") {
        await logFetch(q, runId, c.source_ref, pageUrl, null, robots);
        if (i === 0) robotsBlocked = true;
        continue;
      }
      const r = await safeFetch(pageUrl, allowed);
      await logFetch(q, runId, c.source_ref, pageUrl, r, robots);
      counts.fetched_pages++;
      if (!r.html) continue;
      const ex = extractFromHtml(r.html);
      evidence.emails.push(...ex.emails);
      evidence.phones.push(...ex.phones);
      evidence.addresses.push(...ex.addresses);
      if (ex.addresses.length && evidence.pageUrl === start) evidence.pageUrl = r.finalUrl;
      if (i === 0) {
        for (const link of findContactLinks(ex.links, r.finalUrl)) {
          if (checkFetchTarget(link, allowed).ok && !planned.includes(link)) planned.push(link);
        }
        for (const p of CONTACT_PATHS) {
          const guess = origin + p;
          if (!planned.includes(guess)) planned.push(guess);
        }
      }
      await sleep(800); // höflich (gleiche Domain)
    }

    if (robotsBlocked) counts.robots_blocked++;
    evidence.emails = [...new Set(evidence.emails)];
    evidence.phones = [...new Set(evidence.phones)];
    // F-043: verifyCandidate schreibt Profil, Provenienz, Schul-Status, Brand und Queue in mehreren
    // Statements. In EINER Transaktion kapseln (sql.begin) → bei Fehler rollt der GESAMTE Kandidat
    // zurück. Zähler NUR über ein per-Kandidat-Delta führen und ERST NACH erfolgreichem Commit in
    // die Gesamt-Zähler mergen (verifyCandidate erhöht verified/profiles_updated VOR assignBrand →
    // ein späterer Fehler würde die DB zurückrollen, aber die Erfolgszählung sonst stehen lassen).
    const delta = emptyCounts();
    try {
      await sql.begin(async (tx) => {
        const qt = { query: async (s, p = []) => ({ rows: await tx.unsafe(s, p) }) };
        await verifyCandidate(qt, { schoolId: c.id, sourceRef: c.source_ref, domain: c.domain }, evidence, { runId, counts: delta });
      });
      for (const k of Object.keys(delta)) counts[k] = (counts[k] ?? 0) + delta[k]; // Commit ok → Delta übernehmen
    } catch (e) { counts.errors++; console.error("verify error", c.id, String(e?.message ?? e)); } // Rollback → Delta verworfen
  }

  // Concurrency-Pool über die Kandidaten (verschiedene Domains parallel).
  let next = 0;
  let done = 0;
  async function worker() {
    while (next < candidates.length) {
      const c = candidates[next++];
      try { await processCandidate(c); }
      catch (e) { counts.errors++; console.error("candidate error", c?.id, String(e?.message ?? e)); }
      if (++done % 100 === 0) console.log(`… ${done}/${candidates.length} verarbeitet (verifiziert ${counts.verified})`);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, candidates.length) }, worker));

  // F-045: Kandidatenfehler nicht als „completed/Exit 0" verschleiern.
  const hadErrors = (counts.errors ?? 0) > 0;
  await finishVerifyRun(q, runId, counts, hadErrors ? "completed_with_errors" : "completed");
  console.log("\nLauf-Report:");
  for (const [k, v] of Object.entries(counts)) console.log(`  ${k.padEnd(16)} ${v}`);
  if (hadErrors) {
    console.error(`\n⚠ Verifikation mit ${counts.errors} Fehler(n) abgeschlossen (run ${runId}) — bitte prüfen.`);
    process.exitCode = 1;
  } else {
    console.log(`\nFertig ✓ (run ${runId}). Verifizierte Schulen bleiben is_listed=false (Freigabe separat).`);
  }
} catch (err) {
  console.error("Verifikation fehlgeschlagen:", err?.message ?? err);
  if (runId) { try { await finishVerifyRun(q, runId, { error: true }, "failed"); } catch { /* ignore */ } }
  process.exitCode = 1;
} finally {
  await sql.end();
}
