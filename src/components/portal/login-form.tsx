"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { anmeldenMitPasswort } from "@/modules/portal/actions";

/**
 * login-form.tsx — Client-Insel der Portal-Anmeldung (Supabase-Pfad).
 * ----------------------------------------------------------------------------
 * Reicht E-Mail+Passwort an die SERVER-Action anmeldenMitPasswort weiter (die
 * Auth-Cookies bleiben httpOnly — kein Token im Browser-JS). Danach: mit
 * bestehendem TOTP-Faktor → /app/einrichtung/2fa (Challenge), sonst /app
 * (das MFA-Pflicht-Gate greift dort serverseitig erneut).
 * Fehlermeldungen bewusst generisch (kein Konto-/Passwort-Orakel).
 */
export function LoginForm() {
  const router = useRouter();
  const [fehler, setFehler] = useState(false);
  const [laeuft, startTransition] = useTransition();

  function absenden(formData: FormData) {
    setFehler(false);
    const email = String(formData.get("email") ?? "");
    const passwort = String(formData.get("passwort") ?? "");
    startTransition(async () => {
      const ergebnis = await anmeldenMitPasswort({ email, passwort });
      if (!ergebnis.ok) {
        setFehler(true);
        return;
      }
      router.push(ergebnis.mfaErforderlich ? "/app/einrichtung/2fa" : "/app");
      router.refresh();
    });
  }

  return (
    <form action={absenden} className="mt-8 grid gap-4">
      {fehler ? (
        <p className="rounded-md border border-border bg-muted px-4 py-3 text-sm">
          Anmeldung nicht möglich. Bitte E-Mail und Passwort prüfen.
        </p>
      ) : null}
      <label className="grid gap-1 text-sm">
        <span className="text-muted-foreground">E-Mail</span>
        <input
          type="email"
          name="email"
          autoComplete="email"
          required
          className="min-h-11 rounded-md border border-border bg-card px-3"
        />
      </label>
      <label className="grid gap-1 text-sm">
        <span className="text-muted-foreground">Passwort</span>
        <input
          type="password"
          name="passwort"
          autoComplete="current-password"
          required
          className="min-h-11 rounded-md border border-border bg-card px-3"
        />
      </label>
      <button
        type="submit"
        disabled={laeuft}
        className="mt-2 min-h-11 rounded-full bg-accent px-5 font-semibold text-accent-foreground disabled:opacity-60"
      >
        {laeuft ? "Wird geprüft …" : "Anmelden"}
      </button>
    </form>
  );
}
