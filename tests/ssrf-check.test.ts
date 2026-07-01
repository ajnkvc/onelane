import { describe, it, expect } from "vitest";
import { isPublicIp, assertPublicUrl } from "../scripts/lib/ssrf-check.mjs";

/**
 * ssrf-check.test.ts — SSRF-Vorprüfung für Tooling (F-020, scripts/lib/ssrf-check.mjs).
 * Nur die netzwerkfreien Pfade: isPublicIp + assertPublicUrl mit IP-Literalen/Schema.
 */
describe("isPublicIp", () => {
  it("akzeptiert öffentliche Unicast-IPs", () => {
    for (const ip of ["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"]) expect(isPublicIp(ip)).toBe(true);
  });
  it("blockt loopback/privat/link-local/metadata + Müll", () => {
    for (const ip of ["127.0.0.1", "10.0.0.1", "192.168.1.1", "172.16.0.1", "169.254.169.254", "::1", "fe80::1", "not-an-ip"]) {
      expect(isPublicIp(ip)).toBe(false);
    }
  });
});

describe("assertPublicUrl (IP-Literal + Schema, ohne DNS)", () => {
  it("lehnt nicht-http(s) ab", async () => {
    await expect(assertPublicUrl("ftp://example.com")).rejects.toThrow(/http/);
  });
  it("lehnt nicht-öffentliche IP-Literale ab", async () => {
    await expect(assertPublicUrl("http://127.0.0.1/x")).rejects.toThrow(/nicht-öffentlich/);
    await expect(assertPublicUrl("http://169.254.169.254/latest/meta-data")).rejects.toThrow(/nicht-öffentlich/);
  });
  it("akzeptiert ein öffentliches IP-Literal", async () => {
    const u = await assertPublicUrl("https://8.8.8.8/");
    expect(u.hostname).toBe("8.8.8.8");
  });
});
