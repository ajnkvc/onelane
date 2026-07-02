/**
 * Wechselwort — fortlaufende vertikale Wort-Rolle im Dark-Statement-Band
 * (Motel-One-Muster, 2. Fassung nach Gründer-Review 2026-07-02).
 * ----------------------------------------------------------------------------
 * KEIN Breiten-Phantom mehr: Das Wort steht am ENDE seiner Headline-Zeile und
 * wächst frei nach rechts — kein Platzhalter, keine Lücke zum Wort davor.
 * Voraussetzung (von der aufrufenden Sektion einzuhalten): nach dem
 * <Wechselwort /> folgt in derselben Zeile KEIN weiterer Text (Zeilenumbruch).
 *
 * FENSTER + STRIP: Ein overflow-clippendes Fenster (~2 em hoch) zeigt das
 * aktive Wort mittig und die Nachbarn oben/unten ANGESCHNITTEN (CSS-mask
 * blendet sie zu den Kanten aus) — wie die Anzeigetafel bei Motel One. Der
 * Strip enthält alle Wörter + eine Kopie des ersten als Schluss-Zeile: die
 * Animation fährt kontinuierlich nach OBEN und springt am identischen Frame
 * nahtlos auf den Anfang zurück (immer fortlaufend, nie rückwärts).
 * Negative Margins geben die Mehrhöhe an den Zeilenkasten zurück (kein
 * Layout-Shift). Details/Keyframes: globals.css (.wechsel-*).
 *
 * CSS-KEYFRAMES statt JS: läuft ohne JS, kein Timer-Throttling in
 * Hintergrund-Tabs, nur transform. reduced-motion & SSR-Basiszustand:
 * statisch das erste Wort.
 *
 * WORTLISTE (§ 32 FahrlG!): KEINE Preis-Superlative — „günstigste" ist hier
 * VERBOTEN. Erlaubt sind neutrale/nachprüfbare Eigenschaften (nächste,
 * passende, bestbewertete — Letzteres gestützt auf die gekennzeichneten
 * Google-Daten, den Quellen-Hinweis setzt die aufrufende Sektion).
 * A11y: Strip aria-hidden; ein sr-only-Span liest dauerhaft „passende"
 * (kein Live-Region-Geplapper).
 */
const WOERTER = ["passende", "nächste", "bestbewertete"] as const; // [0] = Fallback

export function Wechselwort() {
  return (
    <span className="wechsel-fenster inline-flex overflow-hidden font-semibold text-accent">
      {/* Screenreader: stabiler Text statt rotierender Wörter */}
      <span className="sr-only">{WOERTER[0]}</span>
      {/* Strip: Kopie des LETZTEN Worts vorn + Kopie des ERSTEN hinten — so ist
          in jeder Phase oben UND unten ein Nachbar angeschnitten sichtbar und
          der Loop springt am pixelidentischen Frame (Details: globals.css). */}
      <span aria-hidden="true" className="wechsel-strip flex flex-col">
        {[WOERTER[WOERTER.length - 1], ...WOERTER, WOERTER[0]].map((w, i) => (
          <span key={`${w}-${i}`} className="wechsel-zeile whitespace-nowrap">
            {w}
          </span>
        ))}
      </span>
    </span>
  );
}
