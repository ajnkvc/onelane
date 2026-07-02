/**
 * Wordmark — typografische Marke „onelane": „one" in Marken-Petrol, „lane" in
 * Ink, abschließender Petrol-Punkt als Signatur. (Action-Teal-Punkt wurde am
 * 2026-07-02 getestet und vom Gründer wieder verworfen — Petrol wirkt
 * geschlossener.) Reine Schrift (kein Asset, CSP-fest), Größe steuert die
 * aufrufende Stelle via className. Zentral austauschbar; finale geometrische
 * Grotesk folgt.
 */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-extrabold tracking-tight ${className}`} aria-label="onelane">
      <span className="text-brand-sky">one</span>
      <span className="text-foreground">lane</span>
      <span className="text-brand-sky">.</span>
    </span>
  );
}
