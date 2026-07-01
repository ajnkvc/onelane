import { pgTable, uuid, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { users } from "./identity";
import { enrollments } from "./enrollments";

/**
 * Modul „communication" — Chat Schüler ↔ Fahrlehrer (vorbereitet).
 * Spiegelt die kanonische SQL-Migration.
 */
export const messages = pgTable("messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  vonUserId: uuid("von_user_id").notNull().references(() => users.id),
  anUserId: uuid("an_user_id").notNull().references(() => users.id),
  enrollmentId: uuid("enrollment_id").references(() => enrollments.id),
  inhalt: text("inhalt"),
  gelesen: boolean("gelesen").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
