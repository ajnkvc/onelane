import { describe, it, expect } from "vitest";
import { computeDbSsl, getDbSslOption, isLocalDbHost, dbHostFromUrl } from "@/server/config/db-ssl";

// Reine Kernlogik der fail-closed TLS-Entscheidung (ohne process.env).
describe("computeDbSsl", () => {
  it("Dev ohne Modus → kein TLS (false)", () => {
    expect(computeDbSsl({ isProd: false })).toBe(false);
  });

  it("Produktion ohne Modus → 'require' (TLS-Zwang, Default)", () => {
    expect(computeDbSsl({ isProd: true })).toBe("require");
  });

  it("Produktion + 'disable' → wirft (fail-closed, kein Klartext)", () => {
    expect(() => computeDbSsl({ isProd: true, mode: "disable" })).toThrow();
  });

  it("Dev + 'require' → 'require' (explizit erzwingbar)", () => {
    expect(computeDbSsl({ isProd: false, mode: "require" })).toBe("require");
  });

  it("'verify-full' ohne CA → rejectUnauthorized:true", () => {
    expect(computeDbSsl({ isProd: true, mode: "verify-full" })).toEqual({
      rejectUnauthorized: true,
    });
  });

  it("'verify-full' mit CA → rejectUnauthorized:true + ca", () => {
    expect(computeDbSsl({ isProd: true, mode: "verify-full", ca: "PEM" })).toEqual({
      rejectUnauthorized: true,
      ca: "PEM",
    });
  });

  it("Remote-Host ohne Modus → 'require' (TLS-Zwang, auch außerhalb Prod) — F-022", () => {
    expect(computeDbSsl({ isProd: false, isRemoteHost: true })).toBe("require");
  });

  it("Remote-Host + 'disable' → wirft (fail-closed, kein Klartext zu Remote) — F-022", () => {
    expect(() => computeDbSsl({ isProd: false, isRemoteHost: true, mode: "disable" })).toThrow();
  });

  it("getDbSslOption: leerer DATABASE_SSL='' fällt auf Default (nicht verify-full)", () => {
    const prev = process.env.DATABASE_SSL;
    process.env.DATABASE_SSL = "";
    try {
      // NODE_ENV im Test ≠ production, keine DSN → Default 'disable' → false (NICHT verify-full-Objekt).
      expect(getDbSslOption()).toBe(false);
    } finally {
      if (prev === undefined) delete process.env.DATABASE_SSL;
      else process.env.DATABASE_SSL = prev;
    }
  });

  it("getDbSslOption(remote-DSN): erzwingt TLS auch in Dev (Host-Kopplung) — F-022", () => {
    const prev = process.env.DATABASE_SSL;
    delete process.env.DATABASE_SSL;
    try {
      expect(getDbSslOption("postgres://app_user:pw@db.example.com:5432/app")).toBe("require");
      expect(getDbSslOption("postgres://app_user:pw@localhost:5432/app")).toBe(false);
      // Single-Label-Host über DSN → remote → TLS-Pflicht (fail-closed).
      expect(getDbSslOption("postgres://app_user:pw@proddb:5432/app")).toBe("require");
      // Hinweis: new URL() normalisiert [::ffff:127.0.0.1] zu Hex (::ffff:7f00:1); diese Hex-Form
      // erkennen wir NICHT als Loopback → konservativ remote (TLS-Pflicht). Fail-closed, akzeptabel.
      expect(getDbSslOption("postgres://app_user:pw@[::ffff:127.0.0.1]:5432/app")).toBe("require");
    } finally {
      if (prev === undefined) delete process.env.DATABASE_SSL;
      else process.env.DATABASE_SSL = prev;
    }
  });
});

describe("isLocalDbHost / dbHostFromUrl", () => {
  it("erkennt lokale/private Hosts (inkl. uppercase, IPv4-mapped IPv6, Scope-ID)", () => {
    for (const h of [
      "localhost", "LOCALHOST", "127.0.0.1", "127.5.5.5", "::1", "0.0.0.0",
      "10.0.0.5", "192.168.1.9", "172.16.0.1", "172.31.255.1", "svc.local", "pg.internal",
      "::ffff:127.0.0.1", "127.0.0.1%en0",
    ]) {
      expect(isLocalDbHost(h), h).toBe(true);
    }
  });
  it("behandelt Single-Label- + öffentliche Hosts + unbekannt als remote (fail-closed) — Blocker-2", () => {
    for (const h of ["db", "postgres", "PRODDB", "db.example.com", "aws-eu.pooler.supabase.com", "8.8.8.8", "172.32.0.1", null, undefined, ""]) {
      expect(isLocalDbHost(h), String(h)).toBe(false);
    }
  });
  it("dbHostFromUrl extrahiert den Host", () => {
    expect(dbHostFromUrl("postgres://u:p@host.tld:5432/db")).toBe("host.tld");
    expect(dbHostFromUrl("nonsense")).toBe(null);
    expect(dbHostFromUrl(undefined)).toBe(null);
  });
});
