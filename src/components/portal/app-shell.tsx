import Link from "next/link";
import type { PortalIdentity } from "@/modules/portal/identity";
import type { PortalNavigation } from "@/modules/portal/navigation";
import { aktiveSchuleSetzen } from "@/modules/portal/shell-actions";
import { abmelden, themeSetzen } from "@/modules/portal/actions";
import type { Theme } from "@/lib/theme";
import { begruessung, datumZeile } from "@/lib/begruessung";
import { Wordmark } from "@/components/ui/wordmark";
import { NavListe } from "./nav-liste";
import { ThemeIcon } from "./icons";

/**
 * app-shell.tsx — die App-Shell des Portals (OS-P2): Sidebar + Topbar + Inhalt.
 * ============================================================================
 * KONTRAKT (P3 konsumiert die Shell NUR über das (geschuetzt)/layout — Slots):
 *   <AppShell identity navigation theme greetingName>{children}</AppShell>
 *  - navigation: fertiges Modell aus bauePortalNavigation (Server!).
 *  - theme: aktuelle Cookie-Wahl ('light'|'dark'|null=System) für aria-pressed.
 *  - Sidebar: Wortmarke + Produkt-Badge (trust-Badge-Optik), Schul-Switcher
 *    (Server Action, validiertes httpOnly-Cookie), rollenbasierte Sektionen.
 *  - Mobile: Off-Canvas ohne JS (Checkbox-Mechanik, ESC-los aber vollständig
 *    bedienbar: Öffnen/Schließen über <label>-Buttons + Overlay-Label).
 *  - Topbar: zeitabhängige Begrüßung (Europe/Berlin), Datum (de-DE),
 *    Theme-Toggle (P1-Action themeSetzen, aria-pressed), Abmelden.
 * KEINE Sicherheitsgrenze: Gates liegen im Layout + je Fach-Action/-Route.
 */

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/** Produkt-Badge neben der Wortmarke — Wortbild-Optik analog TrustBadge. */
function ProduktBadge({ label }: { label: string }) {
  return (
    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold lowercase tracking-tight text-primary">
      {label}
    </span>
  );
}

/** Schul-Kontext oben in der Sidebar: eine Schule (ruhig) oder Switcher. */
function SchulKontext({ identity }: { identity: PortalIdentity }) {
  const { memberships, aktiveSchule } = identity;
  if (!aktiveSchule) return null;

  if (memberships.length <= 1) {
    return (
      <div className="rounded-xl border border-sidebar-border bg-sidebar-accent/10 px-3 py-2.5">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          deine Fahrschule
        </p>
        <p className="mt-0.5 truncate text-sm font-medium" title={aktiveSchule.schoolName}>
          {aktiveSchule.schoolName}
        </p>
      </div>
    );
  }

  return (
    <details className="group relative rounded-xl border border-sidebar-border bg-sidebar-accent/10">
      <summary
        className={`flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 [&::-webkit-details-marker]:hidden ${focusRing} rounded-xl`}
      >
        <span className="min-w-0">
          <span className="block font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            aktive Schule
          </span>
          <span className="block truncate text-sm font-medium">{aktiveSchule.schoolName}</span>
        </span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          aria-hidden="true"
          className="size-4 shrink-0 text-muted-foreground motion-safe:transition-transform group-open:rotate-180"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </summary>
      <div className="border-t border-sidebar-border p-1.5">
        {memberships.map((m) => (
          <form key={m.schoolId} action={aktiveSchuleSetzen}>
            <input type="hidden" name="schoolId" value={m.schoolId} />
            <button
              type="submit"
              aria-current={m.schoolId === aktiveSchule.schoolId ? "true" : undefined}
              className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-sidebar-accent/20 ${focusRing} ${
                m.schoolId === aktiveSchule.schoolId ? "font-medium text-sidebar-primary" : ""
              }`}
            >
              <span className="min-w-0 truncate">{m.schoolName}</span>
              <span className="shrink-0 text-[10px] text-muted-foreground">{m.rolle}</span>
            </button>
          </form>
        ))}
      </div>
    </details>
  );
}

/** Theme-Toggle: drei Zustände (Hell/Dunkel/System) über die P1-Action. */
function ThemeToggle({ theme }: { theme: Theme | null }) {
  const knopf = (
    wert: "light" | "dark" | "system",
    label: string,
    icon: "sonne" | "mond" | "auto",
    aktiv: boolean,
  ) => (
    <button
      type="submit"
      name="theme"
      value={wert}
      aria-pressed={aktiv}
      aria-label={label}
      title={label}
      className={`inline-flex size-8 items-center justify-center rounded-full motion-safe:transition-colors motion-safe:duration-[var(--motion-duration-fast)] ${focusRing} ${
        aktiv ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
      }`}
    >
      <ThemeIcon variante={icon} />
    </button>
  );
  return (
    <form
      action={themeSetzen}
      className="flex items-center gap-0.5 rounded-full border border-border bg-card p-0.5 shadow-elevation-1"
    >
      {knopf("light", "Helles Design", "sonne", theme === "light")}
      {knopf("dark", "Dunkles Design", "mond", theme === "dark")}
      {knopf("system", "System-Design", "auto", theme === null)}
    </form>
  );
}

export function AppShell({
  identity,
  navigation,
  theme,
  children,
}: {
  identity: PortalIdentity;
  navigation: PortalNavigation;
  /** aktuelle Cookie-Wahl; null = System. */
  theme: Theme | null;
  children: React.ReactNode;
}) {
  const jetzt = new Date();
  const vorname = identity.anzeigeName.split(" ")[0] || identity.anzeigeName;

  const sidebarInhalt = (
    <div className="flex h-full flex-col gap-5 p-4">
      <div className="flex items-center justify-between gap-2 px-1">
        <Link href="/app" className={`inline-flex items-center gap-2 rounded-md ${focusRing}`}>
          <Wordmark className="text-lg" />
          {navigation.produktBadge ? <ProduktBadge label={navigation.produktBadge} /> : null}
        </Link>
        {/* Schließen (nur mobil sichtbar) */}
        <label
          htmlFor="portal-nav-toggle"
          aria-label="Navigation schließen"
          className={`inline-flex size-8 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-muted lg:hidden ${focusRing}`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true" className="size-4">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </label>
      </div>

      <SchulKontext identity={identity} />
      <NavListe sektionen={navigation.sektionen} />

      <div className="border-t border-sidebar-border pt-3">
        <p className="truncate px-1 text-xs text-muted-foreground" title={identity.anzeigeName}>
          angemeldet als <span className="font-medium text-foreground">{identity.anzeigeName}</span>
        </p>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-full flex-1 text-sm">
      {/* Off-Canvas-Mechanik (CSS-only): Checkbox steuert Sidebar + Overlay. */}
      <input type="checkbox" id="portal-nav-toggle" className="peer sr-only" aria-hidden="true" />

      {/* Overlay (mobil, schließt per Klick) */}
      <label
        htmlFor="portal-nav-toggle"
        aria-hidden="true"
        className="invisible fixed inset-0 z-30 bg-brand-ink/30 opacity-0 motion-safe:transition-opacity peer-checked:visible peer-checked:opacity-100 lg:hidden"
      />

      {/* Sidebar: mobil off-canvas, ab lg fest */}
      <aside
        className="fixed inset-y-0 left-0 z-40 w-72 -translate-x-full border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-elevation-2 motion-safe:transition-transform motion-safe:duration-[var(--motion-duration-base)] motion-safe:ease-[var(--motion-ease)] peer-checked:translate-x-0 lg:static lg:z-auto lg:w-64 lg:translate-x-0 lg:shadow-none"
      >
        {sidebarInhalt}
      </aside>

      {/* Hauptbereich */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            {/* Öffnen (nur mobil) */}
            <label
              htmlFor="portal-nav-toggle"
              aria-label="Navigation öffnen"
              className={`inline-flex size-9 cursor-pointer items-center justify-center rounded-lg border border-border bg-card text-foreground shadow-elevation-1 lg:hidden ${focusRing}`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true" className="size-4.5">
                <path d="M4.5 7h15M4.5 12h15M4.5 17h15" />
              </svg>
            </label>
            <div className="min-w-0">
              <p className="truncate font-medium tracking-tight">
                {begruessung(jetzt)}, {vorname}.
              </p>
              <p className="text-xs text-muted-foreground">{datumZeile(jetzt)}</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <ThemeToggle theme={theme} />
            <form action={abmelden}>
              <button
                type="submit"
                className={`min-h-9 rounded-full border border-border bg-card px-4 text-sm font-medium shadow-elevation-1 motion-safe:transition-colors motion-safe:duration-[var(--motion-duration-fast)] hover:border-brand-sky/60 ${focusRing}`}
              >
                Abmelden
              </button>
            </form>
          </div>
        </header>

        <div className="flex flex-1 flex-col px-4 py-6 sm:px-6">{children}</div>
      </div>
    </div>
  );
}
