/**
 * Wordmark — typografische Marke „onelane" (Konzept #1): „one" in Sky-Blau,
 * „lane" in Ink, abschließender Sky-Punkt als Signatur. Reine Schrift (kein Asset,
 * CSP-fest), Größe steuert die aufrufende Stelle via className. Zentral austauschbar;
 * finale geometrische Grotesk folgt.
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
