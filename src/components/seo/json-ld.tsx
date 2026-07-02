import { safeJsonLd, type JsonLdValue } from "@/lib/safe-json-ld";

/**
 * <JsonLd> — die EINZIGE erlaubte Render-Komponente für JSON-LD.
 * ----------------------------------------------------------------------------
 * Gibt strukturierte Daten als <script type="application/ld+json"> aus. Der
 * Inhalt läuft AUSSCHLIESSLICH durch safeJsonLd() (rekursiv validiert + escaped),
 * damit kein roher DB-/Nutzer-Inhalt ungeprüft in den <script>-Kontext gelangt.
 *
 * BEWUSST OHNE CSP-Nonce: JSON-LD ist ein Datenblock — „prepare the script
 * element" (HTML-Spec) bricht bei unbekanntem type ab, BEVOR der Inline-Check
 * der CSP (script-src) erreicht wird. Ein Nonce hätte hier also keinerlei
 * Schutzwirkung, erzeugte aber React-19-Hydration-Warnungen: Browser leeren
 * das Nonce-Content-Attribut, sobald eine header-gelieferte CSP existiert
 * (Nonce-Hiding), React vergleicht dann den Server-Prop gegen das leere
 * DOM-Attribut. Ausführbare Inline-Scripts brauchen den Nonce dagegen
 * weiterhin — siehe src/lib/nonce.ts.
 *
 * Dies ist der EINZIGE Ort im Projekt, an dem dangerouslySetInnerHTML erlaubt ist
 * (enge, datei-spezifische ESLint-Ausnahme in eslint.config.mjs). Überall sonst
 * bleibt es gesperrt. WICHTIG: JSON-LD muss fachlich deckungsgleich mit dem
 * sichtbaren Seiteninhalt sein (SEO/GEO) — safeJsonLd prüft nur Serialisierbarkeit.
 */
export function JsonLd({ data }: { data: JsonLdValue }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLd(data) }}
    />
  );
}
