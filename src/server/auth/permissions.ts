import "server-only";
import type { SessionUser } from "./session";

/**
 * permissions.ts — Rollentypen & Autorisierungs-Primitive.
 * ----------------------------------------------------------------------------
 * Rollenmodell (Schritt B):
 *  - `account_typ` (users) ist NUR: student | school_staff | platform_staff.
 *  - Plattformrollen (admin | support | moderator | editor) sind KEINE
 *    account_typ-Werte, sondern Daten in `platform_role_assignments`.
 *
 * WICHTIG: Weder `account_typ` noch Plattformrollen werden aus der Session/Auth-
 * Metadaten abgeleitet. Sie werden serverseitig in der DB über die RLS-Helfer
 * erzwungen (`app.current_account_type()`, `app.has_platform_role()`); die DAL
 * setzt pro Request nur die verifizierte `sub`. Typisierte Check-Helfer, die diese
 * Werte aus der DB lesen, kommen mit der DAL-Query-Schicht hinzu.
 */

/** Fachlicher Account-Typ (DB-Wahrheit: users.account_typ). */
export type AccountType = "student" | "school_staff" | "platform_staff";

/** Interne Plattformrollen (DB-Wahrheit: platform_role_assignments). */
export type PlatformRole = "admin" | "support" | "moderator" | "editor";

/**
 * Basis-Fehler für Autorisierung. Trägt `status` (HTTP) + `code` (technisch), damit der
 * zentrale Error-Mapper NICHT raten muss (F-087). Aufrufer prüfen `instanceof AuthorizationError`
 * und mappen `.status` direkt — ein vergessener Catch wird so nicht zur 500-Falle.
 */
export class AuthorizationError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(message = "Nicht berechtigt", status = 403, code = "forbidden") {
    super(message);
    this.name = "AuthorizationError";
    this.status = status;
    this.code = code;
  }
}

/** 401 — Anmeldung erforderlich (keine gültige Session). */
export class AuthenticationRequiredError extends AuthorizationError {
  constructor(message = "Anmeldung erforderlich") {
    super(message, 401, "authentication_required");
    this.name = "AuthenticationRequiredError";
  }
}

/** 403 — angemeldet, aber nicht berechtigt. */
export class ForbiddenError extends AuthorizationError {
  constructor(message = "Nicht berechtigt") {
    super(message, 403, "forbidden");
    this.name = "ForbiddenError";
  }
}

/**
 * Mappt einen beliebigen Fehler auf einen sicheren HTTP-Status + technischen Code.
 * AuthorizationError sowie jeder Fehler mit numerischem `status` (z. B. CsrfOriginError)
 * → dessen status/code; sonst 500/internal (KEINE Detail-Leaks nach außen).
 */
export function toHttpAuthError(err: unknown): { status: number; code: string } {
  if (err instanceof AuthorizationError) return { status: err.status, code: err.code };
  if (err !== null && typeof err === "object" && "status" in err) {
    const rec = err as Record<string, unknown>;
    if (typeof rec.status === "number") {
      return { status: rec.status, code: typeof rec.code === "string" ? rec.code : "error" };
    }
  }
  return { status: 500, code: "internal" };
}

/** Wirft 401, wenn kein Nutzer angemeldet ist; gibt sonst den (Identitäts-)Nutzer zurück. */
export function requireUser(user: SessionUser | null): SessionUser {
  if (!user) throw new AuthenticationRequiredError();
  return user;
}

/**
 * Prüft einen account_typ (zuvor über die DAL/DB ermittelt, NICHT aus der Session)
 * gegen eine Allowlist. Wirft 403 bei Nichtübereinstimmung.
 */
export function requireAccountType(
  accountType: AccountType | null,
  allowed: AccountType[],
): void {
  if (!accountType || !allowed.includes(accountType)) {
    throw new ForbiddenError();
  }
}
