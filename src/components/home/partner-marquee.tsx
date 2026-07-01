/* eslint-disable @next/next/no-img-element */
/**
 * PartnerMarquee — dezente Endlosschleife farbiger Partner-Logos (nach links,
 * nahtlos, mit Rand-Ausblendung; pausiert bei Hover). Reine CSS-Animation
 * (Server-Komponente), reduced-motion-sicher.
 *
 * WICHTIG (Recht/Ehrlichkeit): Hier laufen aktuell selbst entworfene
 * PLATZHALTER-Logos (Fantasie-Marken, keine echten Firmen). Echte Partnerlogos
 * (TÜV SÜD, TÜV Saarland, DEKRA …) erst NACH unterschriebener Partnerschaft +
 * schriftlicher Logo-Nutzungserlaubnis einsetzen — sonst Marken-/UWG-Verstoß.
 * Austausch dann pro Partner = eine Datei in /public/partners/ ersetzen + Eintrag
 * unten anpassen (src/alt). KEINE Fremdlogos ohne Freigabe committen.
 */
const PARTNERS = [
  { src: "/partners/placeholder-certix.svg", alt: "Certix (Platzhalter)" },
  { src: "/partners/placeholder-drivelo.svg", alt: "Drivelo (Platzhalter)" },
  { src: "/partners/placeholder-verita.svg", alt: "Verita (Platzhalter)" },
  { src: "/partners/placeholder-probyt.svg", alt: "Probyt (Platzhalter)" },
  { src: "/partners/placeholder-aurio.svg", alt: "Aurio (Platzhalter)" },
  { src: "/partners/placeholder-lumeo.svg", alt: "Lumeo (Platzhalter)" },
];

export function PartnerMarquee() {
  const items = [...PARTNERS, ...PARTNERS]; // doppelt → nahtlose -50%-Schleife
  return (
    <section aria-label="In Kooperation mit" className="border-y border-border/60 bg-secondary/30">
      <div className="mx-auto w-full max-w-6xl px-6 py-6">
        <p className="mb-5 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          In Kooperation mit
        </p>
        <div className="marquee-mask overflow-hidden">
          <div className="marquee-track items-center gap-16">
            {items.map((p, i) => (
              <img
                key={`${p.src}-${i}`}
                src={p.src}
                alt={i < PARTNERS.length ? p.alt : ""}
                aria-hidden={i >= PARTNERS.length}
                className="h-12 w-auto shrink-0 select-none"
                draggable={false}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
