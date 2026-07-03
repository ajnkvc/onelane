import Link from "next/link";
import type { PortalIdentity } from "@/modules/portal/identity";
import {
  getAnfragenUebersicht,
  getBewerbungenUebersicht,
  getOffenePosten,
  getSlotsHeute,
  getTermineHeute,
} from "@/modules/portal/dashboard";
import { erzeugeTagesInsights } from "@/modules/insights";
import { istSchulManager } from "@/modules/portal/rollen";
import { EmptyState } from "../empty-state";
import { InsightsPanel } from "../insights-panel";
import { PanelKarte, Kennzahl, KarteNichtVerfuegbar, ZeilenListe, Zeile, StatusPunkt } from "../karten";
import { DashboardHero, TYP_LABEL, alterLabel } from "./hero";

/**
 * schul-cockpit.tsx — Dashboard für inhaber/verwaltung (OS-P2, Cockpit-Vorschau).
 * Datenquellen ausschließlich modules/portal/dashboard (RLS, fail-soft je Karte);
 * die Insights-Schicht erhält NUR Zahlen (Datenschutzgrenze modules/insights).
 * „Offene Posten": bewusst NUR die Anzahl — Beträge kommen mit dem Finanzmodul.
 */
export async function SchulCockpit({ identity }: { identity: PortalIdentity }) {
  const schule = identity.aktiveSchule;
  if (!schule) return null;

  const [anfragen, bewerbungen, termine, slots, posten] = await Promise.all([
    getAnfragenUebersicht(schule.schoolId),
    getBewerbungenUebersicht(schule.schoolId),
    getTermineHeute(schule.schoolId),
    getSlotsHeute(schule.schoolId),
    istSchulManager(identity) ? getOffenePosten(schule.schoolId) : Promise.resolve(null),
  ]);

  const insights = await erzeugeTagesInsights(schule.rolle === "inhaber" ? "inhaber" : "verwaltung", {
    anfragen_neu: anfragen?.anzahlNeu,
    anfragen_neu_aelter_48h: anfragen?.anzahlNeuAelter48h,
    bewerbungen_neu: bewerbungen?.anzahlNeu,
    termine_heute: termine?.anzahl,
    slots_heute: slots?.anzahlSlots,
    posten_offen: posten?.anzahlOffen,
  });

  const vorname = identity.anzeigeName.split(" ")[0] || identity.anzeigeName;
  const satzTeile: string[] = [];
  if (termine) satzTeile.push(`${termine.anzahl} Termin${termine.anzahl === 1 ? "" : "e"} heute`);
  if (anfragen)
    satzTeile.push(`${anfragen.anzahlNeu} neue Anfrage${anfragen.anzahlNeu === 1 ? "" : "n"}`);
  if (bewerbungen && bewerbungen.anzahlNeu > 0)
    satzTeile.push(`${bewerbungen.anzahlNeu} neue Bewerbung${bewerbungen.anzahlNeu === 1 ? "" : "en"}`);
  const satz =
    satzTeile.length > 0 ? `Heute bei ${schule.schoolName}: ${satzTeile.join(" · ")}.` : null;

  return (
    <div className="grid gap-6">
      <DashboardHero kicker="fahrschul-cockpit" titel={`Willkommen zurück, ${vorname}`} satz={satz} />

      {/* Heute wichtig — Kennzahlen aus echten Daten */}
      <section aria-label="Heute wichtig" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kennzahl
          label="neue Anfragen"
          wert={anfragen ? anfragen.anzahlNeu : "—"}
          href="/app/os/anfragen"
          hinweis={
            anfragen && anfragen.anzahlNeuAelter48h > 0
              ? `${anfragen.anzahlNeuAelter48h} älter als 48 h`
              : undefined
          }
        />
        <Kennzahl
          label="neue Bewerbungen"
          wert={bewerbungen ? bewerbungen.anzahlNeu : "—"}
          href="/app/os/bewerbungen"
        />
        <Kennzahl label="Termine heute" wert={termine ? termine.anzahl : "—"} href="/app/os/kalender" />
        <Kennzahl
          label="offene Posten"
          wert={posten ? posten.anzahlOffen : "—"}
          href="/app/os/finanzen"
          hinweis="Beträge folgen im Finanzbereich"
        />
      </section>

      <InsightsPanel insights={insights} />

      <div className="grid gap-4 lg:grid-cols-2">
        <PanelKarte
          titel="Neue Anfragen"
          kicker="posteingang"
          aktion={{ href: "/app/os/anfragen", label: "alle ansehen" }}
        >
          {anfragen === null ? (
            <KarteNichtVerfuegbar />
          ) : anfragen.letzte.length === 0 ? (
            <EmptyState
              kompakt
              szene="posteingang"
              titel="Noch keine Anfragen"
              beschreibung="Neue Anfragen aus dem Portal landen direkt hier."
            />
          ) : (
            <ZeilenListe>
              {anfragen.letzte.map((a) => (
                <Zeile
                  key={a.id}
                  links={
                    <span className="flex items-center gap-2">
                      <StatusPunkt ton={a.status === "neu" ? "warnung" : "neutral"} />
                      {a.vorname} · Klasse {a.klasse}
                    </span>
                  }
                  sub={a.status === "neu" ? "unbeantwortet" : a.status}
                  rechts={alterLabel(a.alter_stunden)}
                />
              ))}
            </ZeilenListe>
          )}
        </PanelKarte>

        <PanelKarte
          titel="Termine heute"
          kicker="tagesplan"
          aktion={{ href: "/app/os/kalender", label: "Kalender" }}
        >
          {termine === null ? (
            <KarteNichtVerfuegbar />
          ) : termine.termine.length === 0 ? (
            <EmptyState
              kompakt
              szene="strecke"
              titel="Heute keine Termine"
              beschreibung="Sobald Termine geplant sind, erscheint hier der Tagesplan."
            />
          ) : (
            <ZeilenListe>
              {termine.termine.map((t) => (
                <Zeile
                  key={t.id}
                  links={`${t.von} · ${TYP_LABEL[t.typ] ?? t.typ}${t.klasse ? ` (Klasse ${t.klasse})` : ""}`}
                  sub={
                    [t.schueler_name, t.fahrlehrer_name].filter(Boolean).join(" · ") || undefined
                  }
                  rechts={t.bis ? `bis ${t.bis}` : undefined}
                />
              ))}
            </ZeilenListe>
          )}
        </PanelKarte>

        <PanelKarte
          titel="Neue Bewerbungen"
          kicker="team"
          aktion={{ href: "/app/os/bewerbungen", label: "alle ansehen" }}
        >
          {bewerbungen === null ? (
            <KarteNichtVerfuegbar />
          ) : bewerbungen.letzte.length === 0 ? (
            <EmptyState
              kompakt
              szene="posteingang"
              titel="Keine Bewerbungen"
              beschreibung="Bewerbungen auf deine Stellenanzeigen erscheinen hier."
              aktion={{ href: "/app/os/jobs", label: "Stellenanzeigen ansehen" }}
            />
          ) : (
            <ZeilenListe>
              {bewerbungen.letzte.map((b) => (
                <Zeile
                  key={b.id}
                  links={
                    <span className="flex items-center gap-2">
                      <StatusPunkt ton={b.status === "neu" ? "warnung" : "neutral"} />
                      {b.name}
                    </span>
                  }
                  sub={b.job_titel}
                  rechts={alterLabel(b.alter_stunden)}
                />
              ))}
            </ZeilenListe>
          )}
        </PanelKarte>

        <PanelKarte titel="Fahrlehrer heute" kicker="verfügbarkeit">
          {slots === null ? (
            <KarteNichtVerfuegbar />
          ) : slots.slots.length === 0 ? (
            <EmptyState
              kompakt
              szene="werkstatt"
              titel="Keine Verfügbarkeiten eingetragen"
              beschreibung="Für heute sind keine Fahrlehrer-Slots gepflegt."
            />
          ) : (
            <ZeilenListe>
              {slots.slots.map((s, i) => (
                <Zeile
                  key={`${s.fahrlehrer_name}-${i}`}
                  links={s.fahrlehrer_name}
                  rechts={s.von && s.bis ? `${s.von}–${s.bis}` : undefined}
                />
              ))}
            </ZeilenListe>
          )}
        </PanelKarte>
      </div>

      {/* Schnellaktionen (Links auf die kommenden Module) */}
      <section aria-label="Schnellaktionen" className="flex flex-wrap gap-2">
        {[
          { href: "/app/os/anfragen", label: "Anfragen beantworten" },
          { href: "/app/os/jobs", label: "Stellenanzeige pflegen" },
          { href: "/app/os/profil-pflege", label: "Profil aktualisieren" },
          { href: "/app/os/team", label: "Team verwalten" },
        ].map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="inline-flex min-h-9 items-center rounded-full border border-border bg-card px-4 text-sm font-medium shadow-elevation-1 motion-safe:transition-colors motion-safe:duration-[var(--motion-duration-fast)] hover:border-brand-sky/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {a.label}
          </Link>
        ))}
      </section>
    </div>
  );
}
