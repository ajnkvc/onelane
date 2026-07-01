"use client";

import { useEffect, useState } from "react";

/**
 * Typewriter — tippt ein Wort Zeichen für Zeichen, löscht es wieder und tippt das
 * nächste (Slogan-Effekt, vgl. moderne Landingpages). Kleine Client-Insel.
 * A11y: der animierte Text ist `aria-hidden`; die vollständige Wortliste steht als
 * `sr-only` für Screenreader. Bei `prefers-reduced-motion` wird NICHT getippt,
 * sondern das erste Wort statisch gezeigt.
 */
export function Typewriter({ words, className = "" }: { words: string[]; className?: string }) {
  const [display, setDisplay] = useState(words[0] ?? "");

  useEffect(() => {
    if (typeof window === "undefined" || words.length === 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return; // erstes Wort bleibt statisch (Initialwert von useState)
    }
    let wi = 0;
    let ci = words[0].length;
    let deleting = true;
    let timer: ReturnType<typeof setTimeout>;

    const tick = () => {
      const w = words[wi];
      if (!deleting) {
        ci++;
        setDisplay(w.slice(0, ci));
        if (ci >= w.length) {
          deleting = true;
          timer = setTimeout(tick, 1500);
          return;
        }
        timer = setTimeout(tick, 85);
      } else {
        ci--;
        setDisplay(w.slice(0, Math.max(0, ci)));
        if (ci <= 0) {
          deleting = false;
          wi = (wi + 1) % words.length;
          timer = setTimeout(tick, 260);
          return;
        }
        timer = setTimeout(tick, 42);
      }
    };

    timer = setTimeout(tick, 1500);
    return () => clearTimeout(timer);
  }, [words]);

  return (
    <span className={className}>
      <span aria-hidden="true">{display}</span>
      <span aria-hidden="true" className="tw-caret" />
      <span className="sr-only">{words.join(", ")}</span>
    </span>
  );
}
