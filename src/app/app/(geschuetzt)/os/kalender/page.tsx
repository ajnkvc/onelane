import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPortalIdentity } from "@/modules/portal/identity";
import { aktiveSchulRolle, istSchulManager, istSchulRolle } from "@/modules/portal/rollen";
import {
  getKalenderWoche,
  parseWochenParam,
  verschiebeTage,
  wochenLabel,
} from "@/modules/portal/os-betrieb";
import { DashboardHero } from "@/components/portal/dashboards/hero";
import { EmptyState } from "@/components/portal/empty-state";
import { KarteNichtVerfuegbar, PanelKarte } from "@/components/portal/karten";
import { VerfuegbarkeitPflege } from "./verfuegbarkeit-pflege";
import { RasterLegende, WochenRaster } from "./wochen-raster";

/**
 * os/kalender — Wochenansicht je Fahrlehrer:in (OS-P3 Paket B; Welle 2:
 * Schüler-Namen + Verfügbarkeits-Pflege).
 * ----------------------------------------------------------------------------
 * Gate identisch zum P2-Platzhalter: alle drei Schul-Rollen. Lesepfade
 * 0029/0030/0031 (appointments ohne preis/abgerechnet; Schüler-Namen über den
 * Definer app.schueler_namen). TERMINE bleiben read-only (Termin-Anlage =
 * eigenes Modul mit Storno-Regeln, P4/V1.1 — bewusst KEIN Button, auch nicht
 * disabled). Die VERFÜGBARKEIT ist seit Welle 2 pflegbar (0031-Policies:
 * Manager schulweit, Fahrlehrer:in nur die eigene Spur) — das Panel erscheint
 * nur in der Einzel-Ansicht für Berechtigte; durchgesetzt wird in Modul+RLS.
 * Fahrlehrer:innen starten auf „Mein Kalender" (eigene Spur), Schul-Manager auf
 * „alle"; Auswahl + Wochen-Navigation laufen über validierte Query-Parameter.
 */
export const metadata: Metadata = { title: "Kalender" };

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function pillKlasse(aktiv: boolean): string {
  return `inline-flex min-h-8 items-center rounded-full border px-3 text-xs font-medium motion-safe:transition-colors motion-safe:duration-[var(--motion-duration-fast)] ${focusRing} ${
    aktiv
      ? "border-primary bg-primary/10 text-primary"
      : "border-border bg-card text-muted-foreground hover:border-brand-sky/60"
  }`;
}

export default async function Seite({
  searchParams,
}: {
  searchParams: Promise<{ woche?: string; fahrlehrer?: string }>;
}) {
  const identity = await getPortalIdentity();
  if (!identity || !istSchulRolle(identity, "inhaber", "verwaltung", "fahrlehrer")) notFound();
  const schule = identity.aktiveSchule;
  if (!schule) notFound();

  const sp = await searchParams;
  const wunschWoche = parseWochenParam(sp.woche);
  const woche = await getKalenderWoche(schule.schoolId, { wunschWoche });

  if (woche === null) {
    return (
      <div className="grid gap-6">
        <DashboardHero kicker="kalender" titel="Kalender" />
        <KarteNichtVerfuegbar />
      </div>
    );
  }

  // Auswahl: ?fahrlehrer=<uuid|alle>; Standard „Mein Kalender" für Fahrlehrer:innen
  // mit eigener Spur (ist_ich via app.own_instructor_ids, 0030), sonst „alle".
  const eigene = woche.fahrlehrer.find((f) => f.ist_ich) ?? null;
  const wunschAuswahl =
    typeof sp.fahrlehrer === "string" && UUID_REGEX.test(sp.fahrlehrer)
      ? sp.fahrlehrer
      : sp.fahrlehrer === "alle"
        ? "alle"
        : null;
  const auswahl: string =
    wunschAuswahl !== null && wunschAuswahl !== "alle"
      ? woche.fahrlehrer.some((f) => f.id === wunschAuswahl)
        ? wunschAuswahl
        : "alle"
      : (wunschAuswahl ??
        (aktiveSchulRolle(identity) === "fahrlehrer" && eigene ? eigene.id : "alle"));

  const einzelAnsicht = auswahl !== "alle";
  // Termine ohne Fahrlehrer-Zuordnung (z. B. Theorie) gelten für die ganze Schule
  // und bleiben in jeder Auswahl sichtbar.
  const termine = einzelAnsicht
    ? woche.termine.filter((t) => t.instructor_id === auswahl || t.instructor_id === null)
    : woche.termine;
  const slots = einzelAnsicht ? woche.slots.filter((s) => s.instructor_id === auswahl) : [];
  const fahrlehrerName = new Map(woche.fahrlehrer.map((f) => [f.id, f.name] as const));

  const istAktuelleWoche = wochenIso(woche.heute) === woche.wochenstart;
  // Auswahl IMMER explizit in den Link schreiben — der Default hängt sonst von
  // der Rolle ab („Mein Kalender") und die „alle"-Pille würde nicht wechseln.
  const kalenderHref = (params: { woche?: string; fahrlehrer: string }) => {
    const q = new URLSearchParams();
    if (params.woche) q.set("woche", params.woche);
    q.set("fahrlehrer", params.fahrlehrer);
    return `/app/os/kalender?${q.toString()}`;
  };

  const satz = `${termine.length === 1 ? "1 Termin" : `${termine.length} Termine`} in dieser Woche${
    einzelAnsicht ? ` für ${fahrlehrerName.get(auswahl) ?? "die Auswahl"}` : ""
  }.`;

  return (
    <div className="grid gap-6">
      <DashboardHero
        kicker="kalender"
        titel={einzelAnsicht && eigene?.id === auswahl ? "Mein Kalender" : "Kalender"}
        satz={satz}
      />

      {/* Wochen-Navigation + Fahrlehrer-Auswahl (Links, kein JS nötig) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Woche wählen" className="flex items-center gap-2">
          <Link
            href={kalenderHref({ woche: verschiebeTage(woche.wochenstart, -7), fahrlehrer: auswahl })}
            aria-label="vorherige Woche"
            className={pillKlasse(false)}
          >
            ‹
          </Link>
          <span className="min-w-40 text-center text-sm font-medium tabular-nums">
            {wochenLabel(woche.tage)}
          </span>
          <Link
            href={kalenderHref({ woche: verschiebeTage(woche.wochenstart, 7), fahrlehrer: auswahl })}
            aria-label="nächste Woche"
            className={pillKlasse(false)}
          >
            ›
          </Link>
          {!istAktuelleWoche ? (
            <Link href={kalenderHref({ fahrlehrer: auswahl })} className={pillKlasse(false)}>
              diese Woche
            </Link>
          ) : null}
        </nav>

        <nav aria-label="Fahrlehrer wählen" className="flex flex-wrap items-center gap-1.5">
          <Link
            href={kalenderHref({ woche: wunschWoche ?? undefined, fahrlehrer: "alle" })}
            aria-current={!einzelAnsicht ? "true" : undefined}
            className={pillKlasse(!einzelAnsicht)}
          >
            alle
          </Link>
          {woche.fahrlehrer.map((f) => (
            <Link
              key={f.id}
              href={kalenderHref({ woche: wunschWoche ?? undefined, fahrlehrer: f.id })}
              aria-current={auswahl === f.id ? "true" : undefined}
              className={pillKlasse(auswahl === f.id)}
            >
              {f.ist_ich ? "Mein Kalender" : f.name}
            </Link>
          ))}
        </nav>
      </div>

      <PanelKarte titel={einzelAnsicht ? (fahrlehrerName.get(auswahl) ?? "Woche") : "Ganze Schule"} kicker="wochenansicht">
        {termine.length === 0 && slots.length === 0 ? (
          <EmptyState
            szene="strecke"
            titel="Diese Woche ist noch leer"
            beschreibung="Termine und Verfügbarkeiten deiner Schule erscheinen hier, sobald sie eingetragen sind."
          />
        ) : (
          <div className="grid gap-4">
            <WochenRaster
              tage={woche.tage}
              heute={woche.heute}
              termine={termine}
              slots={slots}
              zeigeSlots={einzelAnsicht}
              fahrlehrerName={einzelAnsicht ? new Map() : fahrlehrerName}
            />
            <RasterLegende zeigeSlots={einzelAnsicht} />
            {!einzelAnsicht ? (
              <p className="text-xs text-muted-foreground">
                Verfügbarkeits-Bänder siehst du in der Einzel-Ansicht einer Fahrlehrer:in.
              </p>
            ) : null}
          </div>
        )}
      </PanelKarte>

      {/* Verfügbarkeits-Pflege (Welle 2, 0031): nur Einzel-Ansicht + Berechtigte —
          Manager pflegen alle Spuren, Fahrlehrer:innen die eigene (RLS = letzte Linie). */}
      {einzelAnsicht && (istSchulManager(identity) || eigene?.id === auswahl) ? (
        <VerfuegbarkeitPflege
          instructorId={auswahl}
          instructorName={fahrlehrerName.get(auswahl) ?? "dieser Fahrlehrer:in"}
          tage={woche.tage}
          slots={slots}
        />
      ) : null}
    </div>
  );
}

/** Montag (ISO) der Woche, in der `isoDatum` liegt — reine Kalenderarithmetik. */
function wochenIso(isoDatum: string): string {
  const d = new Date(`${isoDatum}T00:00:00Z`);
  const wochentag = (d.getUTCDay() + 6) % 7; // 0 = Montag
  return verschiebeTage(isoDatum, -wochentag);
}
