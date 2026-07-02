"use client";

import { useEffect } from "react";
import { MAX_VERGLEICH, vergleichsHref } from "@/lib/vergleich";
import { useVergleichsMerker } from "@/components/search/vergleich-merker";

/**
 * vergleich-leiste.tsx — sticky Compare-Bar am unteren Rand von /fahrschulen.
 * ----------------------------------------------------------------------------
 * Erscheint als fixe Leiste, sobald ≥ 1 Fahrschule gemerkt ist: gemerkte Namen
 * als entfernbare Chips (horizontal scrollbar statt Umbruch-Springen), Button
 * „Vergleichen (n)" im Action-Teal (bg-accent) — unter 2 Schulen deaktiviert
 * mit sichtbarem Hinweis „wähle mindestens 2" — plus „Alle entfernen".
 *
 * KEIN LAYOUT-SHIFT: Die Leiste ist `fixed` (nimmt keinen Fluss-Platz).
 * KOLLISION MIT DEM MOBILEN KARTEN-TOGGLE: Solange die Leiste sichtbar ist,
 * setzt sie `--vergleich-leiste-h` am <html>-Element; der Karten-Toggle auf
 * /fahrschulen rechnet die Variable in seinen bottom-Abstand ein und rutscht
 * über die Leiste (Fallback 0px → ohne Leiste ändert sich nichts).
 *
 * Einblendung motion-safe via `.leiste-in` (globals.css, nur opacity/transform);
 * bei reduced-motion steht die Leiste statisch. Ohne JS existiert die Leiste
 * nicht (Client-Insel) — /vergleich-URLs funktionieren unabhängig davon (SSR).
 */

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export function VergleichLeiste({ klasse = null }: { klasse?: string | null }) {
  const { liste, entferne, leeren } = useVergleichsMerker();
  const sichtbar = liste.length > 0;

  // Höhe der Leiste als CSS-Variable publizieren (Karten-Toggle-Kollision).
  useEffect(() => {
    const root = document.documentElement;
    if (sichtbar) root.style.setProperty("--vergleich-leiste-h", "5.25rem");
    else root.style.removeProperty("--vergleich-leiste-h");
    return () => {
      // Block-Body statt Kurzform: removeProperty gibt einen String zurück,
      // der Effect-Destructor muss aber void liefern.
      root.style.removeProperty("--vergleich-leiste-h");
    };
  }, [sichtbar]);

  if (!sichtbar) return null;

  const genug = liste.length >= 2;
  const href = vergleichsHref(
    liste.map((e) => ({ stadt: e.stadtSlug, slug: e.slug })),
    klasse,
  );

  return (
    <div className="leiste-in fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] shadow-elevation-3 supports-[backdrop-filter]:bg-background/90 supports-[backdrop-filter]:backdrop-blur">
      <div className="mx-auto flex w-full max-w-[90rem] items-center gap-3 px-4 py-3 sm:px-6">
        {/* Chips: horizontal scrollbar, damit die Leiste einzeilig + ruhig bleibt */}
        <ul className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto" aria-label="Für den Vergleich gemerkte Fahrschulen">
          {liste.map((e) => (
            <li key={`${e.stadtSlug}/${e.slug}`} className="shrink-0">
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary/60 py-1 pl-3 pr-1 text-sm font-medium">
                <span className="max-w-40 truncate">{e.name}</span>
                <button
                  type="button"
                  onClick={() => entferne(e.stadtSlug, e.slug)}
                  aria-label={`${e.name} aus dem Vergleich entfernen`}
                  className={`grid size-7 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors duration-[var(--motion-duration-fast)] ease-[var(--motion-ease)] hover:bg-foreground/10 hover:text-foreground ${focusRing}`}
                >
                  <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" focusable="false">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </span>
            </li>
          ))}
        </ul>

        <div className="flex shrink-0 flex-col items-end gap-1">
          {genug ? (
            <a
              href={href}
              className={`inline-flex min-h-11 items-center rounded-full bg-accent px-5 text-sm font-semibold text-accent-foreground transition-colors duration-[var(--motion-duration-fast)] ease-[var(--motion-ease)] hover:bg-brand-lime ${focusRing}`}
            >
              Vergleichen ({liste.length})
            </a>
          ) : (
            <>
              <button
                type="button"
                disabled
                aria-disabled="true"
                className="inline-flex min-h-11 cursor-not-allowed items-center rounded-full bg-accent/45 px-5 text-sm font-semibold text-accent-foreground/70"
              >
                Vergleichen ({liste.length})
              </button>
              <span className="text-[11px] text-muted-foreground">wähle mindestens 2</span>
            </>
          )}
          <button
            type="button"
            onClick={leeren}
            className={`rounded-[3px] text-[11px] text-muted-foreground underline-offset-2 hover:underline ${focusRing}`}
          >
            Alle entfernen
          </button>
        </div>
      </div>
      <p className="sr-only" aria-live="polite">
        {liste.length} von {MAX_VERGLEICH} Fahrschulen im Vergleich gemerkt
      </p>
    </div>
  );
}
