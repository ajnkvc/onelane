import "server-only";
import { getPublicSupabaseConfig, isProduction } from "@/lib/public-config";

/**
 * dev-session.ts — Konfigurations-Gate des DEV-SESSION-SEAMS (Config-Schicht).
 * ============================================================================
 * Das Seam erlaubt LOKAL (ohne Supabase-Auth-Dienst) die Anmeldung als
 * GESEEDETER Dev-User (scripts/seed-demo.mjs) über ein HMAC-signiertes
 * httpOnly-Cookie. Es ist ein reines Entwicklungs-Werkzeug und FAIL-CLOSED
 * dreifach verriegelt (Review-Auflage 4, Muster DevLog-Mail-Adapter):
 *
 *   1. Explizites Opt-in:  ONELANE_DEV_SESSION='1' (sonst null → Seam existiert nicht).
 *   2. NIE in Produktion:  Flag gesetzt + isProduction() → harter Throw (Kill-Switch).
 *   3. KEIN Mischmodus:    Flag gesetzt + Supabase-Config vorhanden → harter Throw
 *      (der echte Auth-Pfad hat IMMER Vorrang; ein „sowohl als auch" wäre eine
 *      Fehlkonfiguration mit Backdoor-Charakter).
 *
 * Zusätzlich Pflicht: ONELANE_DEV_SESSION_SECRET (min. 32 Zeichen) als
 * HMAC-Schlüssel der Cookie-Signatur — ohne Secret kein Seam (Throw).
 * process.env wird NUR hier gelesen (ESLint-Config-Schicht-Regel).
 */
export interface DevSessionConfig {
  /** HMAC-Schlüssel für die Dev-Cookie-Signatur (nur lokal, kein Produktions-Secret). */
  secret: string;
}

/**
 * Liefert die Dev-Session-Konfiguration oder `null` (Flag nicht gesetzt =
 * Normalfall). Wirft bei jeder Misch-/Fehlkonfiguration (fail-closed).
 */
export function getDevSessionConfig(): DevSessionConfig | null {
  if (process.env.ONELANE_DEV_SESSION !== "1") return null;

  if (isProduction()) {
    throw new Error(
      "Dev-Session-Seam: ONELANE_DEV_SESSION=1 ist in Produktion VERBOTEN (Kill-Switch).",
    );
  }
  if (getPublicSupabaseConfig() !== null) {
    throw new Error(
      "Dev-Session-Seam: Mischkonfiguration — ONELANE_DEV_SESSION=1 zusammen mit " +
        "Supabase-Auth-Config ist verboten (Supabase-Pfad hat Vorrang; Flag entfernen).",
    );
  }
  const secret = process.env.ONELANE_DEV_SESSION_SECRET ?? "";
  if (secret.length < 32) {
    throw new Error(
      "Dev-Session-Seam: ONELANE_DEV_SESSION_SECRET fehlt oder ist kürzer als 32 Zeichen.",
    );
  }
  return { secret };
}
