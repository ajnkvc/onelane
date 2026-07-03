import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPortalIdentity } from "@/modules/portal/identity";
import { istSchulManager } from "@/modules/portal/rollen";
import { getJobsUebersicht, jobStatusVon, type JobStatus } from "@/modules/portal/os-betrieb";
import { DashboardHero } from "@/components/portal/dashboards/hero";
import { EmptyState } from "@/components/portal/empty-state";
import {
  KarteNichtVerfuegbar,
  Kennzahl,
  PanelKarte,
  StatusPunkt,
  Zeile,
  ZeilenListe,
} from "@/components/portal/karten";
import { getSiteUrl } from "@/lib/public-config";

/**
 * os/jobs — eigene Stellenanzeigen der Schule (OS-P3 Paket B, read-only V1).
 * Gate identisch zum P2-Platzhalter: nur Schul-Manager. Anzeigen-Pflege bleibt
 * in V1 KURATIERT (school_jobs-Write-Policy = admin/editor, 0025) — die Seite
 * verweist deshalb wie der B2B-Block der öffentlichen /jobs-Seite auf den
 * kontakt@onelane.de-Weg statt tote Formulare zu zeigen. Bewerbungs-Zähler
 * laufen unter job_applications-RLS (Schul-Manager sehen die eigene Schule).
 */
export const metadata: Metadata = { title: "Stellenanzeigen" };

const STATUS_LABEL: Record<JobStatus, string> = {
  aktiv: "aktiv",
  abgelaufen: "abgelaufen",
  deaktiviert: "deaktiviert",
};

export default async function Seite() {
  const identity = await getPortalIdentity();
  if (!identity || !istSchulManager(identity)) notFound();
  const schule = identity.aktiveSchule;
  if (!schule) notFound();

  const jobs = await getJobsUebersicht(schule.schoolId);

  const satz = jobs
    ? jobs.anzeigen.length === 0
      ? "Für deine Schule sind noch keine Stellenanzeigen geschaltet."
      : `${jobs.anzahlAktiv} aktive ${jobs.anzahlAktiv === 1 ? "Anzeige" : "Anzeigen"}, ${
          jobs.bewerbungenGesamt
        } ${jobs.bewerbungenGesamt === 1 ? "Bewerbung" : "Bewerbungen"} — davon ${
          jobs.bewerbungenNeu
        } neu.`
    : null;

  return (
    <div className="grid gap-6">
      <DashboardHero kicker="stellenanzeigen" titel="Stellenanzeigen" satz={satz} />

      <section aria-label="Anzeigen in Zahlen" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kennzahl label="aktive Anzeigen" wert={jobs ? jobs.anzahlAktiv : "—"} />
        <Kennzahl label="Anzeigen gesamt" wert={jobs ? jobs.anzeigen.length : "—"} />
        <Kennzahl
          label="Bewerbungen gesamt"
          wert={jobs ? jobs.bewerbungenGesamt : "—"}
          href="/app/os/bewerbungen"
        />
        <Kennzahl
          label="neue Bewerbungen"
          wert={jobs ? jobs.bewerbungenNeu : "—"}
          href="/app/os/bewerbungen"
        />
      </section>

      <PanelKarte
        titel="Deine Anzeigen"
        kicker="jobbörse"
        aktion={{ href: `${getSiteUrl()}/jobs`, label: "Jobbörse ansehen" }}
      >
        {jobs === null ? (
          <KarteNichtVerfuegbar />
        ) : jobs.anzeigen.length === 0 ? (
          <EmptyState
            szene="posteingang"
            titel="Noch keine Stellenanzeigen"
            beschreibung="Deine erste Anzeige schaltet das onelane-Team kostenlos für dich — melde dich einfach."
          />
        ) : (
          <ZeilenListe>
            {jobs.anzeigen.map((a) => {
              const status = jobStatusVon(a.aktiv, a.gueltig_bis, jobs.heute);
              return (
                <Zeile
                  key={a.id}
                  links={
                    <span className="inline-flex items-center gap-2">
                      <StatusPunkt
                        ton={
                          status === "aktiv" ? "ok" : status === "abgelaufen" ? "warnung" : "neutral"
                        }
                      />
                      {a.titel}
                    </span>
                  }
                  sub={`${STATUS_LABEL[status]}${
                    a.gueltig_bis
                      ? ` · gültig bis ${a.gueltig_bis.slice(8, 10)}.${a.gueltig_bis.slice(5, 7)}.${a.gueltig_bis.slice(0, 4)}`
                      : " · ohne Befristung"
                  } · online seit ${a.seit_tagen === 0 ? "heute" : `${a.seit_tagen} Tagen`}`}
                  rechts={`${a.bewerbungen} ${a.bewerbungen === 1 ? "Bewerbung" : "Bewerbungen"}${
                    a.bewerbungen_neu > 0 ? ` · ${a.bewerbungen_neu} neu` : ""
                  }`}
                />
              );
            })}
          </ZeilenListe>
        )}
      </PanelKarte>

      <PanelKarte titel="Anzeige ändern oder melden" kicker="kuratiert">
        <p className="text-sm text-muted-foreground">
          Neue Anzeigen, Änderungen, Verlängerungen oder das Abschalten übernimmt aktuell das
          onelane-Team für dich — kuratiert und in der Regel innerhalb eines Werktags. Schreib
          dafür kurz an{" "}
          <a
            href="mailto:kontakt@onelane.de"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            kontakt@onelane.de
          </a>
          {" "}(Stichwort „Stellenanzeige“ + Name deiner Fahrschule). Die Selbst-Verwaltung direkt
          hier folgt in einem nächsten Ausbauschritt.
        </p>
      </PanelKarte>
    </div>
  );
}
