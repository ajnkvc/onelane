import { redirect } from "next/navigation";

/**
 * /login — Weiterleitung ins SaaS-Portal (Gründer 2026-07-03).
 * ----------------------------------------------------------------------------
 * Die frühere Interim-Seite ist abgelöst: ALLE Rollen (Fahrschüler,
 * Fahrlehrer:innen, Fahrschulen, intern) melden sich im Portal unter /app an —
 * die Rollen-Weiche übernimmt das Portal serverseitig. Alte Links und
 * Lesezeichen auf /login bleiben über diese Weiterleitung funktionsfähig;
 * in Produktion hebt der Host-Redirect (proxy.ts) auf app.onelane.de um.
 */
export const dynamic = "force-dynamic";

export default function LoginRedirect(): never {
  redirect("/app/login");
}
