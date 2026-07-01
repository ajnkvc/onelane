import { createHash } from "node:crypto";

/**
 * migrate-core.mjs — reiner Migrations-Kern (KEIN Dateisystem/Netzwerk → testbar).
 * ============================================================================
 * `db` ist ein minimaler Executor:
 *   - exec(sql)            : führt ein ganzes (mehranweisungs-)Migrations-SQL aus
 *   - query(sql, params?)  : liefert { rows }
 * `migrations` ist eine Liste { name, sql }; angewandt wird in NAMENS-Reihenfolge.
 *
 * Angewandte Migrationen werden in `_schema_migrations` (name, checksum, applied_at)
 * getrackt. Eine bereits angewandte, nachträglich GEÄNDERTE Datei wird als „Drift"
 * gemeldet (Checksumme weicht ab) und NICHT erneut ausgeführt.
 */

/**
 * Fixer Schlüssel für pg_advisory_lock: serialisiert konkurrierende Migrations-Runner
 * (F-024). Zwei parallele `db:migrate`-Läufe gegen dieselbe DB dürfen NICHT dieselbe
 * DDL doppelt ausführen. Der Lock ist Session-scoped (postgres.js max:1 = eine Verbindung).
 */
export const MIGRATION_LOCK_KEY = 728310547;

/** SHA-256-Checksumme über den SQL-Inhalt (Drift-Erkennung). */
export function checksum(sql) {
  return createHash("sha256").update(sql, "utf8").digest("hex");
}

/** SQL-String-Literal (nur für kontrollierte Werte: Dateiname, Hex-Checksumme). */
function sqlLiteral(s) {
  return "'" + String(s).replace(/'/g, "''") + "'";
}

/**
 * Verwaltet die Migration ihre EIGENE Transaktion (führende `begin;` nach den
 * Kopf-Kommentaren)? Dann kann der Runner Marker+DDL nicht atomar koppeln → 'applying'-
 * Sentinel schützt die Lücke. Migrationen OHNE eigenes `begin;` wrappt der Runner atomar.
 * (plpgsql-`BEGIN` in Funktionskörpern hat kein direktes `;` und wird hier NICHT erfasst.)
 */
export function hasOwnTransaction(sql) {
  // Führende Whitespaces (inkl. LEERZEILEN), Zeilen- und Blockkommentare iterativ entfernen,
  // bis der erste echte Token übrig ist — dann auf transaktions-`begin;` prüfen. Iterativ, weil
  // beliebige Reihenfolgen aus Leerzeile/Kommentar/Blockkommentar vorkommen (jede Migration hat
  // eine Leerzeile zwischen Kopf-Kommentar und `begin;`).
  let s = String(sql), prev;
  do {
    prev = s;
    s = s.replace(/^\s+/, "").replace(/^--[^\n]*\n?/, "").replace(/^\/\*[\s\S]*?\*\//, "");
  } while (s !== prev);
  return /^begin\s*;/i.test(s);
}

/**
 * Legt die Tracking-Tabelle an (nur Owner/Migrator; nicht an app_user gegrantet).
 * `status`: 'applied' (fertig) | 'applying' (Lauf begonnen, nicht bestätigt → Crash-Sentinel).
 * Rerun-idempotent (F-081): add column if not exists deckt Bestands-DBs ohne status ab.
 */
export async function ensureTable(db) {
  await db.exec(
    "create table if not exists _schema_migrations (" +
      "name text primary key, checksum text not null, " +
      "status text not null default 'applied', " +
      "applied_at timestamptz not null default now());",
  );
  await db.exec(
    "alter table _schema_migrations add column if not exists status text not null default 'applied';",
  );
}

/**
 * Wendet ausstehende Migrationen an (oder listet sie bei dryRun).
 * Rückgabe: { applied, skipped, pending, drift, incomplete } (jeweils Namenslisten).
 *
 * F-024 (Atomarität + Nebenläufigkeit):
 *  - pg_advisory_lock serialisiert konkurrierende Runner (best effort; wo nicht unterstützt,
 *    z. B. In-Memory-Test-DB, wird ohne Lock fortgefahren — dann gibt es ohnehin keine Parallelität).
 *  - Eine bereits mit Status 'applying' vermerkte Migration = ein FRÜHER abgebrochener Lauf →
 *    DB in unbekanntem Zustand → HART abbrechen (kein stilles Re-Apply/Skip), Operator prüft.
 *  - Migrationen ohne eigenes `begin;` werden mit dem Marker in EINER Transaktion angewandt
 *    (atomar: bei Crash rollt alles zurück → sauberes Re-Apply). Selbst-transaktionale
 *    Migrationen nutzen den 'applying'→'applied'-Sentinel, damit eine Lücke sichtbar bleibt.
 */
export async function runMigrations(db, migrations, opts = {}) {
  const { dryRun = false, log = () => {}, lock = true } = opts;

  let locked = false;
  if (lock && !dryRun) {
    try {
      await db.query("select pg_advisory_lock($1)", [MIGRATION_LOCK_KEY]);
      locked = true;
    } catch (e) {
      log(`~ advisory lock nicht verfügbar (${e?.message ?? e}) — ohne Lock fortfahren`);
    }
  }
  try {
    await ensureTable(db);

    const res = await db.query("select name, checksum, status from _schema_migrations");
    const applied = new Map(res.rows.map((r) => [r.name, { checksum: r.checksum, status: r.status }]));

    // Unvollständige Migration(en) eines früheren Laufs = DB in unbekanntem Zustand → nicht weitermachen.
    const incomplete = [...applied.entries()].filter(([, v]) => v.status === "applying").map(([n]) => n).sort();
    if (incomplete.length) {
      for (const n of incomplete) log(`! UNVOLLSTÄNDIG: ${n} (Status 'applying') — früherer Lauf abgebrochen`);
      if (!dryRun) {
        throw new Error(
          `Unvollständige Migration(en) erkannt (Status 'applying'): ${incomplete.join(", ")}. ` +
            "DB in unbekanntem Zustand — bitte manuell prüfen und den _schema_migrations-Eintrag korrigieren.",
        );
      }
    }

    const ordered = [...migrations].sort((a, b) => a.name.localeCompare(b.name));
    const result = { applied: [], skipped: [], pending: [], drift: [], incomplete };

    for (const m of ordered) {
      const sum = checksum(m.sql);
      const rec = applied.get(m.name);
      if (rec) {
        if (rec.status === "applying") continue; // oben bereits als incomplete gemeldet
        if (rec.checksum !== sum) {
          result.drift.push(m.name);
          log(`! DRIFT: ${m.name} wurde nach dem Anwenden geändert (Checksumme weicht ab)`);
        } else {
          result.skipped.push(m.name);
        }
        continue;
      }
      if (dryRun) {
        result.pending.push(m.name);
        log(`~ ausstehend: ${m.name}`);
        continue;
      }
      log(`+ wende an: ${m.name}`);
      if (hasOwnTransaction(m.sql)) {
        // Selbst-transaktionale Datei (begin;…commit;): Marker vor/nach mit 'applying'-Sentinel.
        await db.query(
          "insert into _schema_migrations (name, checksum, status) values ($1, $2, 'applying')",
          [m.name, sum],
        );
        await db.exec(m.sql);
        await db.query(
          "update _schema_migrations set status = 'applied', applied_at = now() where name = $1",
          [m.name],
        );
      } else {
        // Runner-verwaltet: DDL + Marker in EINER Transaktion (atomar, kein Sentinel nötig).
        await db.exec(
          "begin;\n" + m.sql +
            "\ninsert into _schema_migrations (name, checksum, status) values (" +
            sqlLiteral(m.name) + ", " + sqlLiteral(sum) + ", 'applied');\ncommit;",
        );
      }
      result.applied.push(m.name);
    }
    return result;
  } finally {
    if (locked) {
      try { await db.query("select pg_advisory_unlock($1)", [MIGRATION_LOCK_KEY]); } catch { /* Verbindung endet ohnehin */ }
    }
  }
}
