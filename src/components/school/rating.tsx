/**
 * rating.tsx — kleine Signal-Bausteine für Such-Zeilen und Profil-Fakten.
 * ----------------------------------------------------------------------------
 * RatingStern: gefüllter Stern im Bewertungs-Gold (Token --rating-fill) für das
 * Google-Fremdsignal — bewusst getrennt von Marke (Sky/Lime) und Bestätigt-Grün.
 * QuoteTeaser: dezenter Chip „Bestehensquote · amtlich ab 2027" — bewusst OHNE
 * Werte (kein fail_rate), wir zeigen erst amtliche Daten, keine Schätzungen.
 * Server-tauglich, kein Client-JS.
 */

/**
 * Noten-Farbe fürs Google-Aggregat (Gründer 2026-07-02): Der ZAHLWERT wird nach
 * Note eingefärbt (der Stern bleibt Gold als Bewertungs-Symbol) — Suchzeilen
 * und Profil-Kopf nutzen dieselbe Skala. Stufen: ≥ 4,0 kräftiges Grün ·
 * 3,5–3,9 verblasstes Oliv-Grün · 2,5–3,4 Orange · < 2,5 Rot (Grenzen bewusst
 * konservativ: erst deutlich schwache Noten kippen in Rot). Töne zentral in
 * tokens.css (--rating-top/-gut/-mittel/-schwach, AA-fest, Dark-Varianten).
 */
export function ratingFarbClass(rating: string | number | null | undefined): string {
  const r = typeof rating === "number" ? rating : Number.parseFloat(rating ?? "");
  if (!Number.isFinite(r)) return "text-rating";
  if (r >= 4) return "text-[var(--rating-top)]";
  if (r >= 3.5) return "text-[var(--rating-gut)]";
  if (r >= 2.5) return "text-[var(--rating-mittel)]";
  return "text-[var(--rating-schwach)]";
}

export function RatingStern({ className = "size-3.5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`shrink-0 fill-rating-fill ${className}`}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 2.8l2.8 5.7 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 2.9 1.1-6.3L2.9 9.4l6.3-.9L12 2.8z" />
    </svg>
  );
}

export function QuoteTeaser() {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-[4px] border border-border px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground"
      title="Die geplante Reform macht praktische Bestehensquoten je Fahrschule öffentlich — wir zeigen sie, sobald die amtlichen Daten verfügbar sind."
    >
      <svg
        viewBox="0 0 24 24"
        className="size-3 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M4 20h16M7 20v-6M12 20V9M17 20v-9" />
      </svg>
      Bestehensquote · amtlich ab 2027
    </span>
  );
}
