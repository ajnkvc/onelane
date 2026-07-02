/* eslint-disable @next/next/no-img-element -- statische Logo-Dateien mit fester Höhe/auto-Breite (kein Optimierungsbedarf) */
/**
 * PartnerMarquee — „In Zusammenarbeit mit" + Logo-Endlosschleife (rechts→links).
 * ----------------------------------------------------------------------------
 * Server-Komponente ohne Client-JS: nutzt die marquee-Utilities aus globals.css
 * (.marquee-track/.marquee-mask — Liste doppelt, -50 % Translation = nahtlos;
 * motion-safe: pausiert bei Hover, reduced-motion: steht statisch).
 *
 * AKTUELL: PLATZHALTER-LOGOS (Gründer 2026-07-02). Die echten Fremdmarken-
 * Dateien (TÜV SÜD/NORD, DEKRA, Allianz, ADAC, LH München) wurden vollständig
 * entfernt — die Logo-Nutzungsvereinbarungen laufen noch. Die Platzhalter in
 * public/images/partner-platzhalter/ sind EIGENE, generische SVG-Marken
 * (committ- und deploybar, z. B. für den peaknetworks-Test).
 *
 * ⚠️ ECHTE LOGOS erst wieder eintragen, wenn die schriftliche Freigabe
 * vorliegt: Datei ablegen, Eintrag ergänzen und den Nachweis (Vertrags-/
 * Mail-Referenz + Datum) in `permissionRef` dokumentieren. Ohne Freigabe
 * veröffentlicht = Marken- (§ 14 MarkenG) und Irreführungs-Risiko (§ 5 UWG).
 * Das Ehrlichkeits-Gate bleibt: leeres Array → Sektion erscheint nicht.
 */
type Partner = {
  /** Anzeigename (alt-Text). */
  name: string;
  /** Pfad zur Logo-Datei unter /public (SVG bevorzugt, JPEG/PNG möglich). */
  src: string;
  /** PFLICHT bei Fremdmarken: Referenz der schriftlichen Logo-Nutzungserlaubnis. */
  permissionRef: string;
  /** Weißer Chip hinter dem Logo (für JPEG/PNG ohne Transparenz). */
  chip?: boolean;
};

/** Eigene Platzhalter-Marken — bis die Partner-Freigaben vorliegen (s. o.). */
const PARTNER: ReadonlyArray<Partner> = [1, 2, 3, 4, 5, 6].map((n) => ({
  name: `Partner-Platzhalter ${n}`,
  src: `/images/partner-platzhalter/partner-${n}.svg`,
  permissionRef: "eigenes onelane-Asset (Platzhalter, 2026-07-02)",
}));

export function PartnerMarquee() {
  if (PARTNER.length === 0) return null; // Ehrlichkeits-Gate: ohne Partner keine Sektion
  const items = [...PARTNER, ...PARTNER]; // doppelt → nahtlose -50-%-Schleife
  return (
    <section aria-label="In Zusammenarbeit mit" className="border-y border-border/60 bg-secondary/30">
      <div className="mx-auto w-full max-w-6xl px-6 py-6">
        {/* mb-7: bewusst mehr Luft zwischen Überschrift und Logos (Gründer
            2026-07-02), ohne die Sektion insgesamt hoch zu bauen */}
        <p className="mb-7 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          In Zusammenarbeit mit
        </p>
        <div className="marquee-mask relative overflow-hidden">
          {/* MARKEN-FAHRBAHN: feine gestrichelte Mittellinie („lane") läuft
              horizontal HINTER den Logos durch — die Partner fahren auf
              unserer Spur (Markenmetapher, rein dekorativ). */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-muted-foreground/30"
          />
          <div className="marquee-track relative items-center gap-14">
            {/* Einheitliche Logo-Boxen: JEDES Logo sitzt in derselben festen
                Box (h-10 × w-28) und wird per object-contain hineinskaliert.
                Hover: Loop pausiert (globals.css), Logo hebt sanft
                (motion-safe) und nennt den Namen als title-Tooltip. */}
            {items.map((p, i) => (
              <span
                key={`${p.name}-${i}`}
                aria-hidden={i >= PARTNER.length}
                title={p.name}
                className={`flex h-10 w-28 shrink-0 items-center justify-center select-none transition-transform duration-[var(--motion-duration-fast)] ease-[var(--motion-ease)] motion-safe:hover:scale-[1.06] ${
                  p.chip ? "rounded-md bg-white px-2 shadow-elevation-1" : ""
                }`}
              >
                <img
                  src={p.src}
                  alt={i < PARTNER.length ? p.name : ""}
                  className="max-h-full max-w-full object-contain"
                  draggable={false}
                />
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
