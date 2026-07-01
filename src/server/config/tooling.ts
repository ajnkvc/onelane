/**
 * tooling.ts — getrennte, validierte Konfiguration für ERHÖHTE Rechte.
 * ----------------------------------------------------------------------------
 * Wird AUSSCHLIESSLICH von Server-Tooling genutzt (CSV-Import, Migrationen,
 * Wartung) — NIE vom regulären Request-Pfad. Hier liegen die Secrets, die RLS
 * umgehen können (service_role / Owner-Verbindung). Jede Nutzung ist zu
 * protokollieren (siehe SECURITY.md, Abschnitt 3).
 *
 * Bewusst getrennt von env.ts, damit "erhöht" auditierbar bleibt und nicht
 * versehentlich in den App-Request-Pfad gelangt. Diese Datei importiert KEIN
 * `server-only`, weil Tooling-Scripts außerhalb der Next.js-Laufzeit (via tsx)
 * laufen.
 */
import { z } from "zod";

/**
 * F-093: getrennte Loader je tatsächlichem Bedarf — kein Secret-Sprawl. Ein DB-only
 * Wartungs-/Audit-Pfad (z. B. erhöhte DB-Verbindung) darf NICHT an einem ungenutzten
 * Supabase-Secret scheitern. Jeder Loader ist fail-closed NUR für das, was er wirklich braucht.
 */
const toolingDbEnvSchema = z.object({
  /** Erhöhte DB-Verbindung (Owner/Migrations-Rolle) — umgeht RLS bewusst. */
  TOOLING_DATABASE_URL: z.string().min(1),
});
const supabaseSecretEnvSchema = z.object({
  /**
   * Supabase Secret Key (Secret!) — nur für Supabase-Admin/Webhook-Fälle. Neuer Name; der
   * Legacy `SUPABASE_SERVICE_ROLE_KEY` wird als Fallback akzeptiert
   * (Supabase deprecatet die alten Schlüssel bis Ende 2026).
   */
  SUPABASE_SECRET_KEY: z.string().min(1),
});

export type ToolingDbEnv = z.infer<typeof toolingDbEnvSchema>;
export type SupabaseSecretEnv = z.infer<typeof supabaseSecretEnvSchema>;

/** Leere Strings wie "nicht gesetzt" behandeln (damit der Fallback greift). */
const orUndefined = (value: string | undefined) => (value ? value : undefined);

function parseOrThrow<T>(schema: z.ZodType<T>, raw: unknown): T {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const keys = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Ungültige oder fehlende Tooling-Umgebungsvariablen: ${keys}.`);
  }
  return parsed.data;
}

/**
 * Erhöhte DB-Verbindung (DSN). Verlangt NUR TOOLING_DATABASE_URL — für DB-only Pfade
 * (erhöhter DAL, Migrationen, Import). Bewusst NICHT gecached; Scripts sind kurzlebig.
 */
export function getToolingDbEnv(): ToolingDbEnv {
  return parseOrThrow(toolingDbEnvSchema, {
    TOOLING_DATABASE_URL: process.env.TOOLING_DATABASE_URL,
  });
}

/** Supabase-Admin/Webhook-Secret. Verlangt NUR den Secret Key (neu bevorzugt, Legacy als Fallback). */
export function getSupabaseSecretEnv(): SupabaseSecretEnv {
  return parseOrThrow(supabaseSecretEnvSchema, {
    SUPABASE_SECRET_KEY:
      orUndefined(process.env.SUPABASE_SECRET_KEY) ??
      orUndefined(process.env.SUPABASE_SERVICE_ROLE_KEY),
  });
}
