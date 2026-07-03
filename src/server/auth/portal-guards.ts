import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { withCurrentUserContext } from "@/server/dal";
import { getVerifiedUser, type SessionUser } from "./session";
import {
  AuthenticationRequiredError,
  AuthorizationError,
  ForbiddenError,
  type AccountType,
  type PlatformRole,
} from "./permissions";
import { withMutationGuards, type RouteHandler } from "./mutation-guard";

/**
 * portal-guards.ts — Identität + MFA-Gates des App-Portals (/app, OS-V1 P1).
 * ============================================================================
 * PFLICHT-Kette für JEDE Portal-Server-Action und JEDEN Portal-Route-Handler
 * (Review-Auflage 1: MFA durchgängig, nicht nur im Layout):
 *
 *   Session (verifiziert) → PortalIdentity (DB-Wahrheit via RLS) → MFA-Gate
 *   (requireAal2ForRole) → optionales Rollen-Prädikat → Handler.
 *
 * - getPortalIdentity(): request-lokal memoisiert (react cache). Rollen/
 *   Mitgliedschaften kommen AUSSCHLIESSLICH aus der DB über
 *   withCurrentUserContext (RLS: eigene users-/pra-/school_members-Zeilen) —
 *   NIE aus Session-Metadaten. Aktive Schule = httpOnly-Cookie, je Request
 *   gegen die Memberships validiert (fremde/ungültige IDs fallen still auf die
 *   erste Membership zurück).
 * - MFA-PFLICHT (rollenabgeleitet, keine Schema-Spalte): account_typ
 *   'platform_staff' ODER irgendeine Membership-Rolle 'inhaber' → aal2 nötig,
 *   sonst AuthorizationError 403 `mfa_required` (UI leitet auf /app/einrichtung/2fa
 *   um statt 401 zu rendern — Supabase-MFA-Leitlinie).
 * - withPortalActionGuards / withPortalRouteGuards erweitern das
 *   mutation-guard.ts-Muster (Route-Variante komponiert withMutationGuards:
 *   Same-Origin + zentrales Fehler-Mapping bleiben EINE Implementierung).
 * - RLS bleibt die letzte Verteidigungslinie; diese Guards sind die App-Schicht.
 */

/** Schulrollen (DB-Wahrheit: school_members.rolle). */
export type SchoolRole = "inhaber" | "verwaltung" | "fahrlehrer";

export interface SchoolMembership {
  schoolId: string;
  schoolName: string;
  rolle: SchoolRole;
}

export interface PortalIdentity {
  user: SessionUser;
  /** users.account_typ; null, wenn (noch) keine gespiegelte users-Zeile existiert. */
  accountTyp: AccountType | null;
  platformRoles: PlatformRole[];
  memberships: SchoolMembership[];
  /** Gewählte Schule (Cookie, validiert) bzw. erste Membership; null ohne Membership. */
  aktiveSchule: SchoolMembership | null;
  /** Anzeige: Vorname (+ Nachname) → E-Mail (DB, sonst Session) → "Konto". */
  anzeigeName: string;
}

/** httpOnly-Cookie mit der aktiven Schul-ID (wird je Request validiert). */
export const ACTIVE_SCHOOL_COOKIE = "onelane-aktive-schule";

/** Zod-Grenze für die DB-Zeile (Defense-in-Depth gegen unerwartete Werte). */
const identityRowSchema = z.object({
  account_typ: z.enum(["student", "school_staff", "platform_staff"]).nullable(),
  email: z.string().nullable(),
  vorname: z.string().nullable(),
  nachname: z.string().nullable(),
  platform_roles: z.array(z.enum(["admin", "support", "moderator", "editor", "vertrieb"])),
  memberships: z.array(
    z.object({
      schoolId: z.string().uuid(),
      schoolName: z.string(),
      rolle: z.enum(["inhaber", "verwaltung", "fahrlehrer"]),
    }),
  ),
});

/**
 * Lädt die Portal-Identität des angemeldeten Nutzers (null = keine Session).
 * EIN Query je Request (react cache) über den RLS-Kontext der verifizierten sub.
 */
export const getPortalIdentity = cache(async (): Promise<PortalIdentity | null> => {
  const user = await getVerifiedUser();
  if (!user) return null;

  const rows = await withCurrentUserContext(async (tx) => {
    return (await tx.execute(sql`
      select
        u.account_typ::text as account_typ,
        u.email,
        u.vorname,
        u.nachname,
        coalesce(
          (select array_agg(r.role order by r.role)
             from public.platform_role_assignments r
            where r.user_id = u.id),
          '{}'
        ) as platform_roles,
        coalesce(
          (select jsonb_agg(jsonb_build_object(
                    'schoolId', m.school_id,
                    'schoolName', s.name,
                    'rolle', m.rolle) order by s.name)
             from public.school_members m
             join public.driving_schools s on s.id = m.school_id
            where m.user_id = u.id),
          '[]'::jsonb
        ) as memberships
      from public.users u
      where u.id = ${user.id}
    `)) as unknown as Array<Record<string, unknown>>;
  });

  // Keine users-Zeile (z. B. frisch angelegter Auth-Account ohne Spiegelung):
  // Identität existiert, trägt aber keinerlei Rollen (fail-closed leer).
  const roh =
    rows[0] ??
    { account_typ: null, email: null, vorname: null, nachname: null, platform_roles: [], memberships: [] };
  const parsed = identityRowSchema.parse(roh);

  const memberships: SchoolMembership[] = parsed.memberships;
  const cookieStore = await cookies();
  const wunsch = cookieStore.get(ACTIVE_SCHOOL_COOKIE)?.value ?? null;
  const aktiveSchule =
    memberships.find((m) => m.schoolId === wunsch) ?? memberships[0] ?? null;

  const name = [parsed.vorname, parsed.nachname].filter(Boolean).join(" ").trim();
  const anzeigeName = name || parsed.email || user.email || "Konto";

  return {
    user,
    accountTyp: parsed.account_typ,
    platformRoles: parsed.platform_roles,
    memberships,
    aktiveSchule,
    anzeigeName,
  };
});

/** 403 mit technischem Code `mfa_required` — die UI leitet auf den 2FA-Flow um. */
export class MfaRequiredError extends AuthorizationError {
  constructor(message = "Zwei-Faktor-Bestätigung erforderlich") {
    super(message, 403, "mfa_required");
    this.name = "MfaRequiredError";
  }
}

/**
 * MFA-Pflicht rollenabgeleitet (bewusst KEINE Schema-Spalte): Plattform-Personal
 * und Schul-INHABER führen privilegierte/finanznahe Aktionen aus → aal2-Pflicht.
 */
export function istMfaPflichtig(
  identity: Pick<PortalIdentity, "accountTyp" | "memberships">,
): boolean {
  return (
    identity.accountTyp === "platform_staff" ||
    identity.memberships.some((m) => m.rolle === "inhaber")
  );
}

/** Wirft MfaRequiredError (403 mfa_required), wenn MFA-Pflicht besteht und aal < aal2. */
export function requireAal2ForRole(identity: PortalIdentity): void {
  if (istMfaPflichtig(identity) && identity.user.aal !== "aal2") {
    throw new MfaRequiredError();
  }
}

/** Optionales Rollen-Prädikat (z. B. id => id.platformRoles.includes('admin')). */
export type PortalRolePredicate = (identity: PortalIdentity) => boolean;

export interface PortalGuardOptions {
  /** Zusätzliche Rollenprüfung NACH Session+MFA; false → 403 forbidden. */
  require?: PortalRolePredicate;
}

/** Gemeinsame Guard-Kette: Session → Identity → MFA → optionales Prädikat. */
async function resolveGuardedIdentity(options: PortalGuardOptions): Promise<PortalIdentity> {
  const identity = await getPortalIdentity();
  if (!identity) throw new AuthenticationRequiredError();
  requireAal2ForRole(identity);
  if (options.require && !options.require(identity)) throw new ForbiddenError();
  return identity;
}

/**
 * Guard für Portal-SERVER-ACTIONS: erzwingt die volle Kette und reicht die
 * geprüfte Identität als erstes Argument an den Handler. Fehler bleiben
 * AuthorizationError-Instanzen (Actions mappen/redirecten selbst; Next prüft
 * die Action-Origin zusätzlich framework-seitig).
 */
export function withPortalActionGuards<Args extends unknown[], R>(
  handler: (identity: PortalIdentity, ...args: Args) => Promise<R>,
  options: PortalGuardOptions = {},
): (...args: Args) => Promise<R> {
  return async (...args: Args): Promise<R> => {
    const identity = await resolveGuardedIdentity(options);
    return handler(identity, ...args);
  };
}

/** Portal-Route-Handler erhält die geprüfte Identität als zweites Argument. */
export type PortalRouteHandler = (
  request: Request,
  identity: PortalIdentity,
) => Promise<Response> | Response;

/**
 * Guard für Portal-ROUTE-HANDLER: komponiert withMutationGuards (Same-Origin für
 * mutierende Methoden + zentrales Fehler-Mapping auf saubere Statuscodes — 401
 * authentication_required / 403 mfa_required / 403 forbidden, kein 500-Leak)
 * um die Portal-Kette.
 */
export function withPortalRouteGuards(
  handler: PortalRouteHandler,
  options: PortalGuardOptions = {},
): RouteHandler {
  return withMutationGuards(async (request: Request): Promise<Response> => {
    const identity = await resolveGuardedIdentity(options);
    return handler(request, identity);
  });
}
