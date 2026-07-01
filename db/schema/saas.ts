import { pgTable, uuid, boolean, date, time, smallint } from "drizzle-orm/pg-core";
import { instructors } from "./schools";

/**
 * Modul „saas" — Fahrlehrer-Verfügbarkeit für anonymisierte Slot-Berechnung
 * (vorbereitet). Spiegelt die kanonische SQL-Migration.
 */
export const instructorAvailability = pgTable("instructor_availability", {
  id: uuid("id").defaultRandom().primaryKey(),
  instructorId: uuid("instructor_id").notNull().references(() => instructors.id, { onDelete: "cascade" }),
  datum: date("datum"),
  wochentag: smallint("wochentag"),
  von: time("von"),
  bis: time("bis"),
  istBlockiert: boolean("ist_blockiert").notNull().default(false),
});
