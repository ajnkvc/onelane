import "server-only";
import { z } from "zod";

/**
 * env.ts — die EINZIGE reguläre Ladestelle für serverseitige SECRETS.
 * ----------------------------------------------------------------------------
 * Regeln (siehe SECURITY.md):
 *  - Nur Server-Code liest Secrets. Diese Datei ist `server-only`.
 *  - Validierung über Zod: fehlt/ungültig eine Variable, schlägt der erste
 *    Zugriff (getServerEnv) hart fehl — kein stilles Weiterlaufen.
 *  - Es werden NIE Klartext-Werte geloggt, nur die NAMEN betroffener Variablen.
 *
 * ÖFFENTLICHE Werte (`NEXT_PUBLIC_*`) sind KEINE Secrets und liegen NICHT hier,
 * sondern zentral in src/lib/public-config.ts (auch im Client/Edge nutzbar).
 *
 * Erhöhte Rechte (service_role, Migrations-/Import-Verbindung) liegen ebenfalls
 * NICHT hier, sondern getrennt in config/tooling.ts.
 */
/**
 * Bekannte PRIVILEGIERTE DB-Rollen, die im REGULÄREN Request-Pfad NIEMALS erlaubt sind
 * (sie umgehen RLS). Der Request-Pfad muss als `app_user` laufen. Dies ist eine frühe
 * Config-Schranke (fail-fast); die harte Laufzeit-Garantie liefert zusätzlich
 * assertSafeRuntimeRole() (dal/rls-context.ts), das die TATSÄCHLICHE DB-Rolle prüft.
 */
const PRIVILEGED_DB_ROLES = new Set([
  "postgres",
  "supabase_admin",
  "supabase_auth_admin",
  "supabase_storage_admin",
  "service_role",
  "app_owner",
  "owner",
  "root",
  "rdsadmin",
  "admin",
]);

/** Validiert, dass DATABASE_URL eine postgres(ql)-DSN mit nicht-privilegierter Rolle ist (F-022). */
function assertRequestDsn(dsn: string): void {
  let u: URL;
  try {
    u = new URL(dsn);
  } catch {
    throw new Error("DATABASE_URL ist keine gültige URL (erwartet postgres://app_user:…@host/db).");
  }
  if (u.protocol !== "postgres:" && u.protocol !== "postgresql:") {
    throw new Error("DATABASE_URL: nur postgres:// oder postgresql:// erlaubt.");
  }
  // Pooler-Varianten hängen an den Rollennamen einen Tenant an ("app_user.<ref>") → vor dem Punkt prüfen.
  const role = decodeURIComponent(u.username).split(".")[0].toLowerCase();
  if (!role) {
    throw new Error("DATABASE_URL: DB-Rolle (Username) fehlt — Request-Pfad muss app_user sein.");
  }
  if (PRIVILEGED_DB_ROLES.has(role)) {
    // KEIN Rohwert im Fehlertext (DSN enthält das Passwort).
    throw new Error(
      `DATABASE_URL nutzt eine privilegierte DB-Rolle ("${role}") — der Request-Pfad MUSS als app_user ` +
        "laufen (RLS-pflichtig, kein Owner/Superuser/service_role).",
    );
  }
}

const serverEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  /**
   * Reguläre Laufzeit-Verbindung als DB-Rolle `app_user`
   * (RLS-pflichtig, KEIN BYPASSRLS, KEIN Owner). Format: postgres://app_user:<passwort>@<host>:<port>/<db>
   */
  DATABASE_URL: z.string().min(1).superRefine((val, ctx) => {
    try {
      assertRequestDsn(val);
    } catch (e) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: e instanceof Error ? e.message : "ungültige DATABASE_URL" });
    }
  }),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | null = null;

/**
 * Liefert die validierte Server-Umgebung (Secrets). Wirft beim ersten Aufruf,
 * wenn etwas fehlt/ungültig ist. Wird LAZY aufgerufen (nicht beim Import), damit
 * Builds ohne gesetzte Secrets nicht scheitern.
 */
export function getServerEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const keys = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(
      `Ungültige oder fehlende Server-Umgebungsvariablen: ${keys}. ` +
        `Bitte .env anhand von .env.example vervollständigen.`,
    );
  }
  cached = parsed.data;
  return cached;
}
