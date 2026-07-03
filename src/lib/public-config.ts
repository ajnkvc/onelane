import { z } from "zod";

/**
 * public-config.ts — zentrale Stelle für ÖFFENTLICHE Konfiguration.
 * ----------------------------------------------------------------------------
 * Werte aus `NEXT_PUBLIC_*` sind KEINE Secrets (werden zur Build-Zeit inlined und
 * sind am Client sichtbar). Diese Datei bündelt ihr Lesen + Validierung, damit
 * NIRGENDWO sonst (proxy.ts, SEO-Routen, Komponenten) direkt `process.env`
 * gelesen wird — analog zur Regel "Config als zentrale Env-Stelle"
 * (server/config/env.ts für Secrets, hier für Öffentliches).
 *
 * Bewusst KEIN `server-only`: NEXT_PUBLIC_*-Werte dürfen auch im Client/Edge
 * genutzt werden. Es liegen hier KEINE Secrets.
 *
 * ROBUSTHEIT: Kopiert man `.env.example` nach `.env.local`, entstehen LEERE Strings
 * (`NEXT_PUBLIC_SUPABASE_URL=`), kein `undefined`. Ohne Behandlung würde `.url()`
 * an einem leeren String scheitern und die App crashen. Daher normalisieren wir
 * leere Strings per Preprocess zu `undefined` (→ optional bzw. Fallback greift).
 *
 * Wichtig: `NEXT_PUBLIC_*` müssen STATISCH referenziert werden (kein dynamischer
 * process.env[key]-Zugriff), damit Next sie zur Build-Zeit ersetzt.
 */

/** Leere Strings (aus kopierten .env-Vorlagen) wie "nicht gesetzt" behandeln. */
const emptyToUndefined = (value: unknown) =>
  value === "" ? undefined : value;

/** true, wenn die URL wohlgeformt UND https ist (blockt javascript:/data:/ftp:/http:). */
const isHttpsUrl = (v: string): boolean => {
  try {
    return new URL(v).protocol === "https:";
  } catch {
    return false;
  }
};

/** https-URL-Schema (nur https, kein javascript:/data:/ftp:/http:). */
const httpsUrlSchema = z
  .string()
  .url()
  .refine(isHttpsUrl, "muss eine https-URL sein (kein http/javascript/data)");

/**
 * Prüft/normalisiert eine öffentliche Origin (F-074/F-057). Liefert die kanonische Origin
 * (`scheme://host[:port]`) oder null. In Produktion: nur https + kein localhost/private Host;
 * origin-only (kein Pfad/Query/Fragment, keine Zugangsdaten).
 */
export function normalizePublicOrigin(
  value: string,
  opts: { allowInsecureLocalhost: boolean },
): string | null {
  let u: URL;
  try {
    u = new URL(value);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  if (u.username || u.password) return null;
  if ((u.pathname && u.pathname !== "/") || u.search || u.hash) return null;
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const isLocal =
    host === "localhost" || host === "127.0.0.1" || host === "::1" || host.endsWith(".local");
  if (u.protocol !== "https:") {
    // http nur für localhost im Dev erlaubt.
    if (!(opts.allowInsecureLocalhost && isLocal)) return null;
  }
  if (isLocal && !opts.allowInsecureLocalhost) return null; // kein localhost in Produktion
  return u.origin;
}

/**
 * Normalisiert eine ÖFFENTLICH ausgegebene Link-/Ressourcen-URL (z. B. Fahrschul-Website) für
 * href/JSON-LD (F-…, stored-URL-XSS/Phishing-Schutz). Erlaubt NUR http(s) mit Pfad/Query — blockt
 * `javascript:`/`data:`/`ftp:` und URLs mit Zugangsdaten. Gibt die normalisierte URL zurück oder
 * null (dann Feld ausblenden statt einen unsicheren Wert zu rendern).
 */
export function normalizePublicHttpUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  let u: URL;
  try {
    u = new URL(value);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  if (u.username || u.password) return null;
  return u.toString();
}

const publicEnvSchema = z.object({
  // Basis-URL: KEIN stiller Default mehr. In Produktion erzwingt getSiteUrl()
  // einen gesetzten Wert (fail-closed); in Dev wird auf localhost zurückgefallen.
  NEXT_PUBLIC_SITE_URL: z.preprocess(
    emptyToUndefined,
    z.string().url().optional(),
  ),
  NEXT_PUBLIC_SUPABASE_URL: z.preprocess(
    emptyToUndefined,
    httpsUrlSchema.optional(),
  ),
  // Neuer Publishable Key (ab 2025 von Supabase empfohlen).
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.preprocess(
    emptyToUndefined,
    z.string().min(1).optional(),
  ),
  // Legacy anon key — von Supabase bis Ende 2026 unterstützt, hier als Fallback.
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.preprocess(
    emptyToUndefined,
    z.string().min(1).optional(),
  ),
  NEXT_PUBLIC_CONTENT_SLUG: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .regex(/^[a-z0-9-]+$/, "Nur Kleinbuchstaben, Ziffern und Bindestriche.")
      .default("ratgeber"),
  ),
  // Karten-Kacheln: in Produktion MUSS ein eigener/bezahlter Tile-Anbieter
  // konfiguriert werden (OSMF-Public-Tiles sind kein Produktionsdienst).
  NEXT_PUBLIC_MAP_TILE_URL: z.preprocess(
    emptyToUndefined,
    // https-only: Leaflet rendert Tiles/Attribution im DOM → kein javascript:/data:/http.
    // Zusätzlich HOST-Platzhalter ({s}-Subdomain-Sharding) fail-closed ablehnen: daraus ließe
    // sich keine gültige CSP-img-src-Origin ableiten (die Karte würde sonst still per CSP blocken).
    // Pfad-Platzhalter ({z}/{x}/{y}) bleiben erlaubt.
    httpsUrlSchema
      .refine((v) => {
        try {
          return !new URL(v).host.includes("{");
        } catch {
          return false;
        }
      }, "Host-Platzhalter (z. B. {s}) im Tile-Host nicht erlaubt — einen konkreten Host verwenden.")
      .optional(),
  ),
  NEXT_PUBLIC_MAP_TILE_ATTRIBUTION: z.preprocess(
    emptyToUndefined,
    z.string().min(1).optional(),
  ),
});

const publicEnv = publicEnvSchema.parse({
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_CONTENT_SLUG: process.env.NEXT_PUBLIC_CONTENT_SLUG,
  NEXT_PUBLIC_MAP_TILE_URL: process.env.NEXT_PUBLIC_MAP_TILE_URL,
  NEXT_PUBLIC_MAP_TILE_ATTRIBUTION: process.env.NEXT_PUBLIC_MAP_TILE_ATTRIBUTION,
});

/**
 * Basis-URL der Seite (robots/sitemap/llms/canonical). In PRODUKTION fail-closed:
 * ist `NEXT_PUBLIC_SITE_URL` nicht gesetzt, wird hart abgebrochen — sonst landeten
 * falsche `localhost`-URLs in robots/sitemap/llms/canonical. In Dev: localhost.
 */
export function getSiteUrl(): string {
  const url = publicEnv.NEXT_PUBLIC_SITE_URL;
  if (!url) {
    if (isProduction()) {
      throw new Error(
        "NEXT_PUBLIC_SITE_URL ist in Produktion nicht gesetzt — erforderlich für " +
          "robots/sitemap/llms/canonical (kein localhost-Fallback in Produktion).",
      );
    }
    return "http://localhost:3000";
  }
  // F-074: origin-only normalisieren; in Produktion https + kein localhost erzwingen.
  const origin = normalizePublicOrigin(url, { allowInsecureLocalhost: !isProduction() });
  if (!origin) {
    throw new Error(
      "NEXT_PUBLIC_SITE_URL ist ungültig — erwartet eine kanonische Origin " +
        "(in Produktion https, kein localhost, ohne Pfad/Query/Fragment).",
    );
  }
  return origin;
}

/** Öffentlicher Pfadname des Content-Bereichs (z. B. "ratgeber"). */
export function getContentSlug(): string {
  return publicEnv.NEXT_PUBLIC_CONTENT_SLUG;
}

/**
 * Zieladresse für VERMITTLUNGS-Interessenten (Quereinstieg/Ausbildungsplatz).
 * Gründer-Direktive 2026-07-02: Diese Anfragen gehen IMMER an onelane und NIE
 * blind an die Fahrschule — wir übernehmen den vollständigen Vermittlungs-
 * prozess über das Portal (Kommissions-USP und Ertragsquelle). Server-only-Env
 * (kein NEXT_PUBLIC): zur Laufzeit gelesen, Fallback ist unser Funktions-
 * postfach.
 */
export function getVermittlungEmail(): string {
  const wert = process.env.VERMITTLUNG_EMAIL?.trim();
  return wert && wert.length > 0 ? wert : "kontakt@onelane.de";
}

/**
 * Host des App-Portals (z. B. "app.onelane.de"). Server-Laufzeit-Env (kein
 * NEXT_PUBLIC, kein Secret) — wie VERMITTLUNG_EMAIL zur Laufzeit gelesen, damit
 * proxy.ts/origin-guard KEIN direktes process.env brauchen. `null` = kein
 * eigener App-Host (Dev/Single-Host: /app ist direkt erreichbar). Nur
 * hostname[:port], kleingeschrieben; ungültige Werte fail-closed → null.
 */
export function getAppHost(): string | null {
  const wert = process.env.APP_HOST?.trim().toLowerCase();
  if (!wert) return null;
  return /^[a-z0-9][a-z0-9.-]*(:\d{1,5})?$/.test(wert) ? wert : null;
}

/**
 * Kanonische Origins des App-Portals (für CSRF-/Origin-Allowlists). In
 * Produktion nur https; in Dev zusätzlich http (lokale Hosts ohne TLS).
 */
export function getAppOrigins(): string[] {
  const host = getAppHost();
  if (!host) return [];
  return isProduction() ? [`https://${host}`] : [`https://${host}`, `http://${host}`];
}

/**
 * Konfigurierter Karten-Tile-Anbieter (öffentlich, nicht-geheim). `null`, wenn
 * nicht gesetzt → der Maps-Adapter nutzt dann einen DEV-Fallback (und verweigert
 * in Produktion, weil OSMF-Public-Tiles kein Produktionsdienst sind).
 */
export function getMapTileConfig(): { tileUrl: string; attribution: string } | null {
  if (!publicEnv.NEXT_PUBLIC_MAP_TILE_URL) return null;
  return {
    tileUrl: publicEnv.NEXT_PUBLIC_MAP_TILE_URL,
    attribution:
      publicEnv.NEXT_PUBLIC_MAP_TILE_ATTRIBUTION ?? "© OpenStreetMap-Mitwirkende",
  };
}

/**
 * Öffentliche Supabase-Konfiguration (nicht-geheim). `null`, wenn (noch) nicht
 * gesetzt — so können Proxy/Auth-Helfer im Fundament ohne Supabase-Instanz sauber
 * no-op'en statt zu crashen.
 */
export function getPublicSupabaseConfig(): { url: string; publishableKey: string } | null {
  // Bevorzugt der neue Publishable Key; Fallback auf den Legacy anon key
  // (Supabase deprecatet die alten Schlüssel bis Ende 2026).
  const url = publicEnv.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey =
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // F-032 fail-closed: TEILkonfiguration (nur URL ODER nur Key) ist eine Fehlkonfiguration
  // → hart werfen statt still no-op. BEIDE fehlen = bewusst auth-loses Public-Portal (Phase 1) → null.
  // (URL-https wird bereits vom Schema erzwungen.)
  if (!url && !publishableKey) return null;
  if (!url || !publishableKey) {
    throw new Error(
      "Supabase-Auth ist unvollständig konfiguriert: NEXT_PUBLIC_SUPABASE_URL und ein " +
        "Publishable/Anon-Key müssen BEIDE gesetzt sein (oder beide leer für ein auth-loses Deployment).",
    );
  }
  return { url, publishableKey };
}

/**
 * Laufzeitmodus. `NODE_ENV` ist eine Framework-Variable (von Next gesetzt) und
 * wird hier zentral gekapselt, damit außerhalb der Config-Schicht NIRGENDS direkt
 * `process.env` gelesen wird.
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}
