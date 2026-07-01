import { pgEnum } from "drizzle-orm/pg-core";

/**
 * Native PostgreSQL-Enums — nur für STABILE Wertemengen (siehe SPEC).
 * Status-/Workflow-Felder sind bewusst `text` + CHECK (in der SQL-Migration).
 */
export const landEnum = pgEnum("land", ["DE", "AT", "CH"]);
export const accountTypEnum = pgEnum("account_typ", [
  "student",
  "school_staff",
  "platform_staff",
]);
export const schoolMemberRolleEnum = pgEnum("school_member_rolle", [
  "inhaber",
  "verwaltung",
  "fahrlehrer",
]);

// Phase H — Profil-Strukturdaten
export const vehicleGetriebeEnum = pgEnum("vehicle_getriebe", ["schaltung", "automatik"]);
export const imageKategorieEnum = pgEnum("image_kategorie", [
  "gebaeude",
  "theorie",
  "fahrzeug",
  "team",
  "sonstiges",
]);
export const openingArtEnum = pgEnum("opening_art", ["theorie", "buero", "praxis"]);
export const jobArtEnum = pgEnum("job_art", ["fahrlehrer", "anwaerter"]);
