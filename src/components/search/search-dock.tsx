"use client";

import { useEffect, useRef, useState } from "react";

/**
 * SearchDock — kompakte Such-Pill im Header-Bereich (Airbnb-Muster).
 * ----------------------------------------------------------------------------
 * Die Client-Insel beobachtet per IntersectionObserver eine unsichtbare
 * Sentinel direkt unter dem Hero-/Suchmodul. Scrollt die Sentinel oben aus dem
 * Viewport, erscheint zentriert im (bestehenden, sticky) Header eine fixe
 * Mini-Pill: Ort-Kurzform + Lupe. Klick scrollt sanft nach oben und fokussiert
 * die ECHTE SearchBar — hier gibt es bewusst KEIN zweites Formular (eine Quelle
 * der Wahrheit) und keinen Layout-Shift (Pill ist `fixed`). Ohne JS existiert
 * die Pill nicht (initialer State: nicht gerendert). Einblendung motion-safe
 * via Klasse `.dock-in` (opacity/translate, globals.css); reduced-motion
 * scrollt hart statt sanft.
 */
export function SearchDock({ ort }: { ort?: string | null }) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => {
      // Nur zeigen, wenn die Sentinel OBEN hinausgescrollt ist (nicht unterhalb des Falzes).
      setShow(!entry.isIntersecting && entry.boundingClientRect.top < 0);
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  function jumpToSearch() {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    document
      .querySelector<HTMLInputElement>('input[role="combobox"]')
      ?.focus({ preventScroll: true });
  }

  const kurz = (ort ?? "").split(",")[0].trim();

  return (
    <>
      {/* Sentinel: unsichtbar, kein Layout-Beitrag — direkt unter Hero/Suchmodul platzieren. */}
      <div ref={sentinelRef} aria-hidden="true" className="h-px w-full" />
      {show && (
        <div className="pointer-events-none fixed inset-x-0 top-2.5 z-50 flex justify-center">
          <button
            type="button"
            onClick={jumpToSearch}
            className="dock-in pointer-events-auto inline-flex min-h-11 max-w-[45vw] items-center gap-2.5 rounded-full border border-border bg-card/95 py-1 pl-4 pr-1.5 text-sm font-medium shadow-elevation-2 backdrop-blur transition-colors duration-[var(--motion-duration-fast)] ease-[var(--motion-ease)] hover:border-brand-sky/60 sm:max-w-xs"
          >
            <span className="truncate">{kurz || "Deine Adresse"}</span>
            <span
              aria-hidden="true"
              className="grid size-8 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2.2" />
                <path d="m20 20-3-3" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
            </span>
            <span className="sr-only">— zur Suche springen</span>
          </button>
        </div>
      )}
    </>
  );
}
