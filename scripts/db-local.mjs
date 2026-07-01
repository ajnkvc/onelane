/**
 * db-local.mjs — Ein-Befehl-Setup der LOKALEN Dev-Datenbank (Phase C-lokal).
 * ============================================================================
 * Idempotent. Verbindet über den erhöhten lokalen Migrator-Login
 * (TOOLING_DATABASE_URL) und:
 *   1) wendet die kanonische Migration an (db/migrate-core.mjs, mit Drift-Check),
 *   2) aktiviert den `app_user`-LOGIN mit dem lokalen Dev-Passwort aus DATABASE_URL
 *      (die Migration legt app_user bewusst als NOLOGIN an — Login ist out-of-band).
 *
 * NUR lokale Entwicklung. Aufruf:
 *   node --env-file=.env.development.local scripts/db-local.mjs
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { getDbSslOption, isLocalDbHost, dbHostFromUrl } from "./db-ssl.mjs";
import { runMigrations } from "../db/migrate-core.mjs";

if (process.env.NODE_ENV === "production") {
  console.error("db-local: nur lokale Entwicklung (NODE_ENV=production blockiert).");
  process.exit(1);
}
const tooling = process.env.TOOLING_DATABASE_URL;
const appUrl = process.env.DATABASE_URL;
if (!tooling || !appUrl) {
  console.error("Fehlt TOOLING_DATABASE_URL und/oder DATABASE_URL (.env.development.local).");
  process.exit(1);
}

// F-023: NODE_ENV allein reicht nicht. db-local wendet Migrationen an UND setzt das
// app_user-Passwort — das darf NUR gegen ein LOKALES Ziel laufen. Zeigt eine der beiden
// DSNs auf einen Remote-Host (Staging/Prod), hart abbrechen (kein Break-Glass: dieses Tool
// ist definitionsgemäß lokal; für Remote gibt es scripts/migrate.mjs mit Backup-Gate).
for (const [label, dsn] of [["TOOLING_DATABASE_URL", tooling], ["DATABASE_URL", appUrl]]) {
  const host = dbHostFromUrl(dsn);
  if (!isLocalDbHost(host)) {
    console.error(
      `db-local: ${label} zeigt auf einen NICHT-lokalen Host (${host ?? "?"}). ` +
        "Dieses Setup-Tool ist ausschließlich für die lokale Dev-DB (localhost/127.0.0.1/Docker-Netz).",
    );
    process.exit(1);
  }
}

// app_user-Rolle + lokales Dev-Passwort aus DATABASE_URL ableiten (bleiben in Sync).
const parsed = new URL(appUrl);
const appRole = decodeURIComponent(parsed.username);
const appPw = decodeURIComponent(parsed.password);
if (!appRole || !appPw) {
  console.error("DATABASE_URL muss `benutzer:passwort` enthalten (lokaler app_user).");
  process.exit(1);
}
const ident = (s) => {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(s)) throw new Error(`Ungültiger Rollenname: ${s}`);
  return s;
};
const literal = (s) => `'${String(s).replace(/'/g, "''")}'`;

const here = dirname(fileURLToPath(import.meta.url));
const migDir = join(here, "..", "db", "migrations");
const migrations = readdirSync(migDir)
  .filter((f) => f.endsWith(".sql"))
  .map((name) => ({ name, sql: readFileSync(join(migDir, name), "utf8") }));

const sql = postgres(tooling, { max: 1, ssl: getDbSslOption(tooling), onnotice: () => {} });
try {
  console.log("1/2 Migration anwenden …");
  const db = {
    exec: (s) => sql.unsafe(s),
    query: async (s, p = []) => ({ rows: await sql.unsafe(s, p) }),
  };
  const res = await runMigrations(db, migrations, { log: (m) => console.log("   " + m) });
  if (res.drift.length) {
    console.error("   DRIFT erkannt:", res.drift.join(", "));
    process.exitCode = 2;
  }
  console.log(`   neu: ${res.applied.length} · übersprungen: ${res.skipped.length}`);

  console.log(`2/2 app_user-Login aktivieren (Rolle ${appRole}, lokales Dev-Passwort) …`);
  await sql.unsafe(`alter role ${ident(appRole)} with login password ${literal(appPw)}`);
  console.log("   ok");
} finally {
  await sql.end();
}

console.log("Fertig ✓ — lokale Dev-DB bereit (Migration + app_user-Login).");
