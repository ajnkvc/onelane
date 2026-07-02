import { DataBadge } from "@/components/school/data-badge";
import { TelLink } from "@/components/school/tel-link";
import { TrustBadge } from "@/components/trust/trust-badge";
import { hatPflichtangabenSet, formatEuro, type SchoolPriceRow } from "@/lib/preise";
import { ctaLabel } from "@/lib/cta";

/**
 * anmelde-aktionen.tsx — die IMMER sichtbaren Dual-CTAs des Profils.
 * ----------------------------------------------------------------------------
 * Desktop: sticky Anmelde-Rail rechts mit ehrlichem Preis-Anker-DUO
 * (Grundbetrag + Fahrstunde — NIE ein Gesamtpreis) inkl. §32-GATING: das Duo
 * erscheint NUR, wenn eine Klasse das vollständige Pflichtangaben-Set hat;
 * sonst neutraler „Preisaushang unvollständig / keine Preisangabe"-Hinweis mit
 * Provenienz-Badge. Der Preis-Anker folgt der FOKUS-Klasse der Seite
 * (?klasse= aus der Suche → sonst B → sonst erste), fällt aber auf jede
 * vollständige Klasse zurück. Darunter Klassen-Auswahl als GET-Formular
 * (funktioniert ohne JS) → CTA in den Funnel (Label zentral via lib/cta.ts),
 * plus „Anrufen" (tel:). Mobil: Sticky-Bottom-Action-Bar (Touch ≥48 px).
 * KEINE E-Mail-Adresse der Schule — Kontakt läuft über Formular + Telefon.
 */

export function PhoneIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`shrink-0 ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

const TINT_ZONE = "bg-[color-mix(in_oklab,var(--brand-sky)_5%,var(--background))]";

export function AnmeldeRail({
  klassen,
  telefon,
  anmeldenHref,
  priceRows,
  isPartner = false,
  fokusKlasse = null,
  slug,
  ort = null,
}: {
  klassen: string[];
  telefon: string | null;
  anmeldenHref: string;
  priceRows: SchoolPriceRow[];
  isPartner?: boolean;
  /** Fokus-Klasse der Seite (?klasse= → B → erste) — steuert Anker + Vorauswahl. */
  fokusKlasse?: string | null;
  /** Schul-Slug für den aggregierten Tel-Klick-Zähler (tel-link.tsx). */
  slug: string;
  /** Ort der Schule — disambiguiert Slug-Kollisionen im Zähler. */
  ort?: string | null;
}) {
  const tel = telefon?.replace(/\s+/g, "") ?? null;
  // §32-Gating: herausgestellt wird NUR eine Klasse mit vollständigem Pflicht-Set —
  // bevorzugt die Fokus-Klasse, sonst die erste vollständige.
  const fokusRow = fokusKlasse
    ? (priceRows.find((r) => r.klasse.toUpperCase() === fokusKlasse.toUpperCase()) ?? null)
    : null;
  const anker =
    (fokusRow && hatPflichtangabenSet(fokusRow) ? fokusRow : null) ??
    priceRows.find((r) => hatPflichtangabenSet(r)) ??
    null;
  const hinweisRow = anker ?? fokusRow ?? priceRows[0] ?? null;
  const vorauswahl =
    fokusKlasse && klassen.includes(fokusKlasse) ? fokusKlasse : (klassen[0] ?? "B");

  return (
    <div className="rounded-md border border-border bg-background shadow-elevation-1">
      <div className={`border-b border-border px-5 py-4 ${TINT_ZONE}`}>
        <h2 className="text-base font-bold tracking-tight">Anmeldung</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          unverbindlich · kostenlos · Antwort direkt von der Fahrschule
        </p>
      </div>

      {anker ? (
        <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 border-b border-border px-5 py-4 text-sm">
          <dt className="text-muted-foreground">Grundbetrag (Klasse {anker.klasse})</dt>
          <dd className="text-right font-mono tabular-nums">
            {anker.komponenten.grundbetrag != null ? formatEuro(anker.komponenten.grundbetrag) : "keine Angabe"}
          </dd>
          <dt className="text-muted-foreground">Fahrstunde (45 Min.)</dt>
          <dd className="text-right font-mono tabular-nums">
            {anker.komponenten.fahrstunde45 != null ? formatEuro(anker.komponenten.fahrstunde45) : "keine Angabe"}
          </dd>
          <dd className="col-span-2 mt-1.5 justify-self-start">
            <DataBadge status={anker.status} stand={anker.stand} />
          </dd>
        </dl>
      ) : (
        <div className="border-b border-border px-5 py-4">
          <p className="text-sm text-muted-foreground">
            {priceRows.length > 0
              ? "Preisaushang unvollständig — wir stellen keine einzelnen Bestandteile heraus."
              : "Keine Preisangabe — den Aushang gibt es direkt bei der Fahrschule."}
          </p>
          {hinweisRow && (
            <p className="mt-2">
              <DataBadge status={hinweisRow.status} stand={hinweisRow.stand} />
            </p>
          )}
        </div>
      )}

      {/* GET-Formular: Klassen-Wahl reist als ?klasse= in den Funnel (kein JS nötig) */}
      <form action={anmeldenHref} method="get" className="flex flex-col gap-3 px-5 py-4">
        <div>
          <label
            htmlFor="rail-klasse"
            className="mb-1 block font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground"
          >
            Führerscheinklasse
          </label>
          <select
            id="rail-klasse"
            name="klasse"
            defaultValue={vorauswahl}
            className="min-h-11 w-full rounded-[4px] border border-input bg-background px-3 text-sm outline-none focus:border-ring"
          >
            {(klassen.length > 0 ? klassen : ["B"]).map((k) => (
              <option key={k} value={k}>
                Klasse {k}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="inline-flex min-h-12 items-center justify-center rounded-full bg-accent px-4 text-sm font-semibold text-accent-foreground transition-colors duration-[var(--motion-duration-fast)] ease-[var(--motion-ease)] hover:bg-brand-lime"
        >
          {ctaLabel({ isPartner })}
        </button>
        {tel && (
          <TelLink
            slug={slug}
            ort={ort}
            href={`tel:${tel}`}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-border px-4 text-sm font-semibold transition-colors duration-[var(--motion-duration-fast)] ease-[var(--motion-ease)] hover:border-primary/50 hover:text-primary"
          >
            <PhoneIcon />
            Anrufen · {telefon}
          </TelLink>
        )}
        {/* trust zentriert + Claim zentriert darunter (Gründer 2026-07-02) */}
        <div className="mt-1 flex flex-col items-center gap-1.5 text-center">
          <TrustBadge size="sm" />
          <span className="text-[11px] text-muted-foreground">Wir fassen für dich nach.</span>
        </div>
      </form>
    </div>
  );
}

export function MobileActionBar({
  telefon,
  anmeldenHref,
  isPartner = false,
  slug,
  ort = null,
}: {
  telefon: string | null;
  anmeldenHref: string;
  isPartner?: boolean;
  /** Schul-Slug für den aggregierten Tel-Klick-Zähler (tel-link.tsx). */
  slug: string;
  /** Ort der Schule — disambiguiert Slug-Kollisionen im Zähler. */
  ort?: string | null;
}) {
  const tel = telefon?.replace(/\s+/g, "") ?? null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background pb-[env(safe-area-inset-bottom)] shadow-elevation-3 lg:hidden">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-2 px-4 py-2.5">
        <span className="hidden sm:block">
          <TrustBadge size="sm" />
        </span>
        {tel && (
          <TelLink
            slug={slug}
            ort={ort}
            href={`tel:${tel}`}
            className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full border border-border px-3 text-sm font-semibold transition-colors duration-[var(--motion-duration-fast)] ease-[var(--motion-ease)] active:bg-secondary"
          >
            <PhoneIcon />
            Anrufen
          </TelLink>
        )}
        <a
          href={anmeldenHref}
          className="inline-flex min-h-12 flex-[1.4] items-center justify-center rounded-full bg-accent px-3 text-sm font-semibold text-accent-foreground transition-colors duration-[var(--motion-duration-fast)] ease-[var(--motion-ease)] active:bg-brand-lime"
        >
          {ctaLabel({ isPartner })}
        </a>
      </div>
    </div>
  );
}
