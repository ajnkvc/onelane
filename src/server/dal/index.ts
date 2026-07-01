import "server-only";

/**
 * DAL — die öffentliche Schnittstelle des Datenzugriffs.
 * ----------------------------------------------------------------------------
 * Datenzugriff im REGULÄREN Request-Pfad ausschließlich über diese beiden Wege
 * (beide laufen als RLS-pflichtige Rolle `app_user`):
 *   - withCurrentUserContext(work)   → authentifizierter Nutzerkontext; `sub` stammt
 *     AUSSCHLIESSLICH aus der verifizierten Session (kein Impersonation-Footgun)
 *   - withAnonContext(work)          → öffentliche/anonyme Lesezugriffe (nur Public-RLS)
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
  type VerifiedClaims,
} from "./rls-context";
