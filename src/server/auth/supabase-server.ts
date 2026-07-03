import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getPublicSupabaseConfig } from "@/lib/public-config";
import { hardenAuthCookie } from "./cookie-options";

/**
 * supabase-server.ts — request-gebundener Supabase-Server-Client (Auth-Flows).
 * ----------------------------------------------------------------------------
 * Für Login-/MFA-/Logout-SERVER-ACTIONS (modules/portal/actions.ts): dort sind
 * Cookie-WRITES erlaubt, sodass signInWithPassword/mfa.verify/signOut die neuen
 * Tokens direkt als GEHÄRTETE Cookies (hardenAuthCookie: httpOnly/lax/host-only)
 * persistieren. Die Auth-Cookies bleiben damit httpOnly — es gibt weiterhin
 * KEINEN Browser-Client, der Tokens lesen muss (Bestands-Sicherheitsvertrag aus
 * cookie-options.ts; MFA-Flows laufen deshalb serverseitig, Supabase-Doku:
 * „wenn serverseitig, dann nur in Server Action oder Route Handler").
 *
 * `null`, wenn Supabase nicht konfiguriert ist (Dev-Session-Seam/auth-los).
 * WICHTIG: Client PRO REQUEST erzeugen (nie Modul-Scope — Session-Leak-Gefahr).
 */
export async function getSupabaseServerClient() {
  const config = getPublicSupabaseConfig();
  if (!config) return null;
  const cookieStore = await cookies();
  return createServerClient(config.url, config.publishableKey, {
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
          // In Server Components sind Cookie-Writes nicht möglich (nur lesen);
          // Actions/Route-Handler schreiben erfolgreich. Bewusst ignorieren.
        }
      },
    },
  });
}
