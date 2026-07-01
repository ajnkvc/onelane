import {
  pgTable, uuid, text, timestamp, numeric, integer, boolean, jsonb, date,
} from "drizzle-orm/pg-core";
import { drivingSchools } from "./schools";

/**
 * Modul „monetization" — Angebotskatalog & gebuchte Pakete (vorbereitet).
 * Spiegelt die kanonische SQL-Migration.
 */
export const subscriptionPlans = pgTable("subscription_plans", {
  id: uuid("id").defaultRandom().primaryKey(),
  typ: text("typ").$type<"portal_listing" | "saas">().notNull(),
  name: text("name").notNull(),
  preisProMonat: numeric("preis_pro_monat", { precision: 10, scale: 2 }),
  abrechnungseinheit: text("abrechnungseinheit").$type<"pro_schule" | "pro_fahrlehrer">(),
  featureListe: jsonb("feature_liste"),
  aktiv: boolean("aktiv").notNull().default(true),
});

export const schoolSubscriptions = pgTable("school_subscriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  schoolId: uuid("school_id").notNull().references(() => drivingSchools.id, { onDelete: "cascade" }),
  planId: uuid("plan_id").notNull().references(() => subscriptionPlans.id),
  anzahlLizenzen: integer("anzahl_lizenzen").notNull().default(1),
  status: text("status").$type<"active" | "paused" | "cancelled">().notNull().default("active"),
  startDatum: date("start_datum"),
  stripeSubscriptionRef: text("stripe_subscription_ref"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
