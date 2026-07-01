import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * public-config liest process.env beim Modul-Load. Daher pro Fall die Env stubben,
 * Module zurücksetzen und das Modul frisch importieren.
 */
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function loadConfig() {
  vi.resetModules();
  return import("@/lib/public-config");
}

describe("public-config", () => {
  it("behandelt leere Supabase-Strings als nicht gesetzt", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    const { getPublicSupabaseConfig } = await loadConfig();
    expect(getPublicSupabaseConfig()).toBeNull();
  });

  it("liefert Config mit neuem Publishable Key", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_1");
    const { getPublicSupabaseConfig } = await loadConfig();
    expect(getPublicSupabaseConfig()).toEqual({
      url: "https://example.supabase.co",
      publishableKey: "sb_publishable_1",
    });
  });

  it("akzeptiert den Legacy anon key als Fallback", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key-123");
    const { getPublicSupabaseConfig } = await loadConfig();
    expect(getPublicSupabaseConfig()).toEqual({
      url: "https://example.supabase.co",
      publishableKey: "anon-key-123",
    });
  });

  it("bevorzugt den Publishable Key vor dem Legacy anon key", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_1");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key-123");
    const { getPublicSupabaseConfig } = await loadConfig();
    expect(getPublicSupabaseConfig()?.publishableKey).toBe("sb_publishable_1");
  });

  it("greift bei leeren Werten auf Defaults zurück", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_CONTENT_SLUG", "");
    const { getSiteUrl, getContentSlug } = await loadConfig();
    expect(getSiteUrl()).toBe("http://localhost:3000");
    expect(getContentSlug()).toBe("ratgeber");
  });

  it("akzeptiert einen gültigen Content-Slug (^[a-z0-9-]+$)", async () => {
    vi.stubEnv("NEXT_PUBLIC_CONTENT_SLUG", "magazin-2");
    const { getContentSlug } = await loadConfig();
    expect(getContentSlug()).toBe("magazin-2");
  });

  it("lehnt einen ungültigen Content-Slug ab (wirft beim Laden)", async () => {
    vi.stubEnv("NEXT_PUBLIC_CONTENT_SLUG", "Bad Slug!");
    await expect(loadConfig()).rejects.toThrow();
  });

  // F-074: SITE_URL origin-only + Produktion https/kein localhost.
  it("normalisiert SITE_URL auf die Origin (kein Pfad/Query)", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://onelane.de");
    const { getSiteUrl } = await loadConfig();
    expect(getSiteUrl()).toBe("https://onelane.de");
  });
  it("lehnt SITE_URL mit Pfad/Query/Fragment ab", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://onelane.de/pfad?x=1");
    const { getSiteUrl } = await loadConfig();
    expect(() => getSiteUrl()).toThrow();
  });
  it("Produktion: SITE_URL localhost/http wird abgelehnt", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
    const { getSiteUrl } = await loadConfig();
    expect(() => getSiteUrl()).toThrow();
  });
  it("Produktion: gültige https-Origin wird akzeptiert", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://onelane.de");
    const { getSiteUrl } = await loadConfig();
    expect(getSiteUrl()).toBe("https://onelane.de");
  });

  // F-032: Supabase-Teilkonfiguration ist ein harter Fehler; beide leer = auth-los (null).
  it("wirft bei Supabase-Teilkonfiguration (nur URL, kein Key)", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    const { getPublicSupabaseConfig } = await loadConfig();
    expect(() => getPublicSupabaseConfig()).toThrow();
  });
  it("wirft bei Supabase-Teilkonfiguration (nur Key, keine URL)", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_1");
    const { getPublicSupabaseConfig } = await loadConfig();
    expect(() => getPublicSupabaseConfig()).toThrow();
  });

  // https-only für Supabase-/Map-URLs (blockt http/javascript/data) — wirft beim Laden.
  it("lehnt http/javascript-URLs für Supabase/Map ab (beim Laden)", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://example.supabase.co");
    await expect(loadConfig()).rejects.toThrow();
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.stubEnv("NEXT_PUBLIC_MAP_TILE_URL", "javascript:alert(1)");
    await expect(loadConfig()).rejects.toThrow();
  });

  it("lehnt Map-Tile-URL mit Host-Platzhalter {s} ab, akzeptiert Pfad-Platzhalter", async () => {
    vi.stubEnv("NEXT_PUBLIC_MAP_TILE_URL", "https://{s}.tile.example/{z}/{x}/{y}.png");
    await expect(loadConfig()).rejects.toThrow();
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.stubEnv("NEXT_PUBLIC_MAP_TILE_URL", "https://tiles.example/{z}/{x}/{y}.png");
    const { getMapTileConfig } = await loadConfig();
    expect(getMapTileConfig()?.tileUrl).toContain("tiles.example");
  });

  it("normalizePublicHttpUrl: nur http(s), keine Credentials, sonst null (H3)", async () => {
    const { normalizePublicHttpUrl } = await loadConfig();
    expect(normalizePublicHttpUrl("https://schule.de/kontakt")).toContain("https://schule.de");
    expect(normalizePublicHttpUrl("http://schule.de")).toContain("http://schule.de");
    for (const bad of [
      null, undefined, "", "javascript:alert(1)", " javascript:alert(1)", "data:text/html,x",
      "vbscript:x", "file:///etc/passwd", "//evil.com", "ftp://x.de", "https://u:p@x.de", "schule.de",
    ]) {
      expect(normalizePublicHttpUrl(bad), String(bad)).toBeNull();
    }
  });
});
