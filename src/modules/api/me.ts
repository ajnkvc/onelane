import type { ApiKeyDatensatz } from "./port";

/**
 * modules/api/me.ts — Antwort-Shape von GET /api/v1/me (Paket C).
 * ============================================================================
 * Selbstauskunft des authentifizierten Schlüssels: NUR Daten, die der
 * Schlüssel-Inhaber ohnehin kennt bzw. kennen muss (Partner-Name/-Status,
 * Prefix, Scopes, Ablauf). NIE: Hash, Token, interne IDs anderer Partner.
 */
export function baueMeAntwort(schluessel: ApiKeyDatensatz): Record<string, unknown> {
  return {
    partner: {
      name: schluessel.partnerName,
      status: schluessel.partnerStatus,
    },
    schluessel: {
      prefix: schluessel.prefix,
      scopes: [...schluessel.scopes].sort(),
      status: schluessel.status,
      laeuftAbAm: schluessel.expiresAt ? schluessel.expiresAt.toISOString() : null,
    },
  };
}
