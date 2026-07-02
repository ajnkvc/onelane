import "server-only";

/**
 * DAL — die öffentliche Schnittstelle des Datenzugriffs.
 * ----------------------------------------------------------------------------
 * Datenzugriff im REGULÄREN Request-Pfad ausschließlich über diese Wege
 * (alle laufen als RLS-pflichtige Rolle `app_user`):
 *   - withCurrentUserContext(work)      → authentifizierter Nutzerkontext; `sub` stammt
 *     AUSSCHLIESSLICH aus der verifizierten Session (kein Impersonation-Footgun)
 *   - withAnonContext(work)             → öffentliche/anonyme Lesezugriffe (nur Public-RLS;
 *     transaktionslokal READ ONLY — Writes scheitern hart, F-054)
 *   - withPublicSubmissionContext(work) → EINZIGER anonymer Schreibpfad, ausschließlich
 *     für Portal-Submissions (leads/job_applications, Migrationen 0022/0023); kein
 *     RETURNING, Policies + Spalten-Grants begrenzen den Schreibraum
 *
 * `withUserContext(claims, …)` (niedrig-level, akzeptiert beliebige Claims) wird BEWUSST
 * NICHT re-exportiert — Request-Code darf die RLS-Identität nicht frei setzen.
 * `getDb()` (client.ts) bleibt ebenfalls intern (kein Query ohne RLS-Kontext). Der ERHÖHTE
 * Pfad (umgeht RLS) liegt getrennt in dal/elevated.ts (nur Tooling/Webhooks/Wartung).
 *
 * Konvention: außerhalb von src/server/dal/ NUR `@/server/dal` importieren.
 */
export {
  withCurrentUserContext,
  withAnonContext,
  withPublicSubmissionContext,
  type VerifiedClaims,
} from "./rls-context";
