import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getDevSessionConfig } from "@/server/config/dev-session";
import type { Aal, SessionUser } from "./session";

/**
 * dev-session.ts — DEV-SESSION-SEAM (Adapter, NUR lokale Entwicklung).
 * ============================================================================
 * Liefert einen SessionUser aus einem HMAC-signierten httpOnly-Cookie, wenn das
 * dreifach verriegelte Config-Gate (server/config/dev-session.ts) aktiv ist:
 * Opt-in-Flag + !Produktion + KEINE Supabase-Config — sonst existiert dieser
 * Pfad nicht (getVerifiedUser nutzt dann ausschließlich Supabase).
 *
 * Sicherheitsmodell:
 *  - Cookie-Wert `v1.<user_id>.<aal>.<hmac>`; HMAC-SHA256 über `v1.<user_id>.<aal>`
 *    mit dem Dev-Secret. Nur unsere Login-Action signiert Werte — und die
 *    signiert AUSSCHLIESSLICH IDs aus der festen Allowlist unten (deren Existenz
 *    sie zusätzlich per DB-Abfrage gegen die geseedeten users-Zeilen prüft).
 *    Eine frei erfundene UUID hat nie eine gültige Signatur (fail-closed).
 *  - `aal` ist Teil des signierten Werts → der MFA-Flow (aal1→aal2) ist im Dev
 *    ohne echten TOTP-Faktor simulier- und testbar (Query-/Cookie-Schalter nur
 *    hier im Adapter, Review-Auflage 4).
 *  - Vergleich via timingSafeEqual (kein Timing-Orakel).
 */

/** Cookie-Name des Dev-Session-Seams (httpOnly, lax, path=/). */
export const DEV_SESSION_COOKIE = "onelane-dev-session";

/**
 * FESTE Allowlist der Dev-User (deterministische UUIDs — identisch in
 * scripts/seed-demo.mjs gepflegt). NUR diese IDs sind signierbar; die
 * Login-Action prüft zusätzlich, dass die Zeile wirklich geseedet ist.
 */
export const DEV_USERS = [
  { key: "admin", id: "11111111-1111-4111-8111-000000000001", label: "Aleksandar — Plattform-Admin", rolle: "platform_staff · admin" },
  { key: "support", id: "11111111-1111-4111-8111-000000000002", label: "Selin — Support", rolle: "platform_staff · support" },
  { key: "editor", id: "11111111-1111-4111-8111-000000000003", label: "Eva — Redaktion", rolle: "platform_staff · editor" },
  { key: "vertrieb", id: "11111111-1111-4111-8111-000000000004", label: "Viktor — Vertrieb", rolle: "platform_staff · vertrieb" },
  { key: "inhaber", id: "11111111-1111-4111-8111-000000000005", label: "Ingrid — Inhaberin (Schule 1)", rolle: "school_staff · inhaber" },
  { key: "verwaltung", id: "11111111-1111-4111-8111-000000000006", label: "Volkan — Verwaltung (Schule 1)", rolle: "school_staff · verwaltung" },
  { key: "fahrlehrer", id: "11111111-1111-4111-8111-000000000007", label: "Frida — Fahrlehrerin (Schule 1)", rolle: "school_staff · fahrlehrer" },
  { key: "student", id: "11111111-1111-4111-8111-000000000008", label: "Sam — Fahrschüler (Schule 1)", rolle: "student" },
  { key: "api-partner", id: "11111111-1111-4111-8111-000000000009", label: "Pia — API-Partner-Mitglied", rolle: "api_partner_member" },
] as const;

export type DevUserKey = (typeof DEV_USERS)[number]["key"];

/** true, wenn das Seam laut Config-Gate aktiv ist (wirft bei Fehlkonfiguration). */
export function isDevSessionActive(): boolean {
  return getDevSessionConfig() !== null;
}

const VERSION = "v1";
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function hmacHex(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/** Signiert einen Cookie-Wert für eine ALLOWLIST-ID (wirft bei fremder ID). */
export function signDevSessionValue(userId: string, aal: Aal, secret: string): string {
  if (!DEV_USERS.some((u) => u.id === userId)) {
    throw new Error("Dev-Session: user_id ist nicht in der festen Dev-Allowlist.");
  }
  const payload = `${VERSION}.${userId}.${aal}`;
  return `${payload}.${hmacHex(payload, secret)}`;
}

/**
 * Verifiziert einen Cookie-Wert. Liefert { id, aal } oder null (fail-closed bei
 * jeder Abweichung: Format, fremde/freie UUID, ungültige Signatur, falsches aal).
 */
export function verifyDevSessionValue(
  value: string | undefined,
  secret: string,
): { id: string; aal: Aal } | null {
  if (!value) return null;
  const teile = value.split(".");
  if (teile.length !== 4) return null;
  const [version, id, aal, signatur] = teile;
  if (version !== VERSION) return null;
  if (!UUID_REGEX.test(id)) return null;
  if (aal !== "aal1" && aal !== "aal2") return null;
  if (!DEV_USERS.some((u) => u.id === id)) return null;
  const erwartet = hmacHex(`${version}.${id}.${aal}`, secret);
  if (signatur.length !== erwartet.length) return null;
  try {
    if (!timingSafeEqual(Buffer.from(signatur, "hex"), Buffer.from(erwartet, "hex"))) {
      return null;
    }
  } catch {
    return null;
  }
  return { id, aal };
}

/**
 * Liest die Dev-Session aus dem Cookie (nur bei aktivem Seam aufrufen).
 * E-Mail bleibt null — Anzeige-Daten kommen aus der DB (getPortalIdentity).
 */
export async function getDevSessionUser(): Promise<SessionUser | null> {
  const config = getDevSessionConfig();
  if (!config) return null;
  const cookieStore = await cookies();
  const geprueft = verifyDevSessionValue(
    cookieStore.get(DEV_SESSION_COOKIE)?.value,
    config.secret,
  );
  if (!geprueft) return null;
  return { id: geprueft.id, email: null, aal: geprueft.aal, amr: ["dev_seam"] };
}
