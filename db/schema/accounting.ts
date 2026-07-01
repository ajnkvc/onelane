import {
  pgTable, uuid, text, timestamp, integer, date,
} from "drizzle-orm/pg-core";
import { users } from "./identity";
import { drivingSchools } from "./schools";
import { invoices } from "./enrollments";

/**
 * Modul „accounting" — DATEV-Export-Läufe & enthaltene Rechnungen (vorbereitet).
 * Spiegelt die kanonische SQL-Migration. file_ref opaque/privat.
 */
export const accountingExports = pgTable("accounting_exports", {
  id: uuid("id").defaultRandom().primaryKey(),
  schoolId: uuid("school_id").references(() => drivingSchools.id),
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  format: text("format").$type<"datev_buchungsstapel">().notNull(),
  formatVersion: text("format_version"),
  status: text("status").$type<"created" | "exported" | "failed">().notNull().default("created"),
  recordCount: integer("record_count").notNull().default(0),
  contentHash: text("content_hash"),
  fileRef: text("file_ref"),
  createdByUserId: uuid("created_by_user_id").references(() => users.id),
  exportedAt: timestamp("exported_at", { withTimezone: true }),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const accountingExportItems = pgTable("accounting_export_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  exportId: uuid("export_id").notNull().references(() => accountingExports.id, { onDelete: "cascade" }),
  invoiceId: uuid("invoice_id").notNull().references(() => invoices.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
