import type { Metadata } from "next";
import Link from "next/link";
import { SearchBar } from "@/components/search/search-bar";
import { RevealOnScroll } from "@/components/home/reveal";
import { DataBadge } from "@/components/school/data-badge";
import ResultsMap, { type MapMarker } from "@/components/search/results-map";
import { getTileConfig, type MapTileConfig } from "@/modules/maps";
import { searchSchools, type SearchResult, type SearchResultItem } from "@/modules/schools/search";
import { getPricesForSchool } from "@/modules/schools/prices";
import { getSchoolProfile } from "@/modules/schools/profile";
import { formatEuro, type SchoolPriceRow } from "@/lib/preise";
import { slugify } from "@/lib/slug";

/**
 * VORSCHAU „Suche · Datenkonzept" — Prototyp der Ergebnisliste mit These
 * „data-editorial": Ehrliche Daten ALS Ästhetik. Ein Listen-Tabellen-Hybrid,
 * der Vergleichen IN der Liste ermöglicht — spaltenweise ausgerichtete
 * Preisbestandteile (tabular-nums, editorialer Zahlensatz), feine Linien
 * statt Karten-Schatten, schärfere Kanten (rounded-sm/md statt 2xl), Zonen
 * im Wechsel Weiß ↔ dezente Token-Tints (color-mix).
 *
 * RECHTSRAHMEN (§ 32 FahrlG): KEIN Gesamt-/„ab"-Preis, keine Schätzungen.
 * Fahrstunde (45 Min.) und Grundbetrag erscheinen NUR ZUSAMMEN als
 * Komponenten-Paar mit Provenienz-Badge (DataBadge inkl. Stand); fehlende
 * Angaben werden als „—" ausgewiesen, nie geschätzt, Schulen nie ausgeblendet.
 * Google-Bewertungen dezent mit Quellen-Label (Fremdsignal, kein Held).
 *
 * ECHTE DATEN aus der lokalen Dev-DB (Demo-Seed München) über die
 * Modul-Schicht (RLS via DAL). SSR, Token-only, keine Inline-Styles,
 * ohne JS vollständig lesbar (Merken-Stern = reiner CSS-Toggle). `noindex`.
 */
export const metadata: Metadata = {
  title: "Vorschau — Suche (Datenkonzept)",
  robots: { index: false, follow: false },
};

/* ---------------------------------------------------------------------------
 * Kleine Format-Helfer (nur Darstellung)
 * ------------------------------------------------------------------------ */

/** Google-Rating „4.7" → deutsches Format „4,7". */
const fmtRating = (r: string) => r.replace(".", ",");

/** Distanz in km, de-DE, max. 1 Nachkommastelle. */
const fmtKm = (d: number) =>
  `${d.toLocaleString("de-DE", { maximumFractionDigits: 1 })} km`;

/** tel:-Link — nur Ziffern und führendes Plus. */
const telHref = (t: string) => `tel:${t.replace(/[^+\d]/g, "")}`;

/* ---------------------------------------------------------------------------
 * Inline-Hilfskomponenten (bewusst lokal — Prototyp verändert keinen Bestand)
 * ------------------------------------------------------------------------ */

/**
 * Merken-Stern — Vorgriff auf den Vergleichsmodus, REIN VISUELL.
 * CSS-only-Toggle (Checkbox + peer), funktioniert ohne JS und per Tastatur.
 */
function MerkStern({ name }: { name: string }) {
  return (
    <label className="inline-flex size-9 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary has-checked:text-warning">
      <input type="checkbox" className="peer sr-only" />
      <svg
        viewBox="0 0 24 24"
        className="size-5 fill-none stroke-current stroke-2 transition-transform peer-checked:fill-current motion-safe:peer-checked:scale-110"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 3.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8L12 16.9l-5.3 2.7 1-5.8-4.2-4.1 5.9-.9z" />
      </svg>
      <span className="sr-only">{`${name} merken (Vorschau des Vergleichsmodus)`}</span>
    </label>
  );
}

/** Eine ausgerichtete Preis-Zelle: Betrag (tabular-nums) oder ehrliches „—". */
function PreisZelle({ label, betrag }: { label: string; betrag: number | null }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase md:sr-only">
        {label}
      </p>
      {betrag != null ? (
        <p className="text-lg font-semibold tracking-tight tabular-nums md:text-right">
          {formatEuro(betrag)}
        </p>
      ) : (
        <p
          className="text-lg text-muted-foreground md:text-right"
          title="Keine Preisangabe der Fahrschule — wir schätzen grundsätzlich nicht."
        >
          —<span className="sr-only"> keine Preisangabe</span>
        </p>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Seite
 * ------------------------------------------------------------------------ */

// Gemeinsames Spaltenraster für Kopfzeile UND Zeilen → die Liste selbst wird
// zur Vergleichstabelle (Stern | Schule | Preis-Paar | Distanz | Aktion).
const COLS = "md:grid-cols-[2.5rem_minmax(0,1fr)_16rem_5.5rem_11rem]";
const PREIS_INNER = "grid grid-cols-2 gap-x-5";

type Zeile = {
  s: SearchResultItem;
  /** Preiszeile der Klasse B (Anzeige-Anker der Liste) oder null. */
  preisB: SchoolPriceRow | null;
  telefon: string | null;
  dossierHref: string;
};

export default async function VorschauSucheDatenPage() {
  // Echte Suche: Geo-Suche ab München-Stadtmitte → Distanzwerte + faire
  // Distanz-Sortierung (Standard). Fail-soft: Fehler → ehrlicher Leerzustand.
  const ZENTRUM = { lat: 48.1374, lng: 11.5755 }; // Marienplatz (Demo-Bezugspunkt)
  let result: SearchResult | null = null;
  try {
    result = await searchSchools({ lat: ZENTRUM.lat, lng: ZENTRUM.lng, umkreisKm: 25, sort: "distanz" });
    if (result.items.length === 0) result = await searchSchools({ ort: "München" });
  } catch {
    result = null;
  }

  // Je Treffer: Preis-Komponenten (Klasse B) + Telefon fürs prominente
  // Anruf-CTA. HINWEIS (Prototyp): Telefon kommt aus dem Profil-Modul —
  // eine Produktivfassung bündelt das als schlanken Batch-Read im Modul.
  const zeilen: Zeile[] = [];
  for (const s of result?.items ?? []) {
    let preisB: SchoolPriceRow | null = null;
    let telefon: string | null = null;
    try {
      const rows = await getPricesForSchool(s.id);
      preisB = rows.find((r) => r.klasse === "B") ?? null;
    } catch {
      preisB = null;
    }
    const stadtSlug = s.ort ? slugify(s.ort) : null;
    if (stadtSlug) {
      try {
        telefon = (await getSchoolProfile(stadtSlug, s.slug))?.telefon ?? null;
      } catch {
        telefon = null;
      }
    }
    zeilen.push({
      s,
      preisB,
      telefon,
      dossierHref: stadtSlug
        ? `/vorschau/profil-daten?stadt=${encodeURIComponent(stadtSlug)}&schule=${encodeURIComponent(s.slug)}`
        : "/vorschau/profil-daten",
    });
  }

  // Karte fail-soft (wie /fahrschulen): ohne Tile-Config bleibt die Liste
  // vollständig nutzbar — mit sichtbarem, ehrlichem Hinweis statt Lücke.
  let tile: MapTileConfig | null = null;
  try {
    tile = getTileConfig();
  } catch {
    tile = null;
  }
  const markers: MapMarker[] = zeilen
    .filter(({ s }) => s.latitude != null && s.longitude != null)
    .map(({ s }) => ({ id: s.id, name: s.name, lat: s.latitude as number, lng: s.longitude as number, partner: s.isPartner }));

  return (
    <div className="flex flex-col">
      <RevealOnScroll />

      {/* Demo-Kennzeichnung — ehrlich: Prototyp mit Demo-Datensatz */}
      <p className="border-b border-border bg-secondary px-4 py-1.5 text-center text-xs text-secondary-foreground">
        Design-Vorschau · Demo-Datensatz München — keine echten Fahrschulen, keine Veröffentlichung
      </p>

      {/* ================= ZONE 1 · Kopf (Weiß) ================= */}
      <section className="bg-background">
        <div className="mx-auto w-full max-w-6xl px-4 pt-10 pb-8 sm:px-6">
          <p className="font-mono text-xs font-medium tracking-[0.2em] text-primary uppercase">
            Vorschau · Datenkonzept
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tighter text-balance sm:text-5xl">
            Fahrschulen in München<span className="text-primary">.</span>
          </h1>
          <p className="mt-3 max-w-2xl text-base text-muted-foreground">
            {result
              ? `${result.total}${result.hasMore ? "+" : ""} Datensätze · sortiert nach Distanz ab Stadtmitte — Reihenfolge ist keine Werbefläche.`
              : "Die Suche konnte gerade nicht ausgeführt werden."}
          </p>
          <div className="mt-6 max-w-2xl">
            <SearchBar compact />
          </div>
        </div>
      </section>

      {/* ================= ZONE 2 · Lese-Legende (Sky-Tint) ================= */}
      <section className="border-y border-border bg-[color-mix(in_oklch,var(--background),var(--brand-sky)_5%)]">
        <div className="reveal-stagger mx-auto grid w-full max-w-6xl gap-6 px-4 py-6 sm:px-6 md:grid-cols-3">
          <div>
            <h2 className="text-sm font-semibold tracking-tight">Kein Gesamtpreis — mit Absicht</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Fahrschul-Preise bestehen aus amtlichen Bestandteilen (§ 32 FahrlG). Wir zeigen sie
              einzeln und rechnen nichts hoch — jede Summe wäre eine Schätzung.
            </p>
          </div>
          <div>
            <h2 className="text-sm font-semibold tracking-tight">So liest du die Kennzeichnung</h2>
            <div className="mt-2 flex flex-col items-start gap-1.5">
              <DataBadge status="recherchiert" />
              <DataBadge status="bestaetigt" />
            </div>
          </div>
          <div>
            <h2 className="text-sm font-semibold tracking-tight">Immer zusätzlich</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Amtliche Prüfgebühren (TÜV/DEKRA) sind Drittgebühren und kommen stets hinzu.
              Der vollständige Preisaushang steht in jedem Dossier.
            </p>
          </div>
        </div>
      </section>

      {/* ================= ZONE 3 · Liste + Karte (Weiß) ================= */}
      <section className="bg-background">
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-8 sm:px-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0">
            {/* Tabellen-Caption: Preis-Paar gehört zusammen; Sortierung offen deklariert */}
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 pb-2">
              <p className="text-sm font-medium">
                Preisbestandteile <span className="font-semibold">Klasse B</span>
                <span className="text-muted-foreground"> — Fahrstunde und Grundbetrag gehören zusammen*</span>
              </p>
              <p className="text-xs text-muted-foreground">
                Sortierung: <span className="font-semibold text-foreground">Distanz</span> (Standard) · ohne bezahlte Platzierung
              </p>
            </div>

            {/* Kopfzeile (ab md) — erklärt die ausgerichteten Spalten */}
            <div
              className={`hidden border-y-2 border-foreground/80 px-3 py-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase md:grid ${COLS} md:items-end md:gap-x-4`}
              aria-hidden="true"
            >
              <span className="sr-only">Merken</span>
              <span>Fahrschule</span>
              <span className={PREIS_INNER}>
                <span className="md:text-right">Fahrstunde 45 Min.</span>
                <span className="md:text-right">Grundbetrag</span>
              </span>
              <span className="text-foreground md:text-right">Distanz ↓</span>
              <span className="sr-only">Aktion</span>
            </div>

            {/* Ergebnis-Zeilen: feine Linien, großzügige Typo, KEIN Excel-Look */}
            {zeilen.length === 0 ? (
              <p className="border-y border-border px-3 py-10 text-sm text-muted-foreground">
                Gerade keine Ergebnisse verfügbar. Der Demo-Seed (München) ist in dieser
                Umgebung nicht geladen — die Darstellung bleibt trotzdem vollständig.
              </p>
            ) : (
              <ul className="reveal-stagger border-b-2 border-foreground/80">
                {zeilen.map(({ s, preisB, telefon, dossierHref }) => (
                  <li
                    key={s.id}
                    className={`relative grid grid-cols-1 gap-y-3 border-b border-border px-3 py-5 transition-colors last:border-b-0 hover:bg-[color-mix(in_oklch,var(--background),var(--brand-sky)_4%)] md:grid ${COLS} md:items-center md:gap-x-4`}
                  >
                    {/* Merken-Stern (mobil oben rechts, Desktop erste Spalte) */}
                    <div className="absolute top-4 right-2 md:static">
                      <MerkStern name={s.name} />
                    </div>

                    {/* Schule: Name → Dossier, Meta dezent, Klassen-Chips */}
                    <div className="min-w-0 pr-10 md:pr-0">
                      <p className="flex flex-wrap items-center gap-2">
                        <Link
                          href={dossierHref}
                          className="text-base font-semibold tracking-tight underline-offset-4 hover:underline"
                        >
                          {s.name}
                        </Link>
                        {s.isPartner && (
                          <span className="rounded-sm bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-accent-foreground">
                            Partner
                          </span>
                        )}
                        {s.isVerified && (
                          <span className="rounded-sm border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                            Verifiziert
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {s.stadtbezirk ?? s.ort}
                        {s.googleRating && (
                          <>
                            {" · "}
                            <span title="Fremde Quelle — nicht von onelane geprüft.">
                              {fmtRating(s.googleRating)} · Google
                              {s.googleReviewsCount ? `, ${s.googleReviewsCount} Bew.` : ""}
                            </span>
                          </>
                        )}
                      </p>
                      {s.klassen.length > 0 && (
                        <p className="mt-1.5 flex flex-wrap gap-1">
                          {s.klassen.slice(0, 7).map((k) => (
                            <span
                              key={k}
                              className="rounded-sm bg-secondary px-1.5 py-0.5 font-mono text-[11px] text-secondary-foreground"
                            >
                              {k}
                            </span>
                          ))}
                        </p>
                      )}
                    </div>

                    {/* Preis-Paar (ausgerichtet) + Provenienz direkt an den Daten */}
                    <div>
                      <div className={PREIS_INNER}>
                        <PreisZelle label="Fahrstunde 45 Min." betrag={preisB?.komponenten.fahrstunde45 ?? null} />
                        <PreisZelle label="Grundbetrag" betrag={preisB?.komponenten.grundbetrag ?? null} />
                      </div>
                      <div className="mt-1.5 md:flex md:justify-end">
                        {preisB ? (
                          <DataBadge status={preisB.status} stand={preisB.stand} />
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            keine Preisangabe — wir schätzen nicht
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Distanz */}
                    <div>
                      <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase md:sr-only">
                        Distanz ab Stadtmitte
                      </p>
                      <p className="text-sm font-medium tabular-nums md:text-right">
                        {s.distanzKm != null ? fmtKm(s.distanzKm) : "—"}
                      </p>
                    </div>

                    {/* Aktion: Anmeldung primär + Telefon prominent daneben */}
                    <div className="mt-1 grid grid-cols-2 gap-2 md:mt-0 md:flex md:flex-col">
                      <Link
                        href={`${dossierHref}#anmeldung`}
                        className="inline-flex min-h-12 items-center justify-center rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 md:min-h-11"
                      >
                        Anmeldung starten
                      </Link>
                      {telefon ? (
                        <a
                          href={telHref(telefon)}
                          className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-md border border-primary/40 px-3 text-sm font-semibold text-primary transition-colors hover:bg-primary/5 md:min-h-11"
                        >
                          <svg viewBox="0 0 24 24" className="size-4 fill-none stroke-current stroke-2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.4 2.1L8.1 10a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.6 2z" />
                          </svg>
                          Anrufen
                        </a>
                      ) : (
                        <Link
                          href={dossierHref}
                          className="inline-flex min-h-12 items-center justify-center rounded-md border border-border px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary md:min-h-11"
                        >
                          Dossier ansehen
                        </Link>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {/* Fußnote zum Preis-Paar (§ 32) */}
            <p className="mt-3 text-xs text-muted-foreground">
              * Beide Angaben sind Bestandteile des amtlichen Preisaushangs und werden nur gemeinsam
              gezeigt — kein Gesamtpreis, keine Schätzung (§ 32 FahrlG). Zzgl. amtlicher Prüfgebühren
              (TÜV/DEKRA). Recherchierte Angaben ohne Gewähr, bis die Fahrschule sie bestätigt.
            </p>
          </div>

          {/* Karte: Ergänzung, nie Voraussetzung (fail-soft) */}
          <aside className="order-first xl:order-last">
            <div className="xl:sticky xl:top-20">
              <h2 className="mb-2 font-mono text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">
                Lage der Treffer
              </h2>
              {tile && markers.length > 0 ? (
                <div className="overflow-hidden rounded-md border border-border">
                  <ResultsMap markers={markers} center={result?.zentrum ?? ZENTRUM} tile={tile} />
                </div>
              ) : (
                <p className="rounded-md border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
                  Karte in dieser Umgebung nicht verfügbar — die Liste bleibt vollständig nutzbar.
                </p>
              )}
            </div>
          </aside>
        </div>
      </section>

      {/* ================= ZONE 4 · Erklärung (Cyan-Tint) ================= */}
      <section className="border-t border-border bg-[color-mix(in_oklch,var(--background),var(--brand-cyan)_6%)]">
        <div className="reveal mx-auto grid w-full max-w-6xl gap-8 px-4 py-14 sm:px-6 md:grid-cols-[1fr_1fr]">
          <h2 className="text-3xl font-semibold tracking-tighter text-balance sm:text-4xl">
            Warum hier kein Gesamtpreis steht<span className="text-primary">.</span>
          </h2>
          <div className="flex flex-col gap-3 text-base text-muted-foreground">
            <p>
              Wie viele Fahrstunden du brauchst, entscheidet dein Lernfortschritt — nicht ein
              Portal. Jeder ausgewiesene Gesamtpreis wäre deshalb eine Schätzung, und genau die
              verbietet das Fahrlehrergesetz zu Recht.
            </p>
            <p>
              Wir richten stattdessen die amtlichen Bestandteile spaltenweise aus, damit du sie
              Zeile für Zeile vergleichen kannst — und kennzeichnen bei jeder Zahl, woher sie
              stammt und wie aktuell sie ist.
            </p>
            <p>
              <Link href="/vorschau/profil-daten" className="font-semibold text-primary underline-offset-4 hover:underline">
                Zum Fahrschul-Dossier mit vollständigem Preisaushang →
              </Link>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
