import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getPortalIdentity, istMfaPflichtig } from "@/modules/portal/identity";
import { bauePortalNavigation } from "@/modules/portal/navigation";
import { istPlattformPersonal, istStudent } from "@/modules/portal/rollen";
import { getApiPartnerKontext } from "@/modules/portal/dashboard";
import { AppShell } from "@/components/portal/app-shell";
import { THEME_COOKIE, parseTheme } from "@/lib/theme";

/**
 * (geschuetzt)/layout.tsx — Session-/MFA-Gate + App-Shell (OS-P2).
 * ----------------------------------------------------------------------------
 * Gate-Kette je Request (P1-Kontrakt, unverändert): keine Session → /app/login;
 * MFA-Pflichtrolle (platform_staff oder Membership 'inhaber') ohne aal2 →
 * /app/einrichtung/2fa. Danach rendert die Shell (Sidebar/Topbar) mit dem
 * SERVERSEITIG aus der PortalIdentity gebauten Navigationsmodell.
 * WICHTIG: Dieses Layout ist Komfort-Routing, KEINE Sicherheitsgrenze — jede
 * Fach-Action/-Route prüft zusätzlich selbst (withPortalActionGuards/-RouteGuards),
 * jede Platzhalter-Seite prüft ihre Rolle serverseitig (rollen.ts → notFound).
 */
export default async function GeschuetztLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const identity = await getPortalIdentity();
  if (!identity) redirect("/app/login");
  if (istMfaPflichtig(identity) && identity.user.aal !== "aal2") {
    redirect("/app/einrichtung/2fa");
  }

  // API-Partner-Erkennung nur für das Ghost-Muster (school_staff ohne
  // Membership) — bewusst KEINE Erweiterung des eingefrorenen Identity-Shapes.
  const istApiPartnerMitglied =
    !istPlattformPersonal(identity) &&
    !istStudent(identity) &&
    identity.memberships.length === 0
      ? (await getApiPartnerKontext()) !== null
      : false;

  const navigation = bauePortalNavigation(identity, { istApiPartnerMitglied });
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);

  return (
    <AppShell identity={identity} navigation={navigation} theme={theme}>
      {children}
    </AppShell>
  );
}
