import {
  pgTable, uuid, text, timestamp, boolean, smallint, integer, numeric, jsonb,
} from "drizzle-orm/pg-core";
import { users } from "./identity";
import { drivingSchools, schoolBrands } from "./schools";

/**
 * Modul „ingestion" — FUNDAMENT der Fahrschul-Daten-Ingestion (Phase E / 008a).
 * Spiegelt die kanonische SQL-Migration 0002 (MASSGEBLICH dort: RLS, Checks,
 * Trigger, Grants). Alle Tabellen sind DENY-BY-DEFAULT und nur für die interne
 * Plattformrolle `admin` (app_user-Pfad) sichtbar; der erhöhte Tooling-Pfad
 * (Owner) schreibt sie RLS-frei und auditiert über import_run + security_events.
 */

// Lauf-Protokoll (Audit jeder erhöhten Ingestion).
export const importRun = pgTable("import_run", {
  id: uuid("id").defaultRandom().primaryKey(),
  source: text("source").notNull(),
  sourceVersion: text("source_version"),
  query: text("query"),
  params: jsonb("params"),
  status: text("status").$type<"running" | "completed" | "failed" | "aborted">().notNull().default("running"),
  counts: jsonb("counts"),
  errorSummary: text("error_summary"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});

// Roh-/Kandidatendaten je Quell-Objekt (kein Blind-Upsert in canonical Tabellen).
export const importStaging = pgTable("import_staging", {
  id: uuid("id").defaultRandom().primaryKey(),
  runId: uuid("run_id").references(() => importRun.id, { onDelete: "set null" }),
  source: text("source").notNull(),
  sourceRef: text("source_ref").notNull(),
  sourceUrl: text("source_url"),
  raw: jsonb("raw"),
  normalized: jsonb("normalized"),
  contentHash: text("content_hash"),
  status: text("status").$type<
    "pending" | "matched" | "imported" | "excluded" | "review" | "rejected"
  >().notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// BELEGPFLICHT: aktuelle Herkunft + Stand je canonical Feld.
export const fieldProvenance = pgTable("field_provenance", {
  id: uuid("id").defaultRandom().primaryKey(),
  targetTable: text("target_table").$type<"driving_schools" | "school_profiles">().notNull(),
  targetId: uuid("target_id").notNull(),
  field: text("field").notNull(),
  valueHash: text("value_hash"),
  source: text("source").$type<
    "osm" | "school_website" | "impressum" | "manual_review" | "search_discovery"
  >().notNull(),
  sourceUrl: text("source_url"),
  sourceRef: text("source_ref"),
  observedAt: timestamp("observed_at", { withTimezone: true }),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  confidence: numeric("confidence", { precision: 4, scale: 3 }),
  decidedBy: uuid("decided_by").references(() => users.id),
  runId: uuid("run_id").references(() => importRun.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Manuelle Prüfung — Unsicheres/Konflikte gehen NICHT automatisch live.
export const importReviewQueue = pgTable("import_review_queue", {
  id: uuid("id").defaultRandom().primaryKey(),
  runId: uuid("run_id").references(() => importRun.id, { onDelete: "set null" }),
  stagingId: uuid("staging_id").references(() => importStaging.id, { onDelete: "cascade" }),
  schoolId: uuid("school_id").references(() => drivingSchools.id, { onDelete: "cascade" }),
  reasons: text("reasons").array().notNull().default([]),
  conflictFields: text("conflict_fields").array().notNull().default([]),
  proposed: jsonb("proposed"),
  existing: jsonb("existing"),
  priority: smallint("priority").notNull().default(0),
  status: text("status").$type<"pending" | "approved" | "rejected" | "deferred">().notNull().default("pending"),
  reviewerUserId: uuid("reviewer_user_id").references(() => users.id),
  decision: text("decision"),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Dedup-Entscheidung — Filialen sind keine Duplikate (auditierbar).
export const dedupeDecision = pgTable("dedupe_decision", {
  id: uuid("id").defaultRandom().primaryKey(),
  runId: uuid("run_id").references(() => importRun.id, { onDelete: "set null" }),
  stagingId: uuid("staging_id").references(() => importStaging.id, { onDelete: "cascade" }),
  canonicalSchoolId: uuid("canonical_school_id").references(() => drivingSchools.id, { onDelete: "set null" }),
  decision: text("decision").$type<
    "merged" | "not_duplicate" | "separate_branch" | "needs_review"
  >().notNull(),
  score: numeric("score", { precision: 4, scale: 3 }),
  matchFactors: jsonb("match_factors"),
  decidedBy: uuid("decided_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Brand ↔ Domain (008c): idempotente Brand-Identität je verifizierter Domain.
export const schoolBrandDomains = pgTable("school_brand_domains", {
  id: uuid("id").defaultRandom().primaryKey(),
  brandId: uuid("brand_id").notNull().references(() => schoolBrands.id, { onDelete: "cascade" }),
  domain: text("domain").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Fetch-Audit (008c): je abgerufener URL; KEIN HTML-Body/Kontakt-Klartext.
export const importFetchLog = pgTable("import_fetch_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  runId: uuid("run_id").references(() => importRun.id, { onDelete: "set null" }),
  sourceRef: text("source_ref"),
  url: text("url").notNull(),
  finalUrl: text("final_url"),
  robotsDecision: text("robots_decision").$type<
    "allowed" | "disallowed" | "absent" | "unreachable" | "malformed"
  >(),
  httpStatus: integer("http_status"),
  contentHash: text("content_hash"),
  errorCode: text("error_code"),
  errorMessage: text("error_message"),
  durationMs: integer("duration_ms"),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
});

// Harte Ausschlüsse VOR Match/Publish + DSGVO-Zustände (opt_out/takedown/legal_hold).
export const importExclusion = pgTable("import_exclusion", {
  id: uuid("id").defaultRandom().primaryKey(),
  typ: text("typ").$type<"name" | "domain" | "source" | "pattern">().notNull(),
  value: text("value").notNull(),
  reason: text("reason").$type<
    "excluded_brand" | "opt_out" | "takedown" | "legal_hold" | "claimed_conflict" | "other"
  >().notNull(),
  notiz: text("notiz"),
  active: boolean("active").notNull().default(true),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
