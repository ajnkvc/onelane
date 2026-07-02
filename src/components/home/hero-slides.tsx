import { CityIcon } from "@/components/search/city-icons";

/**
 * HeroSlides — rotierendes Marken-Visual (Crossfade, bildfertig vorbereitet).
 * ----------------------------------------------------------------------------
 * Server-taugliche Komponente OHNE Client-JS: Die Slides liegen übereinander,
 * eine reine CSS-Keyframe-Animation (globals.css: .hero-slide, ~6 s je Slide,
 * NUR opacity — kein CLS, Compositor-only) blendet sie im Kreis über. Ohne JS
 * läuft die Rotation trotzdem; bei prefers-reduced-motion steht statisch das
 * ERSTE Slide (Basis-Opacity, keine Animation). Der Container hat eine feste
 * Höhe und großzügige Rundung (rounded-3xl — Bild-Flächen dürfen rund:
 * „rund = Emotion, kantig = Fakten").
 *
 * INTERIM-SLIDES: Bis echte Fotos vorliegen, laufen drei Marken-Kompositionen
 * aus Inline-SVG/CSS-Verläufen (Petrol-Ambient + „lane"-Linienmotiv + je ein
 * groß skaliertes Wahrzeichen aus city-icons.tsx — elegant, KEINE Figuren).
 *
 * FOTO-UPGRADE (vorbereitet): Sobald Bild-Dateien in public/images/ geliefert
 * sind, ersetzt je Slide ein next/image-Node (fill, object-cover, alt="")
 * den SVG-Node im SLIDES-Array — Struktur/Animation bleiben unverändert:
 *   { id: "muenchen-foto", node: <Image src="/images/hero/muenchen.jpg" … /> }
 */

/** Ein Interim-Slide: Petrol-Verlauf + lane-Motiv + großes Wahrzeichen. */
function MarkenSlide({ stadt, label }: { stadt: string; label: string }) {
  return (
    <div className="absolute inset-0 bg-[linear-gradient(155deg,color-mix(in_oklab,var(--brand-ink),var(--primary)_38%),var(--brand-ink)_78%)]">
      {/* „lane"-Linienmotiv: geschwungene Fahrbahn + gestrichelte Mittellinie */}
      <svg
        viewBox="0 0 600 400"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full"
        fill="none"
        aria-hidden="true"
        focusable="false"
      >
        <path
          d="M-40 330 C 120 260, 260 360, 400 280 S 600 180, 660 210"
          className="stroke-brand-sky/25"
          strokeWidth="56"
          strokeLinecap="round"
        />
        <path
          d="M-40 330 C 120 260, 260 360, 400 280 S 600 180, 660 210"
          className="stroke-accent/50"
          strokeWidth="2"
          strokeDasharray="12 18"
          strokeLinecap="round"
        />
        <path
          d="M-30 90 C 150 140, 330 60, 520 110 S 640 140, 680 120"
          className="stroke-brand-cyan/15"
          strokeWidth="34"
          strokeLinecap="round"
        />
      </svg>
      {/* Wahrzeichen groß skaliert — bewusst über den Rand hinaus (Ausschnitt) */}
      <CityIcon
        city={stadt}
        className="absolute -bottom-8 -right-6 size-56 opacity-90 sm:size-72"
      />
      {/* dezente Stadt-Zeile (editorial, Versalien) */}
      <p className="absolute bottom-5 left-6 font-mono text-[11px] uppercase tracking-[0.28em] text-background/70">
        {label}
      </p>
    </div>
  );
}

/**
 * Datenquelle der Rotation: {id, node}. Foto-Slides ersetzen die SVG-Slides
 * 1:1, sobald die Dateien in public/images/ geliefert sind (s. Docblock).
 */
const SLIDES: ReadonlyArray<{ id: string; node: React.ReactNode }> = [
  { id: "muenchen", node: <MarkenSlide stadt="München" label="München" /> },
  { id: "hamburg", node: <MarkenSlide stadt="Hamburg" label="Hamburg" /> },
  { id: "koeln", node: <MarkenSlide stadt="Köln" label="Köln" /> },
];

export function HeroSlides({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`relative h-72 w-full overflow-hidden rounded-3xl shadow-elevation-2 sm:h-96 ${className}`}
    >
      {SLIDES.map((s) => (
        <div key={s.id} className="hero-slide absolute inset-0">
          {s.node}
        </div>
      ))}
    </div>
  );
}
