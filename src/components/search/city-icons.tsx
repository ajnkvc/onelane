/**
 * city-icons.tsx — Mini-Wahrzeichen (24×24) für die „Beliebte Städte"-Liste.
 * ----------------------------------------------------------------------------
 * Handgezeichnete, abstrakt-elegante Silhouetten in DUOTONE aus Token-Farben
 * (Sky als Linie/Fläche, Cyan als Akzent — bewusst nur zwei Farben, kein
 * Kitsch): München = zwei Frauenkirchen-Türme mit Kuppeln, Berlin =
 * Brandenburger Tor, Hamburg = Elphi-Wellendach, Köln = Dom-Doppelspitzen,
 * Frankfurt = Skyline-Balken, Stuttgart = Fernsehturm, Nürnberg = Burg,
 * Augsburg = Rathaus-Giebel. Rein dekorativ (aria-hidden), server-tauglich.
 */

const STROKE = { strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" } as const;

const ICONS: Record<string, React.ReactNode> = {
  // Frauenkirche: zwei Turmschäfte, darüber die charakteristischen Kuppelhauben.
  "München": (
    <g className="stroke-brand-sky" {...STROKE}>
      <rect x="5" y="10" width="5" height="11" className="fill-brand-sky/15" />
      <rect x="14" y="10" width="5" height="11" className="fill-brand-sky/15" />
      <path d="M5 10c0-2.4 1.1-4 2.5-4S10 7.6 10 10" className="fill-brand-cyan/50" />
      <path d="M14 10c0-2.4 1.1-4 2.5-4S19 7.6 19 10" className="fill-brand-cyan/50" />
      <path d="M7.5 6V4.5M16.5 6V4.5" />
    </g>
  ),
  // Brandenburger Tor: Attika-Block, vier Säulen, Quadriga-Andeutung als Akzent.
  Berlin: (
    <g className="stroke-brand-sky" {...STROKE}>
      <rect x="4" y="7" width="16" height="3" className="fill-brand-sky/15" />
      <path d="M6 10v10.5M10 10v10.5M14 10v10.5M18 10v10.5M3.5 20.5h17" />
      <rect x="10.5" y="4" width="3" height="3" className="fill-brand-cyan/60 stroke-none" />
    </g>
  ),
  // Elbphilharmonie: Backstein-Sockel, darüber das geschwungene Wellendach.
  Hamburg: (
    <g className="stroke-brand-sky" {...STROKE}>
      <path
        d="M4 12c1.6-3.4 3.4-1 5-3.2 1.6-2.2 3.4 0.4 5-1.8 1.6-2.2 3.2-0.6 6-2v7H4z"
        className="fill-brand-cyan/40"
      />
      <rect x="4" y="12" width="16" height="8.5" className="fill-brand-sky/15" />
      <path d="M8 12v8.5M12 12v8.5M16 12v8.5" className="stroke-brand-sky/50" strokeWidth="1" />
    </g>
  ),
  // Kölner Dom: zwei hohe Spitztürme, dazwischen das Langhaus.
  "Köln": (
    <g className="stroke-brand-sky" {...STROKE}>
      <path d="M4.5 21V9L7.5 3.5 10.5 9v12" className="fill-brand-sky/15" />
      <path d="M13.5 21V9l3-5.5L19.5 9v12" className="fill-brand-sky/15" />
      <path d="M10.5 21v-6l1.5-2 1.5 2v6" className="fill-brand-cyan/40" />
      <path d="M3.5 21h17" />
    </g>
  ),
  // Frankfurt: Hochhaus-Skyline als Balken, der höchste mit Antenne (Akzent).
  "Frankfurt am Main": (
    <g className="stroke-brand-sky" {...STROKE}>
      <rect x="3.5" y="11" width="4" height="10" className="fill-brand-sky/15" />
      <rect x="9.5" y="6" width="4.5" height="15" className="fill-brand-cyan/40" />
      <rect x="16" y="9" width="4" height="12" className="fill-brand-sky/15" />
      <path d="M11.75 6V3M3 21h18" />
    </g>
  ),
  // Fernsehturm: schlanker Schaft, Turmkorb als Akzent, Antenne.
  Stuttgart: (
    <g className="stroke-brand-sky" {...STROKE}>
      <path d="M10.8 21 11.6 9.5M13.2 21l-.8-11.5M8.5 21h7" />
      <rect x="9.3" y="6.5" width="5.4" height="3" rx="1.5" className="fill-brand-cyan/50" />
      <path d="M12 6.5V3" />
    </g>
  ),
  // Kaiserburg: Rundturm mit Kegeldach, daneben Mauer mit Zinnen.
  "Nürnberg": (
    <g className="stroke-brand-sky" {...STROKE}>
      <rect x="6" y="9.5" width="4.5" height="11.5" className="fill-brand-sky/15" />
      <path d="M5.5 9.5 8.25 4.5 11 9.5" className="fill-brand-cyan/50" />
      <path d="M10.5 15h3v-1.8h2.2V15h2.2v-1.8H20V21h-9.5" className="fill-brand-sky/15" />
      <path d="M4.5 21h16" />
    </g>
  ),
  // Rathaus-Giebel: gestufter Renaissance-Giebel mit rundem Fenster (Akzent).
  Augsburg: (
    <g className="stroke-brand-sky" {...STROKE}>
      <path
        d="M5.5 21v-7.5H8V10h2.5V7h3V10H16v3.5h2.5V21z"
        className="fill-brand-sky/15"
      />
      <path d="M12 7V5" />
      <circle cx="12" cy="4" r="1" className="fill-brand-cyan/60 stroke-none" />
      <circle cx="12" cy="13.5" r="1.6" className="fill-brand-cyan/50" />
      <path d="M4.5 21h15" />
    </g>
  ),
};

/** Fallback für Städte ohne eigenes Wahrzeichen (generische Silhouette). */
function Fallback() {
  return (
    <g className="stroke-brand-sky" {...STROKE}>
      <path d="M4 21V8l8-4.5L20 8v13M9.5 21v-5h5v5" className="fill-brand-sky/10" />
    </g>
  );
}

export function CityIcon({ city, className = "size-6" }: { city: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      {ICONS[city] ?? <Fallback />}
    </svg>
  );
}
