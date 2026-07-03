/**
 * theme.ts — Theme-Mechanik des App-Portals (OS-P1, reine Helfer).
 * ----------------------------------------------------------------------------
 * Cookie 'onelane-theme' trägt die EXPLIZITE Wahl ('light'|'dark'); KEIN Cookie
 * = System (prefers-color-scheme, per nonce-festem Inline-Script aufgelöst —
 * components/portal/theme-script.tsx). Kein Secret, kein httpOnly nötig.
 * Die Public-Site wertet das Cookie NIE aus (Root-Layout wendet die .dark-Klasse
 * ausschließlich im App-Scope an — x-portal-scope-Header des Proxys).
 */
export const THEME_COOKIE = "onelane-theme";

export type Theme = "light" | "dark";

/** Fail-closed: nur exakt 'light'/'dark' sind gültig, alles andere = System (null). */
export function parseTheme(value: string | undefined | null): Theme | null {
  return value === "light" || value === "dark" ? value : null;
}
