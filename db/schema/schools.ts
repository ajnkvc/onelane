import {
  pgTable, pgView, uuid, text, timestamp, boolean, integer, bigint, numeric, doublePrecision,
  jsonb, smallint, time, date, uniqueIndex,
} from "drizzle-orm/pg-core";
import {
  landEnum, schoolMemberRolleEnum,
  vehicleGetriebeEnum, imageKategorieEnum, openingArtEnum, jobArtEnum,
} from "./enums";
import { users } from "./identity";

/**
 * Modul „schools" — Marke/Standort/Profil/Mitglieder/Billing/Fahrlehrer.
 * Spiegelt die kanonische SQL-Migration (MASSGEBLICH dort).
 */

export const schoolBrands = pgTable("school_brands", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  // Owner optional: portal-verwaltete (importierte) Firmen haben (noch) keinen
  // Owner; ein späterer Claim hängt ihn an (Migration 0002).
  inhaberUserId: uuid("inhaber_user_id").references(() => users.id),
  isPortalManaged: boolean("is_portal_managed").notNull().default(false),
  // Kundennummer der GRUPPE (Migration 0009); alle Standorte teilen sie.
  kundennummer: bigint("kundennummer", { mode: "number" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ÖFFENTLICH lesbar (nur is_listed) und SECRET-FREI.
export const drivingSchools = pgTable("driving_schools", {
  id: uuid("id").defaultRandom().primaryKey(),
  brandId: uuid("brand_id").references(() => schoolBrands.id),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  strasse: text("strasse"),
  hausnummer: text("hausnummer"), // eigenes Feld ab Migration 0012 (strasse = Straßenname)
  plz: text("plz"),
  ort: text("ort"),
  stadtbezirk: text("stadtbezirk"),
  bundesland: text("bundesland"),
  land: landEnum("land").notNull().default("DE"),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  googlePlaceId: text("google_place_id"),
  googleRating: numeric("google_rating", { precision: 2, scale: 1 }),
  googleReviewsCount: integer("google_reviews_count"),
  sprachen: text("sprachen").array().notNull().default([]),
  isPartner: boolean("is_partner").notNull().default(false),
  isVerified: boolean("is_verified").notNull().default(false),
  isListed: boolean("is_listed").notNull().default(true),
  // Hauptniederlassung/Zentrale einer Gruppe (Migration 0005). Höchstens EINE je
  // Brand (partieller Unique-Index). Steuert /{stadt}/{schule} = Gruppen-Seite.
  isMainLocation: boolean("is_main_location").notNull().default(false),
  // Dedupe (Migration 0006): von der App gesetzte Schlüssel + weiche Markierung.
  dedupeKey: text("dedupe_key"),
  clusterKey: text("cluster_key"),
  isDuplicate: boolean("is_duplicate").notNull().default(false),
  duplicateOf: uuid("duplicate_of"), // FK auf driving_schools.id (in SQL-Migration)
  dedupeChecked: boolean("dedupe_checked").notNull().default(false),
  // Review-Zusatzfelder (Migration 0007): internes Notizfeld + optionaler Maps-Ortslink.
  reviewNotiz: text("review_notiz"),
  mapsUrl: text("maps_url"),
  // Fortlaufende, stabile Nummer je Schule (Migration 0008) → spätere Kundennummer.
  kundennummer: bigint("kundennummer", { mode: "number" }),
  failRate: numeric("fail_rate", { precision: 5, scale: 2 }),
  // Import-Identität (Phase E / Migration 0002): Idempotenz + Verifikationsstatus.
  // Importierte Datensätze setzen is_listed explizit auf false (Gate in 008c).
  source: text("source"),
  sourceRef: text("source_ref"),
  importedAt: timestamp("imported_at", { withTimezone: true }),
  verificationStatus: text("verification_status").$type<
    "unverified" | "needs_review" | "auto_verified" | "manual_verified" | "rejected"
  >(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// PRIVAT — keine Klartext-IBAN, nur Stripe-Referenz.
export const schoolBilling = pgTable("school_billing", {
  schoolId: uuid("school_id").primaryKey().references(() => drivingSchools.id, { onDelete: "cascade" }),
  stripeAccountRef: text("stripe_account_ref"),
  aboStatus: text("abo_status").$type<"none" | "portal_only" | "saas_active">().notNull().default("none"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const schoolMembers = pgTable("school_members", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  schoolId: uuid("school_id").notNull().references(() => drivingSchools.id, { onDelete: "cascade" }),
  rolle: schoolMemberRolleEnum("rolle").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const schoolProfiles = pgTable("school_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  schoolId: uuid("school_id").notNull().references(() => drivingSchools.id, { onDelete: "cascade" }),
  beschreibung: text("beschreibung"),
  fuehrerscheinklassen: text("fuehrerscheinklassen").array().notNull().default([]),
  preise: jsonb("preise"),
  // Preise gelten als recherchiert/UNBESTÄTIGT, bis die Fahrschule sie bestätigt (Migration 0008).
  preiseVerifiziert: boolean("preise_verifiziert").notNull().default(false),
  oeffnungszeiten: jsonb("oeffnungszeiten"),
  theoriezeiten: jsonb("theoriezeiten"), // Theorie-Unterrichtszeiten je Wochentag (Migration 0010)
  faq: jsonb("faq"),
  logoUrl: text("logo_url"),
  // Kontakt (öffentlich) — für truthful CTA (Phase H)
  telefon: text("telefon"),
  whatsapp: text("whatsapp"), // optionale WhatsApp-Kontaktnummer (Migration 0011)
  email: text("email"),
  // Bewerbungs-Eingang je Schule (Migration 0025) — INTERN wie `email`: wird nie
  // öffentlich gerendert; App-Fallback für Bewerbungs-Mails: bewerbungs_email ?? email.
  bewerbungsEmail: text("bewerbungs_email"),
  website: text("website"),
  // Sektions-Sichtbarkeit (im Backend pro Schule deaktivierbar; Default sichtbar)
  showImages: boolean("show_images").notNull().default(true),
  showVehicles: boolean("show_vehicles").notNull().default(true),
  showInstructors: boolean("show_instructors").notNull().default(true),
  showFaq: boolean("show_faq").notNull().default(true),
  showZeiten: boolean("show_zeiten").notNull().default(true),
  showJobs: boolean("show_jobs").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const instructors = pgTable("instructors", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id),
  schoolId: uuid("school_id").notNull().references(() => drivingSchools.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  aktiv: boolean("aktiv").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Öffentliche View für Fahrlehrer (Spalten-Minimierung): KEINE `user_id`.
 * Existiert in der Migration mit `security_invoker = true` (RLS bleibt aktiv).
 */
export const instructorsPublic = pgView("instructors_public", {
  id: uuid("id"),
  schoolId: uuid("school_id"),
  name: text("name"),
  slug: text("slug"),
  aktiv: boolean("aktiv"),
}).existing();

/**
 * Phase H — strukturierte, je Schule deaktivierbare Profildaten. `aktiv` ist
 * RLS-gegated (Public-Read nur gelistet UND aktiv, siehe Migration 0001).
 */
export const schoolImages = pgTable("school_images", {
  id: uuid("id").defaultRandom().primaryKey(),
  schoolId: uuid("school_id").notNull().references(() => drivingSchools.id, { onDelete: "cascade" }),
  kategorie: imageKategorieEnum("kategorie").notNull().default("sonstiges"),
  url: text("url").notNull(),
  alt: text("alt"),
  position: integer("position").notNull().default(0),
  aktiv: boolean("aktiv").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const schoolVehicles = pgTable("school_vehicles", {
  id: uuid("id").defaultRandom().primaryKey(),
  schoolId: uuid("school_id").notNull().references(() => drivingSchools.id, { onDelete: "cascade" }),
  marke: text("marke"),
  modell: text("modell"),
  getriebe: vehicleGetriebeEnum("getriebe"),
  klasse: text("klasse"),
  besonderheiten: text("besonderheiten").array().notNull().default([]),
  position: integer("position").notNull().default(0),
  aktiv: boolean("aktiv").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const schoolFaqItems = pgTable("school_faq_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  schoolId: uuid("school_id").notNull().references(() => drivingSchools.id, { onDelete: "cascade" }),
  frage: text("frage").notNull(),
  antwort: text("antwort").notNull(),
  position: integer("position").notNull().default(0),
  aktiv: boolean("aktiv").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const schoolOpeningHours = pgTable("school_opening_hours", {
  id: uuid("id").defaultRandom().primaryKey(),
  schoolId: uuid("school_id").notNull().references(() => drivingSchools.id, { onDelete: "cascade" }),
  art: openingArtEnum("art").notNull(),
  wochentag: smallint("wochentag").notNull(),
  von: time("von").notNull(),
  bis: time("bis").notNull(),
  aktiv: boolean("aktiv").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const schoolJobs = pgTable("school_jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  schoolId: uuid("school_id").notNull().references(() => drivingSchools.id, { onDelete: "cascade" }),
  titel: text("titel").notNull(),
  beschreibung: text("beschreibung"),
  art: jobArtEnum("art").notNull().default("fahrlehrer"),
  // Jobbörse-Ausbau (Migration 0023): globale Detail-URL /jobs/{slug} + Anzeige-Metadaten.
  slug: text("slug").notNull(),
  beschaeftigungsart: text("beschaeftigungsart").$type<
    "vollzeit" | "teilzeit" | "minijob" | "nebenberuflich"
  >(),
  // Freiwillige Vergütungsangabe der Schule als Freitext — bewusst KEINE Zahlen-Spanne
  // (keine erfundenen/normierten Werte; AGG-/UWG-schonend).
  verguetungText: text("verguetung_text"),
  gueltigBis: date("gueltig_bis"),
  position: integer("position").notNull().default(0),
  // Strukturierte Phase-1-Felder (Migration 0025). Gehalts-Integrität ist DB-HART:
  // ENTWEDER alle vier Gehaltsfelder NULL ODER komplett + plausibel + bestätigt
  // (chk_school_jobs_gehalt) — unbestätigte Gehälter existieren nie in der Tabelle.
  gehaltVonEuro: numeric("gehalt_von_euro", { precision: 10, scale: 2 }),
  gehaltBisEuro: numeric("gehalt_bis_euro", { precision: 10, scale: 2 }),
  gehaltZeitraum: text("gehalt_zeitraum").$type<"monat" | "jahr" | "stunde">(),
  gehaltBestaetigtAm: date("gehalt_bestaetigt_am"),
  verguetungsmodell: text("verguetungsmodell").$type<
    "fix" | "fix_plus_umsatz" | "nach_vereinbarung"
  >(),
  tarifHinweis: text("tarif_hinweis"),
  klassen: text("klassen").array().notNull().default([]),
  quereinsteigerWillkommen: boolean("quereinsteiger_willkommen").notNull().default(false),
  quereinsteigerFinanzierung: text("quereinsteiger_finanzierung")
    .$type<"keine" | "anteilig" | "voll" | "nach_vereinbarung">()
    .notNull()
    .default("keine"),
  arbeitszeitModell: text("arbeitszeit_modell").$type<"vollzeit" | "teilzeit" | "flexibel">(),
  samstagDienst: boolean("samstag_dienst"),
  geprueftAm: date("geprueft_am"),
  erstveroeffentlichtAm: date("erstveroeffentlicht_am"),
  aktiv: boolean("aktiv").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("uq_school_jobs_slug").on(t.slug)]);

/**
 * Strukturierte Preisangaben je Führerscheinklasse (Migration 0021) — Quelle der
 * Wahrheit für Preisdarstellung/-filter. Struktur folgt dem amtlichen Preisaushang
 * (§ 32 FahrlG, Anlage 4): Sonderfahrten GETRENNT nach Fahrtart; bewusst KEINE
 * Gesamt-/Pauschalpreis-Modellierung. `quelle` ist öffentlich spalten-gesperrt.
 * status: 'recherchiert' (ohne Gewähr) → 'bestaetigt' (durch die Fahrschule).
 */
export const schoolPrices = pgTable("school_prices", {
  id: uuid("id").defaultRandom().primaryKey(),
  schoolId: uuid("school_id").notNull().references(() => drivingSchools.id, { onDelete: "cascade" }),
  klasse: text("klasse").notNull(),
  grundbetrag: numeric("grundbetrag", { precision: 10, scale: 2 }),
  fahrstunde45: numeric("fahrstunde_45", { precision: 10, scale: 2 }),
  sonderfahrtUeberland45: numeric("sonderfahrt_ueberland_45", { precision: 10, scale: 2 }),
  sonderfahrtAutobahn45: numeric("sonderfahrt_autobahn_45", { precision: 10, scale: 2 }),
  sonderfahrtDaemmerung45: numeric("sonderfahrt_daemmerung_45", { precision: 10, scale: 2 }),
  vorstellungTheorie: numeric("vorstellung_theorie", { precision: 10, scale: 2 }),
  vorstellungPraxis: numeric("vorstellung_praxis", { precision: 10, scale: 2 }),
  lehrmaterial: numeric("lehrmaterial", { precision: 10, scale: 2 }),
  waehrung: text("waehrung").notNull().default("EUR"),
  status: text("status").$type<"recherchiert" | "bestaetigt">().notNull().default("recherchiert"),
  stand: date("stand"),
  quelle: text("quelle"),
  aktiv: boolean("aktiv").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("uq_school_prices_school_klasse").on(t.schoolId, t.klasse)]);
