/**
 * url-normalize.mjs — Tooling-URL-Normalisierung für gespeicherte öffentliche Links (website).
 * ----------------------------------------------------------------------------
 * Ergänzt bei schema-losen Eingaben (Hostname) `https://`, erzwingt danach http(s) und validiert
 * per URL-Parser. Gibt die normalisierte URL zurück oder null (dann NICHT speichern).
 *
 * Robuste Scheme-Prüfung (Fix zum alten startsWith("http")-Bug): `file:`, `ftp:`, `javascript:`,
 * `data:` etc. werden abgelehnt statt fälschlich zu `https://file:...` verbogen; Groß/Klein egal.
 * Deckungsgleich mit der Runtime-Ausgabe-Validierung normalizePublicHttpUrl (src/lib/public-config.ts)
 * und dem DB-CHECK (Migration 0018).
 */
export function normalizeToolingUrl(u) {
  if (!u) return null;
  const raw = String(u).trim();
  if (!raw) return null;
  // Hat die Eingabe bereits ein Scheme (`xyz:`)? Wenn nein → als Hostname behandeln (https ergänzen).
  const hasScheme = /^[a-z][a-z0-9+.\-]*:/i.test(raw);
  const candidate = hasScheme ? raw : "https://" + raw;
  try {
    const x = new URL(candidate);
    return x.protocol === "http:" || x.protocol === "https:" ? x.toString() : null;
  } catch {
    return null;
  }
}
