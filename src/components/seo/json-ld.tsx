import { safeJsonLd, type JsonLdValue } from "@/lib/safe-json-ld";

/**
 * <JsonLd> — die EINZIGE erlaubte Render-Komponente für JSON-LD.
 * ----------------------------------------------------------------------------
 * Gibt strukturierte Daten als <script type="application/ld+json"> aus. Der
 * Inhalt läuft AUSSCHLIESSLICH durch safeJsonLd() (rekursiv validiert + escaped),
 * damit kein roher DB-/Nutzer-Inhalt ungeprüft in den <script>-Kontext gelangt.
 *
 * Dies ist der EINZIGE Ort im Projekt, an dem dangerouslySetInnerHTML erlaubt ist
 * (enge, datei-spezifische ESLint-Ausnahme in eslint.config.mjs). Überall sonst
 * bleibt es gesperrt. WICHTIG: JSON-LD muss fachlich deckungsgleich mit dem
 * sichtbaren Seiteninhalt sein (SEO/GEO) — safeJsonLd prüft nur Serialisierbarkeit.
 */
export function JsonLd({ data, nonce }: { data: JsonLdValue; nonce?: string }) {
  return (
    <script
      type="application/ld+json"
      nonce={nonce}
      dangerouslySetInnerHTML={{ __html: safeJsonLd(data) }}
    />
  );
}
