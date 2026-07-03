import type { PortalIdentity } from "@/modules/portal/identity";
import type { ApiPartnerKontext } from "@/modules/portal/dashboard";
import { erzeugeTagesInsights } from "@/modules/insights";
import { RATGEBER_GUIDES } from "@/lib/ratgeber";
import { EmptyState } from "../empty-state";
import { InsightsPanel } from "../insights-panel";
import { PanelKarte, Kennzahl } from "../karten";
import { DashboardHero } from "./hero";

/**
 * kompakt.tsx — kompakte Dashboards für editor / vertrieb / support /
 * api-partner / rollenlose Konten (OS-P2). Je 1–2 ECHTE Zahlen, wo vorhanden
 * (Ratgeber-Registry, API-Keys), sonst ehrliche Premium-Empty-States —
 * nutzerseitig formuliert („in Vorbereitung"), ohne interne Codenamen.
 */

function vornameVon(identity: PortalIdentity): string {
  return identity.anzeigeName.split(" ")[0] || identity.anzeigeName;
}

export async function RedaktionDashboard({ identity }: { identity: PortalIdentity }) {
  const anzahlGuides = RATGEBER_GUIDES.length;
  const insights = await erzeugeTagesInsights("editor", {});
  return (
    <div className="grid gap-6">
      <DashboardHero
        kicker="redaktion"
        titel={`Willkommen zurück, ${vornameVon(identity)}`}
        satz={`${anzahlGuides} Ratgeber sind aktuell veröffentlicht.`}
      />
      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kennzahl label="veröffentlichte Ratgeber" wert={anzahlGuides} />
      </section>
      <InsightsPanel insights={insights} />
      <PanelKarte titel="Briefings & Artikel" kicker="werkbank">
        <EmptyState
          szene="werkstatt"
          titel="Dein Redaktionsbereich ist in Vorbereitung"
          beschreibung="Briefings, Entwürfe und der Artikel-Workflow ziehen hier als Nächstes ein."
          aktion={{ href: "/app/redaktion/briefings", label: "zu den Briefings" }}
        />
      </PanelKarte>
    </div>
  );
}

export async function VertriebDashboard({ identity }: { identity: PortalIdentity }) {
  const insights = await erzeugeTagesInsights("vertrieb", {});
  return (
    <div className="grid gap-6">
      <DashboardHero
        kicker="vertrieb"
        titel={`Willkommen zurück, ${vornameVon(identity)}`}
        satz={null}
      />
      <InsightsPanel insights={insights} />
      <PanelKarte titel="Deine Ziele & Kontakte" kicker="pipeline">
        <EmptyState
          szene="strecke"
          titel="Dein Vertriebsbereich ist in Vorbereitung"
          beschreibung="Ziele, Kontakte und dein Gebiet erscheinen hier im nächsten Ausbauschritt."
        />
      </PanelKarte>
    </div>
  );
}

export async function SupportDashboard({ identity }: { identity: PortalIdentity }) {
  const insights = await erzeugeTagesInsights("support", {});
  return (
    <div className="grid gap-6">
      <DashboardHero
        kicker="support"
        titel={`Willkommen zurück, ${vornameVon(identity)}`}
        satz={null}
      />
      <InsightsPanel insights={insights} />
      <PanelKarte titel="Support-Postfach" kicker="hilfe">
        <EmptyState
          szene="posteingang"
          titel="Dein Support-Bereich ist in Vorbereitung"
          beschreibung="Anliegen und Fälle landen hier, sobald das Support-Modul startet."
        />
      </PanelKarte>
    </div>
  );
}

export async function PartnerDashboard({
  identity,
  partner,
}: {
  identity: PortalIdentity;
  partner: ApiPartnerKontext;
}) {
  const insights = await erzeugeTagesInsights("api_partner", {
    api_keys_aktiv: partner.aktiveKeys,
  });
  return (
    <div className="grid gap-6">
      <DashboardHero
        kicker="partner-api"
        titel={`Willkommen zurück, ${vornameVon(identity)}`}
        satz={`${partner.name}: ${partner.aktiveKeys} aktive${
          partner.aktiveKeys === 1 ? "r" : ""
        } API-Schlüssel · Status ${partner.status}.`}
      />
      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kennzahl label="aktive API-Schlüssel" wert={partner.aktiveKeys} href="/app/partner-api/keys" />
        <Kennzahl label="Partner-Status" wert={partner.status} />
      </section>
      <InsightsPanel insights={insights} />
      <PanelKarte titel="Anbindung" kicker="schnittstelle">
        <EmptyState
          szene="werkstatt"
          titel="Schlüssel-Verwaltung in Vorbereitung"
          beschreibung="Schlüssel, Scopes und die Verbindungsanleitung erscheinen hier in Kürze."
          aktion={{ href: "/app/partner-api/docs", label: "zur Dokumentation" }}
        />
      </PanelKarte>
    </div>
  );
}

export function NeutralDashboard({ identity }: { identity: PortalIdentity }) {
  return (
    <div className="grid gap-6">
      <DashboardHero
        kicker="dein Konto"
        titel={`Willkommen, ${vornameVon(identity)}`}
        satz={null}
      />
      <EmptyState
        szene="strecke"
        titel="Deinem Konto ist noch kein Bereich zugeordnet"
        beschreibung="Sobald dir eine Fahrschule oder ein Bereich zugewiesen ist, geht es hier los."
      />
    </div>
  );
}
