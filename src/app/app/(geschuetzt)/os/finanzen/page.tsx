import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPortalIdentity } from "@/modules/portal/identity";
import { istSchulManager } from "@/modules/portal/rollen";
import {
  RECHNUNG_STATUS_LABEL,
  centAlsEuro,
  getMonatsSummen,
  getOffenePostenListe,
  getTerminAbrechnung,
} from "@/modules/portal/finanzen";
import { DashboardHero, TYP_LABEL } from "@/components/portal/dashboards/hero";
import { EmptyState } from "@/components/portal/empty-state";
import {
  Kennzahl,
  KarteNichtVerfuegbar,
  PanelKarte,
  StatusPunkt,
  Zeile,
  ZeilenListe,
} from "@/components/portal/karten";

/**
 * os/finanzen — Finanz-Überblick V1 (Welle 2, ersetzt den P2-Platzhalter).
 * ----------------------------------------------------------------------------
 * GATE (P2-Platzhalter 1:1): istSchulManager (inhaber + verwaltung). Die DB
 * trägt die eigentliche Verteidigung: invoices-Zeilen liest per RLS nur der
 * Manager (0016); appointments.preis/abgerechnet kommen AUSSCHLIESSLICH über
 * den Manager-Definer app.termin_finanzen (0031). Inhalte: offene Posten
 * (Betrag/Status/offen seit je Anmeldung), Monats-Summen (nur bezahlte
 * Rechnungen) und die Termin-Abrechnungsliste. „Fällig am" existiert als Feld
 * noch nicht — die Liste sagt ehrlich „offen seit" (Zahlungsmodul folgt).
 */
export const metadata: Metadata = { title: "Finanzen" };

function postenTon(status: string): "neutral" | "warnung" {
  return status === "failed" ? "warnung" : "neutral";
}

export default async function Seite() {
  const identity = await getPortalIdentity();
  if (!identity || !istSchulManager(identity) || !identity.aktiveSchule) notFound();
  const schule = identity.aktiveSchule;

  const [posten, monate, abrechnung] = await Promise.all([
    getOffenePostenListe(schule.schoolId),
    getMonatsSummen(schule.schoolId),
    getTerminAbrechnung(schule.schoolId),
  ]);

  const satz = posten
    ? posten.anzahl === 0
      ? `Keine offenen Posten bei ${schule.schoolName} — alles abgerechnet.`
      : `${posten.anzahl} offene${posten.anzahl === 1 ? "r" : ""} Posten über ${centAlsEuro(posten.summeCent)} bei ${schule.schoolName}.`
    : null;

  return (
    <div className="grid gap-6">
      <DashboardHero kicker="finanzen" titel="Finanzen" satz={satz} />

      <section aria-label="Kennzahlen" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kennzahl label="offene Posten" wert={posten ? posten.anzahl : "—"} />
        <Kennzahl label="offener Betrag" wert={posten ? centAlsEuro(posten.summeCent) : "—"} />
        <Kennzahl
          label="Umsatz letzter Monat mit Zahlung"
          wert={monate && monate.length > 0 ? centAlsEuro(monate[0].summe_cent) : "—"}
          hinweis={monate && monate.length > 0 ? `Monat ${monate[0].monat}` : undefined}
        />
        <Kennzahl
          label="unabgerechnete Termine"
          wert={abrechnung ? abrechnung.anzahlOffen : "—"}
          hinweis={
            abrechnung && abrechnung.anzahlOffen > 0
              ? `${centAlsEuro(abrechnung.summeOffenCent)} offen`
              : undefined
          }
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <PanelKarte titel="Offene Posten" kicker="rechnungen">
          {posten === null ? (
            <KarteNichtVerfuegbar />
          ) : posten.posten.length === 0 ? (
            <EmptyState
              kompakt
              szene="werkstatt"
              titel="Keine offenen Posten"
              beschreibung="Alle Rechnungen deiner Schule sind bezahlt oder storniert."
            />
          ) : (
            <ZeilenListe>
              {posten.posten.map((p) => (
                <Zeile
                  key={p.id}
                  links={
                    <span className="flex items-center gap-2">
                      <StatusPunkt ton={postenTon(p.status)} />
                      {p.betrag_cent !== null ? centAlsEuro(p.betrag_cent) : "—"}
                      <span className="text-xs font-normal text-muted-foreground">
                        {RECHNUNG_STATUS_LABEL[p.status] ?? p.status}
                      </span>
                    </span>
                  }
                  sub={`${p.schueler_name ?? `Anmeldung ${p.enrollmentKurz}`}${
                    p.klasse ? ` · Klasse ${p.klasse}` : ""
                  }`}
                  rechts={
                    p.offen_seit_tagen === 0 ? "seit heute" : `seit ${p.offen_seit_tagen} Tg.`
                  }
                />
              ))}
            </ZeilenListe>
          )}
        </PanelKarte>

        <PanelKarte titel="Monats-Summen" kicker="nur bezahlte Rechnungen">
          {monate === null ? (
            <KarteNichtVerfuegbar />
          ) : monate.length === 0 ? (
            <EmptyState
              kompakt
              szene="strecke"
              titel="Noch keine bezahlten Rechnungen"
              beschreibung="Sobald Zahlungen eingehen, siehst du hier die Summen je Monat."
            />
          ) : (
            <ZeilenListe>
              {monate.map((m) => (
                <Zeile
                  key={m.monat}
                  links={m.monat}
                  sub={`${m.anzahl} Rechnung${m.anzahl === 1 ? "" : "en"}`}
                  rechts={centAlsEuro(m.summe_cent)}
                />
              ))}
            </ZeilenListe>
          )}
        </PanelKarte>
      </div>

      <PanelKarte titel="Termin-Abrechnung" kicker="abgeschlossene Termine mit Preis">
        {abrechnung === null ? (
          <KarteNichtVerfuegbar />
        ) : abrechnung.zeilen.length === 0 ? (
          <EmptyState
            kompakt
            szene="strecke"
            titel="Noch keine abrechenbaren Termine"
            beschreibung="Abgeschlossene Termine mit hinterlegtem Preis erscheinen hier."
          />
        ) : (
          <ZeilenListe>
            {abrechnung.zeilen.map((t) => (
              <Zeile
                key={t.id}
                links={
                  <span className="flex items-center gap-2">
                    <StatusPunkt ton={t.abgerechnet ? "ok" : "warnung"} />
                    {t.tag}
                    {t.von ? ` · ${t.von}` : ""} · {TYP_LABEL[t.typ] ?? t.typ}
                    {t.klasse ? ` (Klasse ${t.klasse})` : ""}
                  </span>
                }
                sub={[t.schueler_name, t.fahrlehrer_name].filter(Boolean).join(" · ") || undefined}
                rechts={
                  <span>
                    {t.preis_cent !== null ? centAlsEuro(t.preis_cent) : "—"}
                    {" · "}
                    {t.abgerechnet ? "abgerechnet" : "offen"}
                  </span>
                }
              />
            ))}
          </ZeilenListe>
        )}
      </PanelKarte>

      <p className="text-xs text-muted-foreground/80">
        Beträge netto in Euro. Ein Fälligkeitsdatum je Rechnung gibt es noch nicht — die Listen
        zeigen ehrlich, seit wann ein Posten offen ist.
      </p>
    </div>
  );
}
