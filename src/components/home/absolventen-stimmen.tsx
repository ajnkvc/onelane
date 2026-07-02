"use client";

/**
 * AbsolventenStimmen — horizontale Video-Karten echter Absolvent:innen.
 * ----------------------------------------------------------------------------
 * Muster fonio.ai: horizontal scrollende Karten (scroll-snap), Video spielt
 * auf Desktop bei HOVER an (stumm, inline) und pausiert beim Verlassen; auf
 * Touch-Geräten startet/stoppt ein TAP das Video. Poster ist PFLICHT (kein
 * Layout-Sprung, kein schwarzer Frame). Caption: Vorname + Stadt. Videos
 * liegen unter public/videos/, Poster unter public/images/.
 *
 * EHRLICHKEITS-GATE: Es werden AUSSCHLIESSLICH echte Stimmen gezeigt — nur
 * mit SCHRIFTLICHER Einwilligung der gezeigten Person (bei Minderjährigen:
 * der Sorgeberechtigten), Referenz je Eintrag in `einwilligungRef` (PFLICHT).
 * Das STIMMEN-Array ist aktuell LEER → die Sektion erscheint NICHT. Echte
 * Stimmen existieren laut Gründer; Assets + Einwilligungen folgen. KEINE
 * gestellten/erfundenen Testimonials (§ 5 UWG).
 *
 * A11y/Motion: Autoplay NUR auf Nutzer-Interaktion (Hover/Tap — kein
 * ungefragtes Abspielen, reduced-motion-freundlich), Videos stumm + playsInline,
 * Karten sind fokussierbar (Fokus = Hover-Äquivalent via focus/blur).
 */
type Stimme = {
  vorname: string;
  stadt: string;
  /** Pfad unter /public, z. B. "/videos/stimme-lena-muenchen.mp4". */
  videoSrc: string;
  /** PFLICHT: Poster-Standbild, z. B. "/images/stimmen/lena-muenchen.jpg". */
  posterSrc: string;
  /** PFLICHT: Referenz der schriftlichen Einwilligung (U18: Sorgeberechtigte). */
  einwilligungRef: string;
};

/** AKTUELL LEER (Ehrlichkeits-Gate) — erst mit Einwilligung + Assets füllen. */
const STIMMEN: ReadonlyArray<Stimme> = [];

function play(e: React.SyntheticEvent<HTMLVideoElement>) {
  void e.currentTarget.play().catch(() => {
    /* Autoplay-Block des Browsers: Poster bleibt stehen — kein Fehlerfall. */
  });
}

function pause(e: React.SyntheticEvent<HTMLVideoElement>) {
  e.currentTarget.pause();
}

function toggle(e: React.SyntheticEvent<HTMLVideoElement>) {
  const v = e.currentTarget;
  if (v.paused) {
    void v.play().catch(() => {});
  } else {
    v.pause();
  }
}

export function AbsolventenStimmen() {
  if (STIMMEN.length === 0) return null; // Gate: ohne echte Stimmen keine Sektion
  return (
    <section aria-labelledby="stimmen-heading" className="py-20 sm:py-28">
      <div className="mx-auto w-full max-w-6xl px-6">
        <h2
          id="stimmen-heading"
          className="text-center text-4xl font-light tracking-tight text-balance sm:text-5xl"
        >
          Stimmen von <span className="font-semibold">Absolvent:innen.</span>
        </h2>
        <ul className="mt-12 flex snap-x snap-mandatory gap-5 overflow-x-auto pb-4">
          {STIMMEN.map((s) => (
            <li key={s.videoSrc} className="w-64 shrink-0 snap-start sm:w-72">
              <figure>
                <video
                  src={s.videoSrc}
                  poster={s.posterSrc}
                  muted
                  loop
                  playsInline
                  preload="none"
                  aria-label={`Video-Stimme von ${s.vorname} aus ${s.stadt}`}
                  tabIndex={0}
                  onMouseEnter={play}
                  onMouseLeave={pause}
                  onFocus={play}
                  onBlur={pause}
                  onClick={toggle}
                  className="aspect-[9/16] w-full rounded-3xl border border-border object-cover shadow-elevation-2"
                />
                <figcaption className="mt-3 text-sm font-medium">
                  {s.vorname}
                  <span className="text-muted-foreground"> · {s.stadt}</span>
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
