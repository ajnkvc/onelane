import type { CookieOptions } from "@supabase/ssr";
import { isProduction, getSiteUrl } from "@/lib/public-config";

/**
 * cookie-options.ts — zentrale Härtung ALLER serverseitig gesetzten Auth-Cookies.
 * ----------------------------------------------------------------------------
 * Supabase SSR liefert beim Token-Refresh Cookie-Optionen, die wir bisher
 * ungeprüft durchgereicht haben. Diese Factory erzwingt an EINER Stelle die
 * sicherheitskritischen Attribute und wird in `proxy.ts` UND `session.ts`
 * (den einzigen beiden Stellen, die Auth-Cookies schreiben) angewendet.
 *
 * - httpOnly: true  → Cookie ist NICHT per `document.cookie` lesbar
 *   (XSS-Diebstahlschutz). Sicher, weil die App ausschließlich serverseitig
 *   authentifiziert — es gibt KEINEN Browser-Supabase-Client, der das Token lesen muss.
 * - secure:   HTTPS → nur über HTTPS. Gekoppelt an das tatsächliche Schema der
 *   kanonischen Seiten-URL (NICHT nur NODE_ENV) — so bekommt auch ein HTTPS-
 *   Staging/Preview mit NODE_ENV≠production das Secure-Flag. In Dev
 *   (http://localhost) bewusst aus, sonst ließe sich lokal kein Login-Cookie setzen.
 * - sameSite: "lax" → CSRF-Mitigation. "lax" trägt das Cookie bei Top-Level-
 *   Navigation (nötig für OAuth-Redirects), blockt aber Cross-Site-POST. Wir
 *   erzwingen "lax" auch dann, wenn Supabase z. B. "none" vorschlüge.
 * - path:     "/"   → IMMER erzwungen (kein durchgereichter Fremd-Pfad).
 * - domain:   ENTFERNT → host-only Cookie (F-058). Ohne `Domain`-Attribut gilt das
 *   Cookie nur für den exakten Host → kein Subdomain-/Domain-Shadowing (z. B. SaaS-
 *   Subdomains können das Auth-Cookie nicht überschreiben/mitlesen). `__Host-`-Prefix
 *   wäre die stärkste Variante, erfordert aber Kontrolle über den Cookie-NAMEN
 *   (Supabase vergibt eigene Namen) — daher hier host-only via Domain-Entfernung.
 *
 * Bewusst NICHT angefasst: `maxAge`/Expiry. Die Token-Lebensdauer steuert
 * Supabase Auth (GoTrue, JWT-/Refresh-Expiry im Dashboard). Würden wir die
 * Cookie-maxAge kappen, bräche der serverseitige Token-Refresh.
 */
export function hardenAuthCookie(options: CookieOptions): CookieOptions {
  // `domain` bewusst verwerfen (host-only). Rest übernehmen, dann kritische Attribute erzwingen.
  const { domain: _domain, ...rest } = options;
  void _domain;
  return {
    ...rest,
    httpOnly: true,
    // Prod ist immer secure (Kurzschluss vermeidet getSiteUrl-Throw auf dem
    // Cookie-Pfad); ansonsten an HTTPS gekoppelt → deckt HTTPS-Staging/Preview.
    secure: isProduction() || getSiteUrl().startsWith("https://"),
    sameSite: "lax",
    path: "/",
  };
}
