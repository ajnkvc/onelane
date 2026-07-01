import { describe, it, expect } from "vitest";
import {
  REDACTED,
  redactSensitive,
  scrubSecretValues,
  validateElevatedAudit,
  buildBaseMetadata,
  phaseMetadataJson,
  safeErrorClass,
  type ElevatedAudit,
} from "@/server/dal/elevated-audit";

/**
 * elevated-audit.test.ts — reine Audit-Helfer (Block 4: F-012/F-055).
 * Kein DB-Zugriff: validiert Redaction, Eingabe-Validierung und Fehlerklassen.
 */

describe("redactSensitive — sensible Schlüssel + Secret-Werte", () => {
  it("redigiert sensible Schlüssel (case-insensitiv, verschachtelt)", () => {
    const out = redactSensitive({
      ok: "sichtbar",
      Authorization: "Bearer abc",
      nested: { stripe_customer_ref: "cus_123", email: "a@b.de", harmless: 5 },
      list: [{ token: "t" }, "frei"],
    }) as Record<string, unknown>;
    expect(out.ok).toBe("sichtbar");
    expect(out.Authorization).toBe(REDACTED);
    const nested = out.nested as Record<string, unknown>;
    expect(nested.stripe_customer_ref).toBe(REDACTED);
    expect(nested.email).toBe(REDACTED);
    expect(nested.harmless).toBe(5);
    expect((out.list as unknown[])[0]).toEqual({ token: REDACTED });
    expect((out.list as unknown[])[1]).toBe("frei");
  });

  it("scrubbt Secret-Wertmuster auch unter harmlosen Schlüsseln", () => {
    expect(scrubSecretValues("key=sk_live_ABCDEFGH12345678 done")).toContain(REDACTED);
    expect(scrubSecretValues("whsec_ABCDEFGH12345678")).toBe(REDACTED);
    const out = redactSensitive({ note: "x sk_test_ABCDEFGH12345678 y" }) as Record<string, string>;
    expect(out.note).toContain(REDACTED);
    expect(out.note).not.toContain("sk_test_");
  });

  it("scrubbt Bearer-Token case-insensitiv (B2)", () => {
    for (const v of ["Bearer ABCDEFGH12345678", "bearer ABCDEFGH12345678", "BEARER ABCDEFGH12345678"]) {
      expect(scrubSecretValues(v)).toBe(REDACTED);
    }
  });
});

describe("validateElevatedAudit — fail-closed Eingabevalidierung", () => {
  const ok: ElevatedAudit = { eventType: "stripe_webhook_processed", initiatorType: "stripe_webhook" };
  it("akzeptiert gültige Eingaben", () => {
    expect(() => validateElevatedAudit(ok)).not.toThrow();
  });
  it("lehnt ungültigen eventType ab", () => {
    expect(() => validateElevatedAudit({ ...ok, eventType: "Bad Token" })).toThrow(/eventType/);
  });
  it("lehnt fehlenden/ungültigen initiatorType ab", () => {
    expect(() => validateElevatedAudit({ ...ok, initiatorType: "Bad Init" })).toThrow(/initiatorType/);
  });
  it("lehnt nicht-UUID initiatorUserId/targetId ab", () => {
    expect(() => validateElevatedAudit({ ...ok, initiatorUserId: "nope" })).toThrow(/initiatorUserId/);
    expect(() => validateElevatedAudit({ ...ok, targetId: "nope" })).toThrow(/targetId/);
  });
  it("lehnt ungültige targetTable ab", () => {
    expect(() => validateElevatedAudit({ ...ok, targetTable: "DROP TABLE x" })).toThrow(/targetTable/);
  });
  it("lehnt reservierte metadata-Schlüssel ab (B1/F-012)", () => {
    for (const k of ["initiator_user_id", "reason", "phase", "error_class"]) {
      expect(() => validateElevatedAudit({ ...ok, metadata: { [k]: "x" } })).toThrow(/reservierten/);
    }
  });
});

describe("buildBaseMetadata + phaseMetadataJson", () => {
  it("scrubbt reason und übernimmt initiator_user_id", () => {
    const base = buildBaseMetadata({
      eventType: "e",
      initiatorType: "tooling",
      initiatorUserId: "11111111-1111-4111-8111-111111111111",
      reason: "Bearer SECRETTOKEN12345678 angefasst",
      metadata: { a: 1 },
    });
    expect(base.initiator_user_id).toBe("11111111-1111-4111-8111-111111111111");
    expect(String(base.reason)).toContain(REDACTED);
    expect(base.a).toBe(1);
  });
  it("setzt phase und erzwingt die 8-KB-Grenze", () => {
    const base = buildBaseMetadata({ eventType: "e", initiatorType: "tooling", metadata: {} });
    expect(JSON.parse(phaseMetadataJson(base, "attempt")).phase).toBe("attempt");
    const big = buildBaseMetadata({ eventType: "e", initiatorType: "tooling", metadata: { x: "y".repeat(9000) } });
    expect(() => phaseMetadataJson(big, "attempt")).toThrow(/KB|metadata/);
  });
});

describe("safeErrorClass — nur Fehlerklasse, nie Nachricht", () => {
  it("liefert die Klasse, niemals die Message", () => {
    expect(safeErrorClass(new TypeError("geheime IBAN DE123"))).toBe("TypeError");
    expect(safeErrorClass({ name: "PostgresError" })).toBe("PostgresError");
    expect(safeErrorClass("kaputt")).toBe("Error");
    expect(safeErrorClass({ name: "weird name!" })).toBe("Error");
  });
});
