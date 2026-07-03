import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPortalIdentity } from "@/modules/portal/identity";
import { hatPlattformRolle } from "@/modules/portal/rollen";
import { RATGEBER_GUIDES, RATGEBER_STAND_LABEL } from "@/lib/ratgeber";
import { getSiteUrl } from "@/lib/public-config";
import { DashboardHero } from "@/components/portal/dashboards/hero";
import { PanelKarte, Zeile, ZeilenListe } from "@/components/portal/karten";

/**
 * redaktion/artikel — Bestandsliste der veröffentlichten Ratgeber (OS-P3,
 * Paket D; editor/admin-Gate wie P2). Quelle ist die Code-Registry
 * (src/lib/ratgeber.ts, CMS-Interim laut Redaktions-Linie); das Redaktionsmodul
 * mit Versionierung folgt und wird hier ehrlich angekündigt.
 * Links zeigen ABSOLUT auf die öffentlichen Artikel-Seiten (getSiteUrl):
 * relative Pfade würden auf dem App-Host in den /app-Rewrite laufen (P1-Proxy).
 */
export const metadata: Metadata = { title: "Artikel" };

export default async function Seite() {
  const identity = await getPortalIdentity();
  if (!identity || !hatPlattformRolle(identity, "editor", "admin")) notFound();

  const siteUrl = getSiteUrl();

  return (
    <div className="grid gap-6">
      <DashboardHero
        kicker="redaktion"
        titel="Artikel"
        satz={`${RATGEBER_GUIDES.length} Ratgeber sind veröffentlicht · Stand ${RATGEBER_STAND_LABEL}.`}
      />

      <PanelKarte titel="Veröffentlichte Ratgeber" kicker="bestand">
        <ZeilenListe>
          {RATGEBER_GUIDES.map((guide) => (
            <Zeile
              key={guide.slug}
              links={guide.titel}
              sub={`${guide.kategorie} · Stand ${RATGEBER_STAND_LABEL} · ${guide.lesezeit} Min. Lesezeit`}
              rechts={
                <a
                  href={`${siteUrl}/ratgeber/${guide.slug}`}
                  target="_blank"
                  rel="noopener"
                  className="rounded-full font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  öffentlich ansehen
                </a>
              }
            />
          ))}
        </ZeilenListe>
      </PanelKarte>

      <PanelKarte titel="So geht es weiter" kicker="hinweis">
        <p className="text-sm text-muted-foreground">
          Das Redaktionsmodul mit Entwürfen, Freigaben und Versionierung ist in Vorbereitung.
          Bis dahin ist die Code-Registry die eine Quelle der veröffentlichten Artikel —
          Änderungen laufen über die Entwicklung.
        </p>
      </PanelKarte>
    </div>
  );
}
