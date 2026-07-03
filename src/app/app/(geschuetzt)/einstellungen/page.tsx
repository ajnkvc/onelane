import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import {
  getPortalIdentity,
  isDevSessionActive,
  istMfaPflichtig,
} from "@/modules/portal/identity";
import { themeSetzen } from "@/modules/portal/actions";
import { THEME_COOKIE, parseTheme } from "@/lib/theme";
import { DashboardHero } from "@/components/portal/dashboards/hero";
import { PanelKarte, StatusPunkt } from "@/components/portal/karten";

/**
 * einstellungen — Profil, Sicherheit, Darstellung (OS-P3, Paket D; jede Rolle).
 * Profil zeigt die PortalIdentity (DB-Wahrheit, read-only in Welle 1);
 * Sicherheit den 2FA-/Sitzungs-Stand + Link auf den P1-Einrichtungs-Flow
 * (Dev-Seam wird ehrlich als Simulation ausgewiesen); Darstellung nutzt die
 * P1-Action themeSetzen (Cookie 'light'/'dark', ohne Cookie = System).
 */
export const metadata: Metadata = { title: "Einstellungen" };

const KONTO_TYP_LABEL: Record<string, string> = {
  student: "Fahrschüler:in",
  school_staff: "Fahrschul-Team",
  platform_staff: "onelane-Team",
};

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

function ProfilZeile({ begriff, wert }: { begriff: string; wert: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-muted-foreground">{begriff}</dt>
      <dd className="min-w-0 text-right font-medium">{wert}</dd>
    </div>
  );
}

export default async function Seite() {
  const identity = await getPortalIdentity();
  if (!identity) notFound();

  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  const devSeam = isDevSessionActive();
  const mfaPflicht = istMfaPflichtig(identity);
  const aal2 = identity.user.aal === "aal2";

  const themeKnopf = (wert: "light" | "dark" | "system", label: string, aktiv: boolean) => (
    <button
      type="submit"
      name="theme"
      value={wert}
      aria-pressed={aktiv}
      className={`min-h-9 flex-1 rounded-full px-4 text-sm font-medium motion-safe:transition-colors motion-safe:duration-[var(--motion-duration-fast)] ${focusRing} ${
        aktiv ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="grid gap-6">
      <DashboardHero
        kicker="einstellungen"
        titel="Einstellungen"
        satz="Dein Konto, deine Sicherheit und die Darstellung — alles an einem Ort."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <PanelKarte titel="Profil" kicker="dein konto">
          <dl className="grid gap-2.5 text-sm">
            <ProfilZeile begriff="Name" wert={identity.anzeigeName} />
            <ProfilZeile begriff="E-Mail" wert={identity.user.email ?? "—"} />
            <ProfilZeile
              begriff="Konto-Typ"
              wert={
                identity.accountTyp ? KONTO_TYP_LABEL[identity.accountTyp] ?? "—" : "—"
              }
            />
            {identity.platformRoles.length > 0 ? (
              <ProfilZeile begriff="Rollen" wert={identity.platformRoles.join(", ")} />
            ) : null}
            {identity.memberships.map((m) => (
              <ProfilZeile
                key={m.schoolId}
                begriff="Fahrschule"
                wert={`${m.schoolName} · ${m.rolle}`}
              />
            ))}
          </dl>
          <p className="mt-4 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
            Profil-Änderungen sind in Vorbereitung — bis dahin hilft dir der Support bei
            Korrekturen.
          </p>
        </PanelKarte>

        <PanelKarte
          titel="Sicherheit"
          kicker="anmeldung"
          aktion={{ href: "/app/einrichtung/2fa", label: "Zwei-Faktor einrichten" }}
        >
          <ul className="grid gap-2.5 text-sm">
            <li className="flex items-center gap-2">
              <StatusPunkt ton={aal2 ? "ok" : mfaPflicht ? "warnung" : "neutral"} />
              <span>
                Zwei-Faktor-Bestätigung:{" "}
                <span className="font-medium">
                  {aal2 ? "für diese Sitzung bestätigt" : "in dieser Sitzung nicht bestätigt"}
                </span>
              </span>
            </li>
            <li className="flex items-center gap-2">
              <StatusPunkt ton={mfaPflicht ? "warnung" : "neutral"} />
              <span>
                Für deine Rolle ist der zweite Faktor{" "}
                <span className="font-medium">
                  {mfaPflicht ? "verpflichtend" : "optional, aber empfohlen"}
                </span>
                .
              </span>
            </li>
          </ul>
          <p className="mt-4 text-xs text-muted-foreground">
            Die Einrichtung dauert etwa zwei Minuten: Du verbindest eine Authenticator-App
            und bestätigst einmalig einen Code.{" "}
            <Link
              href="/app/einrichtung/2fa"
              className={`font-medium text-primary underline-offset-4 hover:underline rounded-full ${focusRing}`}
            >
              Jetzt einrichten
            </Link>
          </p>
          {devSeam ? (
            <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
              Entwicklungs-Umgebung: Die Anmeldung läuft über den lokalen Dev-Zugang, der
              zweite Faktor wird simuliert (kein echter Authenticator nötig).
            </p>
          ) : null}
        </PanelKarte>

        <PanelKarte titel="Darstellung" kicker="theme" className="lg:col-span-2">
          <form
            action={themeSetzen}
            className="flex max-w-md items-center gap-1 rounded-full border border-border bg-card p-1 shadow-elevation-1"
          >
            {themeKnopf("light", "Hell", theme === "light")}
            {themeKnopf("dark", "Dunkel", theme === "dark")}
            {themeKnopf("system", "System", theme === null)}
          </form>
          <p className="mt-3 text-xs text-muted-foreground">
            „System“ folgt der Einstellung deines Geräts. Die Wahl gilt für diesen Browser
            und nur im angemeldeten Bereich.
          </p>
        </PanelKarte>
      </div>
    </div>
  );
}
