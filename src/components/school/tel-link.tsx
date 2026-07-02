"use client";

/**
 * tel-link.tsx — Anruf-Link mit PII-freiem Zähl-Beacon.
 * ----------------------------------------------------------------------------
 * Strategie (Gründer): Telefon-Klicks werden JE SCHULE aggregiert gezählt
 * (B2B-Vermittlungsnachweis). Beim Klick feuert fire-and-forget ein
 * sendBeacon an /api/ereignis — Body enthält NUR Schul-Slug + Typ, keinerlei
 * Besucherdaten (Zählung aggregiert je Schule × Typ × Tag, Migration 0024).
 * Die tel:-Navigation läuft ungebremst weiter (Beacon überlebt den
 * Seitenkontext). Fallback: fetch mit keepalive, falls sendBeacon fehlt.
 * Ohne JS bleibt der Link ein normaler tel:-Anker — dann ohne Zählung
 * (bewusst: Anruf geht IMMER vor Zählung).
 */
export function TelLink({
  slug,
  ort,
  href,
  className,
  children,
}: {
  /** Schul-Slug für den aggregierten Zähler (kein Orakel: Server antwortet immer 204). */
  slug: string;
  /** Ort der Schule — disambiguiert Slug-Kollisionen (Slugs nur je (land, ort) eindeutig). */
  ort?: string | null;
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  function melden() {
    try {
      const body = JSON.stringify({ slug, typ: "tel_klick", ...(ort ? { ort } : {}) });
      const alsBlob = new Blob([body], { type: "application/json" });
      if (!navigator.sendBeacon || !navigator.sendBeacon("/api/ereignis", alsBlob)) {
        void fetch("/api/ereignis", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body,
          keepalive: true,
        }).catch(() => {
          /* still — Zählung ist nie ein Blocker */
        });
      }
    } catch {
      /* still — Anruf geht vor */
    }
  }
  return (
    <a href={href} className={className} onClick={melden}>
      {children}
    </a>
  );
}
