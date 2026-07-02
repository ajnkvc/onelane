import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JsonLd } from "@/components/seo/json-ld";

/**
 * Verifiziert den EINZIGEN erlaubten JSON-LD-Render-Pfad: <JsonLd> gibt ein
 * <script type="application/ld+json"> aus und escaped den Inhalt über safeJsonLd
 * (kein </script>-Ausbruch), und bricht bei nicht-serialisierbaren Werten ab.
 * Zusätzlich als Invariante: der Render-Pfad bleibt nonce-frei (Datenblöcke
 * erreichen den CSP-Inline-Check nie; ein Nonce dort schützt nichts und erzeugt
 * durch Browser-Nonce-Hiding nur React-Hydration-Warnungen).
 */
describe("JsonLd", () => {
  it("rendert <script type=application/ld+json> mit escaptem Inhalt", () => {
    const html = renderToStaticMarkup(
      createElement(JsonLd, {
        data: { "@context": "https://schema.org", name: "A<b>&" },
      }),
    );
    expect(html).toContain('type="application/ld+json"');
    // < > & dürfen NICHT roh im Script stehen (kein </script>-Ausbruch).
    expect(html).not.toContain("<b>");
    expect(html).toContain("\\u003c"); // '<' escaped
    expect(html).toContain("\\u0026"); // '&' escaped
  });

  it("trägt NIE ein nonce-Attribut (Datenblock — CSP-script-src greift nicht)", () => {
    const html = renderToStaticMarkup(
      createElement(JsonLd, { data: { "@context": "https://schema.org" } }),
    );
    expect(html).not.toContain("nonce");
  });

  it("Komponente bietet keinen Nonce-Prop an (Schutz vor Wiedereinführung)", () => {
    const src = readFileSync("src/components/seo/json-ld.tsx", "utf8");
    // Kein nonce-Prop/JSX-Attribut im Quelltext (Prosa im Docblock ist erlaubt).
    expect(src).not.toMatch(/nonce\??\s*[=:]/);
  });

  it("wirft bei nicht-serialisierbaren Werten (über safeJsonLd)", () => {
    expect(() =>
      renderToStaticMarkup(
        createElement(JsonLd, {
          data: { x: undefined as unknown as string },
        }),
      ),
    ).toThrow(/safeJsonLd/);
  });
});
