import { sql } from "drizzle-orm";
import { pgTable, uuid, text, timestamp, boolean, integer, date, uniqueIndex } from "drizzle-orm/pg-core";
import { drivingSchools, schoolJobs } from "./schools";

/**
 * Modul „portal" — öffentliche Portal-Submissions (Leads + Bewerbungen).
 * Spiegelt die kanonischen SQL-Migrationen 0022/0023 (MASSGEBLICH dort).
 *
 * PII-Tabellen mit besonderem Schutzmodell:
 *  - Schreibpfad NUR über withPublicSubmissionContext (einziger anonymer Write),
 *    INSERT ohne RETURNING (anonyme SELECT-Policies existieren bewusst nicht).
 *  - FK RESTRICT (kein CASCADE auf PII-Pfaden), Soft-Delete via deleted_at,
 *    UPDATE für app_user per Spalten-Grant auf `status` beschränkt, kein DELETE.
 *  - KEIN support-Zugriff (0016-Linie); SELECT nur Schul-Manager + admin.
 *  - Datenminimierung: kein Geburtsdatum; Guardian-Kontakt nur bei Minderjährigen
 *    (CHECK-Gate); Bewerbungen ohne Foto-/Geschlechts-/Familienstands-Felder (AGG).
 */

export const leads = pgTable("leads", {
  id: uuid("id").defaultRandom().primaryKey(),
  schoolId: uuid("school_id").notNull().references(() => drivingSchools.id, { onDelete: "restrict" }),
  klasse: text("klasse").notNull(),
  zeitraum: text("zeitraum").$type<"sofort" | "in_1_3_monaten" | "spaeter">().notNull().default("sofort"),
  vorname: text("vorname").notNull(),
  nachname: text("nachname"),
  email: text("email"),
  telefon: text("telefon"),
  nachricht: text("nachricht"),
  istMinderjaehrig: boolean("ist_minderjaehrig").notNull().default(false),
  guardianName: text("guardian_name"),
  guardianEmail: text("guardian_email"),
  guardianTelefon: text("guardian_telefon"),
  einwilligungDatenschutzAt: timestamp("einwilligung_datenschutz_at", { withTimezone: true }).notNull(),
  einwilligungWeitergabeAt: timestamp("einwilligung_weitergabe_at", { withTimezone: true }).notNull(),
  status: text("status").$type<"neu" | "gesehen" | "erledigt">().notNull().default("neu"),
  quellePfad: text("quelle_pfad"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

/**
 * Aggregierte Ereignis-Zähler je Schule (Migration 0024) — keine PII, kein
 * Besucher-Bezug: nur school_id × ereignis_typ × Tag × anzahl. Schreibweg
 * AUSSCHLIESSLICH über die SECURITY-DEFINER-Funktion app.zaehle_ereignis
 * (Slug-Auflösung + Gelistet-Gate + Tages-Cap in der DB); app_user hat keine
 * Schreib-Grants. SELECT nur Schul-Manager/admin (B2B-Zahlen „deine Klicks").
 */
export const ereignisZaehler = pgTable("ereignis_zaehler", {
  id: uuid("id").defaultRandom().primaryKey(),
  schoolId: uuid("school_id").notNull().references(() => drivingSchools.id, { onDelete: "cascade" }),
  ereignisTyp: text("ereignis_typ").$type<"tel_klick">().notNull(),
  tag: date("tag").notNull().default(sql`current_date`),
  anzahl: integer("anzahl").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("uq_ereignis_zaehler").on(t.schoolId, t.ereignisTyp, t.tag)]);

export const jobApplications = pgTable("job_applications", {
  id: uuid("id").defaultRandom().primaryKey(),
  jobId: uuid("job_id").notNull().references(() => schoolJobs.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  email: text("email").notNull(),
  telefon: text("telefon"),
  nachricht: text("nachricht"),
  // Bewerbungs-Delta (Migration 0025): Selbstauskunft + Klassen + Verfügbarkeit.
  // Bestand wurde auf 'unbekannt' backfilled; das Formular erlaubt nur die ersten drei.
  bewerberStatus: text("bewerber_status")
    .$type<"fahrlehrer" | "anwaerter" | "quereinsteiger" | "unbekannt">()
    .notNull()
    .default("unbekannt"),
  klassen: text("klassen").array().notNull().default([]),
  verfuegbarStatus: text("verfuegbar_status").$type<"sofort" | "zum_datum" | "flexibel">(),
  verfuegbarAb: date("verfuegbar_ab"),
  // CV-/Foto-METADATEN (Durchleitungs-Prinzip): die Dateien selbst werden NIE
  // gespeichert — sie gehen ausschließlich als Mail-Anhang an die Fahrschule.
  cvDateiname: text("cv_dateiname"),
  cvGroesseBytes: integer("cv_groesse_bytes"),
  fotoDateiname: text("foto_dateiname"),
  fotoGroesseBytes: integer("foto_groesse_bytes"),
  einwilligungDatenschutzAt: timestamp("einwilligung_datenschutz_at", { withTimezone: true }).notNull(),
  // Ab 0025 Pflicht im WITH CHECK der Public-Insert-Policy (Voll-Weiterleitung an die Schule).
  einwilligungWeitergabeAt: timestamp("einwilligung_weitergabe_at", { withTimezone: true }),
  status: text("status").$type<"neu" | "gesehen" | "erledigt">().notNull().default("neu"),
  quellePfad: text("quelle_pfad"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});
