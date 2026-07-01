import { describe, it, expect, vi } from "vitest";
import { withToolingAudit, scrubSecretValues, redactSensitive, safeErrorClass, REDACTED } from "../db/ingest/lib/tooling-audit.mjs";

/**
 * tooling-audit.test.ts — F-018: erhöhter Tooling-Pfad wird auditiert.
 * Nutzt ein Fake-`sql` (postgres.js-Tag), um die INSERT-Aufrufe zu erfassen — ohne echte DB.
 */
type Captured = { phase: string; eventType: string; initiatorType: string; correlationId: string };

function fakeSql(failOnPhase?: string) {
  const events: Captured[] = [];
  // postgres.js wird als Tagged Template genutzt: sql`insert ... ${a} ... ${b}`.
  const sql = (strings: TemplateStringsArray, ...vals: unknown[]) => {
    const text = strings.join("?");
    if (/insert\s+into\s+public\.security_events/i.test(text)) {
      // actor_user_id ist LITERAL null (nicht interpoliert). Gebundene Werte in Reihenfolge:
      // eventType, initiatorType, correlationId, targetTable, metadataJson.
      const [eventType, initiatorType, correlationId, , metaJson] = vals as [
        string, string, string, unknown, string,
      ];
      const meta = JSON.parse(metaJson);
      if (failOnPhase && meta.phase === failOnPhase) {
        return Promise.reject(new RangeError(`insert-fail:${meta.phase}`));
      }
      events.push({ phase: meta.phase, eventType, initiatorType, correlationId });
    }
    return Promise.resolve([]);
  };
  return { sql, events };
}

describe("withToolingAudit — attempt/success/failed (F-018)", () => {
  it("schreibt attempt VOR work und success nach Erfolg (gleiche correlation_id)", async () => {
    const { sql, events } = fakeSql();
    let ranAfterAttempt = false;
    const result = await withToolingAudit(sql, { eventType: "b2b_import" }, async () => {
      // attempt muss bereits geschrieben sein, bevor work läuft.
      expect(events.map((e) => e.phase)).toEqual(["attempt"]);
      ranAfterAttempt = true;
      return 42;
    });
    expect(result).toBe(42);
    expect(ranAfterAttempt).toBe(true);
    expect(events.map((e) => e.phase)).toEqual(["attempt", "success"]);
    expect(events[0].initiatorType).toBe("tooling");
    expect(events[0].correlationId).toBe(events[1].correlationId);
  });

  it("schreibt attempt + failed und wirft den Originalfehler weiter", async () => {
    const { sql, events } = fakeSql();
    await expect(
      withToolingAudit(sql, { eventType: "b2b_import" }, async () => {
        throw new TypeError("geheime IBAN DE123 darf NICHT geloggt werden");
      }),
    ).rejects.toThrow(/IBAN/);
    expect(events.map((e) => e.phase)).toEqual(["attempt", "failed"]);
  });

  it("validiert eventType/initiatorType fail-closed (kein DB-Insert)", async () => {
    const { sql, events } = fakeSql();
    await expect(withToolingAudit(sql, { eventType: "Bad Token" }, async () => 1)).rejects.toThrow(/eventType/);
    await expect(
      withToolingAudit(sql, { eventType: "ok_event", initiatorType: "Bad Init" }, async () => 1),
    ).rejects.toThrow(/initiatorType/);
    expect(events).toHaveLength(0);
  });

  it("lehnt reservierte metadata-Schlüssel ab (phase + error_class)", async () => {
    const { sql } = fakeSql();
    for (const k of ["phase", "error_class"]) {
      await expect(
        withToolingAudit(sql, { eventType: "ok_event", metadata: { [k]: "x" } }, async () => 1),
      ).rejects.toThrow(/reservierten/);
    }
  });

  it("B3: scheitert nur das success-INSERT, wird NICHT als failed protokolliert (warnt)", async () => {
    const { sql, events } = fakeSql("success");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    // work läuft durch; nur das success-Event scheitert → Ergebnis kommt zurück, kein 'failed', aber warn.
    const result = await withToolingAudit(sql, { eventType: "b2b_import" }, async () => "ok");
    expect(result).toBe("ok");
    expect(events.map((e) => e.phase)).toEqual(["attempt"]);
    expect(events.some((e) => e.phase === "failed")).toBe(false);
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it("Fehler beim failed-INSERT verschluckt den Originalfehler NICHT", async () => {
    const { sql } = fakeSql("failed");
    await expect(
      withToolingAudit(sql, { eventType: "b2b_import" }, async () => {
        throw new TypeError("original-fehler");
      }),
    ).rejects.toThrow(/original-fehler/);
  });
});

describe("redaction / safeErrorClass (Tooling, deckungsgleich mit elevated-audit)", () => {
  it("scrubbt Bearer-Token case-insensitiv (alle Varianten)", () => {
    for (const v of ["Bearer ABCDEFGH12345678", "bearer ABCDEFGH12345678", "BEARER ABCDEFGH12345678"]) {
      expect(scrubSecretValues(v)).toBe(REDACTED);
    }
    expect(scrubSecretValues({ note: "sk_live_ABCDEFGH12345678" }).note).toBe(REDACTED);
  });
  it("redigiert sensible Schlüssel-Namen (token/email/authorization)", () => {
    const out = redactSensitive({ token: "abc", email: "a@b.de", authorization: "x", ok: "sichtbar" });
    expect(out.token).toBe(REDACTED);
    expect(out.email).toBe(REDACTED);
    expect(out.authorization).toBe(REDACTED);
    expect(out.ok).toBe("sichtbar");
  });
  it("safeErrorClass liefert nur die Klasse", () => {
    expect(safeErrorClass(new TypeError("secret"))).toBe("TypeError");
    expect(safeErrorClass("x")).toBe("Error");
  });
});
