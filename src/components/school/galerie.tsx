import Image from "next/image";
import type { ProfileImage } from "@/modules/schools/profile";

/**
 * galerie.tsx — Bilder der Fahrschule als ruhiges Collage-Grid (KEIN Karussell).
 * ----------------------------------------------------------------------------
 * Mit echten Bildern: 1 großes + bis zu 2 kleine Bilder mit 1px-Fugen (gap-px
 * auf bg-border = Hairline-Raster). OHNE Bilder: eleganter SSR-SVG-Fallback
 * (stilisierte Karten-Skizze mit Fahrbahn + Pin, reine Token-Farben) statt
 * grauer Platzhalter-Kachel — die Seite bleibt Info-First und niemals „kaputt".
 * Server-tauglich, kein JS, keine Inline-Styles (Nonce-CSP).
 */

const KATEGORIE_LABEL: Record<string, string> = {
  gebaeude: "Gebäude",
  theorie: "Theorieraum",
  fahrzeug: "Fahrzeug",
};

/** Bildlos-Fallback: stilisierte Karten-Skizze (Muster aus dem Canvas-Prototyp). */
export function KartenSkizze({ bezirk }: { bezirk: string | null }) {
  return (
    <div className="relative overflow-hidden rounded-md border border-border">
      <svg
        viewBox="0 0 800 220"
        className="h-auto w-full"
        role="img"
        aria-label={`Stilisierte Karten-Skizze${bezirk ? ` — ${bezirk}` : ""}`}
      >
        <rect width="800" height="220" className="fill-[color-mix(in_oklab,var(--brand-sky)_6%,var(--background))]" />
        <g className="fill-muted stroke-border" strokeWidth="1">
          <rect x="40" y="26" width="130" height="70" />
          <rect x="220" y="44" width="110" height="76" />
          <rect x="520" y="34" width="140" height="60" />
          <rect x="80" y="140" width="120" height="56" />
          <rect x="560" y="128" width="150" height="66" />
        </g>
        <path
          d="M 0 160 C 200 144 340 104 460 94 C 580 86 700 52 800 44"
          className="stroke-border"
          strokeWidth="16"
          fill="none"
        />
        <path
          d="M 0 160 C 200 144 340 104 460 94 C 580 86 700 52 800 44"
          className="stroke-background"
          strokeWidth="2.5"
          strokeDasharray="10 12"
          fill="none"
        />
        <circle cx="430" cy="96" r="14" className="fill-primary stroke-background" strokeWidth="3" />
        <circle cx="430" cy="96" r="4.5" className="fill-primary-foreground" />
      </svg>
      {bezirk && (
        <span className="absolute bottom-3 left-3 rounded-[3px] border border-border bg-background px-2 py-1 font-mono text-[11px] font-semibold uppercase tracking-wide">
          {bezirk}
        </span>
      )}
    </div>
  );
}

export function Galerie({
  images,
  schoolName,
  bezirk,
}: {
  images: ProfileImage[];
  schoolName: string;
  bezirk: string | null;
}) {
  const collage = images.slice(0, 3);
  if (collage.length === 0) return <KartenSkizze bezirk={bezirk} />;

  return (
    <section aria-label={`Bilder von ${schoolName}`} className="overflow-hidden rounded-md border border-border">
      <div className={collage.length >= 3 ? "grid grid-cols-3 grid-rows-2 gap-px bg-border" : "grid grid-cols-2 gap-px bg-border"}>
        {collage.map((img, i) => (
          <div
            key={img.url}
            className={`relative bg-muted ${collage.length >= 3 && i === 0 ? "col-span-2 row-span-2 aspect-[4/3]" : "aspect-[4/3]"}`}
          >
            <Image
              src={img.url}
              alt={img.alt ?? `${schoolName} — ${KATEGORIE_LABEL[img.kategorie] ?? img.kategorie}`}
              fill
              unoptimized
              sizes="(max-width: 1024px) 100vw, 640px"
              className="object-cover"
              priority={i === 0}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
