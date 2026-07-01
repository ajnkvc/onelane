import { describe, it, expect } from "vitest";
import { isPublicIp, assertSafeUrl, SsrfBlockedError } from "@/server/egress/ssrf-guard";

describe("isPublicIp", () => {
  it("erlaubt global routbares Unicast (v4/v6)", () => {
    expect(isPublicIp("8.8.8.8")).toBe(true);
    expect(isPublicIp("1.1.1.1")).toBe(true);
    expect(isPublicIp("2001:4860:4860::8888")).toBe(true);
  });
  it("blockt loopback/privat/link-local/metadata/0.0.0.0 (v4)", () => {
    for (const ip of ["127.0.0.1", "10.0.0.5", "172.16.0.1", "192.168.1.1", "169.254.169.254", "0.0.0.0"]) {
      expect(isPublicIp(ip)).toBe(false);
    }
  });
  it("blockt loopback/link-local/unique-local (v6) + IPv4-mapped", () => {
    for (const ip of ["::1", "fe80::1", "fc00::1", "::ffff:127.0.0.1", "::ffff:10.0.0.1"]) {
      expect(isPublicIp(ip)).toBe(false);
    }
  });
  it("blockt Müll/leere Eingabe", () => {
    expect(isPublicIp("nope")).toBe(false);
    expect(isPublicIp("")).toBe(false);
  });
});

describe("assertSafeUrl", () => {
  it("akzeptiert https mit öffentlichem Host", () => {
    expect(assertSafeUrl("https://example.com/x").hostname).toBe("example.com");
  });
  it("lehnt nicht-https ab (http/file)", () => {
    expect(() => assertSafeUrl("http://example.com")).toThrow(SsrfBlockedError);
    expect(() => assertSafeUrl("file:///etc/passwd")).toThrow(SsrfBlockedError);
  });
  it("lehnt Zugangsdaten (user:pass@) ab", () => {
    expect(() => assertSafeUrl("https://user:pass@example.com")).toThrow(SsrfBlockedError);
  });
  it("lehnt private/Metadata-IP-Literale (v4/v6) ab", () => {
    expect(() => assertSafeUrl("https://127.0.0.1/")).toThrow(SsrfBlockedError);
    expect(() => assertSafeUrl("https://169.254.169.254/latest/meta-data")).toThrow(SsrfBlockedError);
    expect(() => assertSafeUrl("https://[::1]/")).toThrow(SsrfBlockedError);
  });
  it("lehnt AUCH öffentliche IP-Literale ab (nur Hostnamen erlaubt)", () => {
    expect(() => assertSafeUrl("https://8.8.8.8/")).toThrow(SsrfBlockedError);
    expect(() => assertSafeUrl("https://[2001:4860:4860::8888]/")).toThrow(SsrfBlockedError);
  });
  it("lehnt nicht-Standard-Ports ab (nur 443/leer)", () => {
    expect(() => assertSafeUrl("https://example.com:8080/")).toThrow(SsrfBlockedError);
    expect(() => assertSafeUrl("https://example.com:22/")).toThrow(SsrfBlockedError);
    expect(assertSafeUrl("https://example.com:443/").hostname).toBe("example.com");
  });
  it("normalisiert dezimale/hex-IPv4-Literale und blockt sie", () => {
    expect(() => assertSafeUrl("https://2130706433/")).toThrow(SsrfBlockedError); // = 127.0.0.1
    expect(() => assertSafeUrl("https://0x7f000001/")).toThrow(SsrfBlockedError); // = 127.0.0.1
  });
  it("Allowlist: nur gelistete Hosts", () => {
    expect(assertSafeUrl("https://api.geo.example/x", ["api.geo.example"]).hostname).toBe("api.geo.example");
    expect(() => assertSafeUrl("https://evil.example/x", ["api.geo.example"])).toThrow(SsrfBlockedError);
  });
});
