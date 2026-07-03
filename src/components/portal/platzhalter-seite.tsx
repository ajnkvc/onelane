import { notFound } from "next/navigation";
import { getPortalIdentity, type PortalIdentity } from "@/modules/portal/identity";
import { DashboardHero } from "./dashboards/hero";
import { EmptyState, type EmptySzene } from "./empty-state";

/**
 * platzhalter-seite.tsx — P2-Platzhalter für P3-Routen (OS-P2).
 * ----------------------------------------------------------------------------
 * KONTRAKT: Jeder Nav-Eintrag auf ein kommendes Modul zeigt auf eine ECHTE
 * Route mit diesem Baustein — hochwertiger Empty-State statt totem Link.
 *   <PlatzhalterSeite erlaubt={...} kicker titel beschreibung szene aktion?>
 * - `erlaubt` ist das SERVERSEITIGE Rollen-Gate der Seite (rollen.ts-Prädikate,
 *   sync oder async z. B. für den API-Partner-DB-Check); false/keine Session →
 *   notFound() (kein Existenz-Orakel). RLS bleibt letzte Linie; P3 ersetzt den
 *   Platzhalter durch das Modul und übernimmt das identische Gate.
 * - Texte nutzerseitig und ehrlich („in Vorbereitung") — keine internen
 *   Codenamen, keine Funktionsversprechen.
 */
export async function PlatzhalterSeite({
  erlaubt,
  kicker,
  titel,
  beschreibung,
  szene = "werkstatt",
  aktion,
}: {
  erlaubt: (identity: PortalIdentity) => boolean | Promise<boolean>;
  kicker: string;
  titel: string;
  /** EIN ehrlicher Satz für den Empty-State. */
  beschreibung: string;
  szene?: EmptySzene;
  aktion?: { href: string; label: string };
}) {
  const identity = await getPortalIdentity();
  if (!identity || !(await erlaubt(identity))) notFound();

  return (
    <div className="grid gap-8">
      <DashboardHero kicker={kicker} titel={titel} />
      <div className="rounded-2xl border border-border bg-card p-6 shadow-elevation-1">
        <EmptyState
          szene={szene}
          titel="Dieser Bereich ist in Vorbereitung"
          beschreibung={beschreibung}
          aktion={aktion ?? { href: "/app", label: "zur Übersicht" }}
        />
      </div>
    </div>
  );
}
