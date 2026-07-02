import type { NextConfig } from "next";

/**
 * next.config.ts — Build-/Runtime-Konfiguration inkl. Security-Header.
 * ----------------------------------------------------------------------------
 * Die statischen Sicherheits-Header stehen hier. Die Content-Security-Policy
 * (CSP) wird NICHT hier gesetzt, sondern PRO REQUEST in src/proxy.ts mit
 * einem Nonce (siehe SECURITY.md) — nur so lässt sich `script-src` ohne
 * 'unsafe-inline' absichern.
 */

const securityHeaders = [
  // Erzwingt HTTPS (zwei Jahre), inkl. Subdomains; preload-fähig.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // Kein Einbetten in fremde Frames (Clickjacking-Schutz).
  { key: "X-Frame-Options", value: "DENY" },
  // Kein MIME-Sniffing.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Sparsame Referrer-Weitergabe.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Restriktive Permissions-Policy. Geolocation für die Standortsuche erlaubt (self).
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(self), browsing-topics=()",
  },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  // Cross-Origin-Isolation (Defense-in-Depth gegen Cross-Origin-Leaks/Tabnabbing).
  // COOP: eigene Seiten von fremden Openern isolieren. HINWEIS: Sobald OAuth-/Stripe-Popup-
  // Flows dazukommen, dort route-spezifisch auf "same-origin-allow-popups" lockern.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // CORP: eigene Antworten nicht cross-origin einbettbar. COEP bewusst NICHT gesetzt
  // (würde Stripe-/Karten-/Drittanbieter-Einbindungen brechen).
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  // Production-Builds ohne öffentliche Source-Maps (ergänzend, kein Ersatz für
  // serverseitige Sicherheit — siehe SECURITY.md Punkt 7).
  productionBrowserSourceMaps: false,

  experimental: {
    /**
     * Server-Action-Body-Limit (Default 1 MB): der Bewerbungs-Funnel der Jobbörse
     * (src/modules/jobs/actions.ts) nimmt CV (≤ 5 MB) + freiwilliges Foto (≤ 3 MB)
     * als multipart/form-data entgegen — 10 MB decken beide Caps + Overhead.
     * Die fachlichen Datei-Caps erzwingt die Action serverseitig (Größe, MIME,
     * Magic-Bytes); vor öffentlichem Betrieb zusätzlich Edge-/WAF-Limits je Route
     * (dokumentierte Auflage, SECURITY.md §8).
     */
    serverActions: { bodySizeLimit: "10mb" },
  },

  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },

  /**
   * Content-Pfad-Rewrite (Blog/Ratgeber): Der öffentliche Slug ist konfigurierbar
   * und wird hier auf eine stabile interne Route gemappt — KEIN gieriges
   * [contentRoot]-Segment (siehe ARCHITECTURE.md, Abschnitt 8).
   *
   * Die KANONISCHE Quelle des Slugs ist `getContentSlug()` aus
   * `src/lib/public-config.ts` (zentral validiert). Beispiel für später:
   *
   *   import { getContentSlug } from "@/lib/public-config";
   *   const slug = getContentSlug();
   *   return [{ source: `/:locale/${slug}/:path*`,
   *             destination: "/:locale/(content)/:path*" }];
   *
   * Hinweis: next.config wird zur Build-Zeit ausgewertet (außerhalb des App-Module-
   * Graphen); ggf. ist der Wert dort direkt zu lesen. Dies ist KEIN Muster für
   * verstreute `process.env`-Nutzung in der App — dort immer über public-config.
   * Pfadwechsel = Config ändern + 301-Redirect alt→neu (SEO).
   */
  async rewrites() {
    return [];
  },
};

export default nextConfig;
