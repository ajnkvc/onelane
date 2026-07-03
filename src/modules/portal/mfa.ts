import "server-only";
import { getSupabaseServerClient } from "@/server/auth/supabase-server";

/**
 * modules/portal/mfa.ts — Lese-Naht für den 2FA-Flow (Supabase-Pfad).
 * ----------------------------------------------------------------------------
 * Bestimmt serverseitig (nur LESEN, keine Cookie-Writes nötig), ob die 2FA-Seite
 * den Einrichtungs- (kein verifizierter Faktor) oder den Challenge-Modus
 * (verifizierter TOTP-Faktor vorhanden, Session aal1) rendert.
 */
export interface TotpStatus {
  modus: "einrichten" | "challenge";
  /** Bei 'challenge': ID des verifizierten TOTP-Faktors. */
  factorId: string | null;
}

/** null = Supabase nicht konfiguriert (Dev-Seam simuliert den Flow separat). */
export async function getTotpStatus(): Promise<TotpStatus | null> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error || !data) return { modus: "einrichten", factorId: null };
    const verifiziert = data.totp.find((f) => f.status === "verified");
    return verifiziert
      ? { modus: "challenge", factorId: verifiziert.id }
      : { modus: "einrichten", factorId: null };
  } catch {
    return { modus: "einrichten", factorId: null };
  }
}
