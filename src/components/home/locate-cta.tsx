"use client";

import { type ReactNode, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * LocateCta — CTA-Button, der beim Klick (DSGVO-konform: nur auf explizite Aktion)
 * den Gerätestandort abfragt und zur Ergebnisseite mit Koordinaten springt.
 * Bei Ablehnung/Fehler/kein-GPS: einfache Navigation zur Ergebnisliste.
 */
export function LocateCta({ children, className }: { children: ReactNode; className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  function go(params: Record<string, string>) {
    const sp = new URLSearchParams(params);
    const qs = sp.toString();
    router.push(`/fahrschulen${qs ? `?${qs}` : ""}`);
  }

  function onClick() {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      go({});
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => go({ lat: String(pos.coords.latitude), lng: String(pos.coords.longitude), ort: "Mein Standort" }),
      () => { setBusy(false); go({}); },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <button type="button" onClick={onClick} aria-busy={busy} className={className}>
      {busy ? "Standort wird ermittelt…" : children}
    </button>
  );
}
