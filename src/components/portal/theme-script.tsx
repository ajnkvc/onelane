import { getRequestNonce } from "@/lib/nonce";

/**
 * theme-script.tsx — nonce-festes Inline-Script der System-Theme-Auflösung.
 * ----------------------------------------------------------------------------
 * NUR im App-Scope gerendert (Root-Layout), und NUR wenn KEIN explizites
 * Theme-Cookie gesetzt ist: löst prefers-color-scheme VOR dem ersten Paint auf
 * (kein FOUC) und setzt ggf. die .dark-Klasse auf <html>.
 *
 * Sicherheit: der Script-Inhalt ist eine STATISCHE Konstante ohne jegliche
 * Nutzereingabe (themeInitScript() unten — einzige hier erlaubte __html-Quelle,
 * per ESLint-Regel erzwungen wie beim safeJsonLd-Muster). Das <script> trägt den
 * per-Request-CSP-Nonce (script-src 'nonce-…' in Produktion).
 */

/** Statischer Script-Text (keine Interpolation, keine Nutzereingabe). */
export function themeInitScript(): string {
  return (
    "(function(){try{" +
    'if(window.matchMedia("(prefers-color-scheme: dark)").matches)' +
    '{document.documentElement.classList.add("dark");}' +
    "}catch(e){}})();"
  );
}

/** Server-Komponente: Inline-Script mit dem aktuellen Request-Nonce. */
export async function ThemeInitScript() {
  const nonce = await getRequestNonce();
  return <script nonce={nonce} dangerouslySetInnerHTML={{ __html: themeInitScript() }} />;
}
