import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPortalIdentity } from "@/modules/portal/identity";
import { istSchulManager, istSchulRolle } from "@/modules/portal/rollen";
import {
  ZEIT_KATEGORIEN,
  ZEIT_KATEGORIE_LABEL,
  getTeamZeitenWoche,
  getZeiterfassungWoche,
  minutenLabel,
} from "@/modules/portal/os-betrieb";
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
import { ausstempeln, einstempeln } from "./actions";
import { Stoppuhr } from "./stoppuhr";

/**
 * os/zeiterfassung — Ein-/Ausstempeln + eigene Wochen-Übersicht (OS-P3 Paket B).
 * Gate identisch zum P2-Platzhalter: alle drei Schul-Rollen; Schul-Manager sehen
 * zusätzlich die Team-Einträge der Woche read-only (RLS deckt beides, 0029).
 */
export const metadata: Metadata = { title: "Zeiterfassung" };

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const primaerKnopf = `inline-flex min-h-10 items-center justify-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-elevation-1 motion-safe:transition-colors motion-safe:duration-[var(--motion-duration-fast)] hover:bg-primary/90 ${focusRing}`;

export default async function Seite() {
  const identity = await getPortalIdentity();
  if (!identity || !istSchulRolle(identity, "inhaber", "verwaltung", "fahrlehrer")) notFound();
  const schule = identity.aktiveSchule;
  if (!schule) notFound();

  const managerSicht = istSchulManager(identity);
  const [woche, teamWoche] = await Promise.all([
    getZeiterfassungWoche(schule.schoolId, identity.user.id),
    managerSicht ? getTeamZeitenWoche(schule.schoolId) : Promise.resolve(null),
  ]);

  const satz = woche
    ? woche.laufend
      ? `Du bist seit ${woche.laufend.seit} Uhr eingestempelt (${ZEIT_KATEGORIE_LABEL[woche.laufend.kategorie]}).`
      : `Diese Woche hast du ${minutenLabel(woche.summeMinuten)} erfasst.`
    : null;

  return (
    <div className="grid gap-6">
      <DashboardHero kicker="zeiterfassung" titel="Zeiterfassung" satz={satz} />

      <section aria-label="Woche in Zahlen" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kennzahl
          label="erfasst diese Woche"
          wert={woche ? minutenLabel(woche.summeMinuten) : "—"}
        />
        <Kennzahl label="Einträge diese Woche" wert={woche ? woche.eintraege.length : "—"} />
        <Kennzahl
          label="Status"
          wert={woche ? (woche.laufend ? "eingestempelt" : "ausgestempelt") : "—"}
        />
        {managerSicht ? (
          <Kennzahl
            label="Team-Einträge diese Woche"
            wert={teamWoche ? teamWoche.anzahlGesamt : "—"}
          />
        ) : null}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <PanelKarte titel="Stempeluhr" kicker="jetzt">
          {woche === null ? (
            <KarteNichtVerfuegbar />
          ) : woche.laufend ? (
            <div className="grid gap-4">
              <div className="rounded-xl border border-brand-sky/40 bg-brand-sky/10 px-4 py-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  läuft · seit {woche.laufend.seit} Uhr
                </p>
                <p className="mt-1 text-2xl font-semibold tracking-tight">
                  <Stoppuhr
                    startEpochMs={woche.laufend.start_epoch_ms}
                    fallback={minutenLabel(woche.laufend.minuten)}
                  />
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {ZEIT_KATEGORIE_LABEL[woche.laufend.kategorie]}
                  {woche.laufend.notiz ? ` · ${woche.laufend.notiz}` : ""}
                </p>
              </div>
              <form action={ausstempeln}>
                <button type="submit" className={primaerKnopf}>
                  Ausstempeln
                </button>
              </form>
            </div>
          ) : (
            <form action={einstempeln} className="grid gap-3">
              <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                Kategorie
                <select
                  name="kategorie"
                  defaultValue="buero"
                  className={`min-h-10 rounded-xl border border-border bg-card px-3 text-sm text-foreground ${focusRing}`}
                >
                  {ZEIT_KATEGORIEN.map((k) => (
                    <option key={k} value={k}>
                      {ZEIT_KATEGORIE_LABEL[k]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                Notiz (optional)
                <input
                  type="text"
                  name="notiz"
                  maxLength={250}
                  placeholder="z. B. Theorie-Vorbereitung"
                  className={`min-h-10 rounded-xl border border-border bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground/70 ${focusRing}`}
                />
              </label>
              <div>
                <button type="submit" className={primaerKnopf}>
                  Einstempeln
                </button>
              </div>
            </form>
          )}
        </PanelKarte>

        <PanelKarte titel="Deine Woche" kicker="eigene Einträge">
          {woche === null ? (
            <KarteNichtVerfuegbar />
          ) : woche.eintraege.length === 0 ? (
            <EmptyState
              kompakt
              szene="strecke"
              titel="Noch keine Einträge diese Woche"
              beschreibung="Stemple dich ein — deine Zeiten erscheinen dann hier."
            />
          ) : (
            <ZeilenListe>
              {woche.eintraege.map((e) => (
                <Zeile
                  key={e.id}
                  links={
                    <span className="inline-flex items-center gap-2">
                      <StatusPunkt ton={e.bis === null ? "warnung" : "ok"} />
                      {ZEIT_KATEGORIE_LABEL[e.kategorie]}
                    </span>
                  }
                  sub={e.notiz ?? undefined}
                  rechts={`${e.tag} · ${e.von}–${e.bis ?? "…"}${
                    e.minuten !== null ? ` · ${minutenLabel(e.minuten)}` : ""
                  }`}
                />
              ))}
            </ZeilenListe>
          )}
        </PanelKarte>
      </div>

      {managerSicht ? (
        <PanelKarte titel="Team diese Woche" kicker="read-only">
          {teamWoche === null ? (
            <KarteNichtVerfuegbar />
          ) : teamWoche.eintraege.length === 0 ? (
            <EmptyState
              kompakt
              szene="posteingang"
              titel="Noch keine Team-Einträge"
              beschreibung="Sobald dein Team stempelt, siehst du die Woche hier."
            />
          ) : (
            <>
              <ZeilenListe>
                {teamWoche.eintraege.map((e) => (
                  <Zeile
                    key={e.id}
                    links={
                      <span className="inline-flex items-center gap-2">
                        <StatusPunkt ton={e.bis === null ? "warnung" : "neutral"} />
                        {e.member_user_id === identity.user.id
                          ? "du"
                          : `${e.rolle ?? "Mitglied"} · ${e.member_user_id.slice(0, 8)}`}
                      </span>
                    }
                    sub={ZEIT_KATEGORIE_LABEL[e.kategorie]}
                    rechts={`${e.tag} · ${e.von}–${e.bis ?? "…"}${
                      e.minuten !== null ? ` · ${minutenLabel(e.minuten)}` : ""
                    }`}
                  />
                ))}
              </ZeilenListe>
              <p className="mt-3 text-xs text-muted-foreground">
                Mitglieder erscheinen aus Datenschutz-Gründen mit Rolle und Kurz-Kennung —
                Namen folgen mit der Team-Verwaltung in einem nächsten Ausbauschritt.
              </p>
            </>
          )}
        </PanelKarte>
      ) : null}
    </div>
  );
}
