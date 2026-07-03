import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPortalIdentity } from "@/modules/portal/identity";
import { hatPlattformRolle } from "@/modules/portal/rollen";
import { getSchulenKennzahlen } from "@/modules/portal/bereiche";
import { DashboardHero } from "@/components/portal/dashboards/hero";
import { EmptyState } from "@/components/portal/empty-state";
import { PanelKarte, Kennzahl, KarteNichtVerfuegbar } from "@/components/portal/karten";

/**
 * vertrieb — Vertriebs-Cockpit V1 (OS-P3, Paket D; vertrieb/admin-Gate wie P2).
 * Echte Marktzahlen über die anon-lesbaren Pfade (gelistete Schulen, bestätigte
 * Preise via RLS/withCurrentUserContext); Ziele/Kontakte/Gebiet sind ehrliche
 * Empty-States (nächster Ausbauschritt).
 */
export const metadata: Metadata = { title: "Vertrieb" };

export default async function Seite() {
  const identity = await getPortalIdentity();
  if (!identity || !hatPlattformRolle(identity, "vertrieb", "admin")) notFound();

  const kennzahlen = await getSchulenKennzahlen();

  const satz = kennzahlen
    ? `${kennzahlen.gelistet} Fahrschulen sind gelistet — ${
        kennzahlen.mitBestaetigtenPreisen === 1
          ? "eine davon hat"
          : `${kennzahlen.mitBestaetigtenPreisen} davon haben`
      } ihre Preise bestätigt.`
    : null;

  return (
    <div className="grid gap-6">
      <DashboardHero kicker="vertrieb" titel="Vertriebs-Cockpit" satz={satz} />

      <section aria-label="Marktüberblick" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kennzahl
          label="gelistete Fahrschulen"
          wert={kennzahlen ? kennzahlen.gelistet : "—"}
          hinweis="öffentlich sichtbarer Bestand"
        />
        <Kennzahl
          label="Schulen mit bestätigten Preisen"
          wert={kennzahlen ? kennzahlen.mitBestaetigtenPreisen : "—"}
          hinweis="von der Schule verifiziert"
        />
      </section>

      {kennzahlen === null ? (
        <PanelKarte titel="Marktüberblick" kicker="daten">
          <KarteNichtVerfuegbar />
        </PanelKarte>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <PanelKarte titel="Deine Ziele" kicker="steuerung">
          <EmptyState
            kompakt
            szene="strecke"
            titel="Zielvorgaben in Vorbereitung"
            beschreibung="Deine Ziele und dein Gebiet erscheinen hier im nächsten Ausbauschritt."
          />
        </PanelKarte>
        <PanelKarte titel="Kontakte & Pipeline" kicker="arbeit am markt">
          <EmptyState
            kompakt
            szene="posteingang"
            titel="Kontaktliste in Vorbereitung"
            beschreibung="Schul-Kontakte und dein Arbeitsvorrat ziehen hier als Nächstes ein."
          />
        </PanelKarte>
      </div>
    </div>
  );
}
