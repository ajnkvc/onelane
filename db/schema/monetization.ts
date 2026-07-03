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
  // Referenzdaten seit 0029: code 'start' (0 Cent) / 'os' (9900 Cent je
  // FAHRSCHULE — nicht je Standort! — + Seat-Preis; Aktion 3 Monate 4900).
  code: text("code"),
  name: text("name").notNull(),
  preisProMonat: numeric("preis_pro_monat", { precision: 10, scale: 2 }),
  // Preise als INTEGER-Cent (netto, je Monat) — kein Float (0029).
  preisMonatNettoCent: integer("preis_monat_netto_cent"),
  seatPreisMonatNettoCent: integer("seat_preis_monat_netto_cent"),
  // Einführungs-Aktion: reduzierte Grundgebühr für die ersten N Monate (0029).
  aktionPreisMonatNettoCent: integer("aktion_preis_monat_netto_cent"),
  aktionMonate: integer("aktion_monate"),
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
