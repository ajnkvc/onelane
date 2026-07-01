import "server-only";
import { cache } from "react";
import { z } from "zod";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getPublicSupabaseConfig } from "@/lib/public-config";
import { hardenAuthCookie } from "@/server/auth/cookie-options";

/**
 * session.ts — liest und VERIFIZIERT die aktuelle Session serverseitig.
 * ----------------------------------------------------------------------------
 * Wir verwenden bewusst `supabase.auth.getUser()` (verifiziert das Token gegen
 * Supabase Auth), NICHT `getSession()` (liest nur das Cookie). Nur so darf die
 * verifizierte `sub` später als RLS-Kontext gesetzt werden (dal/rls-context.ts).
 *
 * IDENTITÄT, NICHT AUTORISIERUNG: `SessionUser` trägt nur Identität (id, email).
 * Die fachliche Rolle (`users.account_typ`) und Plattformrollen
 * (`platform_role_assignments`) werden NICHT aus der Session/Auth-Metadaten
 * abgeleitet, sondern serverseitig in der DB über RLS-Helfer erzwungen
 * (`app.current_account_type()`, `app.has_platform_role()`). `user_metadata` und
 * `app_metadata` sind KEINE Autorisierungsquelle.
 *
 * WICHTIG (Supabase-Fallstrick): der Client wird PRO REQUEST erzeugt, nie im
 * Modul-Scope — sonst könnte eine Session zwischen Nutzern leaken.
 */
export interface SessionUser {
  id: string;
  email: string | null;
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

/**
 * Verifiziert die aktuelle Session serverseitig. REQUEST-LOKAL memoisiert (F-085) via
 * React `cache()` — mehrere Aufrufe in derselben Request treffen den Auth-Service nur
 * EINMAL und lösen nur EINEN Cookie-Refresh aus. `cache()` ist pro Request isoliert
 * (kein globaler Cache → keine Session-Leaks zwischen Nutzern).
 */
export const getVerifiedUser = cache(async (): Promise<SessionUser | null> => {
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

  let result: Awaited<ReturnType<typeof supabase.auth.getUser>>;
  try {
    // Begrenzt die WARTEZEIT des Aufrufers (F-033) → öffentliche Seiten hängen nicht an einer
    // gestörten Auth. Hinweis: der zugrunde liegende fetch wird (noch) nicht aktiv abgebrochen —
    // aktives Abbrechen bräuchte ein custom fetch mit AbortSignal (kollidiert mit dem
    // Egress-fetch-Verbot in src/server/**) und ist als Folgeschritt vermerkt.
    result = await withTimeout(supabase.auth.getUser(), AUTH_VERIFY_TIMEOUT_MS, "auth-verify-timeout");
  } catch {
    // F-033/F-086: Auth-Service-Fehler/Timeout → fail-closed als "keine Session".
    // (Öffentliche Seiten laufen weiter; geschützte Pfade lehnen via requireUser mit 401 ab.)
    return null;
  }

  const { data, error } = result;
  if (error || !data.user) return null;

  // F-084: Session-ID muss eine UUID sein (RLS-Kontext erwartet UUID) — sonst kontrolliert
  // ablehnen statt später als 500 im DAL zu enden.
  const id = z.string().uuid().safeParse(data.user.id);
  if (!id.success) return null;

  return {
    id: id.data,
    email: data.user.email ?? null,
  };
});
