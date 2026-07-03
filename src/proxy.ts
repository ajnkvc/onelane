import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { hardenAuthCookie } from "@/server/auth/cookie-options";
import {
  getAppHost,
  getMapTileConfig,
  getPublicSupabaseConfig,
  isProduction,
} from "@/lib/public-config";

/**
 * proxy.ts — Host-Routing (App-Portal), CSP und Session-Refresh.
 * (Next.js 16: vormals "middleware.ts"; die Konvention heißt jetzt "proxy".)
 * ============================================================================
 * WICHTIG (Lehre aus CVE-2025-29927): Dieser Proxy macht ABSICHTLICH KEINE
 * Autorisierung. Er darf NIE die alleinige Schutzschicht sein. Die eigentliche
 * Rechteprüfung passiert in Server Actions / Route Handlers / DAL
 * (server/auth/permissions.ts) und in der DB über RLS. Der Name "Proxy"
 * unterstreicht: es ist eine vorgelagerte Netzwerk-Schicht, kein Auth-Layer.
 *
 * Aufgaben hier:
 *  1. HOST-ROUTING App-Portal (OS-P1, Next-16-proxy-Muster): Requests auf dem
 *     APP_HOST (Env, z. B. app.onelane.de) werden intern auf /app/* gerewritet —
 *     mit denselben durchgereichten Request-Headern (x-nonce/CSP), denn
 *     NextResponse.rewrite() akzeptiert dasselbe `{ request: { headers } }`-Init
 *     wie next(). /app/* auf dem PUBLIC-Host wird NUR in Produktion (und nur bei
 *     konfiguriertem APP_HOST) per 308 auf den App-Host umgeleitet; der App-Host
 *     selbst redirectet nie → keine Loop. Doppel-Präfix (/app/* auf dem App-Host)
 *     wird hart mit 404 geblockt.
 *  2. CSP pro Request mit Nonce (script-src ohne 'unsafe-inline' in Produktion).
 *  3. Supabase-Session-Refresh (nur wenn konfiguriert) — Tokens erneuern und
 *     Cookies schreiben (Server Components können das nicht selbst) — auf
 *     DEMSELBEN Response-Objekt, damit Cookies den Rewrite überleben.
 *  4. `x-portal-scope: app` als Request-Header für App-Scope-Requests (Root-
 *     Layout: Theme/Shell-Weiche). Der Header wird IMMER zuerst vom Client-
 *     Request entfernt (kein Spoofing) und nur hier gesetzt.
 *
 * KEIN Locale-Routing mehr (Single-Locale DE an der Domain-Wurzel; DACH später
 * via eigene ccTLD-Deployments).
 *
 * Öffentliche Konfiguration UND der Laufzeitmodus (isProduction) werden zentral aus
 * lib/public-config gelesen — KEIN direkter process.env-Zugriff in dieser Datei.
 */

/**
 * Erlaubter Bild-Origin für Karten-Kacheln (CSP img-src). Aus dem konfigurierten
 * Tile-Anbieter abgeleitet (nur Scheme+Host, ohne {z}/{x}/{y}-Pfad); ohne
 * Konfiguration in Dev der bare OSM-Host (= maps-Adapter DEV_FALLBACK), in
 * Produktion leer (kein Public-Tile-Fallback).
 */
function mapTileOrigin(): string {
  const cfg = getMapTileConfig();
  if (cfg) {
    try {
      return new URL(cfg.tileUrl).origin;
    } catch {
      return "";
    }
  }
  return isProduction() ? "" : "https://tile.openstreetmap.org";
}

function buildCsp(nonce: string, supabaseUrl: string | null, tileOrigin: string): string {
  const isDev = !isProduction();
  const connectSrc = ["'self'", supabaseUrl ?? ""].filter(Boolean).join(" ");
  const imgSrc = ["'self'", "blob:", "data:", tileOrigin].filter(Boolean).join(" ");
  // In der Entwicklung braucht Next.js (HMR) 'unsafe-eval'/'unsafe-inline';
  // in Produktion strikt: Nonce + strict-dynamic, kein 'unsafe-inline' für Skripte.
  const scriptSrc = isDev
    ? "'self' 'unsafe-inline' 'unsafe-eval'"
    : `'self' 'nonce-${nonce}' 'strict-dynamic'`;

  // Hinweis zu style-src 'unsafe-inline' (siehe SECURITY.md): Next.js/Tailwind
  // emittieren framework-kontrollierte Inline-Styles, für die kein praktikabler
  // Nonce-/Hash-Weg besteht. Risiko ist gering (Style-Injection ≠ Skriptausführung).
  // Bei späterer Machbarkeit enger fassen.
  return [
    `default-src 'self'`,
    `script-src ${scriptSrc}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src ${imgSrc}`,
    `font-src 'self'`,
    `connect-src ${connectSrc}`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `upgrade-insecure-requests`,
  ].join("; ");
}

/** Obergrenze für den nicht-fatalen Auth-Refresh im Proxy (Availability-Schutz). */
const PROXY_AUTH_TIMEOUT_MS = 3000;

/** Promise mit harter Zeitgrenze; räumt den Timer beim Settle auf (kein dangling Timer). */
function bounded<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    p.finally(() => {
      if (timer) clearTimeout(timer);
    }),
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("proxy-auth-timeout")), ms);
    }),
  ]);
}

export async function proxy(request: NextRequest) {
  // Single-Locale (DE) an der Domain-Wurzel: KEIN Locale-Routing mehr. DACH später
  // via eigene ccTLD-Deployments. Dieser Proxy macht Host-Routing + CSP +
  // Session-Refresh (KEINE Autorisierung — Lehre aus CVE-2025-29927).

  // 0) Host-Routing App-Portal ---------------------------------------------
  const appHost = getAppHost();
  const host = (request.headers.get("host") ?? "").toLowerCase();
  const isAppHost = appHost !== null && host === appHost;
  const { pathname } = request.nextUrl;

  // Public-Host + /app/* → 308 auf den App-Host, NUR Produktion + konfigurierter
  // APP_HOST (Dev nutzt /app direkt). Der App-Host redirectet nie ⇒ keine Loop.
  if (!isAppHost && appHost !== null && isProduction() && pathname.startsWith("/app")) {
    const ziel = request.nextUrl.clone();
    // APP_HOST ohne Port: hostname setzen UND Port verwerfen (url.host = "x" ohne
    // Port ließe einen bestehenden Public-Port stehen); mit Port: komplett setzen.
    if (appHost.includes(":")) {
      ziel.host = appHost;
    } else {
      ziel.hostname = appHost;
      ziel.port = "";
    }
    ziel.pathname = pathname.replace(/^\/app/, "") || "/";
    return NextResponse.redirect(ziel, 308);
  }

  // Doppel-Präfix auf dem App-Host: /app/* existiert dort EXTERN nicht — der
  // Präfix wird per 308 gestrippt (app.host/app/login → app.host/login). Damit
  // funktionieren interne absolute /app-Redirects (z. B. redirect("/app/login"))
  // hostübergreifend, ohne Duplicate-Content (Redirect statt Zweitauslieferung);
  // eine Loop ist ausgeschlossen (Ziel beginnt nie mit /app).
  if (isAppHost && pathname.startsWith("/app")) {
    const ziel = request.nextUrl.clone();
    ziel.pathname = pathname.replace(/^\/app/, "") || "/";
    return NextResponse.redirect(ziel, 308);
  }

  // App-Scope = App-Host (alles wird nach /app gerewritet) ODER direkter /app-Pfad.
  const isAppScope = isAppHost || pathname.startsWith("/app");

  // 1) CSP pro Request -----------------------------------------------------
  const supabase = getPublicSupabaseConfig();
  const nonce = crypto.randomUUID();
  const csp = buildCsp(nonce, supabase?.url ?? null, mapTileOrigin());

  const requestHeaders = new Headers(request.headers);
  // Defense-in-depth (CVE-2025-29927): den middleware-Bypass-Header NIE vom Client durchreichen.
  requestHeaders.delete("x-middleware-subrequest");
  // Scope-Header NIE vom Client übernehmen (Spoofing) — nur der Proxy setzt ihn.
  requestHeaders.delete("x-portal-scope");
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);
  if (isAppScope) requestHeaders.set("x-portal-scope", "app");

  // Rewrite/Weiterleitung mit DENSELBEN Request-Headern (x-nonce erreicht die
  // gerewritete Route; rewrite() nimmt dasselbe init wie next() — R1-Recherche).
  let response: NextResponse;
  if (isAppHost) {
    const ziel = request.nextUrl.clone();
    ziel.pathname = `/app${pathname === "/" ? "" : pathname}`;
    response = NextResponse.rewrite(ziel, { request: { headers: requestHeaders } });
  } else {
    response = NextResponse.next({ request: { headers: requestHeaders } });
  }
  response.headers.set("content-security-policy", csp);
  // Das App-Portal ist nie für Suchmaschinen bestimmt (zusätzlich zur Metadata-Ebene).
  if (isAppScope) response.headers.set("x-robots-tag", "noindex");

  // 2) Supabase-Session-Refresh (nur wenn konfiguriert) — KEINE Authz! -----
  if (supabase) {
    const client = createServerClient(supabase.url, supabase.publishableKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, hardenAuthCookie(options));
          });
        },
      },
    });
    // getUser() erneuert abgelaufene Tokens und schreibt die Cookies in `response`.
    // BEGRENZT + NICHT-FATAL: eine langsame/gestörte Auth darf öffentliches HTML-Serving
    // nicht blockieren oder 500en (der Proxy ist KEIN Auth-Layer). Echte AuthZ bleibt in
    // Server Actions/Route Handlers/DAL/RLS.
    try {
      await bounded(client.auth.getUser(), PROXY_AUTH_TIMEOUT_MS);
    } catch {
      // Refresh-Störung ignorieren (kein Cookie-Update); geschützte Pfade lehnen später fail-closed ab.
    }
  }

  return response;
}

export const config = {
  // Statische Assets + SEO-Endpunkte ausnehmen — aber NUR bekannte Datei-Endungen (am Pfadende),
  // NICHT jeden Pfad mit Punkt: HTML-Routen/404 mit Punkt (z. B. `/foo.bar`, dateiähnliche Slugs)
  // müssen weiter durch den Proxy laufen, damit sie Nonce-CSP bekommen (fail-closed CSP-Coverage).
  matcher: [
    "/((?!api(?:/|$)|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|llms.txt|.*\\.(?:png|jpe?g|gif|webp|avif|svg|ico|css|js|mjs|map|woff2?|ttf|otf|eot|json|pdf|txt|xml|webmanifest)$).*)",
  ],
};
