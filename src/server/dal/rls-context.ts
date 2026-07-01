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
