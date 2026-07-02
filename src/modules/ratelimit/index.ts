import "server-only";
import { createInMemoryRateLimiter } from "@/server/adapters/ratelimit";

export type { RateLimitResult } from "@/server/adapters/ratelimit/port";

/**
 * Modul-Schicht-Naht für Drosselung: Route Handler (src/app/**) dürfen `@/server`
 * nicht direkt importieren (ESLint-Schichtgrenze) — sie nutzen diese Modul-Helfer.
 *
 * Geteilter Limiter für `/api/geocode`: 30 Anfragen/Minute pro Schlüssel (IP).
 * In-Memory (pro Instanz) — vor Skalierung durch verteilten Adapter ersetzen.
 */
export const geocodeRateLimiter = createInMemoryRateLimiter({ windowMs: 60_000, max: 30 });

/**
 * Limiter für den anonymen Ereignis-Zähler `/api/ereignis` (Migration 0024):
 * 30 Zähl-Ereignisse/Minute je IP genügen jedem echten Nutzer deutlich; Fluten
 * fängt zusätzlich der Tages-Cap in app.zaehle_ereignis (DB) und vor Launch
 * das Edge-Rate-Limit (Cloudflare).
 */
export const ereignisRateLimiter = createInMemoryRateLimiter({ windowMs: 60_000, max: 30 });
