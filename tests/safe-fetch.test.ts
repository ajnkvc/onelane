import { describe, it, expect, vi, beforeEach } from "vitest";

// safe-fetch importiert "server-only"; in Vitest (Node) als No-op mocken.
vi.mock("server-only", () => ({}));

// undici mocken, um die Redirect-Matrix ohne Netzwerk zu testen (F-101).
const { mockUndiciFetch } = vi.hoisted(() => ({ mockUndiciFetch: vi.fn() }));
vi.mock("undici", () => ({
  Agent: class {},
  fetch: mockUndiciFetch,
}));

import {
  stripToSafeRedirect,
  capResponse,
  safeFetch,
  assertSafeUrl,
  SsrfBlockedError,
} from "@/server/egress/safe-fetch";

/**
 * safe-fetch.test.ts — Regressionstests der zentralen Egress-Barriere (Block 6).
 * Deckt die zuvor ungetestete Logik ab: Redirect-Header-Allowlist (F-072), Response-Cap
 * (Content-Length + Stream, async cancel), Input-Validierung (timeoutMs/maxBytes) und die
 * fail-closed Vorprüfung (https/IP-Literal/Allowlist inkl. leere Allowlist F-071) — alles
 * OHNE echten Netzwerkzugriff.
 */

function fakeUndiciRes(opts: { headers?: Record<string, string>; chunks?: Uint8Array[] }) {
  const headers = new Headers(opts.headers ?? {});
  let i = 0;
  const chunks = opts.chunks ?? [];
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i < chunks.length) controller.enqueue(chunks[i++]);
      else controller.close();
    },
  });
  return { body, headers, status: 200, statusText: "OK" } as unknown as Awaited<
    ReturnType<typeof import("undici").fetch>
  >;
}

describe("stripToSafeRedirect (F-072 — Header-Allowlist statt Denylist)", () => {
  it("baut Header aus enger Allowlist neu auf + verwirft Body", () => {
    const out = stripToSafeRedirect({
      method: "POST",
      body: "geheim",
      headers: {
        authorization: "Bearer x",
        "x-api-key": "k",
        "x-tenant-id": "t",
        cookie: "c",
        accept: "application/json",
        "user-agent": "onelane",
      },
    });
    const h = new Headers(out.headers as HeadersInit);
    expect(h.get("accept")).toBe("application/json");
    expect(h.get("user-agent")).toBe("onelane");
    // Unbekannte/sensible Header überleben NICHT.
    expect(h.get("authorization")).toBeNull();
    expect(h.get("x-api-key")).toBeNull();
    expect(h.get("x-tenant-id")).toBeNull();
    expect(h.get("cookie")).toBeNull();
    expect(out.body).toBeUndefined();
  });
});

describe("capResponse (Response-Cap, async cancel)", () => {
  it("wirft bei Content-Length > maxBytes (awaited cancel)", async () => {
    await expect(
      capResponse(fakeUndiciRes({ headers: { "content-length": "100" } }), 10),
    ).rejects.toBeInstanceOf(SsrfBlockedError);
  });
  it("lässt Antworten <= maxBytes durch", async () => {
    const out = await capResponse(fakeUndiciRes({ chunks: [new Uint8Array(5)] }), 100);
    expect(new Uint8Array(await out.arrayBuffer()).byteLength).toBe(5);
  });
  it("bricht ab, wenn der Stream maxBytes überschreitet", async () => {
    const out = await capResponse(fakeUndiciRes({ chunks: [new Uint8Array(20)] }), 10);
    await expect(out.arrayBuffer()).rejects.toThrow();
  });
});

describe("safeFetch Input-/Vorprüfung (fail-closed, ohne Netzwerk)", () => {
  it("lehnt ungültige timeoutMs ab", async () => {
    for (const t of [0, -1, 40_000, Number.NaN]) {
      await expect(safeFetch("https://example.com", {}, { timeoutMs: t })).rejects.toThrow(/timeoutMs/);
    }
  });
  it("lehnt ungültige maxBytes ab", async () => {
    await expect(safeFetch("https://example.com", {}, { maxBytes: 0 })).rejects.toThrow(/maxBytes/);
  });
  it("lehnt nicht-https ab", async () => {
    await expect(safeFetch("http://example.com")).rejects.toBeInstanceOf(SsrfBlockedError);
  });
  it("lehnt IP-Literale ab", async () => {
    await expect(safeFetch("https://1.2.3.4/x")).rejects.toThrow(/IP-Literal/);
  });
  it("lehnt leere Allowlist ab (F-071 fail-closed)", async () => {
    await expect(safeFetch("https://example.com", {}, { allowlist: [] })).rejects.toThrow(/Allowlist/);
  });
});

describe("safeFetch Redirect-Matrix (F-101, undici gemockt)", () => {
  const redirect = (status: number, location: string) =>
    ({ status, headers: new Headers({ location }), body: null }) as unknown as Awaited<
      ReturnType<typeof import("undici").fetch>
    >;
  const final = () =>
    ({
      status: 200,
      headers: new Headers(),
      body: new ReadableStream<Uint8Array>({ start: (c) => c.close() }),
    }) as unknown as Awaited<ReturnType<typeof import("undici").fetch>>;

  const urlOf = (i: number) => mockUndiciFetch.mock.calls[i][0] as string;
  const initOf = (i: number) => mockUndiciFetch.mock.calls[i][1] as {
    method?: string;
    body?: unknown;
    headers?: HeadersInit;
  };
  const hdr = (i: number, name: string) => new Headers(initOf(i).headers).get(name);
  // Einheitliche Ausgangs-Header für jeden Matrixfall (Same-Origin bewahrt, Cross-Origin strippt).
  const HDRS = { authorization: "Bearer x", "x-api-key": "k", accept: "application/json" };

  beforeEach(() => mockUndiciFetch.mockReset());

  // Hilfs-Assertion für einen Hop: URL, Methode, Body, Header (allow = bleiben, strip = entfernt).
  function expectHop(
    i: number,
    exp: { url: string; method: string; body: unknown; auth: string | null; accept: string | null },
  ) {
    expect(urlOf(i)).toBe(exp.url);
    expect(initOf(i).method).toBe(exp.method);
    expect(initOf(i).body).toBe(exp.body);
    expect(hdr(i, "authorization")).toBe(exp.auth);
    expect(hdr(i, "accept")).toBe(exp.accept);
  }

  it("303 → GET (Body weg) für nicht-GET; Same-Origin bewahrt Header", async () => {
    mockUndiciFetch
      .mockResolvedValueOnce(redirect(303, "https://example.com/next"))
      .mockResolvedValueOnce(final());
    await safeFetch("https://example.com/start", { method: "POST", body: "x", headers: { ...HDRS } });
    expect(mockUndiciFetch).toHaveBeenCalledTimes(2);
    expectHop(0, { url: "https://example.com/start", method: "POST", body: "x", auth: "Bearer x", accept: "application/json" });
    expectHop(1, { url: "https://example.com/next", method: "GET", body: undefined, auth: "Bearer x", accept: "application/json" });
  });

  it("302 → GET NUR für POST; Same-Origin bewahrt Header", async () => {
    mockUndiciFetch
      .mockResolvedValueOnce(redirect(302, "https://example.com/n"))
      .mockResolvedValueOnce(final());
    await safeFetch("https://example.com/s", { method: "POST", body: "x", headers: { ...HDRS } });
    expect(mockUndiciFetch).toHaveBeenCalledTimes(2);
    expectHop(0, { url: "https://example.com/s", method: "POST", body: "x", auth: "Bearer x", accept: "application/json" });
    expectHop(1, { url: "https://example.com/n", method: "GET", body: undefined, auth: "Bearer x", accept: "application/json" });
  });

  it("301 → PUT bleibt PUT + Body; Same-Origin bewahrt Header (Blocker-2-Fix)", async () => {
    mockUndiciFetch
      .mockResolvedValueOnce(redirect(301, "https://example.com/n"))
      .mockResolvedValueOnce(final());
    await safeFetch("https://example.com/s", { method: "PUT", body: "x", headers: { ...HDRS } });
    expect(mockUndiciFetch).toHaveBeenCalledTimes(2);
    expectHop(0, { url: "https://example.com/s", method: "PUT", body: "x", auth: "Bearer x", accept: "application/json" });
    expectHop(1, { url: "https://example.com/n", method: "PUT", body: "x", auth: "Bearer x", accept: "application/json" });
  });

  it("307 → Methode + Body unverändert (POST); Same-Origin bewahrt Header", async () => {
    mockUndiciFetch
      .mockResolvedValueOnce(redirect(307, "https://example.com/n"))
      .mockResolvedValueOnce(final());
    await safeFetch("https://example.com/s", { method: "POST", body: "x", headers: { ...HDRS } });
    expect(mockUndiciFetch).toHaveBeenCalledTimes(2);
    expectHop(0, { url: "https://example.com/s", method: "POST", body: "x", auth: "Bearer x", accept: "application/json" });
    expectHop(1, { url: "https://example.com/n", method: "POST", body: "x", auth: "Bearer x", accept: "application/json" });
  });

  it("Cross-Origin-Redirect: Header auf Allowlist reduziert (authorization/x-api-key weg), Body weg", async () => {
    mockUndiciFetch
      .mockResolvedValueOnce(redirect(302, "https://evil.com/n"))
      .mockResolvedValueOnce(final());
    await safeFetch("https://example.com/s", { method: "POST", body: "geheim", headers: { ...HDRS } });
    expect(mockUndiciFetch).toHaveBeenCalledTimes(2);
    expectHop(0, { url: "https://example.com/s", method: "POST", body: "geheim", auth: "Bearer x", accept: "application/json" });
    // Hop 1: Cross-Origin → authorization/x-api-key entfernt, accept (Allowlist) bleibt, Body weg, 302-POST→GET.
    expectHop(1, { url: "https://evil.com/n", method: "GET", body: undefined, auth: null, accept: "application/json" });
    expect(hdr(1, "x-api-key")).toBeNull();
  });

  it("zu viele Redirects → SsrfBlockedError (MAX_REDIRECTS+1 Hops)", async () => {
    mockUndiciFetch.mockResolvedValue(redirect(302, "https://example.com/loop"));
    await expect(safeFetch("https://example.com/s")).rejects.toBeInstanceOf(SsrfBlockedError);
    expect(mockUndiciFetch).toHaveBeenCalledTimes(4); // hop 0..3 (MAX_REDIRECTS=3), dann throw
    expect(urlOf(0)).toBe("https://example.com/s");
    expect(urlOf(1)).toBe("https://example.com/loop");
    expect(urlOf(3)).toBe("https://example.com/loop");
  });
});

describe("assertSafeUrl (F-071 Allowlist-Semantik)", () => {
  it("leere Allowlist = kein Host erlaubt", () => {
    expect(() => assertSafeUrl("https://example.com", [])).toThrow(/Allowlist/);
  });
  it("gesetzte Allowlist erzwingt Host", () => {
    expect(() => assertSafeUrl("https://evil.com", ["example.com"])).toThrow(/Allowlist/);
    expect(assertSafeUrl("https://example.com", ["example.com"]).host).toBe("example.com");
  });
  it("undefined Allowlist = keine Host-Restriktion", () => {
    expect(assertSafeUrl("https://example.com").host).toBe("example.com");
  });
});
