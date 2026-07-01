/**
 * db-ssl.ts — zentrale, FAIL-CLOSED TLS-Entscheidung für DB-Verbindungen.
 * ----------------------------------------------------------------------------
 * Wird von client.ts (app_user) UND elevated.ts (Tooling/Owner) genutzt, damit
 * die TLS-Politik an EINER Stelle liegt. Bewusst KEIN `server-only`-Import: auch
 * tsx-Tooling-Scripts (Import/Seed) verbinden über elevated.ts und müssen dies laden.
 *
 * Liegt unter src/server/config/* → `process.env`-Zugriff hier erlaubt (Config-Schicht).
 *
 * Politik (F-022/F-036 — TLS an HOST/DSN gekoppelt, nicht nur an NODE_ENV):
 *  - REMOTE-Host ODER Produktion: TLS ist PFLICHT. Default `require` (verschlüsselt,
 *    kein Klartext). `DATABASE_SSL=disable` → harter Abbruch (fail-closed). So bekommt
 *    auch ein Remote-Tooling-Lauf ohne NODE_ENV=production KEINE Klartextverbindung.
 *  - LOKALER/privater Dev-Host (localhost/127.x/::1/RFC1918/Docker-Servicename) außerhalb
 *    Produktion: Default `disable` (lokales Postgres/PGlite ohne TLS).
 *  - `verify-full` (stärkste Stufe inkl. Zertifikatsprüfung, MITM-Schutz) via
 *    `DATABASE_SSL=verify-full` + optionalem CA-PEM `DATABASE_SSL_CA`. Ziel-Stufe für
 *    Live (peaknetworks/Supabase-Root-CA `prod-ca-2021.crt`, siehe docs/infra).
 *
 * Rückgabewerte sind direkt die `ssl`-Option von postgres.js:
 *  - `false`            → kein TLS
 *  - `"require"`        → TLS erzwingen (ohne Zertifikatsprüfung)
 *  - `{ rejectUnauthorized: true, ca? }` → TLS mit Zertifikatsprüfung (verify-full)
 */
export type DbSslMode = "disable" | "require" | "verify-full";
export type DbSslOption = false | "require" | { rejectUnauthorized: true; ca?: string };

const VALID_MODES: readonly DbSslMode[] = ["disable", "require", "verify-full"];

/**
 * Klassifiziert einen DB-Host als lokal/privat (TLS darf in Dev entfallen) vs. remote
 * (TLS Pflicht). Konservativ: alles, was NICHT nachweislich lokal/privat ist, gilt als remote.
 */
export function isLocalDbHost(host: string | null | undefined): boolean {
  if (!host) return false; // unbekannter Host → als remote behandeln (fail-closed)
  let h = host.toLowerCase().replace(/^\[|\]$/g, ""); // IPv6-Klammern entfernen
  h = h.replace(/%.*$/, ""); // IPv6-Scope-ID entfernen (fe80::1%eth0)
  // IPv4-mapped IPv6 (::ffff:127.0.0.1) auf den IPv4-Teil reduzieren.
  const mapped = h.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mapped) h = mapped[1];
  if (h === "localhost" || h === "127.0.0.1" || h === "::1" || h === "0.0.0.0") return true;
  if (h.endsWith(".local") || h.endsWith(".internal")) return true;
  // RFC1918 / loopback-Bereiche.
  if (/^127\./.test(h)) return true;
  if (/^10\./.test(h)) return true;
  if (/^192\.168\./.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  // WICHTIG (fail-closed): Single-Label-Hosts ohne Punkt (z. B. "db", "PRODDB") gelten NICHT
  // pauschal als lokal — sonst wäre ein Prod-Host ohne Domain plötzlich TLS-frei. Docker-Compose-
  // Dev nutzt localhost (siehe .env.example); ein Container-interner Servicename braucht bewusst
  // DATABASE_SSL=disable.
  return false;
}

/** Extrahiert den Host aus einer DSN; null, wenn nicht parsebar. */
export function dbHostFromUrl(databaseUrl: string | null | undefined): string | null {
  if (!databaseUrl) return null;
  try {
    return new URL(databaseUrl).hostname || null;
  } catch {
    return null;
  }
}

/** Reine, testbare Kernlogik (ohne process.env). */
export function computeDbSsl(opts: {
  isProd: boolean;
  mode?: DbSslMode;
  ca?: string;
  /** true, wenn der Ziel-Host NICHT lokal/privat ist → TLS Pflicht (auch außerhalb Prod). */
  isRemoteHost?: boolean;
}): DbSslOption {
  const tlsMandatory = opts.isProd || opts.isRemoteHost === true;
  const mode: DbSslMode = opts.mode ?? (tlsMandatory ? "require" : "disable");

  if (tlsMandatory && mode === "disable") {
    throw new Error(
      "DATABASE_SSL=disable ist für Produktion oder Remote-DB-Hosts nicht erlaubt " +
        "(fail-closed: keine Klartext-DB-Verbindung). Setze 'require' oder 'verify-full'.",
    );
  }
  if (mode === "disable") return false;
  if (mode === "require") return "require";
  // verify-full
  return opts.ca ? { rejectUnauthorized: true, ca: opts.ca } : { rejectUnauthorized: true };
}

/**
 * Liest die Umgebung (Config-Schicht) und liefert die postgres.js-`ssl`-Option.
 * `databaseUrl` optional übergeben, damit die TLS-Pflicht an den Ziel-Host gekoppelt wird
 * (Remote-Host ⇒ TLS Pflicht, auch wenn NODE_ENV≠production). Ohne DSN greift nur NODE_ENV.
 */
export function getDbSslOption(databaseUrl?: string): DbSslOption {
  const isProd = process.env.NODE_ENV === "production";
  // `|| undefined`: leerer String (DATABASE_SSL=) wie "nicht gesetzt" behandeln,
  // damit der Default greift (sonst fiele "" durch `??` in den verify-full-Zweig).
  const rawMode = process.env.DATABASE_SSL || undefined;
  const ca = process.env.DATABASE_SSL_CA || undefined;

  if (rawMode && !VALID_MODES.includes(rawMode as DbSslMode)) {
    // Kein Rohwert im Fehlertext (könnte eine fehlgepastete DSN/Secret sein).
    throw new Error(`Ungültiger DATABASE_SSL-Wert — erlaubt: ${VALID_MODES.join(" | ")}.`);
  }
  const host = dbHostFromUrl(databaseUrl);
  // DSN übergeben aber Host nicht lokal ⇒ remote; DSN nicht übergeben ⇒ nur NODE_ENV entscheidet.
  const isRemoteHost = databaseUrl != null && !isLocalDbHost(host);
  return computeDbSsl({ isProd, mode: rawMode as DbSslMode | undefined, ca, isRemoteHost });
}
