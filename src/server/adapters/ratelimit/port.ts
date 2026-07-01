/**
 * RateLimiterPort — Vertrag für Drosselung (Missbrauchs-/Kostenschutz).
 * ----------------------------------------------------------------------------
 * Standard-Adapter ist IN-MEMORY (siehe index.ts) — wirkt nur PRO Instanz/Prozess.
 * Für mehrere Instanzen (Serverless/Skalierung) muss ein VERTEILTER Adapter
 * (z. B. Upstash/Redis oder Vercel KV) hinter denselben Port gesetzt werden —
 * darum ist es bewusst ein austauschbarer Port. Die erste echte DoS-/Bot-Linie
 * gehört zusätzlich an den Edge (WAF/CDN-Rate-Limit), siehe SECURITY.md §8.
 */
export interface RateLimitResult {
  /** false → Anfrage soll mit 429 abgelehnt werden. */
  allowed: boolean;
  /** Verbleibende Treffer im aktuellen Fenster. */
  remaining: number;
  /** Millisekunden bis zum Zurücksetzen des Fensters (für Retry-After). */
  resetMs: number;
}

export interface RateLimiterPort {
  /** Verbraucht einen Treffer für `key` (z. B. IP+Route) und bewertet ihn. */
  check(key: string): RateLimitResult;
}
