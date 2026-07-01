import { pgTable, pgView, uuid, text, timestamp, integer } from "drizzle-orm/pg-core";
import { users } from "./identity";
import { drivingSchools, instructors } from "./schools";
import { enrollments } from "./enrollments";

/**
 * Modul „content" — Portal-Inhalte: Bewertungen & Blog.
 * Spiegelt die kanonische SQL-Migration (Bindung/Moderation/Trigger dort).
 */

// Bewertung NUR nach verifiziertem Enrollment (enrollment_id NOT NULL).
export const reviews = pgTable("reviews", {
  id: uuid("id").defaultRandom().primaryKey(),
  schoolId: uuid("school_id").notNull().references(() => drivingSchools.id, { onDelete: "cascade" }),
  instructorId: uuid("instructor_id").references(() => instructors.id),
  enrollmentId: uuid("enrollment_id").notNull().references(() => enrollments.id),
  authorUserId: uuid("author_user_id").notNull().references(() => users.id),
  rating: integer("rating").notNull(),
  text: text("text"),
  moderationStatus: text("moderation_status").$type<"pending" | "published" | "rejected">().notNull().default("pending"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  moderatedByUserId: uuid("moderated_by_user_id").references(() => users.id),
  moderatedAt: timestamp("moderated_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const blogPosts = pgTable("blog_posts", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull(),
  content: text("content"),
  metaDescription: text("meta_description"),
  authorUserId: uuid("author_user_id").references(() => users.id),
  status: text("status").$type<"draft" | "published">().notNull().default("draft"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Öffentliche View für Bewertungen (Spalten-Minimierung, Datenschutz). Enthält KEINE
 * identifizierenden Spalten (author_user_id, enrollment_id, moderated_by_user_id).
 * Existiert in der Migration mit `security_invoker = true` (RLS bleibt aktiv).
 */
export const reviewsPublic = pgView("reviews_public", {
  id: uuid("id"),
  schoolId: uuid("school_id"),
  instructorId: uuid("instructor_id"),
  rating: integer("rating"),
  text: text("text"),
  moderationStatus: text("moderation_status"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }),
}).existing();
