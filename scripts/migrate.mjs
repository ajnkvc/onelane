import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { getDbSslOption, isLocalDbHost, dbHostFromUrl } from "./db-ssl.mjs";
import { runMigrations } from "../db/migrate-core.mjs";

/**
 * migrate.mjs — Migrations-Runner (Owner-/Tooling-Pfad).
 * ============================================================================
 * Verbindet DIREKT (kein Transaction-Pooler) über TOOLING_DATABASE_URL und wendet
 * `db/migrations/*.sql` in Namensreihenfolge an. Angewandte Migrationen werden in
 * `_schema_migrations` getrackt (Checksumme → Drift-Erkennung).
 *
 * Aufruf:
 *   node scripts/migrate.mjs           # ausstehende Migrationen anwenden
 *   node scripts/migrate.mjs --status  # nur anzeigen (dry-run), nichts anwenden
 *
 * Migrations-Konvention: jede Datei ist self-contained (verwaltet ggf. ihre eigene
 * Transaktion, vgl. 0000_*.sql). Bereits angewandte Dateien NICHT mehr ändern —
 * stattdessen eine neue Migration (höhere Nummer) anlegen.
 */
const STATUS = process.argv.includes("--status");

const url = process.env.TOOLING_DATABASE_URL;
if (!url) {
  console.error("Fehlt: TOOLING_DATABASE_URL (Owner-/Migrations-Verbindung).");
  process.exit(1);
}

// F-042: Backup-Preflight für REMOTE-Migrationen. Owner-DDL gegen eine potenziell produktive
// DB (PII/Payment) darf nicht ohne bestätigtes, frisches Backup laufen. Lokale Ziele
// (localhost/127.0.0.1/Docker-Netz) und der Dry-Run (--status) sind ausgenommen.
function backupArg() {
  const i = process.argv.indexOf("--confirm-backup");
  const v = i >= 0 ? process.argv[i + 1] : process.env.MIGRATION_BACKUP_ID;
  return (v && !v.startsWith("--")) ? v.trim() : "";
}
if (!STATUS) {
  const host = dbHostFromUrl(url);
  const isRemote = !isLocalDbHost(host);
  const backupId = backupArg();
  if (isRemote && !backupId) {
    console.error(
      `Abbruch: Migration gegen REMOTE-DB (${host ?? "?"}) ohne Backup-Bestätigung.\n` +
        "  1) Frisches Backup ziehen (npm run db:backup) und Restore-Test bestätigen.\n" +
        "  2) Erneut mit  --confirm-backup <backup-id>  ODER  MIGRATION_BACKUP_ID=<id>  starten.\n" +
        "  (Lokale Ziele und  --status  sind ausgenommen.)",
    );
    process.exit(1);
  }
  if (isRemote) console.log(`Remote-Migration bestätigt (Backup: ${backupId}) → Ziel-Host: ${host}`);
}

const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, "..", "db", "migrations");
const migrations = readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .map((name) => ({ name, sql: readFileSync(join(dir, name), "utf8") }));

const sql = postgres(url, { max: 1, ssl: getDbSslOption(url), onnotice: () => {} });
const db = {
  exec: (s) => sql.unsafe(s),
  query: async (s, p = []) => ({ rows: await sql.unsafe(s, p) }),
};

try {
  const res = await runMigrations(db, migrations, {
    dryRun: STATUS,
    log: (m) => console.log(m),
  });
  console.log(
    STATUS
      ? `\nAngewandt: ${res.skipped.length} · Ausstehend: ${res.pending.length} · Drift: ${res.drift.length}`
      : `\nNeu angewandt: ${res.applied.length} · Übersprungen: ${res.skipped.length} · Drift: ${res.drift.length}`,
  );
  if (res.drift.length > 0) {
    console.error("Achtung: Drift erkannt — bereits angewandte Migration(en) wurden geändert.");
    process.exitCode = 2;
  }
} catch (err) {
  console.error("Migration fehlgeschlagen:", err?.message ?? err);
  process.exitCode = 1;
} finally {
  await sql.end();
}
