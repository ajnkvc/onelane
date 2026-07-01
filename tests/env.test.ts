import { describe, it, expect, vi, afterEach } from "vitest";

// env.ts ist server-only; in Vitest (Node) als No-op mocken.
vi.mock("server-only", () => ({}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function load() {
  vi.resetModules();
  return import("@/server/config/env");
}

describe("getServerEnv — DATABASE_URL-Validierung (F-022)", () => {
  it("akzeptiert eine app_user-DSN", async () => {
    vi.stubEnv("DATABASE_URL", "postgres://app_user:pw@localhost:5432/app");
    const { getServerEnv } = await load();
    expect(getServerEnv().DATABASE_URL).toContain("app_user");
  });

  it("akzeptiert die Pooler-Variante app_user.<ref>", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://app_user.abcdef:pw@pooler.example.com:6543/app");
    const { getServerEnv } = await load();
    expect(getServerEnv().DATABASE_URL).toContain("app_user");
  });

  it("lehnt privilegierte Rollen ab (postgres/app_owner/service_role/supabase_admin)", async () => {
    for (const role of ["postgres", "app_owner", "service_role", "supabase_admin", "admin"]) {
      vi.stubEnv("DATABASE_URL", `postgres://${role}:pw@host.example.com/app`);
      const { getServerEnv } = await load();
      expect(() => getServerEnv(), role).toThrow();
    }
  });

  it("lehnt Nicht-postgres-Protokolle ab", async () => {
    vi.stubEnv("DATABASE_URL", "mysql://app_user:pw@host/app");
    const { getServerEnv } = await load();
    expect(() => getServerEnv()).toThrow();
  });

  it("lehnt eine kaputte DSN ab", async () => {
    vi.stubEnv("DATABASE_URL", "not-a-url");
    const { getServerEnv } = await load();
    expect(() => getServerEnv()).toThrow();
  });

  it("lehnt privilegierte Rolle in UPPERCASE ab (Normalisierung)", async () => {
    vi.stubEnv("DATABASE_URL", "postgres://POSTGRES:pw@host.example.com/app");
    const { getServerEnv } = await load();
    expect(() => getServerEnv()).toThrow();
  });

  it("lehnt URL-encodierte privilegierte Rolle ab (app%5Fowner → app_owner)", async () => {
    vi.stubEnv("DATABASE_URL", "postgres://app%5Fowner:pw@host.example.com/app");
    const { getServerEnv } = await load();
    expect(() => getServerEnv()).toThrow();
  });

  it("lehnt eine DSN ohne Username ab", async () => {
    vi.stubEnv("DATABASE_URL", "postgres://:pw@host.example.com/app");
    const { getServerEnv } = await load();
    expect(() => getServerEnv()).toThrow();
  });
});
