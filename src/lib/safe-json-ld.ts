/**
 * safe-json-ld.ts — sichere Serialisierung von JSON-LD für
 * <script type="application/ld+json">.
 * ============================================================================
 * Dies ist die EINZIGE erlaubte Quelle, um JSON-LD via `dangerouslySetInnerHTML`
 * auszugeben. Roher DB-/Nutzer-Inhalt (Schulnamen, FAQ-Texte) darf NIEMALS
 * ungeprüft in einen <script>-Block. `dangerouslySetInnerHTML` ist überall
 * sonst verboten.
 *
 * WICHTIG: JSON-LD-Daten müssen VORHER fachlich validiert werden und inhaltlich
 * **deckungsgleich** mit dem sichtbaren Seiteninhalt sein (SEO/GEO-Anforderung).
 *
 * Warum eine REKURSIVE Laufzeit-Validierung? `JSON.stringify` entfernt ungültige
 * Werte STILL (z. B. `{ a: undefined }` → `{}`, Funktionen/Symbole verschwinden),
 * BigInt wirft. Stilles Entfernen verletzt die Deckungsgleichheit. Daher prüfen
 * wir den Wert vollständig (auch verschachtelt) und brechen mit Pfad in der
 * Fehlermeldung ab (z. B. `safeJsonLd: ungültiger Wert bei $.nested.a`).
 *
 * Erlaubt: string, (endliche) number, boolean, null, Arrays, Plain Objects.
 * Abgelehnt (auch verschachtelt): undefined, Function, Symbol, BigInt,
 * NaN/Infinity, Nicht-Plain-Objekte (Date, Map, Klassen-Instanzen → vorher in
 * serialisierbare Form bringen, z. B. Datum als ISO-String).
 *
 * Escaped werden zusätzlich: `<`, `>`, `&`, U+2028, U+2029 (Ausbruch aus
 * </script> / JS-Parsing).
 */

/** Zur Compile-Zeit erlaubte, JSON-serialisierbare Werte. */
export type JsonLdValue =
  | string
  | number
  | boolean
  | null
  | JsonLdValue[]
  | { [key: string]: JsonLdValue };

const LINE_SEPARATOR = String.fromCharCode(0x2028);
const PARAGRAPH_SEPARATOR = String.fromCharCode(0x2029);

const UNSAFE_CHARS = new RegExp(
  `[<>&${LINE_SEPARATOR}${PARAGRAPH_SEPARATOR}]`,
  "g",
);

function describeInvalid(value: unknown): string {
  if (value === undefined) return "undefined";
  const type = typeof value;
  if (type === "function") return "Function";
  if (type === "symbol") return "Symbol";
  if (type === "bigint") return "BigInt";
  if (type === "number") return "nicht-endliche Zahl (NaN/Infinity)";
  return "nicht-serialisierbarer Wert";
}

/**
 * Prüft rekursiv, ob `value` ein gültiger JSON-LD-Wert ist. Wirft mit JSON-Pfad
 * (`$`, `$.key`, `$[0]`) beim ersten ungültigen Wert.
 */
function assertJsonLdValue(value: unknown, path: string): void {
  if (value === null) return;
  const type = typeof value;
  if (type === "string" || type === "boolean") return;
  if (type === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(`safeJsonLd: ungültiger Wert bei ${path} (nicht-endliche Zahl)`);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertJsonLdValue(item, `${path}[${index}]`));
    return;
  }
  if (type === "object") {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) {
      const name = (value as object).constructor?.name ?? "unbekannt";
      throw new Error(
        `safeJsonLd: ungültiger Wert bei ${path} (kein Plain Object: ${name})`,
      );
    }
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      assertJsonLdValue(item, `${path}.${key}`);
    }
    return;
  }
  // undefined, function, symbol, bigint
  throw new Error(`safeJsonLd: ungültiger Wert bei ${path} (${describeInvalid(value)})`);
}

/**
 * Serialisiert `data` zu einem für den <script>-Kontext sicheren JSON-String.
 * Validiert zuvor rekursiv und wirft bei ungültigen (auch verschachtelten) Werten.
 *
 * Verwendung:
 *   <script type="application/ld+json"
 *           dangerouslySetInnerHTML={{ __html: safeJsonLd(data) }} />
 */
export function safeJsonLd(data: JsonLdValue): string {
  assertJsonLdValue(data, "$");
  // Nach erfolgreicher Validierung liefert JSON.stringify immer einen String.
  return JSON.stringify(data).replace(
    UNSAFE_CHARS,
    (char) => "\\u" + char.charCodeAt(0).toString(16).padStart(4, "0"),
  );
}
