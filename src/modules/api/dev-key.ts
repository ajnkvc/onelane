import "server-only";
import { getDevSessionConfig } from "@/server/config/dev-session";

/**
 * modules/api/dev-key.ts — Dev-Schlüssel-KONSTANTEN des API-/MCP-Zugangs.
 * ============================================================================
 * SEIT WELLE 2 KEIN eigener Auth-Adapter mehr: der Key-Lookup läuft IMMER über
 * den DB-Adapter (db-key.ts → app.api_key_pruefen, Migration 0031). Der feste
 * Dev-Token existiert hier nur noch als ANZEIGE-Konstante für die lokale
 * Doku-Seite (/app/partner-api/docs) — gerendert AUSSCHLIESSLICH bei aktivem
 * Dev-Session-Seam (dreifaches Config-Gate, wirft bei Mischkonfiguration).
 *
 * Der zugehörige api_keys-Datensatz (sha256 dieses Tokens) wird NUR von
 * scripts/seed-demo.mjs geseedet (Loopback-/Prod-Guard dort) — ohne Seed kennt
 * die DB den Hash nicht und der Token ist wertlos (fail-closed 401). TOKEN UND
 * SEED MÜSSEN SYNCHRON BLEIBEN (Querverweis im Seed-Block; Muster DEV_USERS).
 */

/** Fester Dev-Token (nur lokal; Prefix olk_ = onelane key). */
export const DEV_API_KEY_TOKEN = "olk_dev_alpha_nur_lokal_4f2e9c81d7b35a60"; // gitleaks:allow (wertloser Dev-Token, Hash nur lokal; hinter Dev-Seam)
/** Identifikations-Prefix — identisch mit dem geseedeten api_keys.prefix. */
export const DEV_API_KEY_PREFIX = "olk_dev_alpha";
/** Partner-Name — identisch mit DEV_PARTNER_NAME in scripts/seed-demo.mjs. */
export const DEV_API_PARTNER_NAME = "dev_seed Partner Alpha";

/** true, wenn das Dev-Seam aktiv ist (wirft bei Fehlkonfiguration). */
export function istDevApiKeyAktiv(): boolean {
  return getDevSessionConfig() !== null;
}
