import "server-only";
import { headers } from "next/headers";

/**
 * nonce.ts — liest den per-Request-CSP-Nonce (vom Proxy als `x-nonce` gesetzt).
 * ----------------------------------------------------------------------------
 * Für nonce-basierte CSP (script-src 'nonce-…' 'strict-dynamic') muss jedes von uns
 * gerenderte <script> (z. B. JSON-LD) den aktuellen Nonce tragen. Next.js nonc-t seine
 * eigenen Framework-Skripte automatisch anhand des Request-CSP-Headers; unsere eigenen
 * Inline-Scripts brauchen den Nonce explizit.
 *
 * Der Aufruf von headers() erzwingt zugleich dynamisches Rendering (Nonce ist per-Request,
 * daher kein Static/ISR — bewusste Entscheidung, Perf via Edge-Cache/Cloudflare).
 */
export async function getRequestNonce(): Promise<string | undefined> {
  return (await headers()).get("x-nonce") ?? undefined;
}
