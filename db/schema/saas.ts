import { pgTable, uuid, boolean, date, time, smallint, text, timestamp } from "drizzle-orm/pg-core";
import { instructors, drivingSchools } from "./schools";
import { users } from "./identity";

/**
 * Modul „saas" — Fahrlehrer-Verfügbarkeit für anonymisierte Slot-Berechnung
 * (vorbereitet) + Zeiterfassung (0029). Spiegelt die kanonische SQL-Migration.
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

// Zeiterfassung je Schul-Mitglied (0029). RLS: Mitglied schreibt/liest eigene
// Einträge, inhaber+verwaltung lesen die Schule; Kategorie-Allowlist + Notiz-Cap
// liegen als CHECKs in der Migration.
export const timeEntries = pgTable("time_entries", {
  id: uuid("id").defaultRandom().primaryKey(),
  schoolId: uuid("school_id").notNull().references(() => drivingSchools.id, { onDelete: "restrict" }),
  memberUserId: uuid("member_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  startAt: timestamp("start_at", { withTimezone: true }).notNull(),
  endeAt: timestamp("ende_at", { withTimezone: true }),
  kategorie: text("kategorie")
    .$type<"fahrstunde" | "theorie" | "buero" | "verwaltung" | "sonstiges">()
    .notNull()
    .default("buero"),
  notiz: text("notiz"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
