/**
 * elevated-audit.ts — REINE Audit-Helfer für den erhöhten DB-Pfad (KEIN DB-/Config-Import).
 * ============================================================================
 * Bewusst nebenwirkungs- und abhängigkeitsfrei (kein `server-only`, kein postgres),
 * damit Validierung/Redaction unabhängig getestet und in Tooling wie App genutzt werden
 * können. Die DB-Orchestrierung (Transaktionen, Timeouts) liegt in `elevated.ts`.
 *
 * Adressiert (Re-Audit Block 4):
 *  - F-012: verifizierter Initiator (initiatorType/initiatorUserId) wird erzwungen/validiert.
 *  - F-055: Audit-Metadaten werden gegen PII/Secrets redigiert; targetTable/targetId validiert.
 */

/** Erlaubte technische Tokens (deckungsgleich mit dem DB-CHECK in security_events). */
export const EVENT_TYPE_RE = /^[a-z][a-z0-9_]{1,63}$/;
export const INITIATOR_TYPE_RE = /^[a-z][a-z0-9_]{1,63}$/;
/** Tabellenname (optional schema-qualifiziert), konservativ + längenbegrenzt. */
export const TARGET_TABLE_RE = /^[a-z_][a-z0-9_]*(\.[a-z_][a-z0-9_]*)?$/;
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Platzhalter für redigierte Werte. */
export const REDACTED = "[redacted]";
/** Max. Metadaten-Größe (deckungsgleich mit dem DB-CHECK length(metadata::text) <= 8192). */
export const MAX_METADATA_BYTES = 8192;
const MAX_REDACT_DEPTH = 8;

/**
 * Schlüssel-Namen, die als sensibel gelten. Bewusst BREIT — bei einem Audit-/Secret-Sink ist
 * Über-Redaction (ein harmloses Feld versteckt) deutlich sicherer als ein geleaktes Secret.
 */
const SENSITIVE_KEY_RE =
  /(pass|pwd|secret|token|authoriz|cookie|bearer|\bjwt\b|signature|api[-_]?key|credential|iban|\bbic\b|sepa|mandat|\bpan\b|card|cvv|cvc|\bssn\b|email|e[-_]?mail|phone|telefon|mobile|geheim|private[-_]?key|account[-_]?number|client[-_]?secret|stripe)/i;

/**
 * Bekannte Secret-WERT-Muster (auch unter harmlosen Keys / in Freitext): Stripe-Keys/Webhook-
 * Secrets, Bearer-Tokens, JWTs. Wird auf alle String-Werte angewandt.
 */
const SECRET_VALUE_RE =
  /(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{8,}|whsec_[A-Za-z0-9]{8,}|Bearer\s+[A-Za-z0-9._-]{8,}|eyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}/gi;

/**
 * Reservierte Top-Level-Metadaten-Schlüssel — vom Wrapper kontrolliert gesetzt; ein Aufrufer darf
 * sie NICHT über `metadata` überschreiben/fälschen (sonst ließe sich der verifizierte Initiator
 * unterlaufen, F-012). Wird in validateElevatedAudit fail-closed abgelehnt.
 */
export const RESERVED_METADATA_KEYS: ReadonlySet<string> = new Set([
  "reason",
  "initiator_user_id",
  "phase",
  "error_class",
]);

/** Redigiert bekannte Secret-Muster in einem String-Wert. */
export function scrubSecretValues(s: string): string {
  return s.replace(SECRET_VALUE_RE, REDACTED);
}

/**
 * Tiefen-Redaction: sensible Schlüssel → [redacted]; String-Werte werden auf Secret-Muster
 * gescrubbt. Arrays/verschachtelte Objekte werden rekursiv behandelt (Tiefe begrenzt).
 */
export function redactSensitive(value: unknown, depth = 0): unknown {
  if (depth > MAX_REDACT_DEPTH) return REDACTED;
  if (typeof value === "string") return scrubSecretValues(value);
  if (Array.isArray(value)) return value.map((v) => redactSensitive(v, depth + 1));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEY_RE.test(k) ? REDACTED : redactSensitive(v, depth + 1);
    }
    return out;
  }
  return value;
}

export type ElevatedAudit = {
  /** technisches Token, z. B. "stripe_webhook_processed" (^[a-z][a-z0-9_]{1,63}$). */
  eventType: string;
  /** VERIFIZIERTER Initiator-Typ, z. B. "stripe_webhook", "admin_job", "tooling" (F-012). */
  initiatorType: string;
  /** optional: verifizierte User-ID (z. B. aus getVerifiedUser()) — landet als initiator_user_id in metadata. */
  initiatorUserId?: string;
  targetTable?: string;
  targetId?: string;
  /** Klartext-Grund (wird gescrubbt) — dennoch KEINE Secrets/PII übergeben. */
  reason?: string;
  /** zusätzliche, NICHT sensible Metadaten (werden redigiert; final ≤ 8 KB). */
  metadata?: Record<string, unknown>;
};

/** Validiert die Audit-Eingaben fail-closed (wirft VOR jedem DB-Zugriff). */
export function validateElevatedAudit(audit: ElevatedAudit): void {
  if (!EVENT_TYPE_RE.test(audit.eventType)) {
    throw new Error(
      `withElevatedAudit: ungültiger eventType "${audit.eventType}" — erwartet ^[a-z][a-z0-9_]{1,63}$`,
    );
  }
  if (!INITIATOR_TYPE_RE.test(audit.initiatorType)) {
    throw new Error(
      `withElevatedAudit: ungültiger initiatorType "${audit.initiatorType}" — erwartet ^[a-z][a-z0-9_]{1,63}$`,
    );
  }
  if (audit.initiatorUserId !== undefined && !UUID_RE.test(audit.initiatorUserId)) {
    throw new Error("withElevatedAudit: initiatorUserId muss eine UUID sein");
  }
  if (
    audit.targetTable !== undefined &&
    !(audit.targetTable.length <= 128 && TARGET_TABLE_RE.test(audit.targetTable))
  ) {
    throw new Error(`withElevatedAudit: ungültige targetTable "${audit.targetTable}"`);
  }
  if (audit.targetId !== undefined && !UUID_RE.test(audit.targetId)) {
    throw new Error("withElevatedAudit: targetId muss eine UUID sein");
  }
  // F-012: reservierte, vom Wrapper kontrollierte Schlüssel dürfen nicht aus metadata kommen
  // (sonst könnte ein Aufrufer initiator_user_id/phase/error_class fälschen).
  if (audit.metadata) {
    for (const k of Object.keys(audit.metadata)) {
      if (RESERVED_METADATA_KEYS.has(k)) {
        throw new Error(`withElevatedAudit: metadata darf den reservierten Schlüssel "${k}" nicht enthalten`);
      }
    }
  }
}

/**
 * Baut das redigierte Basis-Metadatenobjekt (ohne Phasenmarker). Die vom Wrapper KONTROLLIERTEN
 * Felder (reason, initiator_user_id) werden ZULETZT gesetzt — sie können durch redigierte
 * Aufrufer-Metadaten nicht überschrieben werden (F-012; zusätzlich zur Reserved-Key-Ablehnung).
 */
export function buildBaseMetadata(audit: ElevatedAudit): Record<string, unknown> {
  return {
    ...(redactSensitive(audit.metadata ?? {}) as Record<string, unknown>),
    ...(audit.reason ? { reason: scrubSecretValues(audit.reason) } : {}),
    ...(audit.initiatorUserId ? { initiator_user_id: audit.initiatorUserId } : {}),
  };
}

/**
 * Serialisiert das Basis-Metadatenobjekt mit Phasenmarker (+ optionalen Extras) und prüft die
 * Größengrenze. `phase` ist eines von attempt|success|failed (Korrelation über correlation_id).
 */
export function phaseMetadataJson(
  base: Record<string, unknown>,
  phase: "attempt" | "success" | "failed",
  extra?: Record<string, unknown>,
): string {
  const json = JSON.stringify({ ...base, phase, ...(extra ?? {}) });
  if (json.length > MAX_METADATA_BYTES) {
    throw new Error(
      `withElevatedAudit: metadata überschreitet ${MAX_METADATA_BYTES / 1024} KB (security_events-Limit)`,
    );
  }
  return json;
}

/**
 * Liefert NUR die Fehlerklasse (z. B. "TypeError", "PostgresError") — NIE die Fehlermeldung,
 * die PII/Secrets enthalten könnte (F-055). Fällt auf "Error" zurück.
 */
export function safeErrorClass(err: unknown): string {
  if (err && typeof err === "object" && "name" in err) {
    const n = (err as { name?: unknown }).name;
    if (typeof n === "string" && /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(n)) return n;
  }
  return "Error";
}
