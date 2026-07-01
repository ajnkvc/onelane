import { describe, it, expect } from "vitest";
import { normalizeToolingUrl } from "../scripts/lib/url-normalize.mjs";

/**
 * url-normalize.test.ts — Tooling-URL-Normalisierung (Block 7, Review-Blocker-Fix).
 * Der alte startsWith("http")-Ansatz verbog file:/ftp:/HTTPS: zu bogus-https; hier abgesichert.
 */
describe("normalizeToolingUrl", () => {
  it("ergänzt https bei schema-losem Hostname", () => {
    expect(normalizeToolingUrl("schule.de")).toBe("https://schule.de/");
    expect(normalizeToolingUrl("schule.de/kontakt")).toBe("https://schule.de/kontakt");
  });
  it("behält http und https", () => {
    expect(normalizeToolingUrl("http://schule.de")).toBe("http://schule.de/");
    expect(normalizeToolingUrl("https://schule.de/x")).toBe("https://schule.de/x");
  });
  it("normalisiert HTTPS:/HTTP: (case-insensitiv)", () => {
    expect(normalizeToolingUrl("HTTPS://schule.de")).toBe("https://schule.de/");
    expect(normalizeToolingUrl("HTTP://schule.de")).toBe("http://schule.de/");
  });
  it("lehnt nicht-http(s)-Schemes ab (file/ftp/javascript/data/vbscript)", () => {
    for (const bad of [
      "file:///etc/passwd", "ftp://x.de", "javascript:alert(1)", "data:text/html,x",
      "vbscript:x", " javascript:alert(1)", null, undefined, "", "   ",
    ]) {
      expect(normalizeToolingUrl(bad), String(bad)).toBeNull();
    }
  });
});
