import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getPortalIdentity, isDevSessionActive, istMfaPflichtig } from "@/modules/portal/identity";
import { getTotpStatus } from "@/modules/portal/mfa";
import { devAal2Simulieren, abmelden } from "@/modules/portal/actions";
import { TotpEinrichtung } from "@/components/portal/totp-einrichtung";

/**
 * /app/einrichtung/2fa — TOTP-Einrichtung bzw. -Challenge (OS-P1).
 * ----------------------------------------------------------------------------
 * Erfordert eine SESSION (sonst /app/login), aber bewusst KEIN aal2 — diese
 * Seite IST der Weg dorthin. Supabase-Pfad: Einrichtungs-Modus (enroll → QR →
 * verify) oder Challenge-Modus (bestehender Faktor → Code), beides über
 * SERVER-Actions (Cookies bleiben httpOnly). Dev-Seam: aal2-Simulation.
 */
export const metadata: Metadata = { title: "Zwei-Faktor-Einrichtung" };

export default async function ZweiFaktorSeite() {
  const identity = await getPortalIdentity();
  if (!identity) redirect("/app/login");
  if (identity.user.aal === "aal2") redirect("/app");

  const pflicht = istMfaPflichtig(identity);
  const devSeam = isDevSessionActive();
  const status = devSeam ? null : await getTotpStatus();

  return (
    <div className="mx-auto w-full max-w-md px-6 py-16">
      <p className="font-mono text-xs tracking-[0.25em] text-muted-foreground uppercase">
        onelane · Sicherheit
      </p>
      <h1 className="mt-3 text-3xl font-light tracking-tight">
        Zwei-Faktor-<span className="font-semibold">Bestätigung</span>
      </h1>
      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
        {pflicht
          ? "Für dieses Konto ist die Bestätigung per Authenticator-App verpflichtend."
          : "Die Bestätigung per Authenticator-App schützt dieses Konto zusätzlich."}
      </p>

      {devSeam ? (
        <div className="mt-8 grid gap-4">
          <p className="text-sm text-muted-foreground">
            Entwicklungsmodus: Der TOTP-Flow wird simuliert (kein Auth-Dienst).
          </p>
          <form action={devAal2Simulieren}>
            <button
              type="submit"
              className="min-h-11 rounded-full bg-accent px-5 font-semibold text-accent-foreground"
            >
              Zwei-Faktor-Stufe (aal2) simulieren
            </button>
          </form>
        </div>
      ) : (
        <TotpEinrichtung
          modus={status?.modus ?? "einrichten"}
          factorId={status?.factorId ?? null}
        />
      )}

      <form action={abmelden} className="mt-10">
        <button type="submit" className="text-sm text-muted-foreground underline">
          Abmelden und zurück zum Login
        </button>
      </form>
    </div>
  );
}
