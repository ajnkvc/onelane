import type { Metadata } from "next";
import Link from "next/link";
import { DataBadge } from "@/components/school/data-badge";
import { RatingStern, ratingFarbClass } from "@/components/school/rating";
import { PhoneIcon } from "@/components/school/anmelde-aktionen";
import { TrustBadge } from "@/components/trust/trust-badge";
import { VergleichTeilen } from "@/components/vergleich/vergleich-teilen";
import { getSchoolProfile, type SchoolProfileDetail } from "@/modules/schools/profile";
import { getPricesForSchools } from "@/modules/schools/prices";
import { gruppierePreiseNachSchule } from "@/components/search/price-view";
import { formatEuro, type SchoolPriceRow } from "@/lib/preise";
import { openingStatus, naechsteTheorie } from "@/lib/zeiten";
import { berechneHighlights } from "@/lib/highlights";
import { ctaLabel } from "@/lib/cta";
import { getSiteUrl } from "@/lib/public-config";
import {
  parseVergleichsRefs,
  vergleichsHref,
  normalisiereKlasseWunsch,
  sammleKlassen,
  waehleVergleichsKlasse,
  fokusZeileFuerSchule,
  baueVergleichsZeilen,
} from "@/lib/vergleich";

/**
 * /vergleich — Fahrschulen nebeneinander, Komponente für Komponente (M3).
 * ----------------------------------------------------------------------------
 * URL-KONTRAKT: ?s=<stadtSlug>/<schulSlug> (wiederholt, 2–4; tolerant für 1) +
 * optional ?klasse= (Fokus-Klasse der Preisgruppe, Muster der Profilseite).
 * Parsing STRIKT über src/lib/vergleich.ts (Slug-Regex, Dedupe, Cap 4);
 * Ungültiges wird still verworfen. Nicht auflösbare Schulen werden fail-soft
 * übersprungen: 0 gültige → editorialer Leerzustand, 1 gültige → Vergleich
 * plus „füge eine zweite hinzu“-Hinweis.
 *
 * RECHTSRAHMEN (§ 32 FahrlG, wie src/lib/preise.ts): Der Vergleich ist
 * KOMPONENTENWEISE — je Aushang-Komponente eine Zeile, NIE eine Summe, nie ein
 * „ab“-Preis, nie ein „günstigste Fahrschule“-Urteil. Der niedrigste Wert wird
 * NUR JE ZEILE dezent markiert (font-semibold + feiner Accent-Punkt +
 * sr-only-Text — komponentenbasiert, kein Ranking-Gefühl); fehlende Angaben
 * erscheinen neutral als „keine Angabe“ (nie benachteiligend). Fußzeile:
 * „zzgl. amtlicher Prüfgebühren (TÜV/DEKRA)“.
 *
 * LAYOUT: echte <table> (Vergleich = Tabellensemantik, Screenreader bekommen
 * Spalten-/Zeilenbezug geschenkt) in einem Scroll-Container — mobil
 * horizontales scroll-snap (proximity, damit die Tabelle frei scrollbar
 * bleibt) mit sichtbarem Anschnitt der nächsten Spalte; die Zeilen-Labels
 * kleben links (sticky). Desktop: bis 4 Spalten nebeneinander (table-fixed).
 *
 * SEO: noindex (Parameter-Seite, beliebig viele Kombinationen). Canonical
 * BEWUSST WEGGELASSEN: ein Self-Canonical mit Params würde jede Kombination
 * zur „eigenen kanonischen URL“ erklären (ohne Index-Wert), ein Canonical auf
 * /vergleich ohne Params zeigte auf den Leerzustand — beides irreführend.
 * KEIN JSON-LD. Reine SSR-Seite: geteilte /vergleich-Links funktionieren
 * IMMER ohne JS; nur Kopier-Button (Teilen-Modul) ist eine Client-Insel.
 */
export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const SPRACHE_LABEL: Record<string, string> = {
  de: "Deutsch",
  en: "Englisch",
  tr: "Türkisch",
  ru: "Russisch",
  ar: "Arabisch",
  it: "Italienisch",
  es: "Spanisch",
  fr: "Französisch",
  el: "Griechisch",
};

/* Dezente Blau-Tint-Zone (Kernmuster der Suche/Profile) für Gruppen-Köpfe. */
const TINT_SOFT = "bg-[color-mix(in_oklab,var(--brand-sky)_5%,var(--background))]";

/* Zellen-Bausteine der Vergleichstabelle (border-separate → Border je Zelle).
 * LABEL klebt links (sticky, opak) — mobil bleibt so lesbar, WAS verglichen
 * wird, während die Schul-Spalten scrollen. Schul-Zellen haben mobile
 * Mindestbreiten (Anschnitt der nächsten Spalte sichtbar), auf lg verteilt
 * table-fixed den Platz gleichmäßig. */
const CELL_LABEL =
  "sticky left-0 z-10 w-32 min-w-32 border-b border-border/70 bg-background px-3 py-3 text-left align-top text-sm font-medium text-muted-foreground sm:w-40 sm:min-w-40 lg:w-44";
const CELL_SCHULE =
  "min-w-[13.5rem] border-b border-border/70 border-l border-l-border/40 px-3 py-3 text-left align-top text-sm sm:min-w-[15rem] lg:min-w-0";

/** Neutraler Platzhalter für fehlende Nicht-Preis-Angaben. */
function Leer() {
  return (
    <span className="text-muted-foreground/70" aria-label="keine Angabe">
      —
    </span>
  );
}

/** Gruppen-Kopfzeile: klebt-links-Label über die volle Tabellenbreite. */
function GruppenKopf({ spalten, children }: { spalten: number; children: React.ReactNode }) {
  return (
    <tr>
      <th
        colSpan={spalten + 1}
        scope="colgroup"
        className={`border-b border-t border-border px-0 py-0 text-left ${TINT_SOFT}`}
      >
        <span className="sticky left-0 inline-block max-w-[100vw] px-3 py-2 font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
          {children}
        </span>
      </th>
    </tr>
  );
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Fahrschulen im Vergleich",
    description:
      "Bis zu vier Fahrschulen nebeneinander — Preisbestandteile nach § 32 FahrlG, Zeiten und Ausstattung. Ohne Gesamtpreis, ohne Ranking.",
    robots: { index: false, follow: true },
    // Kein canonical — Begründung im Datei-Kopf (Parameter-Seite, noindex).
  };
}

export default async function VergleichPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const refs = parseVergleichsRefs(sp.s);
  const klasseWunsch = normalisiereKlasseWunsch(first(sp.klasse));

  // Fail-soft laden: nicht auflösbare Refs überspringen (kein 404, kein Fehler-
  // Oracle). Sequenziell — jede Profil-Ladung ist eine eigene DAL-Transaktion.
  const schulen: SchoolProfileDetail[] = [];
  for (const ref of refs) {
    const s = await getSchoolProfile(ref.stadt, ref.slug).catch(() => null);
    if (s && !schulen.some((x) => x.id === s.id)) schulen.push(s);
  }

  // ---- Leerzustand: nichts Vergleichbares in der URL ----
  if (schulen.length === 0) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-16 sm:px-6">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Fahrschulen im Vergleich</h1>
        <p className="mt-3 max-w-xl text-muted-foreground">
          Hier stehen bis zu vier Fahrschulen nebeneinander — Preisbestandteil für
          Preisbestandteil, dazu Zeiten und Ausstattung. Ohne Gesamtpreis, ohne Ranking:
          Du vergleichst, du entscheidest.
        </p>
        <p className="mt-3 max-w-xl text-sm text-muted-foreground">
          So geht’s: Merke dir in der Suche mit „Vergleichen“ zwei bis vier Fahrschulen —
          die Leiste am unteren Rand bringt dich dann hierher.
        </p>
        <p className="mt-6">
          <Link
            href="/fahrschulen"
            className="inline-flex min-h-12 items-center rounded-full bg-accent px-6 text-sm font-semibold text-accent-foreground transition-colors duration-[var(--motion-duration-fast)] ease-[var(--motion-ease)] hover:bg-brand-lime"
          >
            Zur Fahrschul-Suche
          </Link>
        </p>
        <div className="mt-14 flex flex-col items-center gap-1.5 text-center">
          <TrustBadge size="sm" />
          <span className="text-[11px] text-muted-foreground">Wir bleiben an deiner Seite.</span>
        </div>
      </div>
    );
  }

  // Preise gebatcht über das bestehende Modul (RLS; Cap = MAX_VERGLEICH).
  let preiseNachSchule = new Map<string, SchoolPriceRow[]>();
  try {
    preiseNachSchule = gruppierePreiseNachSchule(await getPricesForSchools(schulen.map((s) => s.id)));
  } catch {
    preiseNachSchule = new Map();
  }
  const preiseJeSchule = schulen.map((s) => preiseNachSchule.get(s.id) ?? []);

  // Fokus-Klasse (?klasse= → B → erste vollständige → erste) + Zeilen-Bau.
  const fokusKlasse = waehleVergleichsKlasse(preiseJeSchule, klasseWunsch);
  const fokusZeilen = preiseJeSchule.map((rows) => fokusZeileFuerSchule(rows, fokusKlasse));
  const zeilen = baueVergleichsZeilen(fokusZeilen);
  const klassen = sammleKlassen(preiseJeSchule);

  const jetzt = new Date();
  const spalten = schulen.map((s, i) => {
    const rows = preiseJeSchule[i];
    const theorieAbende =
      s.show.zeiten &&
      s.hours.some(
        (h) => h.art === "theorie" && /^\d{2}:\d{2}/.test(h.von) && Number(h.von.slice(0, 2)) >= 18,
      );
    const profilHref = `/fahrschulen/${s.stadtSlug}/${s.slug}`;
    return {
      s,
      bezirk: s.stadtbezirk && s.stadtbezirk !== s.ort ? s.stadtbezirk : null,
      status: s.show.zeiten ? openingStatus(s.hours, jetzt) : null,
      theorie: s.show.zeiten ? naechsteTheorie(s.hours, jetzt, 2) : [],
      highlights: berechneHighlights({
        klassen: s.klassen,
        sprachen: s.sprachen,
        vehicles: s.show.vehicles ? s.vehicles : [],
        theorieAbende,
        preiseBestaetigt: rows.some((r) => r.status === "bestaetigt"),
      }),
      tel: s.telefon?.replace(/\s+/g, "") ?? null,
      profilHref,
      anmeldenHref: `${profilHref}/anmeldung${
        fokusKlasse ? `?klasse=${encodeURIComponent(fokusKlasse)}` : ""
      }`,
    };
  });
  const n = schulen.length;

  // Teil-URL absolut (eine Quelle der Wahrheit: vergleichsHref) — fürs
  // Teilen-Modul und als GET-Ziel des Klassen-Umschalters.
  const pfad = vergleichsHref(
    schulen.map((s) => ({ stadt: s.stadtSlug, slug: s.slug })),
    fokusKlasse,
  );
  const teilenUrl = `${getSiteUrl().replace(/\/+$/, "")}${pfad}`;

  return (
    <div className="flex w-full flex-1 flex-col">
      {/* ---- Kopf-Zone (Tint): Einordnung + ehrliche Spielregeln ---- */}
      <header className={`border-b border-border ${TINT_SOFT}`}>
        <div className="mx-auto w-full max-w-[90rem] px-4 py-8 sm:px-6">
          <nav className="text-sm text-muted-foreground" aria-label="Brotkrumen">
            <Link href="/fahrschulen" className="underline-offset-2 hover:underline">
              Fahrschulen
            </Link>
            <span> · Vergleich</span>
          </nav>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Fahrschulen im Vergleich
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            {n === 1 ? "Eine Fahrschule" : `${n} Fahrschulen`} nebeneinander — Preisbestandteile
            nach § 32 FahrlG, Zeiten und Ausstattung. Bewusst ohne Gesamtpreis und ohne
            Ranking: Du vergleichst, du entscheidest.
          </p>
          {n === 1 && (
            <p className="mt-3 max-w-2xl rounded-md border border-border bg-background px-4 py-3 text-sm">
              <span className="font-semibold">Eine Fahrschule ist erst der Anfang</span> — füge in
              der{" "}
              <Link href="/fahrschulen" className="text-primary underline-offset-2 hover:underline">
                Suche
              </Link>{" "}
              mindestens eine zweite hinzu, dann wird’s ein echter Vergleich.
            </p>
          )}
        </div>
      </header>

      <div className="mx-auto w-full max-w-[90rem] flex-1 px-4 py-6 sm:px-6">
        {/* ---- Klassen-Umschalter: GET-Form ohne JS (Profil-Muster) ---- */}
        {klassen.length > 1 && fokusKlasse && (
          <form action="/vergleich" method="get" className="mb-5 flex flex-wrap items-end gap-2">
            {schulen.map((s) => (
              <input key={s.id} type="hidden" name="s" value={`${s.stadtSlug}/${s.slug}`} />
            ))}
            <div>
              <label
                htmlFor="vergleich-klasse"
                className="mb-1 block font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground"
              >
                Preisaushang für
              </label>
              <select
                id="vergleich-klasse"
                name="klasse"
                defaultValue={fokusKlasse}
                className="min-h-11 rounded-[4px] border border-input bg-background px-3 text-sm outline-none focus:border-ring"
              >
                {klassen.map((k) => (
                  <option key={k} value={k}>
                    Klasse {k}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="inline-flex min-h-11 items-center rounded-full border border-border bg-background px-5 text-sm font-medium transition-colors duration-[var(--motion-duration-fast)] ease-[var(--motion-ease)] hover:border-primary/50 hover:text-primary"
            >
              Anzeigen
            </button>
          </form>
        )}

        {/* ---- Die Vergleichstabelle (Scroll-Container mit Snap) ---- */}
        <div className="snap-x snap-proximity overflow-x-auto rounded-md border border-border">
          <table className="w-full border-separate border-spacing-0 lg:table-fixed">
            <caption className="sr-only">
              Vergleich von {n} Fahrschule{n === 1 ? "" : "n"}: Preisbestandteile nach § 32
              FahrlG{fokusKlasse ? ` (Klasse ${fokusKlasse})` : ""}, Zeiten und Ausstattung —
              ohne Gesamtpreis.
            </caption>

            {/* (a) Kopf: Name (Profil-Link), Ort/Bezirk, Partner-Badge */}
            <thead>
              <tr>
                <td className={CELL_LABEL} aria-hidden="true" />
                {spalten.map(({ s, bezirk, profilHref }) => (
                  <th
                    key={s.id}
                    scope="col"
                    className={`${CELL_SCHULE} snap-start scroll-ml-32 bg-background align-bottom sm:scroll-ml-40`}
                  >
                    <span className="flex flex-col items-start gap-1.5">
                      <Link
                        href={profilHref}
                        className="rounded-[3px] text-base font-bold leading-snug tracking-tight underline-offset-4 outline-offset-4 hover:underline"
                      >
                        {s.name}
                      </Link>
                      <span className="text-xs font-normal text-muted-foreground">
                        {[s.ort, bezirk].filter(Boolean).join(" — ") || "—"}
                      </span>
                      {s.isPartner && (
                        <span className="inline-flex items-center gap-1 rounded-[4px] border border-primary/40 px-1.5 py-0.5 text-[11px] font-medium text-primary">
                          <span aria-hidden="true" className="size-1 rounded-full bg-accent" />
                          Partner
                        </span>
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>

            {/* (a, Fortsetzung) Auf einen Blick: Google-Note, Status, Theorie */}
            <tbody>
              <GruppenKopf spalten={n}>Auf einen Blick</GruppenKopf>
              <tr>
                <th scope="row" className={CELL_LABEL}>
                  Google-Bewertung
                </th>
                {spalten.map(({ s }) => (
                  <td key={s.id} className={CELL_SCHULE}>
                    {s.googleRating ? (
                      <span
                        className="inline-flex items-center gap-1"
                        title="Bewertung bei Google — nicht von onelane erhoben"
                      >
                        <RatingStern />
                        <span className={`font-bold tabular-nums ${ratingFarbClass(s.googleRating)}`}>
                          {s.googleRating.replace(".", ",")}
                        </span>
                        {s.googleReviewsCount ? (
                          <span className="text-muted-foreground">({s.googleReviewsCount})</span>
                        ) : null}
                        <span className="text-muted-foreground">· Google</span>
                      </span>
                    ) : (
                      <Leer />
                    )}
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row" className={CELL_LABEL}>
                  Gerade jetzt
                </th>
                {spalten.map(({ s, status }) => (
                  <td key={s.id} className={CELL_SCHULE}>
                    {status ? (
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          status.status === "geoeffnet"
                            ? "bg-accent text-accent-foreground"
                            : "bg-secondary text-secondary-foreground"
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className={`size-1.5 rounded-full ${
                            status.status === "geoeffnet" || status.status === "schliesst_bald"
                              ? "bg-accent-foreground/70"
                              : "bg-muted-foreground/60"
                          }`}
                        />
                        {status.label}
                      </span>
                    ) : (
                      <Leer />
                    )}
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row" className={CELL_LABEL}>
                  Nächste Theorie
                </th>
                {spalten.map(({ s, theorie }) => (
                  <td key={s.id} className={CELL_SCHULE}>
                    {theorie.length > 0 ? (
                      <span className="font-mono text-sm tabular-nums">
                        {theorie[0].tagLabel} {theorie[0].von}
                        {theorie.length > 1 && (
                          <span className="text-muted-foreground">
                            {" "}
                            · dann {theorie[1].tagLabel} {theorie[1].von}
                          </span>
                        )}
                      </span>
                    ) : (
                      <Leer />
                    )}
                  </td>
                ))}
              </tr>
            </tbody>

            {/* (b) PREISAUSHANG der Fokus-Klasse: je Komponente EINE Zeile.
                Der niedrigste Wert JE ZEILE ist dezent markiert (font-semibold
                + feiner Accent-Punkt + sr-only-Text) — KOMPONENTENBASIERT
                erlaubt (§ 32), bewusst kein Ranking-Gefühl; „keine Angabe“
                bleibt neutral und wird nie benachteiligend dargestellt. */}
            <tbody>
              <GruppenKopf spalten={n}>
                Preisaushang{fokusKlasse ? ` · Klasse ${fokusKlasse}` : ""}
              </GruppenKopf>
              {fokusKlasse ? (
                <>
                  {zeilen.map((zeile) => (
                    <tr key={zeile.key}>
                      <th scope="row" className={CELL_LABEL}>
                        {zeile.label}
                      </th>
                      {zeile.zellen.map((zelle, i) => (
                        <td key={schulen[i].id} className={CELL_SCHULE}>
                          {zelle.wert != null ? (
                            <span className="inline-flex items-center gap-1.5">
                              {zelle.guenstigster && (
                                <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-accent" />
                              )}
                              <span
                                className={`font-mono tabular-nums ${zelle.guenstigster ? "font-semibold" : ""}`}
                              >
                                {formatEuro(zelle.wert)}
                              </span>
                              {zelle.guenstigster && (
                                <span className="sr-only">— niedrigster Wert dieser Zeile</span>
                              )}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/70">keine Angabe</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr>
                    <th scope="row" className={CELL_LABEL}>
                      Kennzeichnung
                    </th>
                    {spalten.map(({ s }, i) => {
                      const row = fokusZeilen[i];
                      return (
                        <td key={s.id} className={CELL_SCHULE}>
                          {row ? <DataBadge status={row.status} stand={row.stand} /> : <Leer />}
                        </td>
                      );
                    })}
                  </tr>
                </>
              ) : (
                <tr>
                  <td colSpan={n + 1} className="border-b border-border/70 px-0 py-0">
                    <span className="sticky left-0 inline-block max-w-[100vw] px-3 py-3 text-sm text-muted-foreground">
                      Für diese Fahrschulen liegen uns noch keine Bestandteile des Preisaushangs
                      vor — wir schätzen grundsätzlich nicht.
                    </span>
                  </td>
                </tr>
              )}
              <tr>
                <td colSpan={n + 1} className="border-b border-border/70 px-0 py-0">
                  <span className="sticky left-0 inline-block max-w-[100vw] px-3 py-2 font-mono text-[11px] text-muted-foreground">
                    Alle Angaben zzgl. amtlicher Prüfgebühren (TÜV/DEKRA).
                  </span>
                </td>
              </tr>
            </tbody>

            {/* (c) Ausstattung: Klassen, Sprachen, ehrliche Highlights */}
            <tbody>
              <GruppenKopf spalten={n}>Ausstattung</GruppenKopf>
              <tr>
                <th scope="row" className={CELL_LABEL}>
                  Führerscheinklassen
                </th>
                {spalten.map(({ s }) => (
                  <td key={s.id} className={CELL_SCHULE}>
                    {s.klassen.length > 0 ? (
                      <span className="flex flex-wrap gap-1">
                        {s.klassen.slice(0, 8).map((k) => (
                          <span
                            key={k}
                            className="rounded-[3px] border border-border px-1.5 py-0.5 font-mono text-[11px] text-foreground/80"
                          >
                            {k}
                          </span>
                        ))}
                        {s.klassen.length > 8 && (
                          <span className="px-1 py-0.5 font-mono text-[11px] text-muted-foreground">
                            +{s.klassen.length - 8}
                          </span>
                        )}
                      </span>
                    ) : (
                      <Leer />
                    )}
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row" className={CELL_LABEL}>
                  Sprachen
                </th>
                {spalten.map(({ s }) => (
                  <td key={s.id} className={CELL_SCHULE}>
                    {s.sprachen.length > 0 ? (
                      <span className="text-foreground/80">
                        {s.sprachen.map((c) => SPRACHE_LABEL[c] ?? c.toUpperCase()).join(" · ")}
                      </span>
                    ) : (
                      <Leer />
                    )}
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row" className={CELL_LABEL}>
                  Highlights
                </th>
                {spalten.map(({ s, highlights }) => (
                  <td key={s.id} className={CELL_SCHULE}>
                    {highlights.length > 0 ? (
                      <ul className="flex flex-col gap-1.5">
                        {highlights.map((h) => (
                          <li key={h.icon} className="flex items-start gap-1.5 leading-snug">
                            <span
                              aria-hidden="true"
                              className="mt-1.5 size-1 shrink-0 rounded-full bg-primary/60"
                            />
                            {h.text}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <Leer />
                    )}
                  </td>
                ))}
              </tr>
            </tbody>

            {/* (d) CTA-Zeile je Spalte: Funnel (?klasse=) + Anrufen (plain tel:,
                bewusst KEIN neues Tracking — es gibt keine wiederverwendbare
                Beacon-Komponente, der Anruf-Zähler lebt auf der Profilseite). */}
            <tbody>
              <tr>
                <td className={CELL_LABEL} aria-hidden="true" />
                {spalten.map(({ s, tel, anmeldenHref }) => (
                  <td key={s.id} className={`${CELL_SCHULE} border-b-0`}>
                    <span className="flex flex-col items-stretch gap-2">
                      <Link
                        href={anmeldenHref}
                        className="inline-flex min-h-11 items-center justify-center rounded-full bg-accent px-4 text-sm font-semibold text-accent-foreground transition-colors duration-[var(--motion-duration-fast)] ease-[var(--motion-ease)] hover:bg-brand-lime"
                      >
                        {ctaLabel({ isPartner: s.isPartner })}
                      </Link>
                      {tel && (
                        <a
                          href={`tel:${tel}`}
                          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-border px-4 text-sm font-semibold transition-colors duration-[var(--motion-duration-fast)] ease-[var(--motion-ease)] hover:border-primary/50 hover:text-primary"
                        >
                          <PhoneIcon />
                          Anrufen
                        </a>
                      )}
                    </span>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        {/* ---- Teilen-Modul: löst das Eltern-Versprechen der Startseite ein ---- */}
        <section
          aria-label="Diesen Vergleich teilen"
          className="mt-6 rounded-md border border-border bg-background px-4 py-4 sm:px-5"
        >
          <h2 className="text-sm font-semibold tracking-tight">
            Diesen Vergleich teilen — z.&nbsp;B. mit deinen Eltern
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Der Link enthält genau diese Auswahl{fokusKlasse ? ` (Klasse ${fokusKlasse})` : ""} und
            funktioniert auf jedem Gerät.
          </p>
          <div className="mt-3">
            <VergleichTeilen url={teilenUrl} />
          </div>
        </section>

        {/* ---- §-32-Transparenz (wie Suche/Profil) ---- */}
        <p className="mt-6 max-w-3xl font-mono text-[11px] leading-relaxed text-muted-foreground">
          § 32 FahrlG: Preisdarstellung als Komponenten des amtlichen Preisaushangs — kein
          Gesamtpreis, keine Kostenschätzung, kein Gesamturteil. Die Markierung gilt jeweils nur
          für eine einzelne Komponente. Recherchierte Angaben gelten ohne Gewähr, bis die
          Fahrschule sie bestätigt. Amtliche Prüfgebühren (TÜV/DEKRA) fallen zusätzlich als
          Drittgebühren an.
        </p>

        <div className="mt-10 flex flex-col items-center gap-1.5 pb-4 text-center">
          <TrustBadge size="sm" />
          <span className="text-[11px] text-muted-foreground">Wir bleiben an deiner Seite.</span>
        </div>
      </div>
    </div>
  );
}
