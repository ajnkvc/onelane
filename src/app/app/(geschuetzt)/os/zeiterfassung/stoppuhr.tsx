"use client";

import { useEffect, useState } from "react";

/**
 * stoppuhr.tsx — kleine Client-Insel der Zeiterfassung (OS-P3 Paket B):
 * tickende Anzeige der laufenden Zeit. Bis zur Hydration (und ohne JS) steht
 * der SERVER-berechnete Fallback-Text — deterministisch, kein Hydration-Drift.
 * Bewusst ohne Imports aus modules/** (server-only-Grenze).
 */
export function Stoppuhr({
  startEpochMs,
  fallback,
}: {
  /** Startzeitpunkt (Epoch ms, aus der DB — nicht aus dem Client). */
  startEpochMs: number;
  /** Server-gerenderter Text, z. B. „2 Std. 5 Min." (steht auch ohne JS). */
  fallback: string;
}) {
  const [jetzt, setJetzt] = useState<number | null>(null);

  useEffect(() => {
    // Nur ABONNIEREN (kein setState im Effect-Körper): bis zum ersten Tick
    // (≤ 1 s) steht der Server-Fallback — danach tickt die Uhr sekündlich.
    const timer = setInterval(() => setJetzt(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (jetzt === null) {
    return <span className="tabular-nums">{fallback}</span>;
  }

  const sekunden = Math.max(0, Math.floor((jetzt - startEpochMs) / 1000));
  const h = Math.floor(sekunden / 3600);
  const m = Math.floor((sekunden % 3600) / 60);
  const s = sekunden % 60;
  const zwei = (n: number) => String(n).padStart(2, "0");

  return (
    <span className="tabular-nums" aria-live="off">
      {h}:{zwei(m)}:{zwei(s)} Std.
    </span>
  );
}
