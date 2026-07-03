import { describe, expect, it, vi } from "vitest";

// theme-script.tsx zieht lib/nonce (server-only + next/headers) — als No-op mocken.
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  headers: async () => ({ get: () => null }),
}));

import { parseTheme, THEME_COOKIE } from "@/lib/theme";
import { themeInitScript } from "@/components/portal/theme-script";

/**
 * theme.test.ts — Theme-Mechanik (OS-P1): Cookie-Parsing fail-closed und
 * statisches Inline-Script (keine Nutzereingabe, kein HTML-Escape-Bruch).
 */
describe("parseTheme (fail-closed)", () => {
  it("akzeptiert nur exakt 'light'/'dark'", () => {
    expect(parseTheme("light")).toBe("light");
    expect(parseTheme("dark")).toBe("dark");
  });
  it("alles andere = System (null)", () => {
    expect(parseTheme(undefined)).toBeNull();
    expect(parseTheme(null)).toBeNull();
    expect(parseTheme("")).toBeNull();
    expect(parseTheme("DARK")).toBeNull();
    expect(parseTheme("dark; injection")).toBeNull();
  });
  it("Cookie-Name bleibt stabil (Root-Layout + Action teilen ihn)", () => {
    expect(THEME_COOKIE).toBe("onelane-theme");
  });
});

describe("themeInitScript (statisch)", () => {
  it("ist eine Konstante ohne HTML-kritische Zeichen (<, &) und setzt nur .dark", () => {
    const script = themeInitScript();
    expect(script).not.toMatch(/[<&]/);
    expect(script).toContain("prefers-color-scheme: dark");
    expect(script).toContain('classList.add("dark")');
  });
});
