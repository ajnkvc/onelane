import "server-only";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getServerEnv } from "@/server/config/env";
import { getDbSslOption } from "@/server/config/db-ssl";

/**
 * client.ts — die einzige Stelle, die eine DB-Verbindung herstellt.
 * ----------------------------------------------------------------------------
 * Reguläre Requests verbinden sich DIREKT als DB-Rolle `app_user`
 * (RLS-pflichtig, kein BYPASSRLS, kein Owner) — die Zugangsdaten stehen in
 * DATABASE_URL (env.ts). KEIN service_role / postgres-Superuser im Request-Pfad.
 *
 * Die Verbindung wird LAZY aufgebaut (erst beim ersten echten Datenzugriff),
 * damit Builds ohne gesetzte Secrets nicht scheitern.
 *
 * `prepare: false` ist für den Supabase-Transaction-Pooler (PgBouncer/Supavisor)
 * nötig, da Prepared Statements dort nicht zuverlässig über gepoolte Verbindungen
 * funktionieren. Der RLS-Kontext wird pro Transaktion gesetzt — siehe rls-context.ts.
 */
let sql: ReturnType<typeof postgres> | null = null;
let db: PostgresJsDatabase<Record<string, never>> | null = null;

function getSql(): ReturnType<typeof postgres> {
  if (!sql) {
    const { DATABASE_URL } = getServerEnv();
    sql = postgres(DATABASE_URL, {
      max: 10,
      prepare: false,
      // DSN übergeben → TLS wird an den Ziel-Host gekoppelt (Remote-Host ⇒ TLS Pflicht).
      ssl: getDbSslOption(DATABASE_URL),
    });
  }
  return sql;
}

/**
 * Liefert die (lazy initialisierte) Drizzle-Instanz für die `app_user`-Rolle.
 * @internal — NUR innerhalb von src/server/dal/ verwenden (rls-context). Wird
 * bewusst NICHT über das DAL-Barrel (dal/index.ts) exportiert, damit der Request-
 * Pfad ausschließlich über withUserContext/withAnonContext läuft (RLS-Kontext).
 */
export function getDb(): PostgresJsDatabase<Record<string, never>> {
  if (!db) {
    db = drizzle(getSql());
  }
  return db;
}
