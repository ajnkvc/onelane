import { describe, expect, it } from "vitest";
import { safeJsonLd } from "@/lib/safe-json-ld";

const LINE_SEPARATOR = String.fromCharCode(0x2028);
const PARAGRAPH_SEPARATOR = String.fromCharCode(0x2029);

describe("safeJsonLd", () => {
  it("escaped <, > und &", () => {
    const out = safeJsonLd({ name: "<b>A&B</b>" });
    expect(out).not.toMatch(/[<>&]/); // keine rohen HTML-kritischen Zeichen
    expect(out).toContain("\\u003c");
    expect(out).toContain("\\u003e");
    expect(out).toContain("\\u0026");
  });

  it("escaped U+2028 und U+2029", () => {
    const out = safeJsonLd({ t: `a${LINE_SEPARATOR}b${PARAGRAPH_SEPARATOR}c` });
    expect(out).toContain("\\u2028");
    expect(out).toContain("\\u2029");
    expect(out).not.toContain(LINE_SEPARATOR);
    expect(out).not.toContain(PARAGRAPH_SEPARATOR);
  });

  it("liefert gültiges, deckungsgleiches JSON für normale Werte", () => {
    const data = { a: 1, b: [true, null, "x"], c: { nested: "ja" } };
    expect(JSON.parse(safeJsonLd(data))).toEqual(data);
  });

  it("wirft bei undefined (kein Crash in .replace)", () => {
    // @ts-expect-error undefined ist kein gültiger JsonLdValue
    expect(() => safeJsonLd(undefined)).toThrow();
  });

  it("wirft bei BigInt", () => {
    // @ts-expect-error BigInt ist kein gültiger JsonLdValue
    expect(() => safeJsonLd(BigInt(1))).toThrow();
  });

  it("wirft bei verschachteltem undefined (mit Pfad)", () => {
    // @ts-expect-error verschachteltes undefined ist ungültig
    expect(() => safeJsonLd({ a: undefined })).toThrow(/\$\.a/);
  });

  it("wirft bei undefined im Array (mit Pfad)", () => {
    // @ts-expect-error undefined im Array ist ungültig
    expect(() => safeJsonLd([undefined])).toThrow(/\$\[0\]/);
  });

  it("wirft bei verschachteltem BigInt (mit Pfad)", () => {
    // @ts-expect-error verschachteltes BigInt ist ungültig
    expect(() => safeJsonLd({ nested: { a: BigInt(1) } })).toThrow(/\$\.nested\.a/);
  });

  it("wirft bei verschachtelter Function", () => {
    // @ts-expect-error Function ist kein gültiger JsonLdValue
    expect(() => safeJsonLd({ fn: () => undefined })).toThrow();
  });

  it("wirft bei verschachteltem Symbol", () => {
    // @ts-expect-error Symbol ist kein gültiger JsonLdValue
    expect(() => safeJsonLd({ s: Symbol("x") })).toThrow();
  });

  it("wirft bei Nicht-Plain-Object (z. B. Date)", () => {
    // @ts-expect-error Date ist kein Plain Object (vorher als ISO-String übergeben)
    expect(() => safeJsonLd({ when: new Date() })).toThrow(/Plain Object/);
  });
});
