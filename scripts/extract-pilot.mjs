/**
 * extract-pilot.mjs — Pilot: misst die Trefferquote der Daten-Extraktion über N
 * Schulen (Default 50), ohne den bestehenden Cache zu stören (nimmt UNGECACHTE).
 * Reine Messung/Vorbefüllung — nichts wird veröffentlicht.
 *
 *   node --env-file=.env.development.local scripts/extract-pilot.mjs [--limit 50] [--concurrency 4]
 */
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { getDbSslOption } from "./db-ssl.mjs";
import { shootSite } from "./shoot-website.mjs";

const SHOT_DIR = path.resolve("data/untracked/screenshots");
const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const LIMIT = Math.max(1, Number(arg("--limit", "50")) || 50);
const CONC = Math.max(1, Math.min(8, Number(arg("--concurrency", "4")) || 4));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const url = process.env.TOOLING_DATABASE_URL;
  if (!url) { console.error("Fehlt: TOOLING_DATABASE_URL (.env.development.local)."); process.exit(1); }
  const sql = postgres(url, { max: 2, prepare: false, ssl: getDbSslOption(url), onnotice: () => {} });
  try {
    const rows = await sql.unsafe(`select ds.id, ds.name, p.website
      from public.driving_schools ds
      join public.school_profiles p on p.school_id=ds.id
      join public.import_review_queue rq on rq.school_id=ds.id and rq.status='pending'
      where not ds.is_duplicate and coalesce(p.website,'') <> ''
      order by coalesce(ds.kundennummer, 9223372036854775807) asc, ds.plz asc nulls last, ds.name asc`);
    const todo = rows.filter((r) => !fs.existsSync(path.join(SHOT_DIR, String(r.id), "meta.json"))).slice(0, LIMIT);
    console.log(`Pilot über ${todo.length} ungecachte Schulen (von ${rows.length} pending mit Website), ${CONC} parallel\n`);
    if (!todo.length) { console.log("Nichts zu tun (alles gecacht)."); return; }

    const stat = { ok: 0, err: 0, telefon: 0, email: 0, plz_ort: 0, strasse: 0, classes: 0, hoursText: 0, hours: 0, multiLoc: 0 };
    const examples = [];
    let idx = 0, fin = 0;
    async function worker() {
      while (idx < todo.length) {
        const r = todo[idx++];
        try {
          const { candidates: c } = await shootSite(r.website, path.join(SHOT_DIR, String(r.id)));
          stat.ok++;
          if (c.telefon?.length) stat.telefon++;
          if (c.email?.length) stat.email++;
          if (c.plz_ort?.length) stat.plz_ort++;
          if (c.strasse?.length) stat.strasse++;
          if (c.classes?.length) stat.classes++;
          if (c.hoursText?.length) stat.hoursText++;
          if (c.hours) stat.hours++;
          if (c.multiLoc?.flag) stat.multiLoc++;
          if (examples.length < 6) examples.push({ name: r.name, url: r.website, c });
          console.log(`  [${++fin}/${todo.length}] ✓ ${r.website}  tel:${c.telefon?.length || 0} mail:${c.email?.length || 0} kl:${(c.classes || []).join("·") || "-"} zeitenStrukt:${c.hours ? "ja" : "nein"} multiLoc:${c.multiLoc?.flag ? "!" : "-"}`);
        } catch (e) { stat.err++; console.log(`  [${++fin}/${todo.length}] ! ${r.website} — ${String(e?.message ?? e).slice(0, 80)}`); }
        await sleep(500);
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONC, todo.length) }, () => worker()));

    const n = stat.ok || 1;
    const pct = (x) => `${x}/${stat.ok} (${Math.round(x / n * 100)}%)`;
    console.log(`\n=== PILOT-ERGEBNIS (${stat.ok} erfolgreich, ${stat.err} Fehler) ===`);
    console.log(`  Telefon:              ${pct(stat.telefon)}`);
    console.log(`  E-Mail:               ${pct(stat.email)}`);
    console.log(`  PLZ+Ort:              ${pct(stat.plz_ort)}`);
    console.log(`  Straße+Nr:            ${pct(stat.strasse)}`);
    console.log(`  Klassen:              ${pct(stat.classes)}`);
    console.log(`  Öffnungszeiten-Text:  ${pct(stat.hoursText)}`);
    console.log(`  Öffnungszeiten hh:mm: ${pct(stat.hours)}`);
    console.log(`  Filial-Hinweis:       ${pct(stat.multiLoc)}`);
    console.log(`\n=== BEISPIELE (zur Genauigkeits-Beurteilung) ===`);
    for (const ex of examples) {
      console.log(`\n• ${ex.name} — ${ex.url}`);
      console.log(`   Telefon: ${(ex.c.telefon || []).map((x) => x.val).join(" | ") || "-"}`);
      console.log(`   E-Mail:  ${(ex.c.email || []).map((x) => x.val).join(" | ") || "-"}`);
      console.log(`   Adresse: ${(ex.c.strasse || []).map((x) => x.val).join(" | ") || "-"}  ${(ex.c.plz_ort || []).map((x) => x.val).join(" | ") || ""}`);
      console.log(`   Klassen: ${(ex.c.classes || []).join(", ") || "-"}`);
      console.log(`   Zeiten (hh:mm): ${ex.c.hours ? JSON.stringify(ex.c.hours) : "—"}`);
      console.log(`   Zeiten-Text: ${(ex.c.hoursText || []).slice(0, 3).join(" / ") || "-"}`);
      console.log(`   Filialen?: ${ex.c.multiLoc?.flag ? `ja (PLZ:${ex.c.multiLoc.distinctPlz}, Keyword:${ex.c.multiLoc.keyword})` : "nein"}`);
    }
  } finally {
    await sql.end();
  }
}
main().catch((e) => { console.error("FEHLER:", e); process.exit(1); });
