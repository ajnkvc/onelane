import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPortalIdentity } from "@/modules/portal/identity";
import { istStudent } from "@/modules/portal/rollen";
import { getMeineTermine, type SchuelerTermin } from "@/modules/portal/bereiche";
import { DashboardHero, TYP_LABEL, TERMIN_STATUS_LABEL } from "@/components/portal/dashboards/hero";
import { EmptyState } from "@/components/portal/empty-state";
import {
  PanelKarte,
  KarteNichtVerfuegbar,
  StatusPunkt,
  Zeile,
  ZeilenListe,
} from "@/components/portal/karten";

/**
 * mein-bereich/termine — deine Termine (OS-P3, Paket D; Schüler-Gate wie P2).
 * Kommende Termine mit Absage-Frist als REINE INFORMATION (Absagen laufen in
 * Welle 1 direkt über die Fahrschule), vergangene Termine cursor-paginiert.
 */
export const metadata: Metadata = { title: "Termine" };

function terminZeile(t: SchuelerTermin) {
  const zeit = t.bis ? `${t.von}–${t.bis} Uhr` : `${t.von} Uhr`;
  return `${t.tag} · ${zeit} — ${TYP_LABEL[t.typ] ?? t.typ}`;
}

function stornoHinweis(t: SchuelerTermin): string | null {
  if (t.status !== "booked" || !t.storno_frist) return null;
  return t.storno_offen
    ? `kostenfrei absagbar bis ${t.storno_frist} Uhr`
    : `Absage-Frist (${t.storno_frist} Uhr) ist abgelaufen`;
}

export default async function Seite({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const identity = await getPortalIdentity();
  if (!identity || !istStudent(identity)) notFound();

  const sp = await searchParams;
  const termine = await getMeineTermine({ cursor: sp.cursor ?? null });

  const satz = termine
    ? termine.kommende.length > 0
      ? `${termine.kommende.length} ${
          termine.kommende.length === 1 ? "Termin ist" : "Termine sind"
        } geplant — der nächste ${termine.kommende[0].tag} um ${termine.kommende[0].von} Uhr.`
      : "Aktuell ist kein Termin geplant — deine Fahrschule meldet sich."
    : null;

  return (
    <div className="grid gap-6">
      <DashboardHero kicker="dein Bereich" titel="Deine Termine" satz={satz} />

      <div className="grid gap-4 lg:grid-cols-2">
        <PanelKarte titel="Kommende Termine" kicker="geplant">
          {termine === null ? (
            <KarteNichtVerfuegbar />
          ) : termine.kommende.length === 0 ? (
            <EmptyState
              kompakt
              szene="strecke"
              titel="Kein Termin geplant"
              beschreibung="Deine Fahrschule plant die nächsten Termine mit dir."
            />
          ) : (
            <ZeilenListe>
              {termine.kommende.map((t) => (
                <Zeile
                  key={t.id}
                  links={terminZeile(t)}
                  sub={
                    [t.fahrlehrer_name ? `mit ${t.fahrlehrer_name}` : null, stornoHinweis(t)]
                      .filter(Boolean)
                      .join(" · ") || undefined
                  }
                  rechts={
                    <span className="inline-flex items-center gap-1.5">
                      <StatusPunkt ton={t.storno_frist && !t.storno_offen ? "warnung" : "ok"} />
                      {TERMIN_STATUS_LABEL[t.status] ?? t.status}
                    </span>
                  }
                />
              ))}
            </ZeilenListe>
          )}
        </PanelKarte>

        <PanelKarte titel="Gut zu wissen" kicker="absagen & ändern">
          <div className="grid gap-2.5 text-sm text-muted-foreground">
            <p>
              Termine planst und änderst du direkt mit deiner Fahrschule — telefonisch oder
              vor Ort.
            </p>
            <p>
              Bis zur angezeigten Absage-Frist ist eine Absage kostenfrei. Danach kann deine
              Fahrschule die Stunde in Rechnung stellen — die Frist hier ist eine reine
              Information, kein Knopf.
            </p>
            <p>Neue Termine erscheinen automatisch, sobald deine Fahrschule sie einträgt.</p>
          </div>
        </PanelKarte>
      </div>

      <PanelKarte titel="Vergangene & abgesagte Termine" kicker="rückblick">
        {termine === null ? (
          <KarteNichtVerfuegbar />
        ) : termine.vergangene.length === 0 ? (
          <EmptyState
            kompakt
            szene="posteingang"
            titel="Noch kein vergangener Termin"
            beschreibung="Nach deiner ersten Stunde findest du hier deinen Rückblick."
          />
        ) : (
          <>
            <ZeilenListe>
              {termine.vergangene.map((t) => (
                <Zeile
                  key={t.id}
                  links={terminZeile(t)}
                  sub={t.fahrlehrer_name ? `mit ${t.fahrlehrer_name}` : undefined}
                  rechts={
                    <span className="inline-flex items-center gap-1.5">
                      <StatusPunkt
                        ton={
                          t.status === "completed"
                            ? "ok"
                            : t.status === "cancelled"
                              ? "warnung"
                              : "neutral"
                        }
                      />
                      {TERMIN_STATUS_LABEL[t.status] ?? t.status}
                    </span>
                  }
                />
              ))}
            </ZeilenListe>
            {termine.naechsterCursor ? (
              <div className="mt-3 border-t border-border pt-3">
                <Link
                  href={`/app/mein-bereich/termine?cursor=${encodeURIComponent(
                    termine.naechsterCursor,
                  )}`}
                  className="rounded-full text-xs font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  ältere Termine anzeigen
                </Link>
              </div>
            ) : null}
          </>
        )}
      </PanelKarte>
    </div>
  );
}
