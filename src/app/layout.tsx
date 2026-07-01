import type { Metadata } from "next";
import localFont from "next/font/local";
import { getSiteUrl } from "@/lib/public-config";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
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
 * NICHT betroffen und bleiben statisch — bewusst (sie tragen keine Nonce-Skripte).
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: "Fahrschulen vergleichen",
    template: "%s · Fahrschul-Plattform",
  },
  description:
    "Fahrschulen in deiner Nähe vergleichen, bewerten und buchen.",
};

/**
 * Root-Layout + App-Shell. Enthält die einzigen <html>/<body>-Tags der App und
 * die globale Shell: Skip-Link, Header (Navigation), genau EIN `main`-Landmark,
 * Footer. `lang="de"` (Single-Locale DE; DACH später via eigene ccTLD-Deployments).
 * Seiten rendern ihren Inhalt OHNE eigenes `<main>` (ein Landmark pro Seite).
 */
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <a href="#content" className="skip-link">
          Zum Inhalt springen
        </a>
        <SiteHeader />
        <main id="content" className="flex flex-1 flex-col">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
