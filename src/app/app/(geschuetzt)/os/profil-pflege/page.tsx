import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPortalIdentity } from "@/modules/portal/identity";
import { istSchulManager } from "@/modules/portal/rollen";
import { getProfilPflege } from "@/modules/portal/os-betrieb";
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
import { DataBadge } from "@/components/school/data-badge";
import { openingStatus, naechsteTheorie } from "@/lib/zeiten";
import { slugify } from "@/lib/slug";
import { getSiteUrl } from "@/lib/public-config";

/**
 * os/profil-pflege — READ-Übersicht des öffentlichen Portal-Profils (OS-P3
 * Paket B, V1). Gate identisch zum P2-Platzhalter: nur Schul-Manager.
 * ----------------------------------------------------------------------------
 * V1 zeigt den PFLEGE-STAND (Beschreibung, Öffnungszeiten-Status, Preisaushang-
 * Status je Klasse mit DataBadge, Kontakt-Vollständigkeit) + Link zur
 * öffentlichen Profilseite (ABSOLUT über getSiteUrl — auf dem App-Host würde
 * ein relativer /fahrschulen-Link in den /app-Rewrite laufen).
 * EDITIEREN kommt in Welle 2/P4 (eigene Schreib-Actions + Review-Pfad) —
 * bewusst KEINE toten Formulare. Die Zustell-Adressen (bewerbungs_email/
 * anfragen_email, 0025/0028) sind für app_user spalten-gesperrt und werden
 * deshalb als „wird vom onelane-Team gepflegt" ausgewiesen (kein Wert-Leak).
 */
export const metadata: Metadata = { title: "Profil-Pflege" };

export default async function Seite() {
  const identity = await getPortalIdentity();
  if (!identity || !istSchulManager(identity)) notFound();
  const schule = identity.aktiveSchule;
  if (!schule) notFound();

  const profil = await getProfilPflege(schule.schoolId);

  if (profil === null) {
    return (
      <div className="grid gap-6">
        <DashboardHero kicker="profil-pflege" titel="Profil-Pflege" />
        <KarteNichtVerfuegbar />
      </div>
    );
  }

  const jetzt = new Date();
  const status = openingStatus(profil.zeiten, jetzt);
  const theorie = naechsteTheorie(profil.zeiten, jetzt, 3);
  const bestaetigt = profil.preise.filter((p) => p.status === "bestaetigt").length;
  const kontaktZaehler = [profil.kontakt.telefon, profil.kontakt.email, profil.kontakt.website]
    .filter(Boolean).length;
  const profilUrl = profil.ort
    ? `${getSiteUrl()}/fahrschulen/${slugify(profil.ort)}/${profil.slug}`
    : null;

  const satz = `Beschreibung ${profil.beschreibung ? "gepflegt" : "offen"}, ${
    profil.zeiten.length
  } Zeitfenster, ${bestaetigt} von ${profil.preise.length} Preisaushängen bestätigt.`;

  return (
    <div className="grid gap-6">
      <DashboardHero kicker="profil-pflege" titel={profil.name} satz={satz} />

      <section aria-label="Pflege-Stand" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kennzahl
          label="Beschreibung"
          wert={profil.beschreibung ? "gepflegt" : "offen"}
          hinweis={profil.beschreibung ? undefined : "wirkt auf dein öffentliches Profil"}
        />
        <Kennzahl
          label="Öffnungszeiten"
          wert={profil.zeiten.length > 0 ? `${profil.zeiten.length} Zeitfenster` : "offen"}
          hinweis={status ? status.label : undefined}
        />
        <Kennzahl
          label="Preisaushang bestätigt"
          wert={`${bestaetigt} / ${profil.preise.length}`}
          hinweis="je Führerscheinklasse"
        />
        <Kennzahl label="Kontaktwege" wert={`${kontaktZaehler} / 3`} hinweis="Telefon · E-Mail · Website" />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <PanelKarte
          titel="Öffentliches Profil"
          kicker="portal"
          aktion={profilUrl ? { href: profilUrl, label: "Profil ansehen" } : undefined}
        >
          <div className="grid gap-3">
            {profil.beschreibung ? (
              <p className="text-sm text-muted-foreground">
                {profil.beschreibung.length > 240
                  ? `${profil.beschreibung.slice(0, 240)} …`
                  : profil.beschreibung}
              </p>
            ) : (
              <EmptyState
                kompakt
                szene="werkstatt"
                titel="Noch keine Beschreibung"
                beschreibung="Eine kurze Vorstellung deiner Schule macht dein Profil deutlich stärker."
              />
            )}
            {profil.klassen.length > 0 ? (
              <p className="text-xs text-muted-foreground">
                Führerscheinklassen:{" "}
                <span className="font-medium text-foreground">{profil.klassen.join(" · ")}</span>
              </p>
            ) : null}
            <ZeilenListe>
              <Zeile
                links={
                  <span className="inline-flex items-center gap-2">
                    <StatusPunkt ton={profil.kontakt.telefon ? "ok" : "warnung"} />
                    Telefon
                  </span>
                }
                rechts={profil.kontakt.telefon ? "hinterlegt" : "offen"}
              />
              <Zeile
                links={
                  <span className="inline-flex items-center gap-2">
                    <StatusPunkt ton={profil.kontakt.email ? "ok" : "warnung"} />
                    E-Mail
                  </span>
                }
                rechts={profil.kontakt.email ? "hinterlegt" : "offen"}
              />
              <Zeile
                links={
                  <span className="inline-flex items-center gap-2">
                    <StatusPunkt ton={profil.kontakt.website ? "ok" : "warnung"} />
                    Website
                  </span>
                }
                rechts={profil.kontakt.website ? "hinterlegt" : "offen"}
              />
            </ZeilenListe>
          </div>
        </PanelKarte>

        <PanelKarte titel="Öffnungs- & Theoriezeiten" kicker="strukturiert">
          {profil.zeiten.length === 0 ? (
            <EmptyState
              kompakt
              szene="werkstatt"
              titel="Noch keine Zeiten hinterlegt"
              beschreibung="Mit gepflegten Zeiten zeigt dein Profil den Live-Status („Jetzt geöffnet“)."
            />
          ) : (
            <div className="grid gap-3">
              {status ? (
                <p className="inline-flex w-fit items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
                  <StatusPunkt
                    ton={
                      status.status === "geoeffnet" || status.status === "schliesst_bald"
                        ? "ok"
                        : "neutral"
                    }
                  />
                  {status.label}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Kein Büro-Status möglich — es sind keine Büro-Zeiten gepflegt.
                </p>
              )}
              {theorie.length > 0 ? (
                <ZeilenListe>
                  {theorie.map((t, i) => (
                    <Zeile
                      key={`${t.tagLabel}-${t.von}-${i}`}
                      links="Theorie"
                      rechts={`${t.tagLabel} · ${t.von}–${t.bis}`}
                    />
                  ))}
                </ZeilenListe>
              ) : (
                <p className="text-xs text-muted-foreground">Keine Theoriezeiten gepflegt.</p>
              )}
            </div>
          )}
        </PanelKarte>

        <PanelKarte titel="Preisaushang" kicker="§ 32 fahrlg · je klasse">
          {profil.preise.length === 0 ? (
            <EmptyState
              kompakt
              szene="posteingang"
              titel="Noch kein Preisaushang hinterlegt"
              beschreibung="Sobald Preise je Klasse vorliegen, siehst du hier ihren Bestätigungs-Stand."
            />
          ) : (
            <ZeilenListe>
              {profil.preise.map((p) => (
                <Zeile
                  key={p.klasse}
                  links={`Klasse ${p.klasse}`}
                  rechts={<DataBadge status={p.status} stand={p.stand} />}
                />
              ))}
            </ZeilenListe>
          )}
        </PanelKarte>

        <PanelKarte titel="Zustell-Adressen" kicker="anfragen & bewerbungen">
          <div className="grid gap-3">
            <ZeilenListe>
              <Zeile
                links="Zustellung für Anfragen"
                sub="Schüler-Anfragen aus dem Portal"
                rechts="wird vom onelane-Team gepflegt"
              />
              <Zeile
                links="Zustellung für Bewerbungen"
                sub="Bewerbungen aus der Jobbörse"
                rechts="wird vom onelane-Team gepflegt"
              />
            </ZeilenListe>
            <p className="text-xs text-muted-foreground">
              Diese Adressen verwaltet aus Sicherheitsgründen das onelane-Team. Änderungen —
              wie auch an Beschreibung, Zeiten oder Preisen — schickst du formlos an{" "}
              <a
                href="mailto:kontakt@onelane.de"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                kontakt@onelane.de
              </a>
              . Die Selbst-Pflege direkt hier folgt in einem nächsten Ausbauschritt.
            </p>
          </div>
        </PanelKarte>
      </div>
    </div>
  );
}
