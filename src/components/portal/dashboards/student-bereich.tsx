import type { PortalIdentity } from "@/modules/portal/identity";
import { getMeinBereich } from "@/modules/portal/dashboard";
import { erzeugeTagesInsights } from "@/modules/insights";
import { EmptyState } from "../empty-state";
import { InsightsPanel } from "../insights-panel";
import { PanelKarte, Kennzahl, KarteNichtVerfuegbar, ZeilenListe, Zeile } from "../karten";
import { DashboardHero, TYP_LABEL } from "./hero";

/**
 * student-bereich.tsx — „dein Bereich" für Fahrschüler (OS-P2).
 * Reduziert, freundlich, Du-Form — und NIRGENDS „os"-Wording (eigener
 * /app/mein-bereich-Baum). Fortschritt ist ehrlich: echte absolvierte
 * Fahrstunden + „bald verfügbar" für die volle Ansicht.
 */

const ANMELDUNG_STATUS: Record<string, string> = {
  pending: "in Bearbeitung",
  active: "aktiv",
  cancelled: "beendet",
  completed: "abgeschlossen",
};

export async function StudentBereich({ identity }: { identity: PortalIdentity }) {
  const bereich = await getMeinBereich();

  const insights = await erzeugeTagesInsights("student", {
    termine_geplant: bereich?.naechsteTermine.length,
    fahrstunden_absolviert: bereich?.absolvierteFahrstunden,
  });

  const vorname = identity.anzeigeName.split(" ")[0] || identity.anzeigeName;
  const naechster = bereich?.naechsteTermine[0] ?? null;
  const satz = bereich
    ? naechster
      ? `Dein nächster Termin: ${naechster.tag} um ${naechster.von} Uhr (${TYP_LABEL[naechster.typ] ?? naechster.typ}).`
      : "Aktuell ist kein Termin geplant — deine Fahrschule meldet sich."
    : null;

  return (
    <div className="grid gap-6">
      <DashboardHero kicker="dein Bereich" titel={`Schön, dass du da bist, ${vorname}`} satz={satz} />

      <section aria-label="Auf einen Blick" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kennzahl
          label="Status deiner Anmeldung"
          wert={bereich?.anmeldung ? ANMELDUNG_STATUS[bereich.anmeldung.status] ?? "—" : "—"}
        />
        <Kennzahl
          label="geplante Termine"
          wert={bereich ? bereich.naechsteTermine.length : "—"}
          href="/app/mein-bereich/termine"
        />
        <Kennzahl
          label="absolvierte Fahrstunden"
          wert={bereich ? bereich.absolvierteFahrstunden : "—"}
          href="/app/mein-bereich/fortschritt"
        />
        <Kennzahl label="Führerscheinklasse" wert={bereich?.anmeldung?.klasse ?? "—"} />
      </section>

      <InsightsPanel insights={insights} />

      <div className="grid gap-4 lg:grid-cols-2">
        <PanelKarte titel="Deine Anmeldung" kicker="status">
          {bereich === null ? (
            <KarteNichtVerfuegbar />
          ) : bereich.anmeldung === null ? (
            <EmptyState
              kompakt
              szene="strecke"
              titel="Noch keine Anmeldung"
              beschreibung="Sobald deine Fahrschule dich angelegt hat, siehst du hier deinen Stand."
            />
          ) : (
            <dl className="grid gap-2.5 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Fahrschule</dt>
                <dd className="font-medium">{bereich.anmeldung.schul_name ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Klasse</dt>
                <dd className="font-medium">{bereich.anmeldung.klasse ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Status</dt>
                <dd className="font-medium">
                  {ANMELDUNG_STATUS[bereich.anmeldung.status] ?? bereich.anmeldung.status}
                </dd>
              </div>
            </dl>
          )}
        </PanelKarte>

        <PanelKarte
          titel="Nächste Termine"
          kicker="planung"
          aktion={{ href: "/app/mein-bereich/termine", label: "alle ansehen" }}
        >
          {bereich === null ? (
            <KarteNichtVerfuegbar />
          ) : bereich.naechsteTermine.length === 0 ? (
            <EmptyState
              kompakt
              szene="strecke"
              titel="Kein Termin geplant"
              beschreibung="Deine Fahrschule plant die nächsten Termine mit dir."
            />
          ) : (
            <ZeilenListe>
              {bereich.naechsteTermine.map((t) => (
                <Zeile
                  key={t.id}
                  links={`${t.tag} · ${t.von} Uhr — ${TYP_LABEL[t.typ] ?? t.typ}`}
                  sub={t.fahrlehrer_name ? `mit ${t.fahrlehrer_name}` : undefined}
                  rechts={t.bis ? `bis ${t.bis}` : undefined}
                />
              ))}
            </ZeilenListe>
          )}
        </PanelKarte>

        <PanelKarte titel="Dein Fortschritt" kicker="lernstand" className="lg:col-span-2">
          <EmptyState
            kompakt
            szene="werkstatt"
            titel="Deine Fortschritts-Ansicht ist bald verfügbar"
            beschreibung={
              bereich && bereich.absolvierteFahrstunden > 0
                ? `${bereich.absolvierteFahrstunden} Fahrstunde${
                    bereich.absolvierteFahrstunden === 1 ? " ist" : "n sind"
                  } schon geschafft — die volle Ansicht ist in Vorbereitung.`
                : "Hier siehst du bald deinen Lernstand auf einen Blick."
            }
          />
        </PanelKarte>

        <PanelKarte titel="Nächste Schritte" kicker="so geht's weiter" className="lg:col-span-2">
          <ol className="grid gap-2 text-sm sm:grid-cols-3">
            {[
              "Besuche regelmäßig den Theorieunterricht deiner Fahrschule.",
              "Stimme deine nächsten Fahrstunden direkt mit deiner Fahrschule ab.",
              "Schau hier vorbei — neue Termine erscheinen automatisch.",
            ].map((schritt, i) => (
              <li key={schritt} className="flex gap-2.5 rounded-xl bg-muted/60 px-3 py-2.5">
                <span className="font-mono text-xs font-semibold text-brand-sky tabular-nums">
                  {i + 1}
                </span>
                <span className="text-muted-foreground">{schritt}</span>
              </li>
            ))}
          </ol>
        </PanelKarte>
      </div>
    </div>
  );
}
