import { describe, it, expect } from "vitest";
import { hardenAuthCookie } from "@/server/auth/cookie-options";

// Unit-Test der zentralen Cookie-Härtung. NODE_ENV ist im Test "test" (nicht
// "production") -> secure === false ist hier erwartet; in Prod ist es true.
describe("hardenAuthCookie", () => {
  it("erzwingt httpOnly + sameSite=lax + path-Default", () => {
    const out = hardenAuthCookie({});
    expect(out.httpOnly).toBe(true);
    expect(out.sameSite).toBe("lax");
    expect(out.path).toBe("/");
  });

  it("überschreibt unsichere Supabase-Vorgaben (httpOnly:false, sameSite:none) + erzwingt path=/", () => {
    const out = hardenAuthCookie({ httpOnly: false, sameSite: "none", path: "/x" });
    expect(out.httpOnly).toBe(true);
    expect(out.sameSite).toBe("lax");
    expect(out.path).toBe("/"); // F-058: path IMMER "/" (kein durchgereichter Fremd-Pfad)
  });

  it("entfernt ein durchgereichtes Domain-Attribut (host-only, F-058)", () => {
    const out = hardenAuthCookie({ domain: "evil.example" });
    expect("domain" in out).toBe(false);
  });

  it("lässt übrige Optionen (maxAge) unverändert — Token-Lebensdauer steuert Supabase", () => {
    const out = hardenAuthCookie({ maxAge: 1234 });
    expect(out.maxAge).toBe(1234);
  });

  it("secure ist in Nicht-Prod aus (lokaler http-Login)", () => {
    expect(hardenAuthCookie({}).secure).toBe(false);
  });
});
