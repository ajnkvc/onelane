/**
 * db/schema/index.ts — Sammelpunkt des Drizzle-Schemas (Typisierung).
 * ----------------------------------------------------------------------------
 * Diese Module SPIEGELN die kanonische SQL-Migration (db/migrations/0000_*).
 * MASSGEBLICH ist immer die Migration — RLS, Policies, Trigger, Constraints,
 * Grants und Rollen liegen ausschließlich dort. Drizzle dient der typsicheren
 * Modellierung/Abfrage in der DAL.
 */
export * from "./enums";
export * from "./identity";
export * from "./schools";
export * from "./ingestion";
export * from "./content";
export * from "./monetization";
export * from "./saas";
export * from "./enrollments";
export * from "./communication";
export * from "./learning";
export * from "./accounting";
export * from "./audit";
