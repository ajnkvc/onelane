import postgres from "postgres";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { sql as dsql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getToolingDbEnv } from "@/server/config/tooling";
import { getDbSslOption } from "@/server/config/db-ssl";
import {
  type ElevatedAudit,
  buildBaseMetadata,
  phaseMetadataJson,
  safeErrorClass,
  validateElevatedAudit,
} from "./elevated-audit";

/**
 * elevated.ts — ERHÖHTER DB-Pfad (umgeht RLS).
 * ============================================================================
 * NUR für Tooling/Webhooks/Wartung (z. B. CSV-Import, Stripe-Webhooks), NIEMALS
 * im regulären Request-Pfad. Verbindet über TOOLING_DATABASE_URL (Owner-/Service-
 * Rolle), die RLS umgeht. Jede Nutzung ist in `security_events` zu protokollieren.
 *
 * WICHTIG (Re-Audit Block 4): `withElevatedAudit` ist Audit, KEINE Autorisierung.
 * AuthZ/Signaturprüfung (z. B. Stripe-Webhook-Signatur, Admin-Rollencheck) MUSS am
 * Aufrufer VOR diesem Wrapper erfolgen; gebaut werden domänenspezifische Funktionen
 * (z. B. runVerifiedStripeWebhook), die intern auditieren. ESLint beschränkt den Import
 * dieses Wrappers auf den Server-/Tooling-Layer.
 *
 * Bewusst KEIN `server-only`-Import, damit der Pfad auch aus tsx-Scripts nutzbar ist.
 * Lazy initialisiert (verbindet erst beim ersten Zugriff). `prepare: false` für den
 * Supabase-Transaction-Pooler.
 */
let sql: ReturnType<typeof postgres> | null = null;
let db: PostgresJsDatabase<Record<string, never>> | null = null;

/**
 * Liefert die (lazy initialisierte) erhöhte Drizzle-Instanz. ACHTUNG: umgeht RLS —
 * nur in klar abgegrenzten, protokollierten Tooling-/Webhook-Pfaden verwenden.
 */
export function getElevatedDb(): PostgresJsDatabase<Record<string, never>> {
  if (!db) {
    const { TOOLING_DATABASE_URL } = getToolingDbEnv();
    sql = postgres(TOOLING_DATABASE_URL, {
      max: 5,
      prepare: false,
      ssl: getDbSslOption(TOOLING_DATABASE_URL),
    });
    db = drizzle(sql);
  }
  return db;
}

/** Transaktions-Handle aus dem transaction()-Callback (erhöhter Pfad). */
type ElevatedTx = Parameters<
  Parameters<PostgresJsDatabase<Record<string, never>>["transaction"]>[0]
>[0];

export type { ElevatedAudit } from "./elevated-audit";

/**
 * Transaktions-lokale Schutzlimits für den erhöhten Pfad (F-052). Bewusst großzügiger als der
 * Request-Pfad (Webhooks/Wartung dürfen länger laufen), aber endlich — ein hängender Owner-Query
 * darf nicht unbegrenzt Locks/Pool-Verbindungen binden. Bulk-tsx-Tooling nutzt getElevatedDb()
 * direkt (ohne diesen Wrapper) und ist hiervon nicht betroffen.
 */
async function setElevatedGuards(tx: ElevatedTx): Promise<void> {
  await tx.execute(dsql`select
    set_config('statement_timeout', '60000', true),
    set_config('lock_timeout', '15000', true),
    set_config('idle_in_transaction_session_timeout', '60000', true)`);
}

/** Schreibt EIN security_events-System-Event (actor_user_id = NULL erzwingt der DB-Trigger). */
async function insertSecurityEvent(
  tx: ElevatedTx,
  audit: ElevatedAudit,
  correlationId: string,
  metaJson: string,
): Promise<void> {
  await tx.execute(dsql`
    insert into public.security_events
      (actor_user_id, event_type, initiator_type, correlation_id, target_table, target_id, metadata)
    values
      (null, ${audit.eventType}, ${audit.initiatorType}, ${correlationId}::uuid,
       ${audit.targetTable ?? null}, ${audit.targetId ?? null}, ${metaJson}::jsonb)
  `);
}

/**
 * withElevatedAudit — der EINZIGE sanktionierte Weg, den RLS-umgehenden Pfad aus
 * Request-/Webhook-Code zu nutzen. Schreibt drei korrelierte Audit-Phasen (SECURITY.md §8.1):
 *
 *   1) attempt  — DAUERHAFT in EIGENER Transaktion VOR der Arbeit (überlebt Rollback/Fehler);
 *                 so bleibt kein erhöhter Zugriffsversuch unprotokolliert (F-013).
 *   2) success  — gekoppelt mit der Arbeit in DERSELBEN Transaktion (commit ⇔ Arbeit committet).
 *   3) failed   — DAUERHAFT in EIGENER Transaktion im Fehlerfall, nur mit Fehlerklasse (kein
 *                 sensibler Fehlertext, F-055); der Originalfehler wird unverändert weitergeworfen.
 *
 * Alle drei Phasen teilen eine correlation_id. Eingaben werden fail-closed validiert und
 * Metadaten redigiert (elevated-audit.ts), BEVOR eine DB-Verbindung aufgebaut wird.
 *
 * Hinweis: `getElevatedDb()` bleibt für tsx-Tooling-Scripts (Seed/Import) nutzbar; im
 * Anwendungscode ist ausschließlich dieser Wrapper zu verwenden.
 */
export async function withElevatedAudit<T>(
  audit: ElevatedAudit,
  work: (tx: ElevatedTx) => Promise<T>,
): Promise<T> {
  validateElevatedAudit(audit);
  const base = buildBaseMetadata(audit);
  // Phasen-JSONs früh bauen (Größenprüfung) — noch ohne DB-Verbindung.
  const attemptJson = phaseMetadataJson(base, "attempt");
  const successJson = phaseMetadataJson(base, "success");
  const correlationId = randomUUID();
  const database = getElevatedDb();

  // 1) Durable ATTEMPT (eigene Transaktion).
  await database.transaction(async (tx) => {
    await setElevatedGuards(tx);
    await insertSecurityEvent(tx, audit, correlationId, attemptJson);
  });

  // 2) Arbeit + gekoppeltes SUCCESS-Event (atomar).
  try {
    return await database.transaction(async (tx) => {
      await setElevatedGuards(tx);
      const result = await work(tx);
      await insertSecurityEvent(tx, audit, correlationId, successJson);
      return result;
    });
  } catch (err) {
    // 3) Durable FAILURE (eigene Transaktion) — nur Fehlerklasse, kein sensibler Text.
    try {
      const failedJson = phaseMetadataJson(base, "failed", { error_class: safeErrorClass(err) });
      await database.transaction(async (tx) => {
        await setElevatedGuards(tx);
        await insertSecurityEvent(tx, audit, correlationId, failedJson);
      });
    } catch {
      // Audit-Schreiben im Fehlerpfad darf den Originalfehler NICHT verschlucken.
    }
    throw err;
  }
}
