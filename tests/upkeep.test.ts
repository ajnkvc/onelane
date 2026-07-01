import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * upkeep.test.ts — maschinelle Wartungs-/Sicherheits-Invarianten (Mission 006).
 * ----------------------------------------------------------------------------
 * Erkennt Regressionen, die sonst still einschleichen: veraltete (Node-20-)
 * CI-Action-Majors, fehlende Runtime-Pins, sowie das Verschwinden zentraler
 * Security-Header / der strikten Produktions-CSP. Bewusst datei-/textbasiert,
 * um sicherheitskritische Module (proxy/next.config) NICHT importieren zu müssen.
 */
const read = (p: string) => readFileSync(p, "utf8");

describe("CI ist auf aktueller (Node-24-)Action-Linie + minimalem Token-Scope", () => {
  const ci = read(".github/workflows/ci.yml");
  it("verwendet keine abgekündigten Node-20-Action-Majors", () => {
    expect(ci).not.toMatch(/actions\/checkout@v[1-4]\b/);
    expect(ci).not.toMatch(/actions\/setup-node@v[1-5]\b/);
    expect(ci).not.toMatch(/gitleaks-action@v[12]\b/);
  });
  it("setzt explizite (minimale) Token-Berechtigungen", () => {
    expect(ci).toMatch(/^permissions:/m);
    expect(ci).toMatch(/contents:\s*read/);
  });
});

describe("Runtime ist im Manifest festgeschrieben", () => {
  const pkg = JSON.parse(read("package.json"));
  it("hat engines.node und packageManager", () => {
    expect(pkg.engines?.node).toBeTruthy();
    expect(pkg.packageManager).toBeTruthy();
  });
});

describe("Dependabot hält Deps + Actions automatisch aktuell", () => {
  it(".github/dependabot.yml deckt npm UND github-actions ab", () => {
    const db = read(".github/dependabot.yml");
    expect(db).toMatch(/package-ecosystem:\s*["']?npm/);
    expect(db).toMatch(/package-ecosystem:\s*["']?github-actions/);
  });
});

describe("Security-Header + strikte Produktions-CSP bleiben vorhanden", () => {
  it("next.config setzt die zentralen Sicherheits-Header", () => {
    const cfg = read("next.config.ts");
    expect(cfg).toContain("Strict-Transport-Security");
    expect(cfg).toContain("X-Frame-Options");
    expect(cfg).toContain("X-Content-Type-Options");
  });
  it("proxy nutzt in Produktion Nonce + strict-dynamic (kein Skript-unsafe-inline)", () => {
    const proxy = read("src/proxy.ts");
    expect(proxy).toContain("'strict-dynamic'");
    expect(proxy).toContain("'nonce-");
    // Produktions-script-src darf nicht hart auf 'unsafe-inline' stehen.
    expect(proxy).not.toMatch(/script-src 'self' 'unsafe-inline'/);
  });
});
