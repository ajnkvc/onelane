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
