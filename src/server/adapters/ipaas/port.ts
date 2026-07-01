/**
 * IpaasPort — Vertrag für spätere iPaaS-Anbindung (z. B. Zapier / Make / n8n).
 * ----------------------------------------------------------------------------
 * Phase 1: NUR DER VERTRAG, KEINE Implementierung. iPaaS wird ein Adapter HINTER
 * diesem Port. Zwei Richtungen: eingehende Webhooks (IN) und ausgehende Trigger (OUT).
 *
 * SICHERHEITSGRENZEN (verbindlich, siehe docs/SECURITY.md §9):
 * - Eingehend gilt als UNTRUSTED: HMAC-Signatur MUSS verifiziert werden,
 *   deny-by-default, Payload erst nach Zod-Validierung verarbeiten, IDEMPOTENT
 *   (Doppelzustellung über idempotencyKey verwerfen).
 * - Kein direkter DB-/Supabase-Zugriff: Verarbeitung über DAL + RLS, nie app_owner.
 * - Connector-Keys/Secrets nur serverseitig; pro Schule gescoped; rate-limited.
 * - Jeder IN-/OUT-Call wird auditiert und je Schule + je Connector gemessen.
 */

/** Eingehendes Webhook-Event. Rohdaten sind untrusted, bis Signatur + Schema geprüft sind. */
export interface IpaasInboundEvent {
  /** Quelle/Connector — MUSS gegen eine Allowlist geprüft werden. */
  connector: string;
  /** HMAC-Signatur des Roh-Bodys — MUSS serverseitig verifiziert werden. */
  signature: string;
  /** Schlüssel zur Doppelzustellungs-Erkennung (Idempotenz). */
  idempotencyKey: string;
  /** Roh-Payload — untrusted, bis (Zod-)validiert. */
  payload: unknown;
}

/** Ausgehender Trigger an ein iPaaS-Szenario. */
export interface IpaasOutboundTrigger {
  connector: string;
  event: string;
  data: Record<string, unknown>;
  /** Scoping für Audit + Messung. */
  schoolId?: string;
}

export interface IpaasPort {
  /** Verifiziert (Signatur) + verarbeitet ein eingehendes Event (deny-by-default, idempotent). */
  handleInbound(event: IpaasInboundEvent): Promise<{ ok: boolean; error?: string }>;
  /** Sendet einen ausgehenden Trigger (Secrets server-only, Usage gemessen). */
  emit(trigger: IpaasOutboundTrigger): Promise<{ ok: boolean; error?: string }>;
}
