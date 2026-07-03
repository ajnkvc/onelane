import "server-only";
import { claimsSchema } from "./claims-schema";
import { sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { getDb } from "./client";
import { getVerifiedUser } from "@/server/auth/session";
import { AuthenticationRequiredError } from "@/server/auth/permissions";

/**
 * rls-context.ts — setzt den verifizierten Nutzerkontext für Row Level Security.
 * ============================================================================
 * SICHERHEITSKRITISCH. Diese Datei trägt einen großen Teil der RLS-Garantie und
 * sollte zu den meistkommentierten/-geprüften Dateien im Projekt gehören.
 *
 * Funktionsweise:
 *  - Jede nutzerbezogene DB-Operation läuft innerhalb EINER Transaktion.
 *  - Zu Beginn werden die verifizierten Claims gesetzt:
 *        select set_config('request.jwt.claims', $1, true)
 *    - $1 ist ein GEBUNDENER Parameter (kein String-Zusammenbau → Injektionsschutz).
 *    - `true` = transaktionslokal → pool-sicher trotz Transaction-Pooling.
 *  - Die DB-Policies werten daraus app.current_user_id() (= sub) aus; Rolle und
 *    Mitgliedschaften leitet die DB über SECURITY-DEFINER-Helfer aus unseren
 *    Tabellen ab — NICHT aus den Claims (siehe ARCHITECTURE.md/SECURITY.md).
 *
 * MINIMALITÄT + VALIDIERUNG: Es werden nur die minimal nötigen, ZOD-VALIDIERTEN
 * Claims gesetzt. Unerwartete Felder werden verworfen, damit die DB keine
 * ungeprüften, sicherheitsrelevanten Werte erhält.
 *
 * Die Claims stammen AUSSCHLIESSLICH aus einer serverseitig verifizierten Session
 * (server/auth/session.ts) — NIEMALS aus Client-Eingaben.
 */

// Erlaubte, minimale Claims (nur `sub`) — Definition + Validierung in ./claims-schema.
export type { VerifiedClaims } from "./claims-schema";

/**
 * Transaktions-lokale Schutzlimits (DoS-/Kostenschutz). Als `set_config(..., true)`
 * = SET LOCAL → gilt nur für die aktuelle Transaktion und ist damit POOLER-SICHER
 * (Supabase Transaction-Pooler). Verhindert, dass eine teure oder hängende Query
 * unbegrenzt eine der wenigen Pool-Verbindungen bindet. Werte bewusst knapp für den
 * Request-Pfad (app_user); der erhöhte Tooling-/Import-Pfad bleibt ungedrosselt.
 *   statement_timeout: max. Laufzeit einer Query
 *   lock_timeout: max. Wartezeit auf ein Lock
 *   idle_in_transaction_session_timeout: max. Leerlauf einer offenen Transaktion
 */
const GUARDS = sql`,
  set_config('statement_timeout', '5000', true),
  set_config('lock_timeout', '3000', true),
  set_config('idle_in_transaction_session_timeout', '10000', true)`;

/** Transaktions-Handle, wie Drizzle es im transaction()-Callback liefert. */
type Tx = Parameters<
  Parameters<PostgresJsDatabase<Record<string, never>>["transaction"]>[0]
>[0];

/**
 * Fail-closed Laufzeit-Garantie (F-002): die reguläre Request-DB-Rolle darf NIEMALS
 * SUPERUSER oder BYPASSRLS sein — sonst würde RLS still ausgehebelt (z. B. wenn versehentlich
 * eine Owner-/Tooling-DSN in DATABASE_URL stünde). Einmalige Prüfung pro Prozess (gecachtes
 * Promise); schlägt sie fehl, wirft JEDER nutzerbezogene Zugriff.
 */
let runtimeRoleChecked: Promise<void> | null = null;
function assertSafeRuntimeRole(database: PostgresJsDatabase<Record<string, never>>): Promise<void> {
  if (!runtimeRoleChecked) {
    runtimeRoleChecked = (async () => {
      const rows = (await database.execute(
        sql`select current_user::text as role, rolsuper, rolbypassrls
              from pg_roles where rolname = current_user`,
      )) as unknown as Array<{ role: string; rolsuper: boolean | null; rolbypassrls: boolean | null }>;
      const r = rows[0];
      if (!r) throw new Error("RLS-Sicherheit: current_user nicht in pg_roles auffindbar.");
      // Laufzeit-Rolle MUSS die gehärtete app_user sein — schließt Owner-/Tooling-DSN
      // (z. B. app_owner, dessen Owner-Exemption RLS umgehen würde) sicher aus.
      if (r.role !== "app_user") {
        throw new Error(
          `RLS-Sicherheit: Laufzeit-DB-Rolle ist "${r.role}", erwartet "app_user" — vermutlich falsche DATABASE_URL (Owner-/Tooling-DSN).`,
        );
      }
      // Fail-closed: NUR exakt false akzeptieren (NULL/true ⇒ Abbruch).
      if (r.rolsuper !== false || r.rolbypassrls !== false) {
        throw new Error(
          `RLS-Sicherheit: app_user-Attribute unerwartet (super=${r.rolsuper}, bypassrls=${r.rolbypassrls}) — RLS wäre umgehbar.`,
        );
      }
    })().catch((e) => {
      runtimeRoleChecked = null; // abgelehnten/transienten Check NICHT dauerhaft cachen
      throw e;
    });
  }
  return runtimeRoleChecked;
}

/**
 * Führt `work` in einer Transaktion mit gesetztem RLS-Nutzerkontext aus.
 * Die übergebenen Claims werden zuerst validiert (wirft bei ungültig) und auf das
 * erlaubte Minimum reduziert.
 *
 * ⚠️ NIEDRIG-LEVEL / @internal: akzeptiert BELIEBIGE Claims und beweist KEINE Session-
 * Herkunft. Wird bewusst NICHT über das DAL-Barrel exportiert (Impersonation-Footgun:
 * eine aus Request-Parametern durchgereichte User-ID würde den RLS-Kontext auf einen
 * FREMDEN Nutzer setzen). Request-Code nutzt ausschließlich `withCurrentUserContext`.
 */
export async function withUserContext<T>(
  rawClaims: unknown,
  work: (tx: Tx) => Promise<T>,
): Promise<T> {
  const claims = claimsSchema.parse(rawClaims);
  const database = getDb();
  await assertSafeRuntimeRole(database);
  return database.transaction(async (tx) => {
    await tx.execute(
      sql`select set_config('request.jwt.claims', ${JSON.stringify(claims)}, true)${GUARDS}`,
    );
    return work(tx);
  });
}

/**
 * SANKTIONIERTER authentifizierter Request-Pfad: bildet die RLS-`sub` AUSSCHLIESSLICH
 * aus der serverseitig verifizierten Session (getVerifiedUser), nie aus Aufrufer-Eingaben.
 * Wirft `AuthenticationRequiredError` (401), wenn keine gültige Session vorliegt.
 */
export async function withCurrentUserContext<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
  const user = await getVerifiedUser();
  if (!user) throw new AuthenticationRequiredError();
  return withUserContext({ sub: user.id }, work);
}

/**
 * Führt `work` OHNE Nutzerkontext aus (öffentliche/anonyme Lesezugriffe).
 * `app.current_user_id()` ist dabei NULL → es greifen ausschließlich die
 * Public-RLS-Policies (z. B. nur gelistete Schulen / veröffentlichte Inhalte).
 * Defensiv werden die Claims transaktionslokal auf leer gesetzt.
 *
 * F-054: Zusätzlich wird die Transaktion transaktionslokal READ ONLY gesetzt
 * (set_config('transaction_read_only','on',true)). Der anonyme Pfad ist als reiner
 * Lesepfad dokumentiert; ein künftiger versehentlicher Write scheitert damit HART auf
 * DB-Ebene (fail-closed), statt nur an einzelnen RLS-Policies zu hängen.
 */
export async function withAnonContext<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
  const database = getDb();
  await assertSafeRuntimeRole(database);
  return database.transaction(async (tx) => {
    await tx.execute(
      sql`select set_config('request.jwt.claims', '', true), set_config('transaction_read_only', 'on', true)${GUARDS}`,
    );
    return work(tx);
  });
}

/**
 * SANKTIONIERTER anonymer SCHREIB-Pfad — AUSSCHLIESSLICH für öffentliche
 * Portal-Submissions (Migrationen 0022/0023: `leads`, `job_applications`).
 *
 * Warum ein eigener Kontext: `withAnonContext` ist bewusst transaktionslokal
 * READ ONLY (F-054) — ein anonymer Lead-/Bewerbungs-INSERT scheitert dort hart
 * mit SQLSTATE 25006. Dieser Kontext ist die EINZIGE Ausnahme davon und bleibt
 * ansonsten identisch eng:
 *   - Claims leer → `app.current_user_id()` ist NULL; es greifen ausschließlich
 *     die expliziten `*_public_insert`-Policies der Submission-Tabellen
 *     (WITH CHECK: status='neu', Einwilligungen gesetzt, Ziel gelistet/aktiv).
 *   - Spalten-Grants der Migrationen begrenzen zusätzlich, WAS geschrieben
 *     werden kann (kein status-/id-/deleted_at-Insert; UPDATE/DELETE anonym
 *     ohnehin policy-los = deny).
 *   - KEIN `RETURNING` verwenden: Postgres wendet die SELECT-Policies auf
 *     RETURNING an — anonym gibt es kein SELECT, die Rückgabe würde hart
 *     scheitern (gewollt; Erfolg wird ohne Datenrückgabe signalisiert).
 *
 * Aufrufer-Pflichten (Modul-Schicht, siehe modules/leads bzw. modules/jobs):
 * Zod-Validierung, Anti-Missbrauchs-Kette (Honeypot/Zeitfalle/Rate-Limit) und
 * serverseitige Auflösung der Ziel-IDs aus dem Routen-Slug — NIE aus dem
 * Formular (IDOR-Schutz).
 *
 * DURCHSETZUNG: (a) ESLint sperrt den Import dieses Kontexts überall außer in
 * src/modules/leads/** und src/modules/jobs/** (PUBLIC_SUBMISSION_IMPORT_SELECTOR,
 * eslint.config.mjs Block 5b); (b) auf DB-Ebene begrenzen die INSERT-Policies +
 * Spalten-Grants der Migrationen 0022/0023, WAS ein Claims-loser app_user
 * überhaupt schreiben kann — andere Tabellen bleiben für diesen Kontext deny.
 */
export async function withPublicSubmissionContext<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
  const database = getDb();
  await assertSafeRuntimeRole(database);
  return database.transaction(async (tx) => {
    // app.public_submission: transaktionslokale Markierung dieses sanktionierten
    // Pfads — einzige Konsumentin ist die SECURITY-DEFINER-Funktion
    // app.job_bewerbung_empfaenger (0027), die interne Zustell-Adressen NUR
    // innerhalb dieses Kontexts herausgibt (Spalten-Grant ist entzogen).
    await tx.execute(
      sql`select set_config('request.jwt.claims', '', true), set_config('app.public_submission', '1', true)${GUARDS}`,
    );
    return work(tx);
  });
}

/** sha256-Hex — das einzige Eingabeformat des Maschinen-Auth-Lookups (0031-CHECK). */
const API_KEY_HASH_RE = /^[0-9a-f]{64}$/;

/**
 * SANKTIONIERTER MASCHINEN-AUTH-PFAD — AUSSCHLIESSLICH für den API-/MCP-
 * Key-Lookup (Migration 0031: app.api_key_pruefen + app.api_key_beruehren).
 *
 * Warum ein eigener, GESCHLOSSENER Pfad (kein work-Callback!):
 *  - api_keys.key_hash ist für app_user unsichtbar (0029) — der Lookup läuft
 *    über eine GUC-gated SECURITY-DEFINER-Funktion (Muster 0027/0028), die NUR
 *    innerhalb dieses Kontexts Daten liefert (app.api_key_auth = '1').
 *  - Der Kontext ist claims-los, aber NICHT read-only (die gedrosselte
 *    last_used_at-Fortschreibung schreibt) — deshalb bekommt der Aufrufer
 *    KEINEN Transaktions-Zugriff: diese Funktion führt exakt die zwei
 *    Definer-Aufrufe aus und gibt die Roh-Zeile zurück (Zod-Parsing macht der
 *    Adapter src/modules/api/db-key.ts — der EINZIGE erlaubte Importeur,
 *    ESLint-erzwungen wie beim Submission-Kontext).
 *  - Hash-Format wird VOR jedem DB-Kontakt geprüft (kein Junk an die DB);
 *    der Hash taucht in keinem Log auf (Aufrufer-Pflicht: modules/api/audit
 *    identifiziert Schlüssel ausschließlich über prefix).
 */
export async function apiKeyAuthLookup(keyHash: string): Promise<Record<string, unknown> | null> {
  if (!API_KEY_HASH_RE.test(keyHash)) return null;
  const database = getDb();
  await assertSafeRuntimeRole(database);
  return database.transaction(async (tx) => {
    await tx.execute(
      sql`select set_config('request.jwt.claims', '', true), set_config('app.api_key_auth', '1', true)${GUARDS}`,
    );
    const rows = (await tx.execute(
      sql`select key_id, prefix, scopes, status, expires_at,
                 partner_id, partner_name, partner_status
            from app.api_key_pruefen(${keyHash})`,
    )) as unknown as Array<Record<string, unknown>>;
    const zeile = rows[0];
    if (!zeile) return null;
    // last_used_at gedrosselt fortschreiben (max. 1 Write / 5 Min. je Schlüssel —
    // Drossel liegt IN der Definer-Funktion, hier nur der Aufruf).
    await tx.execute(sql`select app.api_key_beruehren(${String(zeile.key_id)}::uuid)`);
    return zeile;
  });
}
