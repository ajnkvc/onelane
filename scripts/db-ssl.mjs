/**
 * db-ssl.mjs — JS-Zwilling von src/server/config/db-ssl.ts für plain-JS-Tooling-
 * Skripte (laufen via `node *.mjs`, können das TS-Modul nicht importieren).
 * ----------------------------------------------------------------------------
 * Logik bewusst IDENTISCH zur TS-Version halten — bei Änderungen BEIDE anpassen.
 * Fail-closed: Produktion ODER Remote-Host erzwingt TLS ('require'); 'disable' wirft dann.
 *
 * WICHTIG: Übergib die Ziel-DSN an getDbSslOption(url), damit ein Remote-Tooling-Lauf
 * (z. B. Migration gegen Prod/Staging) auch OHNE NODE_ENV=production TLS erzwingt.
 */
export function isLocalDbHost(host) {
  if (!host) return false;
  let h = String(host).toLowerCase().replace(/^\[|\]$/g, "");
  h = h.replace(/%.*$/, ""); // IPv6-Scope-ID entfernen
  const mapped = h.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mapped) h = mapped[1];
  if (h === "localhost" || h === "127.0.0.1" || h === "::1" || h === "0.0.0.0") return true;
  if (h.endsWith(".local") || h.endsWith(".internal")) return true;
  if (/^127\./.test(h)) return true;
  if (/^10\./.test(h)) return true;
  if (/^192\.168\./.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  // fail-closed: Single-Label-Hosts (z. B. "db", "PRODDB") sind NICHT pauschal lokal.
  return false;
}

export function dbHostFromUrl(databaseUrl) {
  if (!databaseUrl) return null;
  try {
    return new URL(databaseUrl).hostname || null;
  } catch {
    return null;
  }
}

export function computeDbSsl({ isProd, mode, ca, isRemoteHost }) {
  const tlsMandatory = isProd || isRemoteHost === true;
  const m = mode ?? (tlsMandatory ? "require" : "disable");
  if (tlsMandatory && m === "disable") {
    throw new Error(
      "DATABASE_SSL=disable ist für Produktion oder Remote-DB-Hosts nicht erlaubt (fail-closed: keine Klartext-DB-Verbindung).",
    );
  }
  if (m === "disable") return false;
  if (m === "require") return "require";
  // verify-full
  return ca ? { rejectUnauthorized: true, ca } : { rejectUnauthorized: true };
}

export function getDbSslOption(databaseUrl) {
  const isProd = process.env.NODE_ENV === "production";
  // `|| undefined`: leerer String (DATABASE_SSL=) wie "nicht gesetzt" behandeln.
  const mode = process.env.DATABASE_SSL || undefined;
  const ca = process.env.DATABASE_SSL_CA || undefined;
  if (mode && !["disable", "require", "verify-full"].includes(mode)) {
    throw new Error("Ungültiger DATABASE_SSL-Wert — erlaubt: disable | require | verify-full.");
  }
  const host = dbHostFromUrl(databaseUrl);
  const isRemoteHost = databaseUrl != null && !isLocalDbHost(host);
  return computeDbSsl({ isProd, mode, ca, isRemoteHost });
}
