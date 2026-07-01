/**
 * import-osm.mjs — OSM-Import-Runner (008b), erhöhter/Tooling-Pfad.
 * ============================================================================
 * Lädt DE-Fahrschulen (`amenity=driving_school`) aus einem gespeicherten Snapshot
 * ODER von Overpass, normalisiert/dedupliziert/materialisiert sie (hidden/unlisted)
 * über die reine Logik aus db/ingest/*.mjs. Verbindet über TOOLING_DATABASE_URL
 * (Owner, umgeht RLS) — NIE Request-Pfad. Jeder Lauf wird in import_run +
 * security_events auditiert.
 *
 * Aufruf:
 *   node --env-file=.env.development.local scripts/import-osm.mjs --fetch
 *   node --env-file=.env.development.local scripts/import-osm.mjs --snapshot data/osm-snapshots/<datei>.json
 *
 * Datenschutz/Recht: ODbL-Attribution wird im Lauf vermerkt; KEINE Google-Calls,
 * KEIN Website/Impressum-Fetch (das ist 008c). Höflicher Single-Request mit
 * identifizierendem User-Agent + Timeout; keine aggressiven Parallel-Abfragen.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { getDbSslOption } from "./db-ssl.mjs";
import { startRun, finishRun, importCandidates } from "../db/ingest/apply.mjs";

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const OVERPASS_QUERY = `[out:json][timeout:180];
area["ISO3166-1"="DE"][admin_level=2]->.de;
(
  node["amenity"="driving_school"](area.de);
  way["amenity"="driving_school"](area.de);
  relation["amenity"="driving_school"](area.de);
);
out tags center qt;`;
// Neutraler, identifizierender UA (KEINE Marke, KEINE Privat-Daten). Optionaler
// Kontakt (dedizierte Projekt-Mail/-URL) NUR via Env, z. B. OSM_CONTACT="mailto:…".
const OSM_CONTACT = process.env.OSM_CONTACT ?? "";
const USER_AGENT = "FahrschulDatenBot/0.1" + (OSM_CONTACT ? ` (+${OSM_CONTACT})` : "");

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const argVal = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : null;
};

const url = process.env.TOOLING_DATABASE_URL;
if (!url) {
  console.error("Fehlt: TOOLING_DATABASE_URL (Owner-/Tooling-Verbindung).");
  process.exit(1);
}

async function loadElements() {
  const snapshotPath = argVal("--snapshot");
  if (snapshotPath) {
    console.log(`Snapshot lesen: ${snapshotPath}`);
    const json = JSON.parse(readFileSync(snapshotPath, "utf8"));
    return { elements: json.elements ?? [], sourceVersion: json?.osm3s?.timestamp_osm_base ?? null };
  }
  if (!args.includes("--fetch")) {
    console.error("Bitte --fetch (Overpass laden) oder --snapshot <datei> angeben.");
    process.exit(1);
  }
  console.log("Overpass laden (höflicher Single-Request) …");
  const res = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain", "User-Agent": USER_AGENT },
    body: OVERPASS_QUERY,
    signal: AbortSignal.timeout(180_000),
  });
  if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
  const json = await res.json();
  const dir = join(here, "..", "data", "osm-snapshots");
  mkdirSync(dir, { recursive: true });
  const stamp = (json?.osm3s?.timestamp_osm_base ?? "unknown").replace(/[:]/g, "-");
  const out = join(dir, `de-driving-schools-${stamp}.json`);
  writeFileSync(out, JSON.stringify(json));
  console.log(`Snapshot gespeichert: ${out}`);
  return { elements: json.elements ?? [], sourceVersion: json?.osm3s?.timestamp_osm_base ?? null };
}

const sql = postgres(url, { max: 1, prepare: false, ssl: getDbSslOption(url), onnotice: () => {} });
const q = { query: async (s, p = []) => ({ rows: await sql.unsafe(s, p) }) };

let runId = null;
try {
  const { elements, sourceVersion } = await loadElements();
  console.log(`Elemente: ${elements.length} · OSM-Stand: ${sourceVersion ?? "?"}`);
  runId = await startRun(q, { sourceVersion, query: OVERPASS_QUERY });
  const counts = await importCandidates(q, elements, { runId });
  // F-045: Kandidatenfehler NICHT als „completed/Exit 0" verschleiern. Bei Fehlern → Status
  // 'completed_with_errors' + Exit ≠ 0, damit ein Lauf mit Teilfehlern sichtbar/CI-fähig ist.
  const hadErrors = (counts.errors ?? 0) > 0;
  await finishRun(q, runId, counts, hadErrors ? "completed_with_errors" : "completed");
  console.log("\nLauf-Report:");
  for (const [k, v] of Object.entries(counts)) console.log(`  ${k.padEnd(16)} ${v}`);
  if (hadErrors) {
    console.error(`\n⚠ Lauf mit ${counts.errors} Kandidatenfehler(n) abgeschlossen (run ${runId}) — bitte prüfen.`);
    process.exitCode = 1;
  } else {
    console.log(`\nFertig ✓ (run ${runId}). Alle importierten Schulen sind is_listed=false (Review/008c).`);
  }
} catch (err) {
  console.error("Import fehlgeschlagen:", err?.message ?? err);
  if (runId) {
    try { await finishRun(q, runId, { error: true }, "failed", String(err?.message ?? err)); } catch { /* ignore */ }
  }
  process.exitCode = 1;
} finally {
  await sql.end();
}
