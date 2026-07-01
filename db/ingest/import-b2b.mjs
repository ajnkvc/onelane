/**
 * import-b2b.mjs — B2B-Liste als „Brücke" in die Review-Pipeline.
 * ============================================================================
 * ZWECK: Die gekaufte B2B-Liste (data/untracked/*.csv) dient NUR als interner
 * Pointer, um Schulen zu finden und ihre Website-URL zu gewinnen. Es werden
 * KEINE B2B-Feldwerte veröffentlicht; Telefon/E-Mail/Ansprechpartner (PII +
 * Honeytoken-Risiko) werden GAR NICHT übernommen. Veröffentlicht wird nur, was
 * später bei der MANUELLEN Prüfung unabhängig von der Schul-Website re-gesourct
 * und freigegeben wird (is_listed bleibt hier IMMER false).
 *
 * VORGEHEN:
 *  - dedupliziert gegen vorhandene Schulen über cluster_key/dedupe_key
 *  - Treffer mit fehlender Website → nur Website-Lücke füllen (school_profiles)
 *  - kein Treffer → neue Schule `source='b2b'`, verification_status='needs_review',
 *    is_listed=false, eigene Kundennummer, + Review-Queue-Eintrag (pending)
 *  - idempotent über (source='b2b', source_ref)
 *
 * NUTZUNG (lokal, gegen TOOLING_DATABASE_URL):
 *   node --env-file=.env.development.local db/ingest/import-b2b.mjs            # Trockenlauf (nur Bericht)
 *   node --env-file=.env.development.local db/ingest/import-b2b.mjs --apply    # schreibt
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import postgres from "postgres";
import { getDbSslOption } from "../../scripts/db-ssl.mjs";
import { slugify, normName, clusterKey, dedupeKey } from "./normalize.mjs";
import { withToolingAudit } from "./lib/tooling-audit.mjs";

const APPLY = process.argv.includes("--apply");
const DIR = "data/untracked";

function findCsv() {
  const files = fs.readdirSync(DIR).filter((f) => f.toLowerCase().endsWith(".csv"));
  if (!files.length) throw new Error(`Keine CSV in ${DIR}`);
  return path.join(DIR, files[0]);
}

/** Minimaler RFC-4180-Parser (Komma-getrennt, Felder optional in "…", "" = escaped "). */
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\r") { /* skip */ }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function cleanUrl(raw) {
  const v = (raw || "").trim();
  if (!v) return null;
  if (!/^https?:\/\//i.test(v)) return `https://${v.replace(/^\/+/, "")}`;
  return v;
}

async function main() {
  const file = findCsv();
  const rows = parseCsv(fs.readFileSync(file, "utf8"));
  const header = rows.shift().map((h) => h.trim());
  const col = (name) => header.indexOf(name);
  const cName = col("Name"), cStr = col("Straße"), cHaus = col("Hausnummer"), cPlz = col("PLZ"),
    cOrt = col("Ort"), cBland = col("Bundesland"), cWeb = col("Website");
  if (cName < 0 || cWeb < 0) throw new Error(`Erwartete Spalten fehlen (Header: ${header.join(", ")})`);

  // F-049: TOOLING_DATABASE_URL fail-closed prüfen, bevor postgres() sonst auf lokale PG*-Defaults
  // zurückfiele. Ziel-Host maskiert loggen (kein Passwort/keine DSN im Klartext).
  const toolingUrl = process.env.TOOLING_DATABASE_URL;
  if (!toolingUrl) { console.error("Fehlt: TOOLING_DATABASE_URL (.env.development.local)."); process.exit(1); }
  try { console.log(`Ziel-DB-Host: ${new URL(toolingUrl).hostname}`); } catch { console.error("TOOLING_DATABASE_URL ist keine gültige URL."); process.exit(1); }

  const sql = postgres(toolingUrl, { max: 4, prepare: false, ssl: getDbSslOption(toolingUrl), onnotice: () => {} });
  try {
    // Mutierende B2B-Läufe (--apply) laufen über den Tooling-Audit-Wrapper (F-018):
    // attempt/success/failed in security_events. Der Trockenlauf schreibt nichts → kein Audit nötig.
    const runBody = async () => {
    // Bestehende Schulen laden (ohne Duplikate) + Website-Bestand + bereits importierte B2B-Refs
    const existing = await sql.unsafe(`select id, cluster_key, dedupe_key, source, source_ref from public.driving_schools where not is_duplicate`);
    const byDk = new Map(), byCk = new Map();
    for (const r of existing) {
      if (r.dedupe_key && !byDk.has(r.dedupe_key)) byDk.set(r.dedupe_key, r.id);
      if (r.cluster_key && !byCk.has(r.cluster_key)) byCk.set(r.cluster_key, r.id);
    }
    const hasWeb = new Set((await sql.unsafe(`select school_id from public.school_profiles where coalesce(website,'') <> ''`)).map((r) => r.school_id));
    const b2bRefs = new Set(existing.filter((r) => r.source === "b2b").map((r) => r.source_ref));

    const c = { total: 0, skip_existing: 0, neu: 0, neu_web: 0, web_filled: 0, matched_nofill: 0, no_name: 0, err: 0 };
    const sampleNeu = [], sampleFill = [];

    for (const r of rows) {
      if (!r.length || r.every((x) => !String(x).trim())) continue;
      c.total++;
      const name = (r[cName] || "").trim();
      // Kein Name ODER Statistik-/Befüllungszeile (Werte wie „97.35 %") überspringen.
      if (!name || !normName(name) || /%\s*$/.test(name)) { c.no_name++; continue; }
      const strasse = (r[cStr] || "").trim() || null;
      const hausnummer = cHaus >= 0 ? (r[cHaus] || "").trim() || null : null;
      const plz = (r[cPlz] || "").trim() || null;
      const ort = (r[cOrt] || "").trim() || null;
      const bundesland = cBland >= 0 ? (r[cBland] || "").trim() || null : null;
      const website = cleanUrl(r[cWeb]);
      // Stabile, idempotente Quell-Ref aus Inhalts-Hash. F-048: SHA-256/128-Bit (32 Hex) statt
      // 24-Bit-shortHash — bei tausenden B2B-Zeilen sind 24 Bit kollisionsanfällig (fremde Zeilen
      // würden fälschlich als „schon importiert" übersprungen). Dedup zusätzlich über cluster/dedupe_key.
      const sourceRef = `b2b:${createHash("sha256").update([name, plz, strasse, hausnummer, ort, website].join("|")).digest("hex").slice(0, 32)}`;
      const land = "DE";
      const ck = clusterKey({ land, plz, name }), dk = dedupeKey({ land, plz, name, strasse });

      if (b2bRefs.has(sourceRef)) { c.skip_existing++; continue; }

      const matchId = byDk.get(dk) || byCk.get(ck);
      if (matchId) {
        if (website && !hasWeb.has(matchId)) {
          if (APPLY) {
            const prof = await sql.unsafe(`select id from public.school_profiles where school_id=$1`, [matchId]);
            if (prof.length) await sql.unsafe(`update public.school_profiles set website=$2, updated_at=now() where school_id=$1`, [matchId, website]);
            else await sql.unsafe(`insert into public.school_profiles (school_id, website) values ($1,$2)`, [matchId, website]);
          }
          hasWeb.add(matchId);
          c.web_filled++;
          if (sampleFill.length < 5) sampleFill.push(`${name} (${plz ?? "?"} ${ort ?? "?"}) → ${website}`);
        } else c.matched_nofill++;
        continue;
      }

      // Neue Schule (B2B-Pointer)
      c.neu++;
      if (website) c.neu_web++;
      if (sampleNeu.length < 5) sampleNeu.push(`${name} (${plz ?? "?"} ${ort ?? "?"})${website ? " · " + website : " · (keine Website)"}`);
      if (APPLY) {
        // Slug eindeutig pro (land, ort): längerer Inhalts-Hash gegen Kollisionen.
        const slug = `${slugify(name)}-${createHash("sha1").update(sourceRef).digest("hex").slice(0, 10)}`;
        try {
          // F-043: Schule + Profil + Review-Queue-Eintrag gehören zusammen. In EINER Transaktion
          // (sql.begin) → keine neue B2B-Schule ohne Review-Eintrag/Website bei Teilfehler.
          const dsId = await sql.begin(async (tx) => {
            const ds = (await tx.unsafe(
              `insert into public.driving_schools
                 (name, slug, strasse, hausnummer, plz, ort, bundesland, land, source, source_ref, imported_at,
                  verification_status, is_listed, is_verified, cluster_key, dedupe_key, kundennummer)
               values ($1,$2,$3,$4,$5,$6,$7,$8,'b2b',$9, now(),
                  'needs_review', false, false, $10,$11, nextval('public.driving_schools_kundennummer_seq'))
               returning id`,
              [name, slug, strasse, hausnummer, plz, ort, bundesland, land, sourceRef, ck, dk],
            ))[0];
            if (website) await tx.unsafe(`insert into public.school_profiles (school_id, website) values ($1,$2)`, [ds.id, website]);
            await tx.unsafe(`insert into public.import_review_queue (school_id, reasons, priority, status) values ($1,'{b2b_import}',50,'pending')`, [ds.id]);
            return ds.id;
          });
          byDk.set(dk, dsId); byCk.set(ck, dsId); b2bRefs.add(sourceRef);
          if (website) hasWeb.add(dsId);
        } catch (e) {
          c.err++; c.neu--; if (website) c.neu_web--;
          if (c.err <= 5) console.error(`  ! Fehler bei "${name}" (${plz ?? "?"} ${ort ?? "?"}): ${String(e.message).slice(0, 120)}`);
        }
      } else { byDk.set(dk, "dry"); byCk.set(ck, "dry"); b2bRefs.add(sourceRef); }
    }

    console.log(`\n=== B2B-Import ${APPLY ? "(ANGEWENDET)" : "(TROCKENLAUF — nichts geschrieben)"} ===`);
    console.log(`Datei: ${file}`);
    console.log(`Zeilen gesamt:            ${c.total}`);
    console.log(`  ohne Name (übersprungen): ${c.no_name}`);
    console.log(`  bereits importiert (b2b): ${c.skip_existing}`);
    console.log(`  Treffer in unserer DB:    ${c.web_filled + c.matched_nofill}  (davon Website-Lücke gefüllt: ${c.web_filled})`);
    console.log(`  NEU als b2b-Pointer:      ${c.neu}  (davon mit Website: ${c.neu_web})`);
    if (c.err) console.log(`  Fehler (übersprungen):    ${c.err}`);
    console.log(`\nBeispiele NEU:\n  ${sampleNeu.join("\n  ")}`);
    console.log(`\nBeispiele Website-Lücke gefüllt:\n  ${sampleFill.join("\n  ") || "(keine)"}`);
    if (!APPLY) console.log(`\n→ Zum Schreiben erneut mit  --apply  ausführen.`);
    };
    if (APPLY) {
      await withToolingAudit(sql, { eventType: "b2b_import", initiatorType: "tooling", metadata: { file } }, runBody);
    } else {
      await runBody();
    }
  } finally {
    await sql.end();
  }
}

main().catch((e) => { console.error("FEHLER:", e); process.exit(1); });
