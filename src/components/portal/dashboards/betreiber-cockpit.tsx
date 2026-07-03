import type { PortalIdentity } from "@/modules/portal/identity";
import { getPlattformUebersicht } from "@/modules/portal/dashboard";
import { erzeugeTagesInsights } from "@/modules/insights";
import { EmptyState } from "../empty-state";
import { InsightsPanel } from "../insights-panel";
import { PanelKarte, Kennzahl, KarteNichtVerfuegbar } from "../karten";
import { DashboardHero } from "./hero";

/**
 * betreiber-cockpit.tsx — Betreiber-Dashboard für platform_staff mit
 * admin-/moderator-Rolle (OS-P2). Vermittlungs-Postfach bewusst NUR als
 * Text-Hinweis (keine Details, keine Zahlen aus dem Postfach).
 */
export async function BetreiberCockpit({ identity }: { identity: PortalIdentity }) {
  const uebersicht = await getPlattformUebersicht();

  const insights = await erzeugeTagesInsights("admin", {
    leads_heute: uebersicht?.leadsHeute,
    bewerbungen_heute: uebersicht?.bewerbungenHeute,
    schulen_aktiv: uebersicht?.schulenGelistet,
  });

  const vorname = identity.anzeigeName.split(" ")[0] || identity.anzeigeName;
  const satz = uebersicht
    ? `Heute plattformweit: ${uebersicht.leadsHeute} Anfrage${
        uebersicht.leadsHeute === 1 ? "" : "n"
      } · ${uebersicht.bewerbungenHeute} Bewerbung${
        uebersicht.bewerbungenHeute === 1 ? "" : "en"
      } · ${uebersicht.schulenGelistet} gelistete Fahrschulen.`
    : null;

  return (
    <div className="grid gap-6">
      <DashboardHero kicker="betreiber-cockpit" titel={`Willkommen zurück, ${vorname}`} satz={satz} />

      <section aria-label="Heute wichtig" className="grid grid-cols-2 gap-3 xl:grid-cols-3">
        <Kennzahl label="Anfragen heute (gesamt)" wert={uebersicht ? uebersicht.leadsHeute : "—"} />
        <Kennzahl
          label="Bewerbungen heute (gesamt)"
          wert={uebersicht ? uebersicht.bewerbungenHeute : "—"}
        />
        <Kennzahl label="gelistete Fahrschulen" wert={uebersicht ? uebersicht.schulenGelistet : "—"} />
      </section>

      <InsightsPanel insights={insights} />

      <div className="grid gap-4 lg:grid-cols-2">
        <PanelKarte
          titel="Moderation"
          kicker="qualität"
          aktion={{ href: "/app/intern/moderation", label: "öffnen" }}
        >
          {uebersicht === null ? (
            <KarteNichtVerfuegbar />
          ) : (
            <EmptyState
              kompakt
              szene="posteingang"
              titel="Keine offenen Fälle"
              beschreibung="Meldungen und Prüffälle erscheinen hier, sobald es welche gibt."
            />
          )}
        </PanelKarte>

        <PanelKarte titel="Vermittlungs-Postfach" kicker="hinweis">
          <p className="text-sm text-muted-foreground">
            Eingänge werden direkt im Vermittlungs-Postfach bearbeitet — dieser Bereich zeigt
            bewusst keine Details.
          </p>
        </PanelKarte>
      </div>
    </div>
  );
}
