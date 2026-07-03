import type { PortalIdentity, SchoolRole } from "@/server/auth/portal-guards";
import type { PlatformRole } from "@/server/auth/permissions";

/**
 * modules/portal/rollen.ts — reine Rollen-Prädikate über der (eingefrorenen)
 * PortalIdentity (OS-P2). Nutzung: Nav-Aufbau, Dashboard-Verzweigung und die
 * serverseitigen Rollen-Gates der Platzhalter-Seiten (P3 übernimmt sie 1:1 in
 * die echten Module). KEINE Seiteneffekte, KEINE Queries — pure Funktionen,
 * damit sie ohne DB testbar sind. RLS bleibt die letzte Verteidigungslinie.
 */

export function istPlattformPersonal(identity: Pick<PortalIdentity, "accountTyp">): boolean {
  return identity.accountTyp === "platform_staff";
}

export function hatPlattformRolle(
  identity: Pick<PortalIdentity, "platformRoles">,
  ...rollen: PlatformRole[]
): boolean {
  return rollen.some((r) => identity.platformRoles.includes(r));
}

export function istStudent(identity: Pick<PortalIdentity, "accountTyp">): boolean {
  return identity.accountTyp === "student";
}

/** Rolle in der AKTIVEN Schule (null ohne Membership). */
export function aktiveSchulRolle(
  identity: Pick<PortalIdentity, "aktiveSchule">,
): SchoolRole | null {
  return identity.aktiveSchule?.rolle ?? null;
}

/** true, wenn die aktive Schul-Rolle eine der genannten ist. */
export function istSchulRolle(
  identity: Pick<PortalIdentity, "aktiveSchule">,
  ...rollen: SchoolRole[]
): boolean {
  const rolle = aktiveSchulRolle(identity);
  return rolle !== null && rollen.includes(rolle);
}

/** Schul-Manager = inhaber ODER verwaltung (deckungsgleich mit app.is_school_manager). */
export function istSchulManager(identity: Pick<PortalIdentity, "aktiveSchule">): boolean {
  return istSchulRolle(identity, "inhaber", "verwaltung");
}
