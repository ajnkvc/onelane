import { getPortalIdentity } from "@/modules/portal/identity";
import {
  aktiveSchulRolle,
  hatPlattformRolle,
  istPlattformPersonal,
  istStudent,
} from "@/modules/portal/rollen";
import { getApiPartnerKontext } from "@/modules/portal/dashboard";
import { SchulCockpit } from "@/components/portal/dashboards/schul-cockpit";
import { FahrlehrerTag } from "@/components/portal/dashboards/fahrlehrer-tag";
import { StudentBereich } from "@/components/portal/dashboards/student-bereich";
import { BetreiberCockpit } from "@/components/portal/dashboards/betreiber-cockpit";
import {
  NeutralDashboard,
  PartnerDashboard,
  RedaktionDashboard,
  SupportDashboard,
  VertriebDashboard,
} from "@/components/portal/dashboards/kompakt";

/**
 * /app — rollenspezifisches Dashboard (OS-P2, EINE Server-Page, verzweigt nach
 * PortalIdentity). Reihenfolge der Verzweigung = Spezifität: Plattform-Personal
 * (admin/moderator → Betreiber-Cockpit, editor → Redaktion, vertrieb →
 * Vertrieb, sonst Support) · Schüler → „dein Bereich" · Schul-Rollen →
 * Cockpit/„Mein Tag" · API-Partner (Ghost-Muster) · neutraler Fallback.
 * Jedes Dashboard holt seine Daten fail-soft aus modules/portal/dashboard.
 */
export default async function AppStartseite() {
  const identity = await getPortalIdentity();
  if (!identity) return null; // Gate übernimmt das Layout; hier nur Typ-Sicherheit.

  if (istPlattformPersonal(identity)) {
    if (hatPlattformRolle(identity, "admin", "moderator")) {
      return <BetreiberCockpit identity={identity} />;
    }
    if (hatPlattformRolle(identity, "editor")) return <RedaktionDashboard identity={identity} />;
    if (hatPlattformRolle(identity, "vertrieb")) return <VertriebDashboard identity={identity} />;
    return <SupportDashboard identity={identity} />;
  }

  if (istStudent(identity)) return <StudentBereich identity={identity} />;

  const rolle = aktiveSchulRolle(identity);
  if (rolle === "inhaber" || rolle === "verwaltung") return <SchulCockpit identity={identity} />;
  if (rolle === "fahrlehrer") return <FahrlehrerTag identity={identity} />;

  const partner = await getApiPartnerKontext();
  if (partner) return <PartnerDashboard identity={identity} partner={partner} />;

  return <NeutralDashboard identity={identity} />;
}
