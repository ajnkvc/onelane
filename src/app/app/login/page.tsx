import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getPortalIdentity, isDevSessionActive, DEV_USERS } from "@/modules/portal/identity";
import { devAnmelden } from "@/modules/portal/actions";
import { LoginForm } from "@/components/portal/login-form";

/**
 * /app/login — Portal-Anmeldung (OS-P1).
 * ----------------------------------------------------------------------------
 * Supabase-Pfad: E-Mail+Passwort über die Client-Insel (LoginForm), die die
 * SERVER-Action anmeldenMitPasswort aufruft (Auth-Cookies bleiben httpOnly).
 * Dev-Seam (nur lokal, dreifach verriegelt): Picker der GESEEDETEN Dev-User mit
 * Rollen-Labels + wählbarem aal (MFA-Flow-Test). Bereits angemeldet → /app.
 */
export const metadata: Metadata = { title: "Login" };

export default async function AppLoginSeite({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const identity = await getPortalIdentity();
  if (identity) redirect("/app");

  const params = await searchParams;
  const fehler = params.fehler === "1";
  const devSeam = isDevSessionActive();

  return (
    <div className="mx-auto w-full max-w-md px-6 py-16">
      <p className="font-mono text-xs tracking-[0.25em] text-muted-foreground uppercase">
        onelane · Portal
      </p>
      <h1 className="mt-3 text-3xl font-light tracking-tight">
        Anmelden<span className="font-semibold">.</span>
      </h1>

      {fehler ? (
        <p className="mt-4 rounded-md border border-border bg-muted px-4 py-3 text-sm">
          Anmeldung nicht möglich. Bitte erneut versuchen.
        </p>
      ) : null}

      {devSeam ? (
        <form action={devAnmelden} className="mt-8 grid gap-4">
          <p className="text-sm text-muted-foreground">
            Entwicklungsmodus: Anmeldung als geseedeter Dev-User (kein Auth-Dienst
            konfiguriert). Vorher <code>npm run db:seed:demo</code> ausführen.
          </p>
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Dev-User</span>
            <select
              name="devUser"
              className="min-h-11 rounded-md border border-border bg-card px-3"
              defaultValue={DEV_USERS[0].key}
            >
              {DEV_USERS.map((u) => (
                <option key={u.key} value={u.key}>
                  {u.label} — {u.rolle}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="aal" value="aal2" defaultChecked />
            <span>mit bestätigter Zwei-Faktor-Stufe (aal2) anmelden</span>
          </label>
          <button
            type="submit"
            className="mt-2 min-h-11 rounded-full bg-accent px-5 font-semibold text-accent-foreground"
          >
            Anmelden
          </button>
        </form>
      ) : (
        <LoginForm />
      )}
    </div>
  );
}
