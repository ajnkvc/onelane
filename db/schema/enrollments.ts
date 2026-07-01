import {
  pgTable, uuid, text, timestamp, numeric, boolean, jsonb,
} from "drizzle-orm/pg-core";
import { users } from "./identity";
import { drivingSchools, instructors } from "./schools";

/**
 * Modul „enrollments" — die Brücke Portal → SaaS → App (eine Wahrheit) plus
 * Termine und Rechnungen. Spiegelt die kanonische SQL-Migration.
 */

export const enrollments = pgTable("enrollments", {
  id: uuid("id").defaultRandom().primaryKey(),
  studentUserId: uuid("student_user_id").notNull().references(() => users.id),
  schoolId: uuid("school_id").notNull().references(() => drivingSchools.id),
  fuehrerscheinklasse: text("fuehrerscheinklasse"),
  status: text("status").$type<"pending" | "active" | "cancelled" | "completed">().notNull().default("pending"),
  vertragsabschlussDatum: timestamp("vertragsabschluss_datum", { withTimezone: true }),
  zahlungsmethode: text("zahlungsmethode").$type<"sepa" | "stripe_card">(),
  stripeCustomerRef: text("stripe_customer_ref"),
  sepaMandatRef: text("sepa_mandat_ref"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const appointments = pgTable("appointments", {
  id: uuid("id").defaultRandom().primaryKey(),
  enrollmentId: uuid("enrollment_id").notNull().references(() => enrollments.id, { onDelete: "cascade" }),
  instructorId: uuid("instructor_id").references(() => instructors.id),
  typ: text("typ").$type<"fahrstunde" | "theorie" | "fragenkatalog" | "pruefung">().notNull(),
  start: timestamp("start", { withTimezone: true }),
  ende: timestamp("ende", { withTimezone: true }),
  status: text("status").$type<"booked" | "cancelled" | "completed">().notNull().default("booked"),
  stornoFristBis: timestamp("storno_frist_bis", { withTimezone: true }),
  preis: numeric("preis", { precision: 10, scale: 2 }),
  abgerechnet: boolean("abgerechnet").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const invoices = pgTable("invoices", {
  id: uuid("id").defaultRandom().primaryKey(),
  enrollmentId: uuid("enrollment_id").notNull().references(() => enrollments.id),
  betrag: numeric("betrag", { precision: 10, scale: 2 }),
  positionen: jsonb("positionen"),
  status: text("status").$type<"draft" | "open" | "paid" | "failed" | "void">().notNull().default("draft"),
  stripePaymentRef: text("stripe_payment_ref"),
  erstelltAm: timestamp("erstellt_am", { withTimezone: true }).notNull().defaultNow(),
  bezahltAm: timestamp("bezahlt_am", { withTimezone: true }),
});
