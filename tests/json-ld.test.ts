import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JsonLd } from "@/components/seo/json-ld";

/**
 * Verifiziert den EINZIGEN erlaubten JSON-LD-Render-Pfad: <JsonLd> gibt ein
 * <script type="application/ld+json"> aus und escaped den Inhalt über safeJsonLd
 * (kein </script>-Ausbruch), und bricht bei nicht-serialisierbaren Werten ab.
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

  it("setzt das nonce-Attribut, wenn ein Nonce übergeben wird (CSP)", () => {
    const html = renderToStaticMarkup(
      createElement(JsonLd, { data: { "@context": "https://schema.org" }, nonce: "abc123" }),
    );
    expect(html).toContain('nonce="abc123"');
  });

  it("ohne Nonce KEIN nonce-Attribut", () => {
    const html = renderToStaticMarkup(
      createElement(JsonLd, { data: { "@context": "https://schema.org" } }),
    );
    expect(html).not.toContain("nonce=");
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
