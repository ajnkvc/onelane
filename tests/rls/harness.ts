import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * harness.ts — Test-Infrastruktur für RLS-Tests gegen ECHTES PostgreSQL.
 * ----------------------------------------------------------------------------
 * PGlite ist PostgreSQL 16 (WASM, in-process) — kein Mock, kein pgTAP. Wir spielen
 * die kanonische Migration ein und testen RLS real, indem wir pro Anfrage
 * `SET LOCAL ROLE app_user` setzen (RLS greift, da app_user weder Superuser noch
 * BYPASSRLS ist) und die verifizierten Claims via set_config übergeben.
 *
 * Wir steuern die Transaktion MANUELL (BEGIN + Rolle + Claims in EINEM simple-
 * protocol-Batch, dann die Arbeit, dann COMMIT/ROLLBACK). Das setzt den
 * transaktionslokalen GUC zuverlässig, bevor die erste Anweisung läuft.
 *
 * Seed-/Setup-Daten werden als Bootstrap-Rolle eingespielt (umgeht RLS, entspricht
 * dem erhöhten/Tooling-Pfad). Trigger feuern dabei trotzdem.
 */
const MIGRATIONS_DIR = fileURLToPath(new URL("../../db/migrations/", import.meta.url));

export type Claims = { sub: string; [key: string]: unknown };

/** Minimal-Interface zum Absetzen von Queries (PGlite oder Transaktion). */
export type Querier = Pick<PGlite, "query">;

/** Frische In-Memory-DB mit eingespielter Migration. */
export async function createTestDb(): Promise<PGlite> {
  const db = new PGlite();
  // ALLE Migrationen in Namensreihenfolge einspielen (0000, 0001, …) — sonst
  // fehlen neue Tabellen und Drift-/RLS-Tests wären inkonsistent.
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const f of files) {
    await db.exec(readFileSync(MIGRATIONS_DIR + f, "utf8"));
  }
  return db;
}

/**
 * Führt `fn` als `app_user` mit den gegebenen Claims aus (RLS aktiv).
 * claims=null → anonym (kein eingeloggter Nutzer).
 */
export async function asUser<T>(
  db: PGlite,
  claims: Claims | null,
  fn: (q: Querier) => Promise<T>,
): Promise<T> {
  const claimsJson = claims ? JSON.stringify(claims) : "";
  // Manuelle Transaktion: BEGIN + Rolle + transaktionslokale Claims (wie Produktion),
  // dann die Arbeit, dann COMMIT/ROLLBACK. `set local`/set_config(..., true) werden
  // beim Transaktionsende automatisch zurückgesetzt.
  await db.exec("begin");
  await db.exec("set local role app_user");
  await db.query("select set_config('request.jwt.claims', $1, true)", [claimsJson]);
  try {
    const result = await fn(db);
    await db.exec("commit");
    return result;
  } catch (error) {
    await db.exec("rollback");
    throw error;
  }
}

/** Kurzform: SELECT als app_user, gibt die Zeilen zurück. */
export async function selectAsUser<T = Record<string, unknown>>(
  db: PGlite,
  claims: Claims | null,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  return asUser(db, claims, async (q) => {
    const res = await q.query<T>(sql, params);
    return res.rows;
  });
}
