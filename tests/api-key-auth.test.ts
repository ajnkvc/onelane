import { describe, expect, it } from "vitest";
import {
  leseBearerToken,
  pruefeApiKey,
  wwwAuthenticateHeader,
} from "@/modules/api/auth";
import {
  erstelleSammelAuditPort,
  redigiereEreignis,
  scrubGeheimnisse,
} from "@/modules/api/audit";
import { baueMeAntwort } from "@/modules/api/me";
import {
  erstelleInMemoryKeyAuthPort,
  KEIN_KEY_AUTH_PORT,
  sha256Hex,
  type ApiKeyDatensatz,
} from "@/modules/api/port";

/**
 * api-key-auth.test.ts — Key-Auth-Kern (OS-P3, Paket C).
 * ----------------------------------------------------------------------------
 * Die komplette Prüfkette läuft gegen das In-Memory-Double des KeyAuthPort
 * (Welle-1-Kontrakt: der DB-Lookup-Adapter kommt mit Welle 2, s. port.ts) —
 * fail-closed in jeder Abzweigung, kein Schlüssel-Orakel, redigiertes Audit
 * (nur prefix, NIE Token/Hash).
 */

const TOKEN = "olk_test_partner_a_0123456789abcdef0000"; // gitleaks:allow (Test-Fixture, kein echtes Secret)
const datensatz = (patch: Partial<ApiKeyDatensatz> = {}): ApiKeyDatensatz => ({
  id: "33333333-3333-4333-8333-000000000001",
  prefix: "olk_test",
  scopes: ["rest_read", "mcp"],
  status: "aktiv",
  expiresAt: null,
  partnerId: "33333333-3333-4333-8333-000000000002",
  partnerName: "Partner Test",
  partnerStatus: "aktiv",
  ...patch,
});
const portMit = (patch: Partial<ApiKeyDatensatz> = {}) =>
  erstelleInMemoryKeyAuthPort([{ token: TOKEN, datensatz: datensatz(patch) }]);
const header = `Bearer ${TOKEN}`;

describe("leseBearerToken", () => {
  it("liest das Token aus dem Bearer-Header (case-insensitives Schema)", () => {
    expect(leseBearerToken("Bearer abc")).toBe("abc");
    expect(leseBearerToken("bearer abc")).toBe("abc");
  });
  it("lehnt fehlende/fremde Schemata ab", () => {
    expect(leseBearerToken(null)).toBeNull();
    expect(leseBearerToken("")).toBeNull();
    expect(leseBearerToken("Basic abc")).toBeNull();
    expect(leseBearerToken("Bearer")).toBeNull();
  });
});

describe("sha256Hex", () => {
  it("liefert 64-Hex (Format des 0029-CHECK chk_api_keys_hash_format)", () => {
    expect(sha256Hex(TOKEN)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("pruefeApiKey — Kette fail-closed", () => {
  it("ohne Header → 401 header_fehlt (WWW-Authenticate ohne error-Attribut)", async () => {
    const e = await pruefeApiKey(portMit(), null, { scope: "rest_read" });
    expect(e).toMatchObject({ ok: false, status: 401, code: "authentication_required", grund: "header_fehlt" });
    if (!e.ok) expect(wwwAuthenticateHeader(e, "rest_read")).toBe('Bearer realm="onelane-api"');
  });

  it("Junk-Token (Format) wird VOR dem Hash-Lookup abgelehnt", async () => {
    const e = await pruefeApiKey(portMit(), "Bearer zu-kurz", { scope: "rest_read" });
    expect(e).toMatchObject({ ok: false, status: 401, grund: "token_format" });
  });

  it("unbekanntes Token → 401 (gleicher Code wie rotiert/abgelaufen — kein Orakel)", async () => {
    const e = await pruefeApiKey(portMit(), "Bearer olk_unbekannt_0123456789abcdef", { scope: "rest_read" });
    expect(e).toMatchObject({ ok: false, status: 401, code: "authentication_required", grund: "unbekannt" });
    if (!e.ok) expect(wwwAuthenticateHeader(e, "rest_read")).toContain('error="invalid_token"');
  });

  it("rotierter/widerrufener Schlüssel → 401", async () => {
    for (const status of ["rotiert", "widerrufen"] as const) {
      const e = await pruefeApiKey(portMit({ status }), header, { scope: "rest_read" });
      expect(e).toMatchObject({ ok: false, status: 401, grund: "schluessel_status" });
    }
  });

  it("abgelaufener Schlüssel → 401 (expires_at <= jetzt)", async () => {
    const e = await pruefeApiKey(
      portMit({ expiresAt: new Date("2026-01-01T00:00:00Z") }),
      header,
      { scope: "rest_read", jetzt: new Date("2026-07-01T00:00:00Z") },
    );
    expect(e).toMatchObject({ ok: false, status: 401, grund: "abgelaufen" });
  });

  it("zukünftiges expires_at bleibt gültig", async () => {
    const e = await pruefeApiKey(
      portMit({ expiresAt: new Date("2027-01-01T00:00:00Z") }),
      header,
      { scope: "rest_read", jetzt: new Date("2026-07-01T00:00:00Z") },
    );
    expect(e.ok).toBe(true);
  });

  it("pausierter/beendeter Partner → 403 partner_inactive", async () => {
    for (const partnerStatus of ["pausiert", "beendet"] as const) {
      const e = await pruefeApiKey(portMit({ partnerStatus }), header, { scope: "rest_read" });
      expect(e).toMatchObject({ ok: false, status: 403, code: "partner_inactive" });
    }
  });

  it("fehlender Scope → 403 insufficient_scope (inkl. RFC-6750-Header)", async () => {
    const e = await pruefeApiKey(portMit({ scopes: ["rest_read"] }), header, { scope: "mcp" });
    expect(e).toMatchObject({ ok: false, status: 403, code: "insufficient_scope", grund: "scope_fehlt" });
    if (!e.ok) {
      expect(wwwAuthenticateHeader(e, "mcp")).toBe(
        'Bearer realm="onelane-api", error="insufficient_scope", scope="mcp"',
      );
    }
  });

  it("gültiger Schlüssel mit Scope → ok + Datensatz", async () => {
    const e = await pruefeApiKey(portMit(), header, { scope: "mcp" });
    expect(e.ok).toBe(true);
    if (e.ok) expect(e.schluessel.prefix).toBe("olk_test");
  });

  it("KEIN_KEY_AUTH_PORT (Welle-1-Produktionsverhalten) lehnt JEDEN Schlüssel ab", async () => {
    const e = await pruefeApiKey(KEIN_KEY_AUTH_PORT, header, { scope: "rest_read" });
    expect(e).toMatchObject({ ok: false, status: 401, grund: "unbekannt" });
  });
});

describe("Audit-Redaktion (nur prefix, nie Token/Hash)", () => {
  it("scrubbt 64-Hex-Hashes und Bearer-Token aus String-Werten", () => {
    expect(scrubGeheimnisse(`hash=${sha256Hex(TOKEN)}`)).toBe("hash=[redigiert]");
    expect(scrubGeheimnisse(`Bearer ${TOKEN}`)).toBe("[redigiert]");
  });

  it("redigiert eingeschleuste Secrets in Ereignis-Feldern", () => {
    const redigiert = redigiereEreignis({
      ereignis: "api_auth_fehlgeschlagen",
      endpoint: "/api/v1/me",
      ausgang: "abgelehnt",
      grund: `hash:${sha256Hex(TOKEN)}`,
    });
    expect(JSON.stringify(redigiert)).not.toContain(sha256Hex(TOKEN));
  });

  it("Sammel-Port hält nur redigierte Ereignisse", () => {
    const audit = erstelleSammelAuditPort();
    audit.schreibe({
      ereignis: "api_zugriff",
      endpoint: "/api/v1/me",
      ausgang: "ok",
      schluesselPrefix: "olk_test",
      partnerName: `x Bearer ${TOKEN}`,
    });
    const json = JSON.stringify(audit.ereignisse);
    expect(json).toContain("olk_test");
    expect(json).not.toContain(TOKEN);
  });
});

describe("baueMeAntwort", () => {
  it("liefert nur Selbstauskunfts-Felder (kein Hash, keine IDs)", () => {
    const antwort = baueMeAntwort(datensatz());
    expect(antwort).toEqual({
      partner: { name: "Partner Test", status: "aktiv" },
      schluessel: { prefix: "olk_test", scopes: ["mcp", "rest_read"], status: "aktiv", laeuftAbAm: null },
    });
    expect(JSON.stringify(antwort)).not.toContain("33333333");
  });
});
