import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * F-093: getrennte Loader je tatsächlichem Bedarf. Wir stubben pro Fall die Env und setzen die
 * Schlüssel-Varianten explizit auf "" (= nicht gesetzt), damit eine real gesetzte Umgebung nicht stört.
 */
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("tooling-config — getToolingDbEnv (DB-only)", () => {
  it("liefert die DSN und verlangt KEIN Supabase-Secret (F-093)", async () => {
    vi.stubEnv("TOOLING_DATABASE_URL", "postgres://app_owner:x@localhost:5432/db");
    vi.stubEnv("SUPABASE_SECRET_KEY", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    const { getToolingDbEnv } = await import("@/server/config/tooling");
    // DB-only Pfad darf NICHT an einem fehlenden Supabase-Secret scheitern.
    expect(getToolingDbEnv().TOOLING_DATABASE_URL).toBe("postgres://app_owner:x@localhost:5432/db");
  });

  it("wirft, wenn die DSN fehlt", async () => {
    vi.stubEnv("TOOLING_DATABASE_URL", "");
    const { getToolingDbEnv } = await import("@/server/config/tooling");
    expect(() => getToolingDbEnv()).toThrow();
  });
});

describe("tooling-config — getSupabaseSecretEnv (Supabase-Admin/Webhook)", () => {
  function stubNoKeys() {
    vi.stubEnv("SUPABASE_SECRET_KEY", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
  }
  it("akzeptiert den neuen SUPABASE_SECRET_KEY", async () => {
    stubNoKeys();
    vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_1");
    const { getSupabaseSecretEnv } = await import("@/server/config/tooling");
    expect(getSupabaseSecretEnv().SUPABASE_SECRET_KEY).toBe("sb_secret_1");
  });

  it("fällt auf den Legacy SUPABASE_SERVICE_ROLE_KEY zurück", async () => {
    stubNoKeys();
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "legacy_role_key");
    const { getSupabaseSecretEnv } = await import("@/server/config/tooling");
    expect(getSupabaseSecretEnv().SUPABASE_SECRET_KEY).toBe("legacy_role_key");
  });

  it("bevorzugt den neuen Key vor dem Legacy-Key", async () => {
    stubNoKeys();
    vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_1");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "legacy_role_key");
    const { getSupabaseSecretEnv } = await import("@/server/config/tooling");
    expect(getSupabaseSecretEnv().SUPABASE_SECRET_KEY).toBe("sb_secret_1");
  });

  it("wirft, wenn beide Keys fehlen", async () => {
    stubNoKeys();
    const { getSupabaseSecretEnv } = await import("@/server/config/tooling");
    expect(() => getSupabaseSecretEnv()).toThrow();
  });
});
