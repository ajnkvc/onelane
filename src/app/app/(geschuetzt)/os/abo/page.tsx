import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPortalIdentity } from "@/modules/portal/identity";
import { istSchulRolle } from "@/modules/portal/rollen";
import { baueMonatsVorschau, getAboUebersicht } from "@/modules/portal/abo";
import { centAlsEuro } from "@/modules/portal/finanzen";
import { DashboardHero } from "@/components/portal/dashboards/hero";
import {
  Kennzahl,
  KarteNichtVerfuegbar,
  PanelKarte,
  Zeile,
  ZeilenListe,
} from "@/components/portal/karten";

/**
 * os/abo — Tarif-/Vertragsansicht V1 (Welle 2, ersetzt den P2-Platzhalter).
 * ----------------------------------------------------------------------------
 * GATE (P2-Platzhalter 1:1): NUR inhaber. Daten über modules/portal/abo
 * (school_subscriptions liest per RLS 0031 nur der Manager, Spalten ohne
 * Stripe-Referenz). Die Monats-Vorschau ist eine NEUTRALE Zusammensetzung
 * (Grundgebühr + Seats × Seat-Preis, Aktions-Hinweis) — KEINE Rechnung, KEIN
 * Checkout: der Upgrade-Weg ist eine ehrliche Frühzugangs-Anfrage per Mail.
 */
export const metadata: Metadata = { title: "Tarif" };

const ABO_STATUS_LABEL: Record<string, string> = {
  active: "aktiv",
  paused: "pausiert",
  cancelled: "beendet",
};

export default async function Seite() {
  const identity = await getPortalIdentity();
  if (!identity || !istSchulRolle(identity, "inhaber") || !identity.aktiveSchule) notFound();
  const schule = identity.aktiveSchule;

  const abo = await getAboUebersicht(schule.schoolId);

  if (abo === null) {
    return (
      <div className="grid gap-6">
        <DashboardHero kicker="tarif" titel="Tarif" />
        <KarteNichtVerfuegbar />
      </div>
    );
  }

  const seats = abo.vertraglicheSeats ?? abo.fahrlehrerAktiv;
  const vorschau = baueMonatsVorschau(abo.plan, seats);
  const istStart = !abo.hatAbo || abo.plan.code === "start";
  const osPlan = abo.katalog.find((p) => p.code === "os") ?? null;

  const satz = istStart
    ? `${schule.schoolName} nutzt ${abo.plan.name} — die operativen Module gibt es mit onelane os.`
    : `${schule.schoolName} nutzt ${abo.plan.name}${abo.startDatum ? ` seit ${abo.startDatum}` : ""}.`;

  return (
    <div className="grid gap-6">
      <DashboardHero kicker="tarif" titel="Tarif & Vertrag" satz={satz} />

      <section aria-label="Kennzahlen" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kennzahl label="aktueller Tarif" wert={abo.plan.name} />
        <Kennzahl
          label="Status"
          wert={abo.aboStatus ? (ABO_STATUS_LABEL[abo.aboStatus] ?? abo.aboStatus) : "ohne Vertrag"}
        />
        <Kennzahl
          label="Fahrlehrer-Seats"
          wert={seats}
          hinweis={
            abo.vertraglicheSeats !== null
              ? `vertraglich · ${abo.fahrlehrerAktiv} aktive Fahrlehrer-Profile`
              : `derzeit aktive Fahrlehrer-Profile`
          }
        />
        <Kennzahl
          label="Monats-Vorschau (netto)"
          wert={centAlsEuro(vorschau.gesamtCent)}
          hinweis="neutrale Zusammensetzung — keine Rechnung"
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <PanelKarte titel="Monats-Zusammensetzung" kicker="vorschau · netto">
          <ZeilenListe>
            <Zeile
              links={`Grundgebühr ${abo.plan.name}`}
              sub="je Fahrschule, nicht je Standort"
              rechts={centAlsEuro(vorschau.grundCent)}
            />
            <Zeile
              links={`${seats} Fahrlehrer-Seat${seats === 1 ? "" : "s"}`}
              sub={
                abo.plan.seat_preis_monat_netto_cent !== null
                  ? `à ${centAlsEuro(abo.plan.seat_preis_monat_netto_cent)} je Monat`
                  : "in diesem Tarif ohne Seat-Preis"
              }
              rechts={centAlsEuro(vorschau.seatSummeCent)}
            />
            <Zeile
              links={<span className="font-semibold">Summe je Monat</span>}
              rechts={<span className="font-semibold">{centAlsEuro(vorschau.gesamtCent)}</span>}
            />
          </ZeilenListe>
          {abo.plan.aktion_preis_monat_netto_cent !== null &&
          abo.plan.aktion_monate !== null &&
          vorschau.aktionGesamtCent !== null ? (
            <p className="mt-3 rounded-lg bg-success/10 px-3 py-2 text-xs text-success">
              Einführungs-Aktion: in den ersten {abo.plan.aktion_monate} Monaten reduziert sich die
              Grundgebühr auf {centAlsEuro(abo.plan.aktion_preis_monat_netto_cent)} — Summe dann{" "}
              {centAlsEuro(vorschau.aktionGesamtCent)} je Monat.
            </p>
          ) : null}
          <p className="mt-3 text-xs text-muted-foreground/80">
            Alle Beträge netto je Monat. Diese Vorschau ist keine Rechnung — die Abrechnung
            startet erst mit deiner Bestätigung.
          </p>
        </PanelKarte>

        <PanelKarte titel={istStart ? "onelane os" : "dein Vertrag"} kicker={istStart ? "upgrade" : "vertrag"}>
          {istStart ? (
            <div className="grid gap-3">
              <p className="text-sm text-muted-foreground">
                Mit onelane os bekommst du die operativen Module — Kalender, Schülerverwaltung,
                Anfragen, Team und Finanzen — für deine ganze Fahrschule
                {osPlan?.preis_monat_netto_cent != null
                  ? ` (${centAlsEuro(osPlan.preis_monat_netto_cent)} netto je Monat`
                  : ""}
                {osPlan?.seat_preis_monat_netto_cent != null
                  ? ` + ${centAlsEuro(osPlan.seat_preis_monat_netto_cent)} je Fahrlehrer-Seat)`
                  : osPlan?.preis_monat_netto_cent != null
                    ? ")"
                    : ""}
                .
              </p>
              {osPlan?.aktion_preis_monat_netto_cent != null && osPlan.aktion_monate != null ? (
                <p className="text-sm text-muted-foreground">
                  Zum Start: die ersten {osPlan.aktion_monate} Monate für{" "}
                  {centAlsEuro(osPlan.aktion_preis_monat_netto_cent)} Grundgebühr.
                </p>
              ) : null}
              <a
                href={`mailto:kontakt@onelane.de?subject=${encodeURIComponent(
                  `Frühzugang onelane os — ${schule.schoolName}`,
                )}`}
                className="inline-flex min-h-10 w-fit items-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground shadow-elevation-1 motion-safe:transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Frühzugang anfragen
              </a>
              <p className="text-xs text-muted-foreground/80">
                Kein Checkout, keine Zahlung — wir melden uns persönlich bei dir.
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              <ZeilenListe>
                <Zeile
                  links="Status"
                  rechts={abo.aboStatus ? (ABO_STATUS_LABEL[abo.aboStatus] ?? abo.aboStatus) : "—"}
                />
                <Zeile links="Vertragsbeginn" rechts={abo.startDatum ?? "—"} />
                <Zeile
                  links="Fahrlehrer-Seats (vertraglich)"
                  rechts={abo.vertraglicheSeats ?? "—"}
                />
              </ZeilenListe>
              <p className="text-xs text-muted-foreground/80">
                Änderungen an Tarif oder Seats laufen aktuell über das onelane-Team:{" "}
                <a className="underline underline-offset-4" href="mailto:kontakt@onelane.de">
                  kontakt@onelane.de
                </a>
                .
              </p>
            </div>
          )}
        </PanelKarte>
      </div>
    </div>
  );
}
