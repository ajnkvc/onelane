import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPortalIdentity } from "@/modules/portal/identity";
import { istSchulManager } from "@/modules/portal/rollen";
import { getTeamUebersicht, type TeamMitglied } from "@/modules/portal/os-betrieb";
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

/**
 * os/team — Mitglieder + Fahrlehrer:innen der aktiven Schule (OS-P3 Paket B,
 * read-only V1). Gate identisch zum P2-Platzhalter: nur Schul-Manager.
 * Mitglieder erscheinen OHNE Personen-Namen (users-RLS — Welle 2 bringt den
 * geprüften Namens-Lesepfad samt Verwaltung/Einladungen); Fahrlehrer-Namen
 * kommen aus instructors (bewusst lesbar) inkl. Verfügbarkeits-Status heute.
 * BEWUSST kein „Mitglied einladen"-Button — Einladungen folgen als eigener
 * Ausbauschritt, tote Bedienelemente zeigen wir nicht.
 */
export const metadata: Metadata = { title: "Team" };

const ROLLEN_LABEL: Record<TeamMitglied["rolle"], string> = {
  inhaber: "Inhaber:in",
  verwaltung: "Verwaltung",
  fahrlehrer: "Fahrlehrer:in",
};

function RollenBadge({ rolle }: { rolle: TeamMitglied["rolle"] }) {
  const stil =
    rolle === "inhaber"
      ? "bg-primary/10 text-primary"
      : rolle === "verwaltung"
        ? "bg-brand-sky/15 text-foreground"
        : "bg-secondary text-secondary-foreground";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${stil}`}>
      {ROLLEN_LABEL[rolle]}
    </span>
  );
}

export default async function Seite() {
  const identity = await getPortalIdentity();
  if (!identity || !istSchulManager(identity)) notFound();
  const schule = identity.aktiveSchule;
  if (!schule) notFound();

  const team = await getTeamUebersicht(schule.schoolId);

  const aktiveFahrlehrer = team?.fahrlehrer.filter((f) => f.aktiv) ?? [];
  const heuteVerfuegbar = aktiveFahrlehrer.filter((f) => f.slots_heute > 0);
  const satz = team
    ? `${team.mitglieder.length} ${team.mitglieder.length === 1 ? "Mitglied" : "Mitglieder"}, ${
        aktiveFahrlehrer.length
      } aktive Fahrlehrer:innen — ${heuteVerfuegbar.length} heute verfügbar.`
    : null;

  return (
    <div className="grid gap-6">
      <DashboardHero kicker="team" titel={`Team · ${schule.schoolName}`} satz={satz} />

      <section aria-label="Team in Zahlen" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kennzahl label="Mitglieder" wert={team ? team.mitglieder.length : "—"} />
        <Kennzahl label="Fahrlehrer:innen aktiv" wert={team ? aktiveFahrlehrer.length : "—"} />
        <Kennzahl
          label="heute verfügbar"
          wert={team ? heuteVerfuegbar.length : "—"}
          href="/app/os/kalender"
        />
        <Kennzahl
          label="Zeiterfassung"
          wert="zur Woche"
          href="/app/os/zeiterfassung"
          hinweis="Team-Einträge read-only"
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <PanelKarte titel="Mitglieder" kicker="rollen">
          {team === null ? (
            <KarteNichtVerfuegbar />
          ) : team.mitglieder.length === 0 ? (
            <EmptyState
              kompakt
              szene="posteingang"
              titel="Noch keine Mitglieder"
              beschreibung="Die Mitgliedschaften deiner Schule erscheinen hier."
            />
          ) : (
            <>
              <ZeilenListe>
                {team.mitglieder.map((m) => (
                  <Zeile
                    key={m.id}
                    links={
                      <span className="inline-flex items-center gap-2">
                        <RollenBadge rolle={m.rolle} />
                        {m.user_id === identity.user.id ? (
                          <span className="text-xs font-semibold text-primary">du</span>
                        ) : null}
                      </span>
                    }
                    sub={`Kennung ${m.user_id.slice(0, 8)}`}
                    rechts={m.seit_tagen === 0 ? "seit heute" : `seit ${m.seit_tagen} Tagen`}
                  />
                ))}
              </ZeilenListe>
              <p className="mt-3 text-xs text-muted-foreground">
                Mitglieder erscheinen aus Datenschutz-Gründen mit Rolle und Kurz-Kennung.
                Namen, Verwaltung und Einladungen folgen in einem nächsten Ausbauschritt —
                bis dahin übernimmt das onelane-Team Änderungen für dich.
              </p>
            </>
          )}
        </PanelKarte>

        <PanelKarte
          titel="Fahrlehrer:innen"
          kicker="verfügbarkeit heute"
          aktion={{ href: "/app/os/kalender", label: "zum Kalender" }}
        >
          {team === null ? (
            <KarteNichtVerfuegbar />
          ) : team.fahrlehrer.length === 0 ? (
            <EmptyState
              kompakt
              szene="strecke"
              titel="Noch keine Fahrlehrer:innen"
              beschreibung="Sobald Fahrlehrer:innen hinterlegt sind, siehst du hier ihre Verfügbarkeit."
            />
          ) : (
            <ZeilenListe>
              {team.fahrlehrer.map((f) => (
                <Zeile
                  key={f.id}
                  links={
                    <span className="inline-flex items-center gap-2">
                      <StatusPunkt
                        ton={!f.aktiv ? "neutral" : f.slots_heute > 0 ? "ok" : "warnung"}
                      />
                      {f.name}
                      {f.ist_ich ? (
                        <span className="text-xs font-semibold text-primary">du</span>
                      ) : null}
                    </span>
                  }
                  sub={
                    !f.aktiv
                      ? "inaktiv"
                      : f.slots_heute > 0
                        ? `heute verfügbar${f.von && f.bis ? ` · ${f.von}–${f.bis}` : ""}`
                        : "heute keine Verfügbarkeit hinterlegt"
                  }
                  rechts={
                    f.aktiv && f.slots_heute > 0 ? `${f.slots_heute} Zeitfenster` : undefined
                  }
                />
              ))}
            </ZeilenListe>
          )}
        </PanelKarte>
      </div>
    </div>
  );
}
