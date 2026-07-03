"use server";

import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { getSupabaseServerClient } from "@/server/auth/supabase-server";
import { hardenAuthCookie } from "@/server/auth/cookie-options";
import { getDevSessionConfig } from "@/server/config/dev-session";
import {
  DEV_SESSION_COOKIE,
  DEV_USERS,
  signDevSessionValue,
  verifyDevSessionValue,
} from "@/server/auth/dev-session";
// Sanktionierte Dev-Seam-Ausnahme: die Dev-Login-Action läuft VOR jeder Session —
// withCurrentUserContext ist hier unmöglich. withUserContext wird ausschließlich
// mit einer ID aus der FESTEN Allowlist (DEV_USERS) aufgerufen, hinter dem
// dreifach verriegelten Config-Gate (nie Produktion, nie neben Supabase).
import { withUserContext } from "@/server/dal/rls-context";
import { THEME_COOKIE, parseTheme } from "@/lib/theme";

/**
 * modules/portal/actions.ts — Server Actions des App-Portals (OS-P1 Fundament):
 * Login (Supabase-Passwort ODER Dev-Seam-Picker), TOTP-Einrichtung/-Challenge,
 * Logout, aal2-Simulation (nur Dev-Seam) und Theme-Wahl.
 * ----------------------------------------------------------------------------
 * SICHERHEIT: Alle Auth-Flows laufen SERVERSEITIG über den Supabase-SERVER-Client
 * (supabase-server.ts) — die Auth-Cookies bleiben httpOnly (Bestandsvertrag
 * cookie-options.ts); es gibt keinen Browser-Client, der Tokens liest. MFA-
 * verify stellt neue (aal2-)Tokens aus, die hier als gehärtete Cookies landen
 * (Supabase-Leitlinie: serverseitig nur in Server Action / Route Handler).
 * Diese Actions sind bewusst NICHT mit withPortalActionGuards umwickelt — sie
 * SIND der Weg zur Session/aal2; privilegierte Fach-Actions (P2/P3) nutzen die
 * Guards verpflichtend. Fehlermeldungen bleiben generisch (kein Auth-Orakel).
 */

/** FormData-String defensiv lesen (Files/fehlende Felder → leerer String). */
function feld(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === "string" ? v : "";
}

const anmeldeSchema = z.object({
  email: z.string().trim().email().max(320),
  passwort: z.string().min(1).max(1024),
});

export interface AnmeldeErgebnis {
  ok: boolean;
  /** true → Weiterleitung auf /app/einrichtung/2fa (Faktor vorhanden, aal1). */
  mfaErforderlich?: boolean;
}

/** E-Mail+Passwort-Anmeldung (Supabase-Pfad). Cookies schreibt der Server-Client. */
export async function anmeldenMitPasswort(eingabe: {
  email: string;
  passwort: string;
}): Promise<AnmeldeErgebnis> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return { ok: false };
  const parsed = anmeldeSchema.safeParse(eingabe);
  if (!parsed.success) return { ok: false };

  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.passwort,
  });
  if (error) return { ok: false };

  // AAL-Stand direkt nach Login (Session ist frisch und serverseitig verifiziert):
  // Faktor enrollt, aber nicht bestätigt → Challenge-Flow auf der 2FA-Seite.
  try {
    const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    const mfaErforderlich =
      data?.nextLevel === "aal2" && data.nextLevel !== data.currentLevel;
    return { ok: true, mfaErforderlich };
  } catch {
    return { ok: true, mfaErforderlich: false };
  }
}

export interface TotpStart {
  ok: boolean;
  factorId?: string;
  /** SVG-Data-URI für <img> (CSP img-src erlaubt data:). */
  qrDataUri?: string;
  secret?: string;
}

/**
 * TOTP-Einrichtung starten: räumt unverifizierte Faktor-Leichen auf (Supabase-
 * Fallstrick: abgebrochene Enrollments erzeugen nextLevel=aal2 ohne nutzbaren
 * Faktor) und enrollt einen neuen Faktor (QR + Secret für die Anzeige).
 */
export async function totpEinrichtungStarten(): Promise<TotpStart> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return { ok: false };
  try {
    const { data: faktoren } = await supabase.auth.mfa.listFactors();
    for (const f of faktoren?.all ?? []) {
      if (f.factor_type === "totp" && f.status === "unverified") {
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
    }
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Authenticator",
    });
    if (error || !data) return { ok: false };
    return {
      ok: true,
      factorId: data.id,
      qrDataUri: data.totp.qr_code,
      secret: data.totp.secret,
    };
  } catch {
    return { ok: false };
  }
}

const totpCodeSchema = z.object({
  factorId: z.string().min(1).max(128),
  code: z.string().regex(/^[0-9]{6}$/),
});

/**
 * TOTP bestätigen — deckt BEIDE Fälle: (a) frisches Enrollment (challenge+verify)
 * und (b) Login-Challenge eines bestehenden Faktors (challengeAndVerify).
 * Erfolg hebt die Session auf aal2; die neuen Tokens landen als httpOnly-Cookies.
 */
export async function totpBestaetigen(eingabe: {
  factorId: string;
  code: string;
}): Promise<{ ok: boolean }> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return { ok: false };
  const parsed = totpCodeSchema.safeParse(eingabe);
  if (!parsed.success) return { ok: false };
  try {
    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: parsed.data.factorId,
      code: parsed.data.code,
    });
    return { ok: !error };
  } catch {
    return { ok: false };
  }
}

/** Abmelden: Dev-Seam-Cookie löschen bzw. Supabase-signOut; danach /app/login. */
export async function abmelden(): Promise<void> {
  if (getDevSessionConfig() !== null) {
    (await cookies()).delete(DEV_SESSION_COOKIE);
  } else {
    const supabase = await getSupabaseServerClient();
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch {
        // fail-soft: Cookies sind maßgeblich; ein Auth-Service-Fehler blockiert den Logout nicht
      }
    }
  }
  redirect("/app/login");
}

/**
 * DEV-SEAM: Anmeldung als geseedeter Dev-User. NUR bei aktivem, dreifach
 * verriegeltem Gate; Auswahl ausschließlich über den Allowlist-Key (KEINE freie
 * UUID); die Existenz der geseedeten users-Zeile wird per RLS-Selbst-SELECT
 * (withUserContext mit der Allowlist-ID) geprüft — fehlt sie, keine Anmeldung.
 */
export async function devAnmelden(formData: FormData): Promise<void> {
  const config = getDevSessionConfig();
  if (!config) redirect("/app/login");

  const eintrag = DEV_USERS.find((u) => u.key === feld(formData, "devUser"));
  if (!eintrag) redirect("/app/login?fehler=1");

  const aal = feld(formData, "aal") === "aal2" ? "aal2" : "aal1";

  let geseedet = false;
  try {
    geseedet = await withUserContext({ sub: eintrag.id }, async (tx) => {
      const rows = (await tx.execute(
        sql`select id from public.users where id = ${eintrag.id}`,
      )) as unknown as unknown[];
      return rows.length > 0;
    });
  } catch {
    geseedet = false;
  }
  if (!geseedet) redirect("/app/login?fehler=1");

  const wert = signDevSessionValue(eintrag.id, aal, config.secret);
  (await cookies()).set(DEV_SESSION_COOKIE, wert, hardenAuthCookie({}));
  redirect("/app");
}

/** DEV-SEAM: hebt die simulierte Session auf aal2 (2FA-Flow-Test ohne TOTP). */
export async function devAal2Simulieren(): Promise<void> {
  const config = getDevSessionConfig();
  if (!config) redirect("/app/login");
  const cookieStore = await cookies();
  const aktuell = verifyDevSessionValue(
    cookieStore.get(DEV_SESSION_COOKIE)?.value,
    config.secret,
  );
  if (!aktuell) redirect("/app/login");
  cookieStore.set(
    DEV_SESSION_COOKIE,
    signDevSessionValue(aktuell.id, "aal2", config.secret),
    hardenAuthCookie({}),
  );
  redirect("/app");
}

/**
 * Theme-Wahl (App-Portal): 'light'|'dark' als Cookie, 'system' löscht das Cookie
 * (Root-Layout löst dann prefers-color-scheme per Inline-Script auf). Bewusst
 * httpOnly=false-los unnötig — kein Secret, aber wir setzen es dennoch nicht
 * lesbar-kritisch: httpOnly bleibt aus Nutzersicht irrelevant, JS braucht es nicht.
 */
export async function themeSetzen(formData: FormData): Promise<void> {
  const wahl = feld(formData, "theme");
  const cookieStore = await cookies();
  const theme = parseTheme(wahl);
  if (theme === null) {
    cookieStore.delete(THEME_COOKIE);
    return;
  }
  cookieStore.set(THEME_COOKIE, theme, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
}
