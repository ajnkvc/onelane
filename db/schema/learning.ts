import {
  pgTable, uuid, text, timestamp, boolean, numeric,
} from "drizzle-orm/pg-core";
import { users } from "./identity";
import { drivingSchools } from "./schools";
import { enrollments } from "./enrollments";

/**
 * Modul „learning" — Online-Theorie, Live-Unterricht, Fragenkataloge, Fortschritt
 * (vorbereitet, Phase 2/3). Spiegelt die kanonische SQL-Migration. Opaque/private
 * Referenzen (media_ref/stream_ref) speichern KEINE öffentlichen URLs/Tokens/Secrets.
 */
export const questionCatalogs = pgTable("question_catalogs", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  fuehrerscheinklassen: text("fuehrerscheinklassen").array().notNull().default([]),
  aktiv: boolean("aktiv").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const theoryLessons = pgTable("theory_lessons", {
  id: uuid("id").defaultRandom().primaryKey(),
  scope: text("scope").$type<"platform" | "school">().notNull(),
  schoolId: uuid("school_id").references(() => drivingSchools.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  beschreibung: text("beschreibung"),
  contentType: text("content_type").$type<"video" | "ai" | "document">().notNull(),
  mediaRef: text("media_ref"),
  fuehrerscheinklassen: text("fuehrerscheinklassen").array().notNull().default([]),
  status: text("status").$type<"draft" | "published">().notNull().default("draft"),
  reviewStatus: text("review_status").$type<"pending" | "approved" | "rejected">(),
  createdByUserId: uuid("created_by_user_id").references(() => users.id),
  publishedByUserId: uuid("published_by_user_id").references(() => users.id),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const studentProgress = pgTable("student_progress", {
  id: uuid("id").defaultRandom().primaryKey(),
  studentUserId: uuid("student_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  enrollmentId: uuid("enrollment_id").notNull().references(() => enrollments.id, { onDelete: "cascade" }),
  lessonId: uuid("lesson_id").references(() => theoryLessons.id),
  catalogId: uuid("catalog_id").references(() => questionCatalogs.id),
  status: text("status").$type<"not_started" | "in_progress" | "completed">().notNull().default("not_started"),
  score: numeric("score", { precision: 5, scale: 2 }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const liveSessions = pgTable("live_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  schoolId: uuid("school_id").notNull().references(() => drivingSchools.id, { onDelete: "cascade" }),
  hostUserId: uuid("host_user_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  scheduledStart: timestamp("scheduled_start", { withTimezone: true }).notNull(),
  scheduledEnd: timestamp("scheduled_end", { withTimezone: true }).notNull(),
  status: text("status").$type<"scheduled" | "live" | "ended" | "cancelled">().notNull().default("scheduled"),
  streamRef: text("stream_ref"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const liveSessionQuestions = pgTable("live_session_questions", {
  id: uuid("id").defaultRandom().primaryKey(),
  liveSessionId: uuid("live_session_id").notNull().references(() => liveSessions.id, { onDelete: "cascade" }),
  enrollmentId: uuid("enrollment_id").notNull().references(() => enrollments.id),
  studentUserId: uuid("student_user_id").notNull().references(() => users.id),
  frage: text("frage").notNull(),
  beantwortet: boolean("beantwortet").notNull().default(false),
  status: text("status").$type<"visible" | "hidden" | "removed">().notNull().default("visible"),
  hiddenAt: timestamp("hidden_at", { withTimezone: true }),
  hiddenByUserId: uuid("hidden_by_user_id").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
