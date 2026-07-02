"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

/**
 * ResultsMap — Leaflet-Karten-Island (Client). Die Leaflet-Bibliothek wird LAZY
 * (dynamischer Import in useEffect) geladen → nicht im Initial-Bundle der SSR-Liste.
 * Marker = exakt die übergebenen (sichtbaren) Treffer. Tile-Config kommt als Props
 * vom Server (Maps-Modul) — kein `@/server/*`-Import hier. Marker als inline-
 * gestylter divIcon (keine externen Leaflet-Icon-Assets → bundler-/CSP-robust).
 */
export type MapMarker = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  partner: boolean;
};

type Props = {
  markers: MapMarker[];
  center: { lat: number; lng: number } | null;
  tile: { tileUrl: string; attribution: string; maxZoom: number };
};

export default function ResultsMap({ markers, center, tile }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let map: import("leaflet").Map | null = null;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !ref.current) return;

      const pts = markers.filter((m) => Number.isFinite(m.lat) && Number.isFinite(m.lng));
      const start = center ?? (pts[0] ? { lat: pts[0].lat, lng: pts[0].lng } : { lat: 51.16, lng: 10.45 });

      map = L.map(ref.current, { scrollWheelZoom: false }).setView([start.lat, start.lng], 11);
      L.tileLayer(tile.tileUrl, { attribution: tile.attribution, maxZoom: tile.maxZoom }).addTo(map);

      const bounds: [number, number][] = [];
      for (const m of pts) {
        const color = m.partner ? "#65a30d" : "#0ea5e9";
        const icon = L.divIcon({
          className: "",
          html: `<span style="display:block;width:16px;height:16px;border-radius:9999px;background:${color};border:3px solid #fff;box-shadow:0 1px 4px rgba(15,41,66,.35)"></span>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        });
        // F-016: `bindPopup(string)` würde den Namen als HTML setzen (innerHTML) → gespeicherte XSS
        // über DB-/OSM-Namen. Stattdessen ein DOM-Element mit textContent übergeben → reiner Text,
        // keine HTML-Interpretation. (`title` ist eine DOM-Property-Zuweisung und damit unkritisch.)
        const popupEl = document.createElement("div");
        popupEl.textContent = m.name;
        L.marker([m.lat, m.lng], { icon, title: m.name }).addTo(map).bindPopup(popupEl);
        bounds.push([m.lat, m.lng]);
      }
      if (bounds.length > 1) map.fitBounds(bounds, { padding: [30, 30] });
      else if (bounds.length === 1) map.setView(bounds[0], 13);
    })();

    return () => {
      cancelled = true;
      if (map) map.remove();
    };
  }, [markers, center, tile]);

  return (
    /* Inset-Rahmung nach Radius-Skala + Kanten-Verlauf: die Karte „taucht" in die
       Fläche ein. Die Gradient-Overlays liegen ÜBER den Tiles (Leaflet-Panes
       z-Index ≤ 700), aber UNTER den Controls/der Attribution (z-Index ≥ 800) —
       die Attribution bleibt immer sichtbar (Pflicht, nie verstecken). */
    <div className="map-ci relative overflow-hidden rounded-md border border-border">
      <div ref={ref} className="h-80 w-full" role="img" aria-label="Karte der Suchergebnisse" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 z-[750] h-6 bg-gradient-to-b from-background to-transparent"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[750] h-6 bg-gradient-to-t from-background to-transparent"
      />
    </div>
  );
}
