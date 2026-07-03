import type { Metadata } from "next";
import Link from "next/link";
import { getSiteUrl } from "@/lib/public-config";

/**
 * /os — kompakte Marketingseite der beiden online verfügbaren Abos
 * (Gründer 2026-07-02: „kurz und knapp, nur die 2 Abos").
 * ----------------------------------------------------------------------------
 * GENAU ZWEI Angebote: onelane start (kostenlos) und onelane os (Betriebs-
 * system, 99 € netto/Monat je Fahrschule — Einführungs-Aktion die ersten
 * 3 Monate 49 € — zzgl. 29 € netto je Fahrlehrer:in). WEITERE interne
 * Produkte werden hier NIEMALS erwähnt oder angedeutet — kein dritter Tier,
 * kein „mehr auf Anfrage"-Teaser. onelane os ist ehrlich als „in Vorbereitung
 * — Frühzugang" gekennzeichnet (nichts versprechen, was nicht live ist).
 * B2B-Seite → Sie-Form (wie /fuer-fahrschulen). Marke immer klein „onelane".
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "onelane os — das Betriebssystem für Ihre Fahrschule",
  description:
    "Zwei Abos, ein Ziel: weniger Verwaltung, mehr Fahrschule. onelane start ist dauerhaft kostenlos — onelane os übernimmt Ihren Betrieb: Schüler, Kalender, Anfragen, Rechnungen, Team.",
  alternates: { canonical: `${getSiteUrl().replace(/\/+$/, "")}/os` },
};

const FOKUS_RING =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

const START_LEISTUNGEN = [
  "Profileintrag im Vergleichsportal beanspruchen und selbst pflegen",
  "Anfragen und Bewerbungen direkt per E-Mail empfangen",
  "Stellenanzeigen kostenfrei in der Jobbörse schalten",
  "Preisaushang bestätigen — sichtbares Bestätigt-Zeichen im Portal",
];

const OS_LEISTUNGEN = [
  "Alles aus onelane start",
  "Cockpit mit Betriebsübersicht — Anfragen, Termine, Zahlen auf einen Blick",
  "Schülerverwaltung mit Ausbildungsfortschritt",
  "Kalender je Fahrlehrer:in — Fahrstunden, Theorie, Prüfungen",
  "Anfragen- und Bewerbungsverwaltung im Portal statt im Posteingang",
  "Rechnungen und offene Posten im Blick",
  "Team, Rollen und Zeiterfassung",
];

export default function OsMarketingPage() {
  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-14 sm:py-20">
      {/* Kopf — kurz und selbstbewusst */}
      <header className="mx-auto max-w-3xl text-center">
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
          onelane · für Fahrschulen
        </p>
        <h1 className="mt-6 text-4xl font-light tracking-tight text-balance sm:text-6xl">
          Weniger Verwaltung. <span className="font-semibold">Mehr Fahrschule.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl leading-relaxed text-muted-foreground">
          Zwei Abos, klare Sache: kostenlos sichtbar werden — oder den ganzen Betrieb mit
          onelane os führen.
        </p>
      </header>

      {/* Die zwei Abos — NUR diese zwei */}
      <div className="mt-14 grid items-start gap-6 lg:grid-cols-2">
        {/* onelane start */}
        <section
          aria-labelledby="start-heading"
          className="flex flex-col rounded-3xl border border-border bg-card p-8 shadow-elevation-1 sm:p-10"
        >
          <h2 id="start-heading" className="text-2xl font-extrabold tracking-tight">
            onelane <span className="text-brand-sky">start</span>
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Sichtbar im Vergleichsportal — dauerhaft kostenlos.</p>
          <p className="mt-6 text-4xl font-light tracking-tight">
            0 €<span className="ml-2 text-sm font-normal text-muted-foreground">für immer</span>
          </p>
          <ul className="mt-8 flex-1 space-y-3 text-sm leading-relaxed">
            {START_LEISTUNGEN.map((l) => (
              <li key={l} className="flex items-start gap-2.5">
                <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-brand-sky" />
                {l}
              </li>
            ))}
          </ul>
          <Link
            href="/fuer-fahrschulen"
            className={`mt-10 inline-flex min-h-12 items-center justify-center rounded-full border border-primary/40 px-6 text-sm font-semibold text-primary transition-colors duration-[var(--motion-duration-fast)] ease-[var(--motion-ease)] hover:border-primary/70 hover:bg-primary/5 ${FOKUS_RING}`}
          >
            Eintrag kostenlos beanspruchen
          </Link>
        </section>

        {/* onelane os — hervorgehoben (dunkles Panel) */}
        <section
          aria-labelledby="os-heading"
          className="flex flex-col rounded-3xl bg-foreground p-8 text-background shadow-elevation-2 sm:p-10"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 id="os-heading" className="text-2xl font-extrabold tracking-tight">
              onelane <span className="text-accent">os</span>
            </h2>
            {/* Ehrlichkeits-Chip: noch nicht live — kein falsches Versprechen */}
            <span className="rounded-full border border-accent/40 px-3 py-1 text-xs font-medium text-accent">
              in Vorbereitung · Frühzugang
            </span>
          </div>
          <p className="mt-1 text-sm text-background/70">Das Betriebssystem für Ihre Fahrschule.</p>
          <p className="mt-6 text-4xl font-light tracking-tight">
            99 €<span className="ml-2 text-sm font-normal text-background/70">netto je Fahrschule/Monat</span>
          </p>
          <p className="mt-1 text-sm text-background/70">
            + 29 € netto je Fahrlehrer:in/Monat · ein Preis für alle Standorte Ihrer Fahrschule
          </p>
          {/* Einführungs-Aktion (2026-07-03): ehrlich als zeitlich begrenzte
              Aktion gekennzeichnet — regulärer Preis bleibt sichtbar (UWG). */}
          <p className="mt-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-accent/15 px-3 py-1.5 text-sm font-semibold text-accent">
              Startaktion: die ersten 3 Monate nur 49 € netto/Monat
            </span>
          </p>
          <ul className="mt-8 flex-1 space-y-3 text-sm leading-relaxed text-background/90">
            {OS_LEISTUNGEN.map((l) => (
              <li key={l} className="flex items-start gap-2.5">
                <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />
                {l}
              </li>
            ))}
          </ul>
          <a
            href="mailto:kontakt@onelane.de?subject=onelane%20os%20%E2%80%94%20Fr%C3%BChzugang"
            className={`mt-10 inline-flex min-h-12 items-center justify-center rounded-full bg-accent px-6 text-sm font-semibold text-accent-foreground transition-colors duration-[var(--motion-duration-fast)] ease-[var(--motion-ease)] hover:bg-brand-lime ${FOKUS_RING}`}
          >
            Frühzugang anfragen
          </a>
        </section>
      </div>

      {/* Fußzeile — knapp, ehrlich */}
      <p className="mt-10 text-center text-xs text-muted-foreground">
        Alle Preise netto zzgl. gesetzlicher Umsatzsteuer. Monatlich kündbar, keine
        Einrichtungsgebühr.
      </p>
    </div>
  );
}
