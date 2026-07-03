import "server-only";
import { cache } from "react";
import { z } from "zod";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getPublicSupabaseConfig } from "@/lib/public-config";
import { hardenAuthCookie } from "@/server/auth/cookie-options";
import { getDevSessionConfig } from "@/server/config/dev-session";
import { getDevSessionUser } from "@/server/auth/dev-session";

/**
 * session.ts — liest und VERIFIZIERT die aktuelle Session serverseitig.
 * ----------------------------------------------------------------------------
 * Verifikations-Primitiv ist `supabase.auth.getClaims()` (offizielle Empfehlung,
 * SSR-Guide): prüft Signatur (JWKS, lokal bei asymmetrischen Keys) + `exp` bei
 * JEDEM Aufruf; bei HS256 fällt supabase-js intern auf einen verifizierten
 * `getUser(token)`-Roundtrip zurück. NIE `getSession()` serverseitig vertrauen
 * (liest nur das Cookie). Nur so darf die verifizierte `sub` später als
 * RLS-Kontext gesetzt werden (dal/rls-context.ts).
 *
 * AAL/MFA: `SessionUser` trägt zusätzlich `aal` ('aal1'|'aal2') und `amr` aus den
 * signaturverifizierten Claims — die MFA-Gates (auth/portal-guards.ts) hängen
 * daran. FAIL-CLOSED: fehlt/misslingt getClaims → keine Session; fehlt nur das
 * aal-Claim → 'aal1' (nie stilles aal2).
 *
 * IDENTITÄT, NICHT AUTORISIERUNG: Die fachliche Rolle (`users.account_typ`) und
 * Plattformrollen (`platform_role_assignments`) werden NICHT aus Session-/Auth-
 * Metadaten abgeleitet, sondern serverseitig in der DB über RLS-Helfer erzwungen
 * (`app.current_account_type()`, `app.has_platform_role()`).
 *
 * DEV-SESSION-SEAM: NUR wenn das dreifach verriegelte Config-Gate aktiv ist
 * (ONELANE_DEV_SESSION=1 + !Produktion + KEINE Supabase-Config; sonst Throw —
 * server/config/dev-session.ts) liefert der Dev-Adapter (auth/dev-session.ts)
 * die Session aus einem HMAC-signierten Cookie geseedeter Dev-User. Der
 * Supabase-Pfad bleibt der Default und hat bei Konfiguration IMMER Vorrang.
 *
 * WICHTIG (Supabase-Fallstrick): der Client wird PRO REQUEST erzeugt, nie im
 * Modul-Scope — sonst könnte eine Session zwischen Nutzern leaken.
 */

/** Authenticator Assurance Level der Session (aal2 = MFA verifiziert). */
export type Aal = "aal1" | "aal2";

export interface SessionUser {
  id: string;
  email: string | null;
  /** Signaturverifiziertes AAL-Claim; fail-closed 'aal1', wenn nicht bestimmbar. */
  aal: Aal;
  /** Authentication Methods References (z. B. 'password', 'totp') — nur informativ. */
  amr: string[];
}

/** Obergrenze für die Auth-Verifikation (F-033): eine langsame/gestörte Auth soll
 *  öffentliche Seiten nicht ausbremsen; für geschützte Pfade fail-closed (→ null → 401). */
const AUTH_VERIFY_TIMEOUT_MS = 5000;

/** Promise mit harter Zeitgrenze; räumt den Timer beim Settle auf (kein dangling Timer). */
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(label)), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

/** Minimal-Validierung der verifizierten Claims (nur was wir tragen). */
const claimsShape = z.object({
  sub: z.string().uuid(),
  email: z.string().nullish(),
  aal: z.unknown().optional(),
  amr: z.unknown().optional(),
});

/** aal fail-closed normalisieren: NUR exakt 'aal2' wird zu aal2, alles andere aal1. */
function normalizeAal(value: unknown): Aal {
  return value === "aal2" ? "aal2" : "aal1";
}

/** amr defensiv auf Methoden-Namen reduzieren (Format lt. Supabase: [{method,timestamp}]). */
function normalizeAmr(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((eintrag) =>
      eintrag !== null && typeof eintrag === "object" && "method" in eintrag
        ? String((eintrag as { method: unknown }).method)
        : null,
    )
    .filter((m): m is string => typeof m === "string" && m.length > 0)
    .slice(0, 10);
}

/**
 * Verifiziert die aktuelle Session serverseitig. REQUEST-LOKAL memoisiert (F-085) via
 * React `cache()` — mehrere Aufrufe in derselben Request treffen den Auth-Service nur
 * EINMAL und lösen nur EINEN Cookie-Refresh aus. `cache()` ist pro Request isoliert
 * (kein globaler Cache → keine Session-Leaks zwischen Nutzern).
 */
export const getVerifiedUser = cache(async (): Promise<SessionUser | null> => {
  // DEV-SESSION-SEAM (fail-closed Gate; wirft bei Produktions-/Mischkonfiguration).
  // dev-session.ts importiert aus dieser Datei NUR Typen (erased) — kein Laufzeit-Zyklus.
  if (getDevSessionConfig() !== null) {
    return getDevSessionUser();
  }

  // getPublicSupabaseConfig() wirft bei TEILkonfiguration (F-032); beide leer → null (auth-los).
  const config = getPublicSupabaseConfig();
  if (!config) return null;

  const cookieStore = await cookies();

  const supabase = createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, hardenAuthCookie(options)),
          );
        } catch {
          // In Server Components lassen sich keine Cookies setzen — das
          // Token-Refresh erledigt der Proxy. Hier bewusst ignorieren.
        }
      },
    },
  });

  // FAIL-CLOSED: ohne getClaims (zu alte supabase-js) KEINE Session — wir raten nie.
  if (typeof supabase.auth.getClaims !== "function") return null;

  let result: Awaited<ReturnType<typeof supabase.auth.getClaims>>;
  try {
    // Begrenzt die WARTEZEIT des Aufrufers (F-033) → öffentliche Seiten hängen nicht an einer
    // gestörten Auth. Hinweis: der zugrunde liegende fetch wird (noch) nicht aktiv abgebrochen —
    // aktives Abbrechen bräuchte ein custom fetch mit AbortSignal (kollidiert mit dem
    // Egress-fetch-Verbot in src/server/**) und ist als Folgeschritt vermerkt.
    result = await withTimeout(supabase.auth.getClaims(), AUTH_VERIFY_TIMEOUT_MS, "auth-verify-timeout");
  } catch {
    // F-033/F-086: Auth-Service-Fehler/Timeout → fail-closed als "keine Session".
    // (Öffentliche Seiten laufen weiter; geschützte Pfade lehnen via requireUser mit 401 ab.)
    return null;
  }

  const { data, error } = result;
  if (error || !data?.claims) return null;

  // F-084: `sub` muss eine UUID sein (RLS-Kontext erwartet UUID) — sonst kontrolliert
  // ablehnen statt später als 500 im DAL zu enden.
  const parsed = claimsShape.safeParse(data.claims);
  if (!parsed.success) return null;

  return {
    id: parsed.data.sub,
    email: parsed.data.email ?? null,
    aal: normalizeAal(parsed.data.aal),
    amr: normalizeAmr(parsed.data.amr),
  };
});
