import { beforeEach, describe, expect, it, vi } from "vitest";

// server-only als Mock (Muster tests/shell-actions.test.ts) — der Wrapper zieht
// den In-Memory-Limiter aus @/server/adapters/ratelimit (server-only-Modul).
vi.mock("server-only", () => ({}));

import { erstelleSammelAuditPort } from "@/modules/api/audit";
import { apiJson, withApiKeyAuth } from "@/modules/api/route-wrapper";
import { erstelleInMemoryKeyAuthPort, sha256Hex, type ApiKeyDatensatz } from "@/modules/api/port";
import { baueMeAntwort } from "@/modules/api/me";

/**
 * api-route-wrapper.test.ts — Guard-Kette der Key-Auth-Endpunkte (Paket C).
 * ----------------------------------------------------------------------------
 * withApiKeyAuth gegen das In-Memory-Double: 401/403/429/500-Mapping, RFC-6750-
 * Header, no-store, Key-Rate-Limit und das redigierte Audit (nie Token/Hash).
 * Ohne injizierten Port gilt das Welle-1-Produktionsverhalten: fail-closed 401.
 */

const TOKEN = "olk_wrapper_test_0123456789abcdef0000";
const datensatz = (patch: Partial<ApiKeyDatensatz> = {}): ApiKeyDatensatz => ({
  id: crypto.randomUUID(),
  prefix: "olk_wrap",
  scopes: ["rest_read", "mcp"],
  status: "aktiv",
  expiresAt: null,
  partnerId: crypto.randomUUID(),
  partnerName: "Partner Wrap",
  partnerStatus: "aktiv",
  ...patch,
});

let ipZaehler = 0;
/** Jede Anfrage eigene IP — das IP-Limit (120/min) bleibt testneutral. */
function anfrage(headers: Record<string, string> = {}, ip?: string): Request {
  ipZaehler += 1;
  return new Request("https://api.test/api/v1/me", {
    headers: { "x-forwarded-for": ip ?? `10.0.${Math.floor(ipZaehler / 200)}.${ipZaehler % 200}`, ...headers },
  });
}

beforeEach(() => {
  vi.unstubAllEnvs();
  // Standard-Port-Auflösung darf NIE auf den Dev-Adapter fallen (kein Seam).
  vi.stubEnv("ONELANE_DEV_SESSION", "");
});

describe("withApiKeyAuth", () => {
  it("ohne Header → 401 + WWW-Authenticate + no-store, Audit ohne Prefix", async () => {
    const audit = erstelleSammelAuditPort();
    const handler = withApiKeyAuth(async () => apiJson({ ok: true }), {
      scope: "rest_read",
      endpoint: "/api/v1/me",
      port: erstelleInMemoryKeyAuthPort([]),
      audit,
    });
    const res = await handler(anfrage());
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toBe('Bearer realm="onelane-api"');
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ error: "authentication_required" });
    expect(audit.ereignisse).toEqual([
      {
        ereignis: "api_auth_fehlgeschlagen",
        endpoint: "/api/v1/me",
        ausgang: "abgelehnt",
        grund: "header_fehlt",
        schluesselPrefix: undefined,
        partnerName: undefined,
      },
    ]);
  });

  it("unbekanntes Token → 401; Audit enthält weder Token noch Hash", async () => {
    const audit = erstelleSammelAuditPort();
    const handler = withApiKeyAuth(async () => apiJson({ ok: true }), {
      scope: "rest_read",
      endpoint: "/api/v1/me",
      port: erstelleInMemoryKeyAuthPort([]),
      audit,
    });
    const res = await handler(anfrage({ authorization: `Bearer ${TOKEN}` }));
    expect(res.status).toBe(401);
    const json = JSON.stringify(audit.ereignisse);
    expect(json).not.toContain(TOKEN);
    expect(json).not.toContain(sha256Hex(TOKEN));
  });

  it("gültiger Schlüssel → Handler bekommt Datensatz; Audit ok mit Prefix", async () => {
    const audit = erstelleSammelAuditPort();
    const schluessel = datensatz();
    const handler = withApiKeyAuth(
      async (_request, s) => apiJson(baueMeAntwort(s)),
      {
        scope: "rest_read",
        endpoint: "/api/v1/me",
        port: erstelleInMemoryKeyAuthPort([{ token: TOKEN, datensatz: schluessel }]),
        audit,
      },
    );
    const res = await handler(anfrage({ authorization: `Bearer ${TOKEN}` }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ partner: { name: "Partner Wrap" } });
    expect(audit.ereignisse.at(-1)).toMatchObject({
      ereignis: "api_zugriff",
      ausgang: "ok",
      schluesselPrefix: "olk_wrap",
    });
  });

  it("fehlender Scope → 403 insufficient_scope", async () => {
    const handler = withApiKeyAuth(async () => apiJson({ ok: true }), {
      scope: "mcp",
      endpoint: "/api/mcp",
      port: erstelleInMemoryKeyAuthPort([
        { token: TOKEN, datensatz: datensatz({ scopes: ["rest_read"] }) },
      ]),
      audit: erstelleSammelAuditPort(),
    });
    const res = await handler(anfrage({ authorization: `Bearer ${TOKEN}` }));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "insufficient_scope" });
    expect(res.headers.get("www-authenticate")).toContain('scope="mcp"');
  });

  it("Key-Rate-Limit: 61. Anfrage desselben Schlüssels → 429 + retry-after", async () => {
    const audit = erstelleSammelAuditPort();
    const handler = withApiKeyAuth(async () => apiJson({ ok: true }), {
      scope: "rest_read",
      endpoint: "/api/v1/me",
      port: erstelleInMemoryKeyAuthPort([{ token: TOKEN, datensatz: datensatz() }]),
      audit,
    });
    let letzte: Response | null = null;
    for (let i = 0; i < 61; i += 1) {
      letzte = await handler(anfrage({ authorization: `Bearer ${TOKEN}` }));
    }
    expect(letzte?.status).toBe(429);
    expect(Number(letzte?.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(await letzte?.json()).toEqual({ error: "rate_limited" });
    expect(audit.ereignisse.at(-1)).toMatchObject({
      ereignis: "api_rate_limit",
      grund: "rate_limit_key",
      schluesselPrefix: "olk_wrap",
    });
  });

  it("Handler-Fehler → 500 internal_error ohne Details, Audit ausgang fehler", async () => {
    const audit = erstelleSammelAuditPort();
    const handler = withApiKeyAuth(
      async () => {
        throw new Error("geheimes Detail mit IBAN DE00 1234");
      },
      {
        scope: "rest_read",
        endpoint: "/api/v1/me",
        port: erstelleInMemoryKeyAuthPort([{ token: TOKEN, datensatz: datensatz() }]),
        audit,
      },
    );
    const res = await handler(anfrage({ authorization: `Bearer ${TOKEN}` }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "internal_error" });
    expect(JSON.stringify(audit.ereignisse)).not.toContain("IBAN");
    expect(audit.ereignisse.at(-1)).toMatchObject({ ausgang: "fehler", grund: "error" });
  });

  it("OHNE injizierten Port (Welle-1-Standard, kein Dev-Seam) → fail-closed 401", async () => {
    const audit = erstelleSammelAuditPort();
    const handler = withApiKeyAuth(async () => apiJson({ ok: true }), {
      scope: "rest_read",
      endpoint: "/api/v1/me",
      audit,
    });
    const res = await handler(anfrage({ authorization: `Bearer ${TOKEN}` }));
    expect(res.status).toBe(401);
    expect(audit.ereignisse.at(-1)).toMatchObject({ grund: "unbekannt" });
  });
});

describe("apiJson", () => {
  it("setzt no-store", async () => {
    const res = apiJson({ ok: true });
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ ok: true });
  });
});
