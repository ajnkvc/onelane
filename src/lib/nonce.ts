import "server-only";
import { headers } from "next/headers";

/**
 * nonce.ts — liest den per-Request-CSP-Nonce (vom Proxy als `x-nonce` gesetzt).
 * ----------------------------------------------------------------------------
 * Für nonce-basierte CSP (script-src 'nonce-…' 'strict-dynamic') muss jedes von uns
 * gerenderte AUSFÜHRBARE Inline-<script> den aktuellen Nonce tragen. Next.js nonc-t
 * seine eigenen Framework-Skripte automatisch anhand des Request-CSP-Headers; eigene
 * ausführbare Inline-Scripts (derzeit keine) brauchen den Nonce explizit von hier.
 *
 * NICHT für JSON-LD verwenden: Datenblöcke (type="application/ld+json") erreichen
 * den CSP-Inline-Check gar nicht („prepare the script element" bricht vorher ab) —
 * ein Nonce dort schützt nichts und provoziert nur React-Hydration-Warnungen durch
 * Browser-Nonce-Hiding, siehe components/seo/json-ld.tsx.
 *
 * Der Aufruf von headers() erzwingt zugleich dynamisches Rendering (Nonce ist per-Request,
 * daher kein Static/ISR — bewusste Entscheidung, Perf via Edge-Cache/Cloudflare).
 */
export async function getRequestNonce(): Promise<string | undefined> {
  return (await headers()).get("x-nonce") ?? undefined;
}
