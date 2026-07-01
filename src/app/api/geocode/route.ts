import { NextResponse } from "next/server";
import { suggestPlaces } from "@/modules/geocode";
import { geocodeRateLimiter } from "@/modules/ratelimit";

/**
 * GET /api/geocode?q=… — Adress-/Orts-Autocomplete für die eigene CI-Suchleiste.
 * ----------------------------------------------------------------------------
 * Läuft über das Geocode-Modul (Phase F: Dev-Adapter, KEIN externer Call; Google
 * erst consent-gegated ab Phase M). Dünner Eintrittspunkt: ruft Modul, nie DAL/DB
 * direkt.
 *
 * Drosselung über die wiederverwendbare Rate-Limit-Utility (In-Memory, pro
 * Instanz). HINWEIS: Die Client-IP stammt aus `x-forwarded-for`/`x-real-ip` und
 * ist hinter einem nicht vertrauenswürdigen Proxy fälschbar — die belastbare
 * DoS-/Bot-Abwehr gehört zusätzlich an den Edge (WAF/CDN-Rate-Limit). Bei
 * Skalierung den Limiter durch einen verteilten Adapter ersetzen (SECURITY.md §8).
 */
export async function GET(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "local";

  const { allowed, resetMs } = geocodeRateLimiter.check(ip);
  if (!allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "retry-after": String(Math.ceil(resetMs / 1000)) } },
    );
  }

  const q = new URL(request.url).searchParams.get("q") ?? "";
  const suggestions = await suggestPlaces(q, 6);
  return NextResponse.json({ suggestions }, { headers: { "cache-control": "no-store" } });
}
