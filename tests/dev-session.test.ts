import { afterEach, describe, expect, it, vi } from "vitest";

// server-only + next/headers sind in Vitest (Node) als No-op zu mocken.
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));

/**
 * dev-session.test.ts — Kill-Switch- und Signatur-Tests des Dev-Session-Seams
 * (Review-Auflage 4): Produktion → throw; Mischkonfiguration (Supabase-Config +
 * Flag) → throw; fehlendes/kurzes Secret → throw; Cookie-Signatur fail-closed
 * (Tamper/fremde UUID/fremdes Secret → null; nur Allowlist-IDs signierbar).
 *
 * public-config/dev-session lesen process.env beim Modul-Load bzw. zur Laufzeit —
 * pro Fall Env stubben, Module zurücksetzen, frisch importieren
 * (Muster tests/public-config.test.ts).
 */
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

const SECRET = "x".repeat(32);

async function loadConfig() {
  vi.resetModules();
  return import("@/server/config/dev-session");
}

async function loadAdapter() {
  vi.resetModules();
  return import("@/server/auth/dev-session");
}

describe("Dev-Session-Seam — Config-Gate (fail-closed)", () => {
  it("Flag nicht gesetzt → null (Seam existiert nicht)", async () => {
    const { getDevSessionConfig } = await loadConfig();
    expect(getDevSessionConfig()).toBeNull();
  });

  it("KILL-SWITCH: Flag in Produktion → harter Throw", async () => {
    vi.stubEnv("ONELANE_DEV_SESSION", "1");
    vi.stubEnv("ONELANE_DEV_SESSION_SECRET", SECRET);
    vi.stubEnv("NODE_ENV", "production");
    const { getDevSessionConfig } = await loadConfig();
    expect(() => getDevSessionConfig()).toThrow(/Produktion/);
  });

  it("MISCHKONFIGURATION: Flag + Supabase-Config → harter Throw", async () => {
    vi.stubEnv("ONELANE_DEV_SESSION", "1");
    vi.stubEnv("ONELANE_DEV_SESSION_SECRET", SECRET);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_1");
    const { getDevSessionConfig } = await loadConfig();
    expect(() => getDevSessionConfig()).toThrow(/Mischkonfiguration/);
  });

  it("fehlendes oder zu kurzes Secret → harter Throw", async () => {
    vi.stubEnv("ONELANE_DEV_SESSION", "1");
    const ohneSecret = await loadConfig();
    expect(() => ohneSecret.getDevSessionConfig()).toThrow(/SECRET/);

    vi.stubEnv("ONELANE_DEV_SESSION_SECRET", "kurz");
    const kurzesSecret = await loadConfig();
    expect(() => kurzesSecret.getDevSessionConfig()).toThrow(/SECRET/);
  });

  it("korrekt verriegelt (Dev, kein Supabase, Secret) → Config", async () => {
    vi.stubEnv("ONELANE_DEV_SESSION", "1");
    vi.stubEnv("ONELANE_DEV_SESSION_SECRET", SECRET);
    const { getDevSessionConfig } = await loadConfig();
    expect(getDevSessionConfig()).toEqual({ secret: SECRET });
  });
});

describe("Dev-Session-Seam — Cookie-Signatur (HMAC, Allowlist)", () => {
  it("Roundtrip: signierter Allowlist-User wird mit aal verifiziert", async () => {
    const { DEV_USERS, signDevSessionValue, verifyDevSessionValue } = await loadAdapter();
    const wert = signDevSessionValue(DEV_USERS[0].id, "aal2", SECRET);
    expect(verifyDevSessionValue(wert, SECRET)).toEqual({ id: DEV_USERS[0].id, aal: "aal2" });
  });

  it("KEINE freie UUID: Signieren fremder IDs wirft; verifizieren fremd-signierter Werte scheitert", async () => {
    const { signDevSessionValue, verifyDevSessionValue } = await loadAdapter();
    const fremd = "99999999-9999-4999-8999-999999999999";
    expect(() => signDevSessionValue(fremd, "aal1", SECRET)).toThrow(/Allowlist/);
    // selbst ein formal korrekt signierter fremder Wert (manuell gebaut) fällt an der Allowlist
    const { createHmac } = await import("node:crypto");
    const payload = `v1.${fremd}.aal1`;
    const manuell = `${payload}.${createHmac("sha256", SECRET).update(payload).digest("hex")}`;
    expect(verifyDevSessionValue(manuell, SECRET)).toBeNull();
  });

  it("Tamper (aal1→aal2), falsches Secret, kaputtes Format → null", async () => {
    const { DEV_USERS, signDevSessionValue, verifyDevSessionValue } = await loadAdapter();
    const wert = signDevSessionValue(DEV_USERS[0].id, "aal1", SECRET);
    expect(verifyDevSessionValue(wert.replace(".aal1.", ".aal2."), SECRET)).toBeNull();
    expect(verifyDevSessionValue(wert, "y".repeat(32))).toBeNull();
    expect(verifyDevSessionValue(undefined, SECRET)).toBeNull();
    expect(verifyDevSessionValue("v1.kaputt", SECRET)).toBeNull();
  });

  it("Allowlist und Seed-Konstanten bleiben synchron (feste UUIDs, 9 Rollen)", async () => {
    const { DEV_USERS } = await loadAdapter();
    expect(DEV_USERS).toHaveLength(9);
    expect(new Set(DEV_USERS.map((u) => u.id)).size).toBe(9);
    for (const u of DEV_USERS) {
      expect(u.id).toMatch(/^11111111-1111-4111-8111-0000000000\d\d$/);
    }
  });
});
