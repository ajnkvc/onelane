"use server";

import "server-only";
import { cookies } from "next/headers";
import { z } from "zod";
import {
  ACTIVE_SCHOOL_COOKIE,
  withPortalActionGuards,
} from "@/server/auth/portal-guards";
import { isProduction } from "@/lib/public-config";

/**
 * modules/portal/shell-actions.ts — Server Actions der App-Shell (OS-P2).
 * ----------------------------------------------------------------------------
 * SCHUL-SWITCHER (P1-Kontrakt „aktiveSchule"): setzt das httpOnly-Cookie mit
 * der gewählten Schul-ID. Die Wahl wird HIER gegen die eigenen Memberships der
 * geprüften Identität validiert (fremde IDs → no-op) UND von getPortalIdentity
 * bei JEDEM Request erneut validiert (Fallback erste Membership) — das Cookie
 * ist reiner Komfort, nie Autorisierung. Volle Guard-Kette via
 * withPortalActionGuards (Session → Identity → MFA), Review-Auflage 1.
 */

const schulIdSchema = z.string().uuid();

export const aktiveSchuleSetzen = withPortalActionGuards(
  async (identity, formData: FormData): Promise<void> => {
    const roh = formData.get("schoolId");
    const parsed = schulIdSchema.safeParse(typeof roh === "string" ? roh : "");
    if (!parsed.success) return;

    // Nur EIGENE Memberships sind wählbar (fail-closed: sonst keine Änderung).
    const membership = identity.memberships.find((m) => m.schoolId === parsed.data);
    if (!membership) return;

    (await cookies()).set(ACTIVE_SCHOOL_COOKIE, membership.schoolId, {
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction(),
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  },
);
