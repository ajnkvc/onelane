import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { accountTypEnum } from "./enums";

/**
 * Modul „identity" — Login-Personen & Plattformrollen.
 * Spiegelt die kanonische SQL-Migration (db/migrations/0000_*). MASSGEBLICH ist
 * die Migration (RLS/Policies/Trigger/Constraints liegen dort).
 */

// users.id = auth.users.id (gespiegelt, Supabase). KEIN Default.
export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull(),
  telefon: text("telefon"),
  vorname: text("vorname"),
  nachname: text("nachname"),
  accountTyp: accountTypEnum("account_typ").notNull().default("student"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastLogin: timestamp("last_login", { withTimezone: true }),
});

// Interne Plattformrollen (admin/support/moderator/editor) — über
// app.has_platform_role(...) ausgewertet. KEINE DB-Login-Rollen.
export const platformRoleAssignments = pgTable("platform_role_assignments", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role").$type<"admin" | "support" | "moderator" | "editor">().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
