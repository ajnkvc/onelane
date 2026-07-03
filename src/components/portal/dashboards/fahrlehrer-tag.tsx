import type { PortalIdentity } from "@/modules/portal/identity";
import { getAnmeldungenUebersicht, getMeinTag } from "@/modules/portal/dashboard";
import { erzeugeTagesInsights } from "@/modules/insights";
import { EmptyState } from "../empty-state";
import { InsightsPanel } from "../insights-panel";
import { PanelKarte, Kennzahl, KarteNichtVerfuegbar, ZeilenListe, Zeile } from "../karten";
import { DashboardHero, TYP_LABEL, TERMIN_STATUS_LABEL } from "./hero";

/**
 * fahrlehrer-tag.tsx — „Mein Tag" für die Rolle fahrlehrer (OS-P2).
 * Eigene Termine (app.own_instructor_ids, 0030), Schüler-Überblick der Schule
 * (schulweit per Gründer-Entscheid Quer-Routing; Namen seit Welle 2 über den
 * geprüften Definer-Pfad app.schueler_namen, Migration 0031) und
 * Verfügbarkeits-Hinweis. Insights erhalten NUR Zahlen.
 */
export async function FahrlehrerTag({ identity }: { identity: PortalIdentity }) {
  const schule = identity.aktiveSchule;
  if (!schule) return null;

  const [meinTag, anmeldungen] = await Promise.all([
    getMeinTag(),
    getAnmeldungenUebersicht(schule.schoolId),
  ]);

  const insights = await erzeugeTagesInsights("fahrlehrer", {
    termine_heute: meinTag?.heute.length,
    termine_morgen: meinTag?.morgen.length,
    schueler_aktiv: anmeldungen?.anzahlAktiv,
    verfuegbarkeit_heute_gepflegt: meinTag ? (meinTag.verfuegbarkeitHeuteGepflegt ? 1 : 0) : undefined,
  });

  const vorname = identity.anzeigeName.split(" ")[0] || identity.anzeigeName;
  const satz = meinTag
    ? `Heute ${meinTag.heute.length === 1 ? "steht" : "stehen"} ${meinTag.heute.length} Termin${
        meinTag.heute.length === 1 ? "" : "e"
      } für dich an, morgen ${meinTag.morgen.length}.`
    : null;

  const terminListe = (termine: NonNullable<typeof meinTag>["heute"]) => (
    <ZeilenListe>
      {termine.map((t) => (
        <Zeile
          key={t.id}
          links={`${t.von} · ${TYP_LABEL[t.typ] ?? t.typ}${t.klasse ? ` (Klasse ${t.klasse})` : ""}`}
          sub={
            t.schueler_name
              ? `${t.schueler_name} · ${TERMIN_STATUS_LABEL[t.status] ?? t.status}`
              : (TERMIN_STATUS_LABEL[t.status] ?? t.status)
          }
          rechts={t.bis ? `bis ${t.bis}` : undefined}
        />
      ))}
    </ZeilenListe>
  );

  return (
    <div className="grid gap-6">
      <DashboardHero kicker="mein tag" titel={`Guten Start, ${vorname}`} satz={satz} />

      <section aria-label="Heute wichtig" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kennzahl label="Termine heute" wert={meinTag ? meinTag.heute.length : "—"} />
        <Kennzahl label="Termine morgen" wert={meinTag ? meinTag.morgen.length : "—"} />
        <Kennzahl
          label="aktive Anmeldungen"
          wert={anmeldungen ? anmeldungen.anzahlAktiv : "—"}
          href="/app/os/schueler"
        />
        <Kennzahl
          label="Verfügbarkeit heute"
          wert={meinTag ? (meinTag.verfuegbarkeitHeuteGepflegt ? "gepflegt" : "offen") : "—"}
          href="/app/os/kalender"
        />
      </section>

      <InsightsPanel insights={insights} />

      <div className="grid gap-4 lg:grid-cols-2">
        <PanelKarte titel="Heute" kicker="deine Termine" aktion={{ href: "/app/os/kalender", label: "Kalender" }}>
          {meinTag === null ? (
            <KarteNichtVerfuegbar />
          ) : meinTag.heute.length === 0 ? (
            <EmptyState
              kompakt
              szene="strecke"
              titel="Heute keine eigenen Termine"
              beschreibung="Sobald dir Termine zugewiesen sind, stehen sie hier."
            />
          ) : (
            terminListe(meinTag.heute)
          )}
        </PanelKarte>

        <PanelKarte titel="Morgen" kicker="vorschau">
          {meinTag === null ? (
            <KarteNichtVerfuegbar />
          ) : meinTag.morgen.length === 0 ? (
            <EmptyState
              kompakt
              szene="strecke"
              titel="Morgen ist noch frei"
              beschreibung="Für morgen sind dir bisher keine Termine zugewiesen."
            />
          ) : (
            terminListe(meinTag.morgen)
          )}
        </PanelKarte>

        <PanelKarte
          titel="Anmeldungen der Schule"
          kicker="schüler"
          aktion={{ href: "/app/os/schueler", label: "alle ansehen" }}
        >
          {anmeldungen === null ? (
            <KarteNichtVerfuegbar />
          ) : anmeldungen.letzte.length === 0 ? (
            <EmptyState
              kompakt
              szene="posteingang"
              titel="Noch keine Anmeldungen"
              beschreibung="Neue Anmeldungen deiner Schule erscheinen hier."
            />
          ) : (
            <ZeilenListe>
              {anmeldungen.letzte.map((a) => (
                <Zeile
                  key={a.id}
                  links={a.name ? `${a.name} · Klasse ${a.klasse ?? "—"}` : `Klasse ${a.klasse ?? "—"}`}
                  sub={a.status === "active" ? "aktiv" : a.status}
                  rechts={a.seit_tagen === 0 ? "heute" : `seit ${a.seit_tagen} Tg.`}
                />
              ))}
            </ZeilenListe>
          )}
        </PanelKarte>

        <PanelKarte titel="Verfügbarkeit" kicker="planung">
          {meinTag === null ? (
            <KarteNichtVerfuegbar />
          ) : meinTag.verfuegbarkeitHeuteGepflegt ? (
            <p className="rounded-lg bg-success/10 px-3 py-2 text-xs text-success">
              Deine Verfügbarkeit für heute ist eingetragen — danke!
            </p>
          ) : (
            <EmptyState
              kompakt
              szene="werkstatt"
              titel="Verfügbarkeit offen"
              beschreibung="Deine Verfügbarkeit für heute ist noch nicht eingetragen."
              aktion={{ href: "/app/os/kalender", label: "zum Kalender" }}
            />
          )}
        </PanelKarte>
      </div>
    </div>
  );
}
