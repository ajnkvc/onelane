import "server-only";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getServerEnv } from "@/server/config/env";
import { getDbSslOption } from "@/server/config/db-ssl";
import { isProduction } from "@/lib/public-config";

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
type DbHandle = {
  sql: ReturnType<typeof postgres>;
  db: PostgresJsDatabase<Record<string, never>>;
};

/** Produktion: Prozess lebt lang, Module werden nicht neu instanziiert → Modul-Scope. */
let moduleHandle: DbHandle | null = null;

/**
 * Dev/HMR: Der Next-Dev-Server (Turbopack) instanziiert den Server-Modulgraphen bei
 * jedem Recompile neu — ein NUR modul-lokaler Cache erzeugt dann pro Recompile einen
 * NEUEN Pool, dessen alte Verbindungen offen bleiben (beobachtet 2026-07-03: 97 idle
 * app_user-Verbindungen bei max_connections=100 → alle /app-Routen 500). Außerhalb
 * der Produktion wird der Pool deshalb an globalThis verankert (überlebt die
 * Neuinstanziierung); zusätzlich räumen idle_timeout/max_lifetime Verbindungen ab,
 * falls doch einmal ein Pool verwaist. Produktion bleibt bewusst im Modul-Scope.
 */
const devGlobal = globalThis as typeof globalThis & { __onelanePgPool?: DbHandle };

function createHandle(): DbHandle {
  const { DATABASE_URL } = getServerEnv();
  const sql = postgres(DATABASE_URL, {
    max: 10,
    prepare: false,
    // DSN übergeben → TLS wird an den Ziel-Host gekoppelt (Remote-Host ⇒ TLS Pflicht).
    ssl: getDbSslOption(DATABASE_URL),
    // Nur Dev: zeitliche Schutzlimits (Sekunden) gegen verwaiste HMR-Pools.
    ...(isProduction() ? {} : { idle_timeout: 20, max_lifetime: 60 * 30 }),
  });
  return { sql, db: drizzle(sql) };
}

/**
 * Liefert die (lazy initialisierte) Drizzle-Instanz für die `app_user`-Rolle.
 * @internal — NUR innerhalb von src/server/dal/ verwenden (rls-context). Wird
 * bewusst NICHT über das DAL-Barrel (dal/index.ts) exportiert, damit der Request-
 * Pfad ausschließlich über withUserContext/withAnonContext läuft (RLS-Kontext).
 */
export function getDb(): PostgresJsDatabase<Record<string, never>> {
  if (isProduction()) {
    moduleHandle ??= createHandle();
    return moduleHandle.db;
  }
  devGlobal.__onelanePgPool ??= createHandle();
  return devGlobal.__onelanePgPool.db;
}
