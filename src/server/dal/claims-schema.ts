import { z } from "zod";

/**
 * claims-schema.ts — die ERLAUBTEN, minimalen RLS-Claims.
 * ============================================================================
 * Bewusst eigenes, abhängigkeitsarmes Modul (nur zod), damit die
 * Sicherheits-Invariante „es wird ausschließlich `sub` gesetzt" unabhängig vom
 * DB-Client unit-testbar ist (siehe tests/security-guards.test.ts).
 *
 * Rolle/Plattformrollen werden NICHT über Claims transportiert, sondern in der DB
 * aus `users.account_typ` bzw. `platform_role_assignments` abgeleitet (RLS-Helfer).
 * Unbekannte Felder entfernt Zod (strip), sodass die DB nie ungeprüfte,
 * sicherheitsrelevante Werte erhält.
 */
export const claimsSchema = z.object({
  sub: z.string().uuid(),
});

export type VerifiedClaims = z.infer<typeof claimsSchema>;

/** Validiert + minimiert rohe Claims auf das erlaubte Minimum (wirft bei ungültig). */
export function parseClaims(raw: unknown): VerifiedClaims {
  return claimsSchema.parse(raw);
}
