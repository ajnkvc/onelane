"use client";

import { useEffect, useRef, useState } from "react";

/**
 * teilen.tsx — „Diesen Vergleich teilen"-Mini-Insel der /vergleich-Seite.
 * ----------------------------------------------------------------------------
 * Löst das Eltern-Versprechen der Startseite ein: die Vergleichs-URL lässt sich
 * mit einem Klick kopieren (navigator.clipboard). PROGRESSIVE ENHANCEMENT:
 * Die absolute URL kommt SSR-seitig als Prop und steht IMMER sichtbar in einem
 * readonly-Input — ohne JS (oder wenn die Clipboard-API fehlt/abgelehnt wird)
 * markiert man sie einfach von Hand; der Fokus selektiert den Inhalt. Der
 * Kopier-Status wird per aria-live angesagt (nicht nur Farbwechsel).
 */

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export function TeilenModul({ url }: { url: string }) {
  const [status, setStatus] = useState<"idle" | "kopiert" | "fehler">("idle");
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
    };
  }, []);

  async function kopieren() {
    try {
      await navigator.clipboard.writeText(url);
      setStatus("kopiert");
    } catch {
      // Fallback: Input selektieren — die URL bleibt so trotzdem 1-Geste-teilbar.
      inputRef.current?.select();
      setStatus("fehler");
    }
    if (timerRef.current != null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setStatus("idle"), 2500);
  }

  return (
    <div className="flex w-full max-w-xl flex-col gap-2">
      <div className="flex items-stretch gap-2">
        <input
          ref={inputRef}
          type="text"
          readOnly
          value={url}
          aria-label="Link zu diesem Vergleich"
          onFocus={(e) => e.currentTarget.select()}
          className={`min-h-11 w-full min-w-0 flex-1 rounded-[4px] border border-input bg-background px-3 font-mono text-xs text-muted-foreground ${focusRing}`}
        />
        <button
          type="button"
          onClick={kopieren}
          className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-border bg-background px-4 text-sm font-semibold transition-colors duration-[var(--motion-duration-fast)] ease-[var(--motion-ease)] hover:border-primary/50 hover:text-primary ${focusRing}`}
        >
          <svg viewBox="0 0 24 24" className="size-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
            <rect x="9" y="9" width="12" height="12" rx="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          {status === "kopiert" ? "Kopiert!" : "Link kopieren"}
        </button>
      </div>
      <p aria-live="polite" className="min-h-4 text-[11px] text-muted-foreground">
        {status === "kopiert" && "Link kopiert — einfach weiterschicken."}
        {status === "fehler" && "Kopieren nicht möglich — markiere den Link einfach von Hand."}
      </p>
    </div>
  );
}
