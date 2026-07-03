import "server-only";

/**
 * modules/portal/identity.ts — Modul-Schicht-Naht des App-Portals.
 * ----------------------------------------------------------------------------
 * Präsentationscode (src/app/app/**) darf `@/server` nicht direkt importieren
 * (ESLint-Schichtgrenze) — Identität, MFA-Gates und Dev-Seam-Infos kommen
 * ausschließlich über diese Naht (Muster src/modules/guards.ts).
 */
export {
  getPortalIdentity,
  istMfaPflichtig,
  requireAal2ForRole,
  withPortalActionGuards,
  withPortalRouteGuards,
  MfaRequiredError,
  ACTIVE_SCHOOL_COOKIE,
  type PortalIdentity,
  type SchoolMembership,
  type SchoolRole,
  type PortalRolePredicate,
  type PortalGuardOptions,
} from "@/server/auth/portal-guards";

export { isDevSessionActive, DEV_USERS, type DevUserKey } from "@/server/auth/dev-session";
