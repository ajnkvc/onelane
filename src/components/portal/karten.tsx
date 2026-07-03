import Link from "next/link";

/**
 * karten.tsx — Karten-Primitiven der Dashboards (OS-P2).
 * ----------------------------------------------------------------------------
 * KONTRAKT (P3 baut auf diesen Slots auf):
 *  - <PanelKarte titel intro? aktion? children> — Rahmen: Hairline + weiche
 *    elevation-1, kompakte Typo (App-Dichte), Kopfzeile mit optionalem Link.
 *  - <Kennzahl label wert hinweis? href?> — große Zahl in tabular-nums.
 *  - <ZeilenListe> / <Zeile> — ruhige Listenzeilen mit Hairline-Trennern.
 *  - <StatusPunkt ton> — kleiner semantischer Punkt (neutral/ok/warnung).
 * Karten sind Server-Komponenten (keine Interaktivität nötig).
 */

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export function PanelKarte({
  titel,
  kicker,
  aktion,
  children,
  className = "",
}: {
  titel: string;
  /** kleiner mono-Kicker über dem Titel (Editorial-Muster der Public-Seiten). */
  kicker?: string;
  aktion?: { href: string; label: string };
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`flex flex-col rounded-2xl border border-border bg-card p-5 shadow-elevation-1 ${className}`}
    >
      <header className="flex items-baseline justify-between gap-3">
        <div>
          {kicker ? (
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              {kicker}
            </p>
          ) : null}
          <h2 className="text-sm font-semibold tracking-tight">{titel}</h2>
        </div>
        {aktion ? (
          <Link
            href={aktion.href}
            className={`shrink-0 rounded-full text-xs font-medium text-primary underline-offset-4 hover:underline ${focusRing}`}
          >
            {aktion.label}
          </Link>
        ) : null}
      </header>
      <div className="mt-3 flex flex-1 flex-col">{children}</div>
    </section>
  );
}

export function Kennzahl({
  label,
  wert,
  hinweis,
  href,
}: {
  label: string;
  wert: number | string;
  hinweis?: string;
  href?: string;
}) {
  const inhalt = (
    <>
      <p className="text-2xl font-semibold tracking-tight tabular-nums">{wert}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
      {hinweis ? <p className="mt-1 text-[11px] text-muted-foreground/80">{hinweis}</p> : null}
    </>
  );
  if (href) {
    return (
      <Link
        href={href}
        className={`block rounded-xl border border-border bg-card p-4 shadow-elevation-1 motion-safe:transition-colors motion-safe:duration-[var(--motion-duration-fast)] hover:border-brand-sky/60 ${focusRing}`}
      >
        {inhalt}
      </Link>
    );
  }
  return <div className="rounded-xl border border-border bg-card p-4 shadow-elevation-1">{inhalt}</div>;
}

export function ZeilenListe({ children }: { children: React.ReactNode }) {
  return <ul className="divide-y divide-border text-sm">{children}</ul>;
}

export function Zeile({
  links,
  rechts,
  sub,
}: {
  links: React.ReactNode;
  rechts?: React.ReactNode;
  sub?: React.ReactNode;
}) {
  return (
    <li className="flex items-center justify-between gap-3 py-2.5 first:pt-1 last:pb-1">
      <div className="min-w-0">
        <div className="truncate font-medium">{links}</div>
        {sub ? <div className="mt-0.5 truncate text-xs text-muted-foreground">{sub}</div> : null}
      </div>
      {rechts ? (
        <div className="shrink-0 text-xs text-muted-foreground tabular-nums">{rechts}</div>
      ) : null}
    </li>
  );
}

export function StatusPunkt({ ton }: { ton: "neutral" | "ok" | "warnung" }) {
  const farbe =
    ton === "ok" ? "bg-success" : ton === "warnung" ? "bg-warning" : "bg-muted-foreground/50";
  return <span aria-hidden="true" className={`inline-block size-2 rounded-full ${farbe}`} />;
}

/** Karten-Zustand, wenn eine Datenquelle fail-soft `null` geliefert hat. */
export function KarteNichtVerfuegbar() {
  return (
    <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
      Gerade nicht verfügbar — bitte lade die Seite gleich noch einmal.
    </p>
  );
}
