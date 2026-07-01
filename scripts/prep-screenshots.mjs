/**
 * prep-screenshots.mjs — Batch-Vorbereitung der assistierten Prüfung.
 * ============================================================================
 * Holt für die NÄCHSTEN N noch ungeprüften Schulen MIT Website die Screenshots
 * (Startseite/Impressum/Kontakt) + belegbare Kandidaten und legt sie im Cache
 * ab (data/untracked/screenshots/<id>, git-ignoriert), damit das Review-Tool sie
 * SOFORT zeigt. Bewusst in Schritten (Default 150) + höflich gedrosselt — wir
 * speichern NICHT 6.900×3 Screenshots gleichzeitig. Verifizierte Datensätze
 * löschen ihre Screenshots automatisch (Review-Tool), so bleibt der Speicher klein.
 *
 * Nur eigene Schul-Websites, robots-konform, nichts wird veröffentlicht.
 *
 * NUTZUNG:
 *   node --env-file=.env.development.local scripts/prep-screenshots.mjs            # 150 vorbereiten
 *   node --env-file=.env.development.local scripts/prep-screenshots.mjs --limit 100
 *   node --env-file=.env.development.local scripts/prep-screenshots.mjs --clean    # ALLE Screenshots löschen (Speicher freigeben)
 */
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { getDbSslOption } from "./db-ssl.mjs";
import { shootSite } from "./shoot-website.mjs";

const SHOT_DIR = path.resolve("data/untracked/screenshots");
const arg = (name, def) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : def; };
const LIMIT = Math.max(1, Number(arg("--limit", "150")) || 150);
const DELAY = Math.max(0, Number(arg("--delay", "800")) || 800);
const CONC = Math.max(1, Math.min(8, Number(arg("--concurrency", "4")) || 4));
const CLEAN = process.argv.includes("--clean");

function dirSize(dir) {
  let total = 0;
  if (!fs.existsSync(dir)) return 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    total += e.isDirectory() ? dirSize(p) : fs.statSync(p).size;
  }
  return total;
}
const mb = (b) => (b / 1024 / 1024).toFixed(1) + " MB";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  if (CLEAN) {
    const before = dirSize(SHOT_DIR);
    fs.rmSync(SHOT_DIR, { recursive: true, force: true });
    console.log(`🧹 Alle Screenshots gelöscht — ${mb(before)} freigegeben.`);
    return;
  }

  const url = process.env.TOOLING_DATABASE_URL;
  if (!url) { console.error("Fehlt: TOOLING_DATABASE_URL (.env.development.local)."); process.exit(1); }
  const sql = postgres(url, { max: 2, prepare: false, ssl: getDbSslOption(url), onnotice: () => {} });
  try {
    // Exakt die Review-Queue (pending) mit Website — gleiche Reihenfolge wie im Tool.
    const rows = await sql.unsafe(`select ds.id, p.website
      from public.driving_schools ds
      join public.school_profiles p on p.school_id=ds.id
      join public.import_review_queue rq on rq.school_id=ds.id and rq.status='pending'
      where not ds.is_duplicate and coalesce(p.website,'') <> ''
      order by coalesce(ds.kundennummer, 9223372036854775807) asc, ds.plz asc nulls last, ds.name asc`);

    const REFRESH = process.argv.includes("--refresh");
    const cached = (r) => fs.existsSync(path.join(SHOT_DIR, String(r.id), "meta.json"));
    const target = rows.slice(0, LIMIT);                                  // die ERSTEN LIMIT der Review-Queue
    const todo = REFRESH ? target : target.filter((r) => !cached(r));     // --refresh: auch gecachte neu extrahieren

    console.log(`Review-Queue mit Website: ${rows.length}  ·  Ziel: erste ${target.length}  ·  ${REFRESH ? "Modus: REFRESH (alle neu)" : "schon vorbereitet: " + (target.length - todo.length)}  ·  dieser Batch: ${todo.length}`);
    if (!todo.length) { console.log("Nichts zu tun — entweder alles vorbereitet oder verifiziert."); return; }

    console.log(`Nebenläufigkeit: ${CONC} parallel · Drosselung: ${DELAY} ms\n`);
    let ok = 0, err = 0, idx = 0, fin = 0;
    async function worker() {
      while (idx < todo.length) {
        const i = idx++; const r = todo[i];
        try {
          const { shots } = await shootSite(r.website, path.join(SHOT_DIR, String(r.id)));
          const got = shots.filter((s) => s.file).length; ok++;
          console.log(`  [${++fin}/${todo.length}] ✓ ${r.website}  (${got} Screenshots)`);
        } catch (e) {
          err++;
          console.log(`  [${++fin}/${todo.length}] ! ${r.website}  — ${String(e?.message ?? e).slice(0, 100)}`);
        }
        if (DELAY) await sleep(DELAY);
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONC, todo.length) }, () => worker()));
    console.log(`\nFertig: ${ok} vorbereitet, ${err} Fehler.  Cache-Größe gesamt: ${mb(dirSize(SHOT_DIR))}`);
    console.log(`→ Im Review-Tool (Fokus-Modus) erscheinen die Screenshots jetzt sofort. Verifizierte werden automatisch gelöscht.`);
    console.log(`→ Nächsten Batch: erneut ausführen. Speicher freigeben: --clean`);
  } finally {
    await sql.end();
  }
}

main().catch((e) => { console.error("FEHLER:", e); process.exit(1); });
