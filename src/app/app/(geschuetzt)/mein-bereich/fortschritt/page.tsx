import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPortalIdentity } from "@/modules/portal/identity";
import { istStudent } from "@/modules/portal/rollen";
import { getMeinFortschritt } from "@/modules/portal/bereiche";
import { DashboardHero, TYP_LABEL } from "@/components/portal/dashboards/hero";
import { EmptyState } from "@/components/portal/empty-state";
import { PanelKarte, Kennzahl, KarteNichtVerfuegbar } from "@/components/portal/karten";

/**
 * mein-bereich/fortschritt — dein Fortschritt (OS-P3, Paket D; Schüler-Gate wie
 * P2). Absolvierte Einheiten je Typ als ruhige Balken aus ECHTEN Daten; der
 * Theorie-Lernstand kommt erst mit dem Lernmodul und wird ehrlich so benannt.
 */
export const metadata: Metadata = { title: "Fortschritt" };

/** Mehrzahl-Labels für die Balken (TYP_LABEL ist Singular). */
const TYP_LABEL_PLURAL: Record<string, string> = {
  fahrstunde: "Fahrstunden",
  theorie: "Theorie-Einheiten",
  pruefung: "Prüfungen",
  fragenkatalog: "Lernstand-Einheiten",
};

export default async function Seite() {
  const identity = await getPortalIdentity();
  if (!identity || !istStudent(identity)) notFound();

  const fortschritt = await getMeinFortschritt();

  const satz = fortschritt
    ? fortschritt.absolviertGesamt > 0
      ? `${fortschritt.absolviertGesamt} ${
          fortschritt.absolviertGesamt === 1 ? "Einheit ist" : "Einheiten sind"
        } geschafft — weiter so.`
      : "Deine ersten Einheiten erscheinen hier, sobald sie absolviert sind."
    : null;

  const maxWert = fortschritt
    ? Math.max(1, ...fortschritt.jeTyp.map((e) => e.absolviert))
    : 1;

  return (
    <div className="grid gap-6">
      <DashboardHero kicker="dein Bereich" titel="Dein Fortschritt" satz={satz} />

      <section aria-label="Auf einen Blick" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kennzahl
          label="absolvierte Einheiten gesamt"
          wert={fortschritt ? fortschritt.absolviertGesamt : "—"}
        />
        <Kennzahl
          label="davon Fahrstunden"
          wert={
            fortschritt
              ? fortschritt.jeTyp.find((e) => e.typ === "fahrstunde")?.absolviert ?? 0
              : "—"
          }
        />
        <Kennzahl
          label="geplante Termine"
          wert={fortschritt ? fortschritt.geplant : "—"}
          href="/app/mein-bereich/termine"
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <PanelKarte titel="Absolvierte Einheiten je Typ" kicker="dein stand">
          {fortschritt === null ? (
            <KarteNichtVerfuegbar />
          ) : fortschritt.absolviertGesamt === 0 ? (
            <EmptyState
              kompakt
              szene="strecke"
              titel="Noch keine absolvierte Einheit"
              beschreibung="Nach deiner ersten Stunde wächst hier deine Übersicht."
            />
          ) : (
            <ul className="grid gap-3.5">
              {fortschritt.jeTyp.map((eintrag) => (
                <li key={eintrag.typ} className="grid gap-1">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-medium">
                      {TYP_LABEL_PLURAL[eintrag.typ] ?? TYP_LABEL[eintrag.typ] ?? eintrag.typ}
                    </span>
                    <span className="text-muted-foreground tabular-nums">
                      {eintrag.absolviert}
                    </span>
                  </div>
                  <div
                    className="h-2 overflow-hidden rounded-full bg-muted"
                    role="presentation"
                  >
                    <div
                      className="h-full rounded-full bg-brand-sky/70"
                      style={{
                        width: `${Math.round((eintrag.absolviert / maxWert) * 100)}%`,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </PanelKarte>

        <PanelKarte titel="Theorie-Lernstand" kicker="lernen">
          <EmptyState
            kompakt
            szene="werkstatt"
            titel="Dein Theorie-Lernstand folgt"
            beschreibung="Sobald das Lernmodul startet, siehst du hier deinen Stand aus dem Fragentraining."
          />
        </PanelKarte>
      </div>
    </div>
  );
}
