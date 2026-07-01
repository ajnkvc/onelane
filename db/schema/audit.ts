import { pgTable, uuid, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { users } from "./identity";

/**
 * Modul „audit" — append-only Sicherheits-/Audit-Ereignisse.
 * Spiegelt die kanonische SQL-Migration (kein UPDATE/DELETE, ohne PII/Secrets).
 */
export const securityEvents = pgTable("security_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  actorUserId: uuid("actor_user_id").references(() => users.id),
  eventType: text("event_type").notNull(),
  // Erhöhter Pfad (Migration 0017): verifizierter Initiator + Korrelation der attempt/success/
  // failed-Phasen eines withElevatedAudit-Aufrufs.
  initiatorType: text("initiator_type"),
  correlationId: uuid("correlation_id"),
  targetTable: text("target_table"),
  targetId: uuid("target_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
