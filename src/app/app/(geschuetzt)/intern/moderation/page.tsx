import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPortalIdentity } from "@/modules/portal/identity";
import { hatPlattformRolle } from "@/modules/portal/rollen";
import { getSchulenKennzahlen } from "@/modules/portal/bereiche";
import { DashboardHero } from "@/components/portal/dashboards/hero";
import { EmptyState } from "@/components/portal/empty-state";
import { PanelKarte, Kennzahl } from "@/components/portal/karten";

/**
 * intern/moderation — Warteschlangen der Moderation (OS-P3, Paket D;
 * admin/moderator-Gate wie P2). Die Bestandszahl ist echt (gelistete Schulen
 * via RLS-Lesepfad); die Warteschlangen selbst starten mit den zugehörigen
 * Meldewegen und sind bis dahin ehrliche Empty-States.
 */
export const metadata: Metadata = { title: "Moderation" };

export default async function Seite() {
  const identity = await getPortalIdentity();
  if (!identity || !hatPlattformRolle(identity, "admin", "moderator")) notFound();

  const kennzahlen = await getSchulenKennzahlen();

  return (
    <div className="grid gap-6">
      <DashboardHero
        kicker="intern"
        titel="Moderation"
        satz={
          kennzahlen
            ? `${kennzahlen.gelistet} gelistete Fahrschulen liegen im moderierten Bestand.`
            : null
        }
      />

      <section aria-label="Bestand" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kennzahl
          label="gelistete Fahrschulen"
          wert={kennzahlen ? kennzahlen.gelistet : "—"}
          hinweis="öffentlich sichtbarer Bestand"
        />
        <Kennzahl label="offene Korrektur-Meldungen" wert={0} hinweis="Meldeweg startet bald" />
        <Kennzahl label="offene Ratgeber-Reviews" wert={0} hinweis="mit dem Redaktionsmodul" />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <PanelKarte titel="Korrektur-Meldungen" kicker="warteschlange">
          <EmptyState
            kompakt
            szene="posteingang"
            titel="Keine offene Meldung"
            beschreibung="Eingehende Korrektur-Meldungen zu Schul-Einträgen landen hier zur Prüfung."
          />
        </PanelKarte>
        <PanelKarte titel="Ratgeber-Reviews" kicker="warteschlange">
          <EmptyState
            kompakt
            szene="werkstatt"
            titel="Kein Review offen"
            beschreibung="Sobald Redaktions-Einreichungen zur Freigabe anstehen, erscheinen sie hier."
          />
        </PanelKarte>
      </div>
    </div>
  );
}
