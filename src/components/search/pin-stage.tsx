/**
 * pin-stage.tsx — SSR-SVG-Karten-Fallback der Ergebnisliste (kein Client-JS).
 * ----------------------------------------------------------------------------
 * Ohne Tile-Config (Prod fail-closed) trägt statt Leaflet eine stilisierte
 * Stadt-Skizze die Lage-Übersicht: abstrakte Blöcke + Straßenraster als Bühne,
 * darüber die ECHTEN Treffer als nummerierte Pins (lat/lng linear in die
 * viewBox projiziert). Pin-Nummer = laufende Zeilen-Nummer der Liste; der
 * optionale Bezugspunkt (Suchzentrum) erscheint als markierter Anker.
 * Nur Token-Farben (fill-/stroke-Utilities bzw. color-mix aus var()), keine
 * Roh-Hex, keine Inline-Styles — CSP-fest und ohne JS vollständig lesbar.
 */

export type PinPunkt = {
  /** Laufende Nummer = Zeilen-Nummer in der Ergebnisliste (1-basiert). */
  nr: number;
  lat: number;
  lng: number;
  partner: boolean;
};

export function PinStage({
  punkte,
  zentrum,
}: {
  punkte: PinPunkt[];
  zentrum: { lat: number; lng: number } | null;
}) {
  if (punkte.length === 0) return null;

  const lats = punkte.map((p) => p.lat).concat(zentrum ? [zentrum.lat] : []);
  const lngs = punkte.map((p) => p.lng).concat(zentrum ? [zentrum.lng] : []);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const dLat = Math.max(maxLat - minLat, 1e-6);
  const dLng = Math.max(maxLng - minLng, 1e-6);
  const px = (lng: number) => 80 + ((lng - minLng) / dLng) * 640;
  const py = (lat: number) => 80 + ((maxLat - lat) / dLat) * 480;

  return (
    <svg
      viewBox="0 0 800 640"
      preserveAspectRatio="xMidYMid slice"
      className="h-full w-full"
      role="img"
      aria-label="Stilisierte Lageskizze der Treffer — Pin-Nummer entspricht der Zeilen-Nummer in der Liste"
    >
      {/* Grundfläche in dezentem Blau-Tint (color-mix aus Token) */}
      <rect x="0" y="0" width="800" height="640" className="fill-[color-mix(in_srgb,var(--brand-sky)_5%,var(--background))]" />
      {/* Abstrakte Stadtblöcke */}
      <g className="fill-muted stroke-border" strokeWidth="1">
        <rect x="40" y="40" width="130" height="90" />
        <rect x="220" y="30" width="110" height="120" />
        <rect x="380" y="55" width="150" height="95" />
        <rect x="590" y="40" width="130" height="110" />
        <rect x="60" y="220" width="140" height="110" />
        <rect x="260" y="235" width="120" height="100" />
        <rect x="440" y="225" width="140" height="115" />
        <rect x="630" y="235" width="120" height="100" />
        <rect x="45" y="420" width="130" height="100" />
        <rect x="240" y="435" width="145" height="90" />
        <rect x="450" y="415" width="120" height="110" />
        <rect x="620" y="425" width="140" height="100" />
      </g>
      {/* Straßenraster */}
      <g className="stroke-border" strokeWidth="9" strokeLinecap="round" fill="none">
        <line x1="0" y1="185" x2="800" y2="185" />
        <line x1="0" y1="385" x2="800" y2="385" />
        <line x1="200" y1="0" x2="200" y2="640" />
        <line x1="560" y1="0" x2="560" y2="640" />
      </g>
      {/* Fluss-Band als ruhige Diagonale (dezenter Brand-Mix) */}
      <path
        d="M 470 640 C 510 480 550 360 610 240 C 650 160 700 70 760 0"
        className="stroke-[color-mix(in_srgb,var(--brand-sky)_28%,var(--background))]"
        strokeWidth="22"
        fill="none"
        strokeLinecap="round"
      />
      {/* Bezugspunkt der Distanzen (Suchzentrum) */}
      {zentrum && (
        <g>
          <circle cx={px(zentrum.lng)} cy={py(zentrum.lat)} r="6" className="fill-brand-cyan" />
          <circle
            cx={px(zentrum.lng)}
            cy={py(zentrum.lat)}
            r="12"
            className="fill-none stroke-brand-cyan"
            strokeWidth="2"
            strokeDasharray="3 3"
          />
        </g>
      )}
      {/* Echte Treffer als nummerierte Pins (Nummer = Zeile in der Liste) */}
      {punkte.map((p) => (
        <g key={p.nr}>
          {p.partner && <circle cx={px(p.lng)} cy={py(p.lat)} r="18" className="fill-none stroke-accent" strokeWidth="3" />}
          <circle cx={px(p.lng)} cy={py(p.lat)} r="13" className="fill-primary stroke-background" strokeWidth="2.5" />
          <text
            x={px(p.lng)}
            y={py(p.lat)}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="12"
            fontWeight="700"
            className="fill-primary-foreground font-mono"
          >
            {p.nr}
          </text>
        </g>
      ))}
    </svg>
  );
}
