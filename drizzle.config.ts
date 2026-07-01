import { defineConfig } from "drizzle-kit";

/**
 * drizzle.config.ts — Konfiguration für das DB-Tooling (Migrationen).
 * ----------------------------------------------------------------------------
 * Migrationen laufen über den ERHÖHTEN Tooling-Pfad (Owner/Migrations-Rolle),
 * nicht über die reguläre `app_user`-Verbindung. Die Zugangsdaten kommen aus
 * TOOLING_DATABASE_URL (siehe src/server/config/tooling.ts).
 *
 * `dialect: "postgresql"` + reine SQL-Ausgabe → kein Lock-in.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./db/schema/index.ts",
  out: "./db/migrations",
  dbCredentials: {
    url: process.env.TOOLING_DATABASE_URL ?? "",
  },
  strict: true,
  verbose: true,
});
