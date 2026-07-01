"use client";

import { useEffect, useRef, useState } from "react";
import { SearchBar } from "@/components/search/search-bar";

/**
 * StickySearch — persistente Suche, die beim HOCHscrollen erscheint
 * (show-on-scroll-up) und beim Runterscrollen ausblendet. Erscheint erst, wenn
 * die Hero-Suche aus dem Viewport ist.
 *
 * Bewusste, UX-saubere Umsetzung der „schwebenden Suchleiste"-Idee
 * (Marktanalyse-Fundament 2026): KEINE dauerhafte Schwebe-/Pulsanimation
 * (Banner-Blindness), sondern dezentes Einblenden bei aktiver Suchabsicht.
 * reduced-motion-sicher; `invisible` im Ruhezustand → nicht fokussierbar/kein Tab-Stop.
 */
export function StickySearch() {
  const [show, setShow] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    lastY.current = window.scrollY;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        const goingUp = y < lastY.current - 4;
        const goingDown = y > lastY.current + 4;
        const pastHero = y > 520; // Hero-Suche ist hier aus dem Viewport
        if (!pastHero) setShow(false);
        else if (goingUp) setShow(true);
        else if (goingDown) setShow(false);
        lastY.current = y;
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      aria-hidden={!show}
      className={`fixed inset-x-0 top-16 z-40 border-b border-border bg-background/90 shadow-sm backdrop-blur transition-all duration-300 motion-reduce:transition-none ${
        show ? "visible translate-y-0 opacity-100" : "invisible pointer-events-none -translate-y-[120%] opacity-0"
      }`}
    >
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-6 py-3">
        <span className="hidden shrink-0 text-sm font-semibold text-[#1b3a5c] sm:block">Fahrschule finden:</span>
        <div className="min-w-0 flex-1">
          <SearchBar compact />
        </div>
      </div>
    </div>
  );
}
