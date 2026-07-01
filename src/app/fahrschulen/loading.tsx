/**
 * loading.tsx — gebrandetes Lade-Erlebnis der Ergebnisseite (Check24-Stil).
 * Next zeigt es automatisch während des SSR-Datenabrufs der Ergebnisseite — also
 * exakt im echten Pending-Zustand (kein künstliches Bremsen). reduced-motion
 * stoppt die Animationen (globale Leitplanke). A11y: role=status + aria-live.
 */
const STEPS = ["Adresse erkannt", "Umkreis berechnet", "Fahrschulen werden gefunden"];

export default function FahrschulenLoading() {
  return (
    <div
      className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-7 px-6 py-28 text-center"
      role="status"
      aria-live="polite"
    >
      <div className="relative grid size-20 place-items-center">
        <span aria-hidden="true" className="pulse-ring absolute inset-0 rounded-full bg-brand-sky/15" />
        <span aria-hidden="true" className="size-14 animate-spin rounded-full border-4 border-brand-sky/25 border-t-brand-sky" />
      </div>

      <p className="text-lg font-semibold text-[#1b3a5c]">Wir suchen die besten Fahrschulen für dich…</p>

      <ul className="flex flex-col gap-2.5 text-sm">
        {STEPS.map((s, i) => (
          <li
            key={s}
            className="load-step flex items-center gap-2 text-muted-foreground"
            style={{ animationDelay: `${i * 0.35}s` }}
          >
            <span aria-hidden="true" className="grid size-5 place-items-center rounded-full bg-accent text-accent-foreground">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="m5 13 4 4L19 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
            {s}
          </li>
        ))}
      </ul>
    </div>
  );
}
