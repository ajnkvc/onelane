/**
 * db-smoke.mjs — lokaler RLS-Smoke-Test gegen die laufende Dev-DB.
 * ============================================================================
 * Verbindet als regulärer `app_user` (DATABASE_URL, anonym = keine Claims) und
 * prüft, dass die DB-Sicherheit greift — das gleiche Verhalten wie die PGlite-
 * Tests, aber gegen echtes lokales Postgres. Exit 0 = alles grün.
 *
 * Aufruf: node --env-file=.env.development.local scripts/db-smoke.mjs
 */
import postgres from "postgres";
import { getDbSslOption } from "./db-ssl.mjs";

const appUrl = process.env.DATABASE_URL;
if (!appUrl) {
  console.error("Fehlt DATABASE_URL (regulärer app_user-Pfad).");
  process.exit(1);
}

let ok = true;
const check = (name, cond, detail) => {
  console.log(`${cond ? "✓" : "✗"} ${name}${detail ? " — " + detail : ""}`);
  if (!cond) ok = false;
};

const sql = postgres(appUrl, { max: 1, ssl: getDbSslOption(appUrl), onnotice: () => {} });
try {
  const [role] = await sql`
    select rolname, rolsuper, rolbypassrls from pg_roles where rolname = current_user`;
  check(
    "verbunden EXAKT als app_user — kein Superuser, kein BYPASSRLS (Invariante)",
    !!role && role.rolname === "app_user" && role.rolsuper === false && role.rolbypassrls === false,
    `role=${role?.rolname} super=${role?.rolsuper} bypassrls=${role?.rolbypassrls}`,
  );

  const [{ c: listed }] = await sql`select count(*)::int as c from public.driving_schools`;
  check("anonym: gelistete Schulen sichtbar (>0)", listed > 0, `${listed} sichtbar`);

  const [{ c: users }] = await sql`select count(*)::int as c from public.users`;
  check("anonym: private Tabelle users gesperrt (0)", users === 0, `${users} sichtbar`);

  const [{ c: enr }] = await sql`select count(*)::int as c from public.enrollments`;
  check("anonym: private Tabelle enrollments gesperrt (0)", enr === 0, `${enr} sichtbar`);

  const [{ c: rp }] = await sql`select count(*)::int as c from public.reviews_public`;
  check("anonym: reviews_public lesbar (>0)", rp > 0, `${rp} sichtbar`);
} catch (err) {
  console.error("Smoke fehlgeschlagen:", err?.message ?? err);
  ok = false;
} finally {
  await sql.end();
}

console.log(ok ? "\nRLS-Smoke: GRÜN ✓" : "\nRLS-Smoke: FEHLER ✗");
process.exit(ok ? 0 : 1);
