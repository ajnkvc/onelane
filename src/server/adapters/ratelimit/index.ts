import "server-only";
import type { RateLimiterPort, RateLimitResult } from "./port";

/**
 * In-Memory-Rate-Limiter (Fixed-Window) mit fauler TTL-Bereinigung.
 * ----------------------------------------------------------------------------
 * WICHTIG: wirkt nur PRO Prozess/Instanz — bei mehreren Instanzen (Serverless)
 * ist das KEIN belastbarer Schutz. Vor Skalierung durch einen verteilten Adapter
 * (Upstash/Redis, Vercel KV) hinter `RateLimiterPort` ersetzen, und die echte
 * DoS-/Bot-Abwehr an den Edge (WAF/CDN) legen (siehe SECURITY.md §8).
 *
 * Behebt zwei Mängel des früheren Ad-hoc-Limiters: (1) abgelaufene Einträge werden
 * bereinigt (kein unbegrenztes Map-Wachstum), (2) wiederverwendbar/testbar statt
 * pro Route dupliziert.
 */
interface Bucket {
  count: number;
  reset: number;
}

export function createInMemoryRateLimiter(opts: { windowMs: number; max: number }): RateLimiterPort {
  const { windowMs, max } = opts;
  const buckets = new Map<string, Bucket>();
  let lastSweep = 0;

  function sweep(now: number): void {
    if (now - lastSweep < windowMs) return;
    lastSweep = now;
    for (const [key, b] of buckets) {
      if (now > b.reset) buckets.delete(key);
    }
  }

  return {
    check(key: string): RateLimitResult {
      const now = Date.now();
      sweep(now);
      const existing = buckets.get(key);
      if (!existing || now > existing.reset) {
        buckets.set(key, { count: 1, reset: now + windowMs });
        return { allowed: true, remaining: max - 1, resetMs: windowMs };
      }
      existing.count += 1;
      return {
        allowed: existing.count <= max,
        remaining: Math.max(0, max - existing.count),
        resetMs: Math.max(0, existing.reset - now),
      };
    },
  };
}
