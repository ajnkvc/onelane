import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPortalIdentity } from "@/modules/portal/identity";
import { hatPlattformRolle } from "@/modules/portal/rollen";
import { erzeugeRedaktionsBriefings } from "@/modules/portal/bereiche";
import { RATGEBER_GUIDES } from "@/lib/ratgeber";
import { DashboardHero } from "@/components/portal/dashboards/hero";
import { EmptyState } from "@/components/portal/empty-state";
import { PanelKarte } from "@/components/portal/karten";

/**
 * redaktion/briefings — Themen-Vorschläge für neue Artikel (OS-P3, Paket D;
 * editor/admin-Gate wie P2). Die Vorschläge werden DETERMINISTISCH und PII-frei
 * aus der Ratgeber-Registry abgeleitet (Kategorien-Lücken) und sind als
 * „automatisch erstellt" gekennzeichnet — Prinzip des Insights-Mocks.
 */
export const metadata: Metadata = { title: "Briefings" };

export default async function Seite() {
  const identity = await getPortalIdentity();
  if (!identity || !hatPlattformRolle(identity, "editor", "admin")) notFound();

  const briefings = erzeugeRedaktionsBriefings(RATGEBER_GUIDES);

  return (
    <div className="grid gap-6">
      <DashboardHero
        kicker="redaktion"
        titel="Briefings"
        satz={
          briefings.length > 0
            ? `${briefings.length} Themen-Vorschläge aus Lücken im aktuellen Ratgeber-Bestand (${RATGEBER_GUIDES.length} Artikel).`
            : `Der Ratgeber-Bestand (${RATGEBER_GUIDES.length} Artikel) deckt alle vorgeschlagenen Themen ab.`
        }
      />

      {briefings.length === 0 ? (
        <PanelKarte titel="Themen-Vorschläge" kicker="werkbank">
          <EmptyState
            kompakt
            szene="werkstatt"
            titel="Aktuell kein offener Themen-Vorschlag"
            beschreibung="Neue Vorschläge erscheinen, sobald der Bestand Lücken zeigt."
          />
        </PanelKarte>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {briefings.map((b) => (
            <PanelKarte key={b.schluessel} titel={b.arbeitstitel} kicker={b.kategorie}>
              <div className="flex flex-1 flex-col gap-3">
                <p className="text-xs text-muted-foreground">{b.begruendung}</p>
                <ol className="grid gap-2 text-sm">
                  {b.gliederung.map((punkt, i) => (
                    <li key={punkt} className="flex gap-2.5 rounded-xl bg-muted/60 px-3 py-2">
                      <span className="font-mono text-xs font-semibold text-brand-sky tabular-nums">
                        {i + 1}
                      </span>
                      <span className="text-muted-foreground">{punkt}</span>
                    </li>
                  ))}
                </ol>
                <p className="mt-auto self-start rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                  automatisch erstellt
                </p>
              </div>
            </PanelKarte>
          ))}
        </div>
      )}

      <PanelKarte titel="So geht es weiter" kicker="hinweis">
        <p className="text-sm text-muted-foreground">
          Das Redaktionsmodul mit Entwürfen, Freigaben und Versionierung ist in Vorbereitung —
          bis dahin entstehen Artikel wie bisher über die Ratgeber-Registry im Code.
        </p>
      </PanelKarte>
    </div>
  );
}
