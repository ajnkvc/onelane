import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSchluesselUebersicht, type SchluesselZeile } from "@/modules/api/konsole";
import { getApiPartnerKontext } from "@/modules/portal/dashboard";
import { getPortalIdentity } from "@/modules/portal/identity";
import { hatPlattformRolle } from "@/modules/portal/rollen";
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
 * partner-api/keys — Schlüssel-Konsole V1 (Paket C, ersetzt den P2-Platzhalter).
 * ----------------------------------------------------------------------------
 * Gate 1:1 vom Platzhalter übernommen: admin ODER API-Partner-Mitglied
 * (getApiPartnerKontext, DB-Wahrheit via RLS) — sonst notFound(). Die Liste
 * liest AUSSCHLIESSLICH 0029-lesbare Spalten (key_hash ist für app_user
 * unsichtbar); V1 ist READ-ONLY — Erzeugen/Rotieren/Widerrufen übernimmt
 * onelane (admin-Write-Policies), die Konsole sagt das ehrlich.
 */
export const metadata: Metadata = { title: "API-Schlüssel" };

const STATUS_TON: Record<SchluesselZeile["status"], "ok" | "neutral" | "warnung"> = {
  aktiv: "ok",
  rotiert: "neutral",
  widerrufen: "warnung",
};

const STATUS_LABEL: Record<SchluesselZeile["status"], string> = {
  aktiv: "aktiv",
  rotiert: "rotiert",
  widerrufen: "widerrufen",
};

export default async function Seite() {
  const identity = await getPortalIdentity();
  if (!identity) notFound();
  const partner = await getApiPartnerKontext();
  const istAdmin = hatPlattformRolle(identity, "admin");
  if (!istAdmin && partner === null) notFound();

  const uebersicht = await getSchluesselUebersicht({ limit: 20 });

  return (
    <div className="grid gap-8">
      <DashboardHero
        kicker="partner-api"
        titel="API-Schlüssel"
        satz={
          partner
            ? `${partner.name} · ${partner.aktiveKeys === 1 ? "1 aktiver Schlüssel" : `${partner.aktiveKeys} aktive Schlüssel`}`
            : "Plattform-Sicht: alle Partner-Schlüssel."
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Kennzahl
          label="aktive Schlüssel"
          wert={uebersicht ? uebersicht.anzahlAktiv : "—"}
        />
        <Kennzahl
          label="Schlüssel gesamt"
          wert={uebersicht ? uebersicht.anzahlGesamt : "—"}
        />
        <Kennzahl
          label="Partner-Status"
          wert={partner ? partner.status : "—"}
          hinweis={partner ? undefined : "kein Partner-Konto verknüpft"}
        />
      </div>

      <PanelKarte
        titel="Deine Schlüssel"
        kicker="zugang"
        aktion={{ href: "/app/partner-api/docs", label: "zur Dokumentation" }}
      >
        {uebersicht === null ? (
          <KarteNichtVerfuegbar />
        ) : uebersicht.zeilen.length === 0 ? (
          <EmptyState
            szene="werkstatt"
            titel="Noch kein Schlüssel hinterlegt"
            beschreibung="Sobald onelane deinen Zugang freischaltet, erscheint dein Schlüssel hier."
            kompakt
          />
        ) : (
          <ZeilenListe>
            {uebersicht.zeilen.map((zeile) => (
              <Zeile
                key={zeile.id}
                links={
                  <span className="inline-flex items-center gap-2">
                    <StatusPunkt ton={STATUS_TON[zeile.status]} />
                    <span className="font-mono text-xs">{zeile.prefix}…</span>
                  </span>
                }
                sub={`${zeile.partner_name} · Scopes: ${zeile.scopes.join(", ")} · erstellt ${zeile.erstellt_am}${zeile.laeuft_ab_am ? ` · läuft ab ${zeile.laeuft_ab_am}` : ""}`}
                rechts={
                  zeile.status === "aktiv"
                    ? zeile.zuletzt_verwendet_am
                      ? `zuletzt ${zeile.zuletzt_verwendet_am}`
                      : "noch nicht verwendet"
                    : STATUS_LABEL[zeile.status]
                }
              />
            ))}
          </ZeilenListe>
        )}
      </PanelKarte>

      <PanelKarte titel="Verwaltung über onelane" kicker="hinweis">
        <p className="text-sm text-muted-foreground">
          Schlüssel werden in dieser Version von onelane für dich erzeugt, rotiert und
          widerrufen — melde dich dafür bei deinem onelane-Kontakt. Die Selbstverwaltung
          in der Konsole ist in Vorbereitung.
        </p>
        <p className="mt-2 text-xs text-muted-foreground/80">
          Aus Sicherheitsgründen zeigt die Liste nur den Prefix: der vollständige
          Schlüssel ist nach der Übergabe nirgends mehr einsehbar — bewahre ihn wie ein
          Passwort auf.
        </p>
      </PanelKarte>
    </div>
  );
}
