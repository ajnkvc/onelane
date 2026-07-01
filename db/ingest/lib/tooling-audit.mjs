/**
 * tooling-audit.mjs — verpflichtendes Audit für erhöhte Tooling-Schreibpfade (F-018).
 * ============================================================================
 * Tooling-Scripts schreiben über TOOLING_DATABASE_URL (Owner, umgeht RLS). Jeder
 * MUTIERENDE Lauf MUSS — analog zu src/server/dal/elevated.ts (withElevatedAudit) —
 * korreliert in `security_events` protokolliert werden: attempt VOR der Arbeit
 * (dauerhaft, überlebt Fehler), success nach Erfolg, failed im Fehlerfall (nur
 * Fehlerklasse, kein sensibler Text). Gemeinsame correlation_id.
 *
 * Bewusste, kleine Duplizierung der TS-Helfer (elevated-audit.ts): Node-.mjs kann die
 * .ts-Module nicht direkt importieren. Logik/Regeln bewusst deckungsgleich gehalten.
 *
 * `sql` ist eine postgres.js-Instanz (oder ein kompatibler Tag). Ein einzelnes
 * `await sql\`…\`` committet implizit → attempt/failed sind sofort dauerhaft.
 */
import { randomUUID } from "node:crypto";

const EVENT_TYPE_RE = /^[a-z][a-z0-9_]{1,63}$/;
const INITIATOR_TYPE_RE = /^[a-z][a-z0-9_]{1,63}$/;
const TARGET_TABLE_RE = /^[a-z_][a-z0-9_]*(\.[a-z_][a-z0-9_]*)?$/;
// Parität zu elevated-audit.ts: vom Wrapper kontrollierte Keys dürfen nicht aus metadata kommen.
const RESERVED_METADATA_KEYS = new Set(["reason", "initiator_user_id", "phase", "error_class"]);
const SECRET_VALUE_RE =
  /(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{8,}|whsec_[A-Za-z0-9]{8,}|Bearer\s+[A-Za-z0-9._-]{8,}|eyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}/gi;
// Deckungsgleich mit elevated-audit.ts (SENSITIVE_KEY_RE) — sensible Schlüssel-Namen redigieren.
const SENSITIVE_KEY_RE =
  /(pass|pwd|secret|token|authoriz|cookie|bearer|\bjwt\b|signature|api[-_]?key|credential|iban|\bbic\b|sepa|mandat|\bpan\b|card|cvv|cvc|\bssn\b|email|e[-_]?mail|phone|telefon|mobile|geheim|private[-_]?key|account[-_]?number|client[-_]?secret|stripe)/i;
const MAX_METADATA_BYTES = 8192;
export const REDACTED = "[redacted]";

/** Scrubbt bekannte Secret-Wertmuster in einem String. */
export function scrubSecretValues(v, depth = 0) {
  if (depth > 8) return REDACTED;
  if (typeof v === "string") return v.replace(SECRET_VALUE_RE, REDACTED);
  if (Array.isArray(v)) return v.map((x) => scrubSecretValues(x, depth + 1));
  if (v && typeof v === "object") {
    const o = {};
    for (const [k, val] of Object.entries(v)) o[k] = scrubSecretValues(val, depth + 1);
    return o;
  }
  return v;
}

/** Tiefen-Redaction: sensible Schlüssel → [redacted]; String-Werte secret-gescrubbt (wie elevated-audit.ts). */
export function redactSensitive(v, depth = 0) {
  if (depth > 8) return REDACTED;
  if (typeof v === "string") return scrubSecretValues(v);
  if (Array.isArray(v)) return v.map((x) => redactSensitive(x, depth + 1));
  if (v && typeof v === "object") {
    const o = {};
    for (const [k, val] of Object.entries(v)) {
      o[k] = SENSITIVE_KEY_RE.test(k) ? REDACTED : redactSensitive(val, depth + 1);
    }
    return o;
  }
  return v;
}

/** Nur die Fehlerklasse (nie die Message → kein PII/Secret-Leak). */
export function safeErrorClass(err) {
  const n = err && typeof err === "object" ? err.name : undefined;
  return typeof n === "string" && /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(n) ? n : "Error";
}

async function insertEvent(sql, eventType, initiatorType, correlationId, targetTable, metaObj) {
  const json = JSON.stringify(metaObj);
  if (json.length > MAX_METADATA_BYTES) {
    throw new Error(`tooling-audit: metadata überschreitet ${MAX_METADATA_BYTES / 1024} KB`);
  }
  await sql`
    insert into public.security_events
      (actor_user_id, event_type, initiator_type, correlation_id, target_table, metadata)
    values
      (null, ${eventType}, ${initiatorType}, ${correlationId}::uuid, ${targetTable ?? null}, ${json}::jsonb)`;
}

/**
 * Führt `work(correlationId)` aus und protokolliert attempt/success/failed in security_events.
 * audit: { eventType, initiatorType='tooling', targetTable?, metadata? }.
 * Wirft VOR jedem DB-Zugriff bei ungültigen Tokens (fail-closed). Reserviert die Schlüssel
 * `phase`/`error_class` (von hier gesetzt); Aufrufer-metadata darf sie nicht enthalten.
 */
export async function withToolingAudit(sql, audit, work) {
  const eventType = audit.eventType;
  const initiatorType = audit.initiatorType ?? "tooling";
  if (!EVENT_TYPE_RE.test(eventType)) throw new Error(`tooling-audit: ungültiger eventType "${eventType}"`);
  if (!INITIATOR_TYPE_RE.test(initiatorType)) {
    throw new Error(`tooling-audit: ungültiger initiatorType "${initiatorType}"`);
  }
  if (audit.targetTable !== undefined && audit.targetTable !== null &&
      !(audit.targetTable.length <= 128 && TARGET_TABLE_RE.test(audit.targetTable))) {
    throw new Error(`tooling-audit: ungültige targetTable "${audit.targetTable}"`);
  }
  for (const k of Object.keys(audit.metadata ?? {})) {
    if (RESERVED_METADATA_KEYS.has(k)) {
      throw new Error(`tooling-audit: metadata darf reservierten Schlüssel "${k}" nicht enthalten`);
    }
  }
  const base = redactSensitive(audit.metadata ?? {});
  const correlationId = randomUUID();

  // attempt: eigenes (auto-committetes) INSERT → dauerhaft, überlebt einen späteren Fehler.
  await insertEvent(sql, eventType, initiatorType, correlationId, audit.targetTable, { ...base, phase: "attempt" });

  // HINWEIS (bewusst, dokumentiert): Die Tooling-Funktionen sind NICHT transaktional
  // (import-b2b = Batch mit per-Zeile-Resilienz; review-server = viele Einzel-Statements).
  // Anders als withElevatedAudit (TS/Drizzle) sind work+success daher NICHT atomar gekoppelt.
  // Dauerhafte Beweiskette = attempt + (bei Arbeitsfehler) failed. success ist best-effort und
  // wird NIE als failed umgedeutet, wenn nur das success-INSERT scheitert (B3-Fix).
  let result;
  try {
    result = await work(correlationId);
  } catch (err) {
    try {
      await insertEvent(sql, eventType, initiatorType, correlationId, audit.targetTable, {
        ...base,
        phase: "failed",
        error_class: safeErrorClass(err),
      });
    } catch {
      // Audit-Schreiben im Fehlerpfad darf den Originalfehler NICHT verschlucken.
    }
    throw err;
  }

  // Arbeit war erfolgreich → success best-effort (ein Fehler hier ist KEIN Arbeitsfehler).
  try {
    await insertEvent(sql, eventType, initiatorType, correlationId, audit.targetTable, { ...base, phase: "success" });
  } catch (e) {
    console.warn(`tooling-audit: success-Event nicht geschrieben (${safeErrorClass(e)}); attempt bleibt der Beleg.`);
  }
  return result;
}
