"use client";

import { useEffect } from "react";

/**
 * RevealOnScroll — „Apple-Stil"-Einblenden beim Scrollen, FAIL-SAFE.
 * Setzt `reveal-on` an <html> (aktiviert den versteckten Startzustand der
 * `.reveal`/`.reveal-stagger`-Elemente in globals.css) und fügt `.in` hinzu,
 * sobald ein Element in den Viewport scrollt. Die Animation ist nur Zugabe:
 * Inhalt bleibt IMMER sichtbar — bei reduced-motion, fehlendem
 * IntersectionObserver oder verpasstem Auslösen wird garantiert alles
 * eingeblendet (Sicherheitsnetz), damit nie eine Sektion leer/„versetzt" bleibt.
 */
export function RevealOnScroll() {
  useEffect(() => {
    const root = document.documentElement;
    const els = Array.from(document.querySelectorAll<HTMLElement>(".reveal, .reveal-stagger"));
    const revealAll = () => els.forEach((el) => el.classList.add("in"));

    // Kein Motion gewünscht oder kein Observer verfügbar → sofort alles zeigen.
    if (
      typeof IntersectionObserver === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      revealAll();
      return;
    }

    root.classList.add("reveal-on");

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        }
      },
      // großzügig: schon beim ersten Pixel im Viewport auslösen.
      { threshold: 0, rootMargin: "0px 0px -5% 0px" },
    );
    els.forEach((el) => io.observe(el));

    // Sicherheitsnetz: was nach 1,6 s noch nicht eingeblendet ist (verpasstes
    // Auslösen, zu hohe Sektion, Tab im Hintergrund …), wird garantiert gezeigt.
    const safety = window.setTimeout(revealAll, 1600);
    // Extra-Netz: spätestens beim vollständigen Laden alles sichtbar.
    window.addEventListener("load", revealAll, { once: true });

    return () => {
      io.disconnect();
      window.clearTimeout(safety);
      window.removeEventListener("load", revealAll);
      root.classList.remove("reveal-on");
    };
  }, []);

  return null;
}
