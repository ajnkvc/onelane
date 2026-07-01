import { describe, it, expect, vi } from "vitest";

// origin-guard importiert "server-only"; in Vitest (Node) als No-op mocken.
vi.mock("server-only", () => ({}));

import { isSameOrigin, assertSameOrigin, isOriginAllowed, CsrfOriginError } from "@/server/auth/origin-guard";
import { parseClaims } from "@/server/dal/claims-schema";
import { withElevatedAudit } from "@/server/dal/elevated";
import { hardenAuthCookie } from "@/server/auth/cookie-options";
import { withMutationGuards } from "@/server/auth/mutation-guard";
import {
  requireUser,
  requireAccountType,
  toHttpAuthError,
  AuthorizationError,
  AuthenticationRequiredError,
  ForbiddenError,
} from "@/server/auth/permissions";

const UUID = "11111111-1111-4111-8111-111111111111";

/** Minimaler Request-Stub: die Guards nutzen nur method + headers.get(). */
function req(method: string, headers: Record<string, string>): Request {
  return {
    method,
    headers: { get: (k: string) => headers[k.toLowerCase()] ?? null },
  } as unknown as Request;
}

describe("origin-guard (CSRF erste Linie) — kanonische Allowlist (F-057)", () => {
  // Reine Kernprüfung: volle Origin (Scheme+Host+Port) gegen Allowlist; localhost nur in Dev.
  it("isOriginAllowed: exakte Origin-Übereinstimmung (Scheme zählt)", () => {
    const allow = ["https://onelane.de"];
    expect(isOriginAllowed("https://onelane.de", allow, { allowLocalhost: false })).toBe(true);
    expect(isOriginAllowed("http://onelane.de", allow, { allowLocalhost: false })).toBe(false); // falsches Scheme
    expect(isOriginAllowed("https://evil.com", allow, { allowLocalhost: false })).toBe(false);
    expect(isOriginAllowed(null, allow, { allowLocalhost: false })).toBe(false);
  });
  it("isOriginAllowed: localhost nur mit allowLocalhost (Dev)", () => {
    expect(isOriginAllowed("http://localhost:3001", [], { allowLocalhost: true })).toBe(true);
    expect(isOriginAllowed("http://localhost:3001", [], { allowLocalhost: false })).toBe(false);
  });

  // Integration: im Test ist getSiteUrl()=http://localhost:3000 + Dev (allowLocalhost=true).
  it("erkennt same-origin (localhost) über Origin", () => {
    expect(isSameOrigin(req("POST", { origin: "http://localhost:3000" }))).toBe(true);
  });
  it("lehnt cross-origin ab", () => {
    expect(isSameOrigin(req("POST", { origin: "https://evil.com" }))).toBe(false);
  });
  it("fällt auf Referer zurück", () => {
    expect(isSameOrigin(req("POST", { referer: "http://localhost:3000/x" }))).toBe(true);
  });
  it("ohne Origin/Referer = nicht same-origin (deny-by-default)", () => {
    expect(isSameOrigin(req("POST", {}))).toBe(false);
  });
  it("assertSameOrigin wirft bei cross-origin POST", () => {
    expect(() => assertSameOrigin(req("POST", { origin: "https://evil.com" }))).toThrow(CsrfOriginError);
  });
  it("assertSameOrigin erlaubt same-origin POST", () => {
    expect(() => assertSameOrigin(req("POST", { origin: "http://localhost:3000" }))).not.toThrow();
  });
  it("assertSameOrigin ist No-op für GET (auch cross-origin)", () => {
    expect(() => assertSameOrigin(req("GET", { origin: "https://evil.com" }))).not.toThrow();
  });
  it("assertSameOrigin wirft bei mutierendem Request ohne Origin/Referer", () => {
    expect(() => assertSameOrigin(req("DELETE", {}))).toThrow(CsrfOriginError);
  });
});

describe("claims-schema (RLS-Invariante: nur sub)", () => {
  it("entfernt unbekannte Felder (kein Privilege-Smuggling über Claims)", () => {
    const out = parseClaims({ sub: UUID, role: "admin", account_typ: "platform_staff", foo: 1 });
    expect(out).toEqual({ sub: UUID });
    expect("role" in out).toBe(false);
  });
  it("wirft bei ungültiger sub", () => {
    expect(() => parseClaims({ sub: "not-a-uuid" })).toThrow();
  });
  it("wirft bei fehlender sub", () => {
    expect(() => parseClaims({})).toThrow();
  });
});

describe("withElevatedAudit (Validierung VOR DB-Zugriff)", () => {
  it("lehnt ungültigen eventType ab (ohne DB-Verbindung)", async () => {
    await expect(
      withElevatedAudit({ eventType: "Bad Token", initiatorType: "tooling" }, async () => 1),
    ).rejects.toThrow(/eventType/);
  });
  it("lehnt ungültigen initiatorType ab (F-012, ohne DB-Verbindung)", async () => {
    await expect(
      withElevatedAudit({ eventType: "test_event", initiatorType: "Bad Init" }, async () => 1),
    ).rejects.toThrow(/initiatorType/);
  });
  it("lehnt zu große metadata ab", async () => {
    await expect(
      withElevatedAudit(
        { eventType: "test_event", initiatorType: "tooling", metadata: { big: "x".repeat(9000) } },
        async () => 1,
      ),
    ).rejects.toThrow(/8 KB|metadata/);
  });
});

describe("permissions — Fehlerklassen + HTTP-Mapping (F-087)", () => {
  it("requireUser wirft AuthenticationRequiredError (401)", () => {
    try {
      requireUser(null);
      throw new Error("sollte werfen");
    } catch (e) {
      expect(e).toBeInstanceOf(AuthenticationRequiredError);
      expect((e as AuthenticationRequiredError).status).toBe(401);
    }
  });
  it("requireAccountType wirft ForbiddenError (403)", () => {
    try {
      requireAccountType("student", ["platform_staff"]);
      throw new Error("sollte werfen");
    } catch (e) {
      expect(e).toBeInstanceOf(ForbiddenError);
      expect((e as ForbiddenError).status).toBe(403);
    }
  });
  it("requireUser gibt den Nutzer zurück, wenn vorhanden", () => {
    const u = { id: "11111111-1111-4111-8111-111111111111", email: null };
    expect(requireUser(u)).toBe(u);
  });
  it("toHttpAuthError mappt AuthorizationError, CsrfOriginError und Unbekanntes", () => {
    expect(toHttpAuthError(new AuthorizationError())).toEqual({ status: 403, code: "forbidden" });
    expect(toHttpAuthError(new AuthenticationRequiredError())).toEqual({ status: 401, code: "authentication_required" });
    expect(toHttpAuthError(new CsrfOriginError())).toEqual({ status: 403, code: "csrf_origin" });
    expect(toHttpAuthError(new Error("boom"))).toEqual({ status: 500, code: "internal" });
  });
});

describe("cookie-options — host-only + path Härtung (F-058)", () => {
  it("entfernt Domain, erzwingt path=/, httpOnly, sameSite=lax", () => {
    const out = hardenAuthCookie({ domain: "evil.example", path: "/sub", sameSite: "none", secure: false });
    expect("domain" in out).toBe(false);
    expect(out.path).toBe("/");
    expect(out.httpOnly).toBe(true);
    expect(out.sameSite).toBe("lax");
  });
});

describe("withMutationGuards — zentrales CSRF/Fehler-Gate (F-056)", () => {
  it("blockt cross-origin POST mit 403 csrf_origin", async () => {
    const handler = withMutationGuards(async () => Response.json({ ok: true }));
    const res = await handler(req("POST", { origin: "https://evil.com" }));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "csrf_origin" });
  });
  it("lässt same-origin POST durch", async () => {
    const handler = withMutationGuards(async () => Response.json({ ok: true }));
    const res = await handler(req("POST", { origin: "http://localhost:3000" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
  it("mappt AuthorizationError aus dem Handler auf 401/403", async () => {
    const handler = withMutationGuards(async () => {
      throw new AuthenticationRequiredError();
    });
    const res = await handler(req("POST", { origin: "http://localhost:3000" }));
    expect(res.status).toBe(401);
  });
});
