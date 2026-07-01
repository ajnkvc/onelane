"use client";

import { useState } from "react";

/**
 * CostEstimator — interaktiver Kosten-Schätzer (Slider → Live-Summe).
 * Kleine Client-Insel. Werte sind BEISPIELE/Schätzungen (Grundbetrag wird als
 * Prop übergeben); echte Preise kommen später aus den hinterlegten Schul-Preisen
 * bzw. ab 2027 aus der Mobilithek. Unverbindlich.
 */
const PER_LESSON = 65; // € je Übungsfahrt (Beispiel)
const SPECIAL = 12 * 75; // 12 Pflicht-Sonderfahrten Klasse B (Beispiel)
const FEES = 350; // behördliche Prüfgebühren (Beispiel)

function eur(n: number) {
  return n.toLocaleString("de-DE", { maximumFractionDigits: 0 }) + " €";
}

export function CostEstimator({ basePrice, klasse = "B" }: { basePrice: number; klasse?: string }) {
  const [lessons, setLessons] = useState(20);
  const lessonsCost = lessons * PER_LESSON;
  const total = basePrice + lessonsCost + SPECIAL + FEES;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <h2 className="text-lg font-semibold">Kosten-Schätzer · Klasse {klasse}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Zieh den Regler auf deine geschätzten Übungsfahrten — die Summe rechnet live mit.
      </p>

      <div className="mt-5 flex items-baseline justify-between">
        <span className="text-sm text-muted-foreground">Übungsfahrten</span>
        <span className="text-sm font-semibold">{lessons}</span>
      </div>
      <input
        type="range"
        min={5}
        max={60}
        step={1}
        value={lessons}
        onChange={(e) => setLessons(Number(e.target.value))}
        aria-label="Geschätzte Übungsfahrten"
        className="mt-2 w-full accent-[var(--brand-sky)]"
      />
      <div className="mt-1 flex justify-between text-xs text-muted-foreground">
        <span>5</span>
        <span>Ø 25–35</span>
        <span>60</span>
      </div>

      <dl className="mt-5 space-y-1.5 text-sm">
        <div className="flex justify-between"><dt className="text-muted-foreground">Grundbetrag</dt><dd>{eur(basePrice)}</dd></div>
        <div className="flex justify-between"><dt className="text-muted-foreground">Übungsfahrten ({lessons} × {PER_LESSON} €)</dt><dd>{eur(lessonsCost)}</dd></div>
        <div className="flex justify-between"><dt className="text-muted-foreground">Pflicht-Sonderfahrten</dt><dd>{eur(SPECIAL)}</dd></div>
        <div className="flex justify-between"><dt className="text-muted-foreground">Prüfgebühren (Behörde)</dt><dd>{eur(FEES)}</dd></div>
      </dl>

      <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
        <span className="font-semibold">Geschätzte Gesamtkosten</span>
        <span className="text-2xl font-bold text-gradient-brand">{eur(total)}</span>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Unverbindliche Beispiel-Schätzung — keine verbindlichen Preise.</p>
    </div>
  );
}
