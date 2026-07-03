import type { Metadata } from "next";
import localFont from "next/font/local";
import { cookies, headers } from "next/headers";
import { getSiteUrl } from "@/lib/public-config";
import { THEME_COOKIE, parseTheme } from "@/lib/theme";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { ThemeInitScript } from "@/components/portal/theme-script";
import "./globals.css";

/**
 * Schrift: Inter (Open Source, sehr gut lesbar) — PLATZHALTER, siehe DEVLOG.
 * LOKAL selbst gehostet (next/font/local), damit der Build NICHT von einem
 * externen Google-Fonts-Abruf abhängt (reproduzierbar, offline-/CI-fest, kein
 * Drittanbieter-Request zur Build-Zeit). Die Variable-Font-Datei deckt alle
 * Gewichte (100–900) und wird als CSS-Variable `--font-sans` bereitgestellt.
 */
const inter = localFont({
  src: "./fonts/InterVariable.woff2",
  variable: "--font-sans",
  display: "swap",
  weight: "100 900",
});

/**
 * Root-Metadaten (Platzhalter). Seitenspezifische Titel/Beschreibungen werden
 * später pro Route gesetzt (SEO). KEINE Meta-Keywords (veraltet).
 * `metadataBase` macht OpenGraph-/canonical-URLs absolut (Quelle: public-config).
 */
/**
 * Nonce-basierte CSP (script-src 'nonce-…' 'strict-dynamic', src/proxy.ts) erfordert
 * dynamisches Rendering: der Nonce ist per-Request, statische/ISR-Shells hätten keinen
 * gültigen Nonce → Skripte würden blockiert. Daher app-weit force-dynamic (Entscheidung
 * 01.07.: stärkste XSS-Abwehr; Performance via Cloudflare-Edge-Cache). Route-Segment-
 * Config im Root-Layout gilt für alle UI-Routen unter diesem Layout.
 * HINWEIS: Spezial-Routen ohne dieses Layout (robots.ts, sitemap.ts, llms.txt) sind davon
 * NICHT betroffen (sie tragen keine Nonce-Skripte). robots.ts und llms.txt bleiben statisch;
 * sitemap.ts setzt ein EIGENES force-dynamic (F-102: Live-Datenbestand je Request, siehe dort).
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: "onelane — Deutschlands Fahrschulvergleich",
    template: "%s · onelane",
  },
  description:
    "Fahrschulen in deiner Nähe finden und ehrlich vergleichen — kostenlos und ohne Konto.",
};

/**
 * Root-Layout + App-Shell. Enthält die einzigen <html>/<body>-Tags der App und
 * die globale Shell: Skip-Link, Header (Navigation), genau EIN `main`-Landmark,
 * Footer. `lang="de"` (Single-Locale DE; DACH später via eigene ccTLD-Deployments).
 * Seiten rendern ihren Inhalt OHNE eigenes `<main>` (ein Landmark pro Seite).
 *
 * PFADBEWUSST (OS-P1): Requests im App-Scope (`x-portal-scope: app` — setzt
 * AUSSCHLIESSLICH der Proxy, Client-Werte werden dort verworfen) erhalten
 *  (a) die Theme-Klasse aus dem Cookie ('dark') bzw. — ohne explizite Wahl —
 *      das nonce-feste Inline-Script zur prefers-color-scheme-Auflösung (kein
 *      FOUC) und
 *  (b) KEINE Public-Shell (Header/Footer): das Portal bringt seinen eigenen
 *      Rahmen mit (src/app/app/**). Die Public-Site erbt NIEMALS .dark —
 *      außerhalb des App-Scopes wird weder Cookie noch Script ausgewertet.
 */
export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const istAppScope = (await headers()).get("x-portal-scope") === "app";
  let themeKlasse = "";
  let systemThemeScript = false;
  if (istAppScope) {
    const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
    themeKlasse = theme === "dark" ? " dark" : "";
    systemThemeScript = theme === null; // keine explizite Wahl → System auflösen
  }

  return (
    <html lang="de" className={`${inter.variable} h-full antialiased${themeKlasse}`}>
      <body className="min-h-full flex flex-col">
        {istAppScope && systemThemeScript ? <ThemeInitScript /> : null}
        <a href="#content" className="skip-link">
          Zum Inhalt springen
        </a>
        {istAppScope ? null : <SiteHeader />}
        <main id="content" className="flex flex-1 flex-col">
          {children}
        </main>
        {istAppScope ? null : <SiteFooter />}
      </body>
    </html>
  );
}
