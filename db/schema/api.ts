import { pgTable, uuid, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { users } from "./identity";
import { drivingSchools } from "./schools";

/**
 * Modul „api" — Zugangs-Fundament für REST + MCP (0029) und Feature-Flags.
 * Spiegelt die kanonische SQL-Migration; RLS/Policies/Spalten-Grants/CHECKs
 * (Scope-/Status-/Event-Allowlists, sha256-Formate) liegen AUSSCHLIESSLICH dort.
 * Key-/Secret-Material existiert NIE im Klartext (nur sha256-Hashes; key_hash/
 * secret_hash sind für app_user zusätzlich per Spalten-Grant unsichtbar).
 */
export const apiPartners = pgTable("api_partners", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  status: text("status").$type<"aktiv" | "pausiert" | "beendet">().notNull().default("aktiv"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const apiPartnerMembers = pgTable("api_partner_members", {
  id: uuid("id").defaultRandom().primaryKey(),
  partnerId: uuid("partner_id").notNull().references(() => apiPartners.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const apiKeys = pgTable("api_keys", {
  id: uuid("id").defaultRandom().primaryKey(),
  partnerId: uuid("partner_id").notNull().references(() => apiPartners.id, { onDelete: "cascade" }),
  keyHash: text("key_hash").notNull(), // sha256(hex) — NIE Klartext
  prefix: text("prefix").notNull(), // nur Identifikation in UIs
  scopes: text("scopes").array().notNull().default([]), // Allowlist: mcp | rest_read
  status: text("status").$type<"aktiv" | "rotiert" | "widerrufen">().notNull().default("aktiv"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  rotatedAt: timestamp("rotated_at", { withTimezone: true }),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Persistente Idempotenz für /api/v1 (deny-by-default; Zugriff nur erhöhter Pfad).
export const apiIdempotency = pgTable("api_idempotency", {
  id: uuid("id").defaultRandom().primaryKey(),
  keyHash: text("key_hash").notNull(),
  endpoint: text("endpoint").notNull(),
  responseHash: text("response_hash"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(), // TTL
});

export const webhookSubscriptions = pgTable("webhook_subscriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  partnerId: uuid("partner_id").notNull().references(() => apiPartners.id, { onDelete: "cascade" }),
  url: text("url").notNull(), // https-Pflicht (CHECK)
  events: text("events").array().notNull().default([]), // Event-Allowlist (CHECK)
  secretHash: text("secret_hash").notNull(), // sha256(hex) — NIE Klartext
  status: text("status").$type<"aktiv" | "pausiert">().notNull().default("aktiv"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Feature-Flags (0029): global oder je Schule; Key-Allowlist (derzeit nur 'pay').
// RLS: lesen authentifizierte gemäß Scope, schreiben nur admin.
export const featureFlags = pgTable("feature_flags", {
  id: uuid("id").defaultRandom().primaryKey(),
  scope: text("scope").$type<"global" | "school">().notNull(),
  schoolId: uuid("school_id").references(() => drivingSchools.id, { onDelete: "cascade" }),
  key: text("key").$type<"pay">().notNull(),
  aktiv: boolean("aktiv").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
