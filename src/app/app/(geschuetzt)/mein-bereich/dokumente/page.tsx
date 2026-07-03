import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPortalIdentity } from "@/modules/portal/identity";
import { istStudent } from "@/modules/portal/rollen";
import { DashboardHero } from "@/components/portal/dashboards/hero";
import { EmptyState } from "@/components/portal/empty-state";
import { PanelKarte } from "@/components/portal/karten";

/**
 * mein-bereich/dokumente — deine Unterlagen (OS-P3, Paket D; Schüler-Gate wie
 * P2). In Welle 1 ein ehrlicher Empty-State: Der Dokumenten-Ablageort kommt
 * mit dem Fahrschul-Modul, das Unterlagen bereitstellt.
 */
export const metadata: Metadata = { title: "Dokumente" };

export default async function Seite() {
  const identity = await getPortalIdentity();
  if (!identity || !istStudent(identity)) notFound();

  return (
    <div className="grid gap-6">
      <DashboardHero
        kicker="dein Bereich"
        titel="Deine Dokumente"
        satz="Ein sicherer Ort für alles, was zu deiner Ausbildung gehört."
      />

      <PanelKarte titel="Deine Unterlagen" kicker="ablage">
        <EmptyState
          szene="posteingang"
          titel="Noch keine Unterlagen"
          beschreibung="Deine Fahrschule stellt hier bald Unterlagen für dich bereit — zum Beispiel Vertrag oder Bescheinigungen."
          aktion={{ href: "/app", label: "zur Übersicht" }}
        />
      </PanelKarte>
    </div>
  );
}
