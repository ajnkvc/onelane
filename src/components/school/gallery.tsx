"use client";

import Image from "next/image";
import { useState } from "react";

/**
 * Gallery — Hero-Slider (Client-Island) für Schul-Bilder. Wird NUR gerendert,
 * wenn aktive Bilder vorhanden sind (adaptives Layout: ohne Bilder zeigt die
 * Seite stattdessen einen typografischen Kopf). `unoptimized` dient den lokalen
 * SVG-Platzhaltern; bei echten Foto-Uploads (Folge-Mission) wird optimiert.
 */
export type GalleryImage = { url: string; alt: string | null; kategorie: string };

export default function Gallery({
  images,
  schoolName,
}: {
  images: GalleryImage[];
  schoolName: string;
}) {
  const [i, setI] = useState(0);
  const n = images.length;
  if (n === 0) return null;
  const go = (d: number) => setI((p) => (p + d + n) % n);

  return (
    <section
      aria-roledescription="Bildergalerie"
      aria-label={`Bilder von ${schoolName}`}
      className="relative overflow-hidden rounded-2xl border bg-muted"
    >
      <div className="relative aspect-[16/9] w-full">
        {images.map((img, idx) => (
          <div
            key={idx}
            aria-hidden={idx !== i}
            className={`absolute inset-0 transition-opacity duration-500 ${idx === i ? "opacity-100" : "opacity-0"}`}
          >
            <Image
              src={img.url}
              alt={img.alt ?? `${schoolName} – ${img.kategorie}`}
              fill
              unoptimized
              sizes="(max-width: 1024px) 100vw, 768px"
              className="object-cover"
              priority={idx === 0}
            />
          </div>
        ))}
      </div>

      {n > 1 && (
        <>
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Vorheriges Bild"
            className="absolute left-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-lg text-white backdrop-blur transition hover:bg-black/65"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Nächstes Bild"
            className="absolute right-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-lg text-white backdrop-blur transition hover:bg-black/65"
          >
            ›
          </button>
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-2">
            {images.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setI(idx)}
                aria-label={`Bild ${idx + 1} von ${n}`}
                aria-current={idx === i}
                className={`h-2.5 w-2.5 rounded-full border border-white/70 transition ${idx === i ? "bg-white" : "bg-white/30"}`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
