"use client";

import { useEffect, useRef, useState } from "react";

/**
 * vergleich-teilen.tsx — „Diesen Vergleich teilen“-Modul der /vergleich-Seite.
 * ----------------------------------------------------------------------------
 * PROGRESSIVE ENHANCEMENT: Die URL steht IMMER sichtbar in einem readonly-Input
 * (SSR-gerendert) — ohne JS markieren + kopieren per Systemgeste. Der
 * Kopier-Button ist die Client-Veredelung (navigator.clipboard); schlägt die
 * Clipboard-API fehl (Berechtigung/älterer Browser), selektiert er als
 * Fallback den Input-Inhalt. Erfolgsmeldung zusätzlich als aria-live-Region
 * (Zustand nie nur visuell). KEIN Tracking, keine Share-SDKs — nur die URL.
 */

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export function VergleichTeilen({ url }: { url: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<number | null>(null);
  const [kopiert, setKopiert] = useState(false);

  useEffect(() => {
    return () => {
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
    };
  }, []);

  const kopieren = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setKopiert(true);
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setKopiert(false), 2500);
    } catch {
      // Fallback: Inhalt markieren — Kopieren dann per Systemgeste.
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  };

  return (
    <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
      <input
        ref={inputRef}
        readOnly
        value={url}
        onFocus={(e) => e.currentTarget.select()}
        aria-label="Link zu diesem Vergleich"
        className="min-h-11 w-full min-w-0 flex-1 rounded-[4px] border border-input bg-background px-3 font-mono text-xs text-muted-foreground outline-none focus:border-ring"
      />
      <button
        type="button"
        onClick={kopieren}
        className={`inline-flex min-h-11 shrink-0 items-center justify-center rounded-full border px-5 text-sm font-semibold transition-colors duration-[var(--motion-duration-fast)] ease-[var(--motion-ease)] ${
          kopiert
            ? "border-primary/50 bg-primary/10 text-primary"
            : "border-border bg-background hover:border-primary/50 hover:text-primary"
        } ${focusRing}`}
      >
        {kopiert ? "Link kopiert" : "Link kopieren"}
      </button>
      <span className="sr-only" aria-live="polite">
        {kopiert ? "Link in die Zwischenablage kopiert" : ""}
      </span>
    </div>
  );
}
