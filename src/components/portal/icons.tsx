import type { NavIcon } from "@/modules/portal/navigation";

/**
 * icons.tsx — schlankes Inline-Icon-Set der App-Shell (OS-P2).
 * ----------------------------------------------------------------------------
 * Stroke-basierte 24er-Glyphen (currentColor, CSP-fest, kein Asset/Request),
 * bewusst reduziert und in einer Linienstärke (1.8) — ruhige, editoriale
 * Anmutung statt Icon-Font-Rauschen. Rein dekorativ (aria-hidden); das Label
 * steht immer als Text daneben.
 */

const PFADE: Record<NavIcon, React.ReactNode> = {
  uebersicht: (
    <>
      <path d="M4 11.5 12 5l8 6.5" />
      <path d="M6.5 10.5V19h11v-8.5" />
    </>
  ),
  anfragen: (
    <>
      <path d="M5 6h14v9.5H9.5L6 19v-3.5H5z" />
      <path d="M9 10.5h6" />
    </>
  ),
  bewerbungen: (
    <>
      <rect x="5" y="5" width="14" height="14" rx="2" />
      <circle cx="12" cy="10" r="2.2" />
      <path d="M8 16.5c.8-1.8 2.2-2.7 4-2.7s3.2.9 4 2.7" />
    </>
  ),
  schueler: (
    <>
      <circle cx="9.5" cy="9" r="2.6" />
      <path d="M4.5 18c.9-2.5 2.7-3.8 5-3.8s4.1 1.3 5 3.8" />
      <path d="M15.5 6.8c1.4.3 2.4 1.5 2.4 3s-1 2.7-2.4 3" />
    </>
  ),
  kalender: (
    <>
      <rect x="4.5" y="6" width="15" height="13" rx="2" />
      <path d="M4.5 10.5h15M9 4v3.5M15 4v3.5" />
    </>
  ),
  team: (
    <>
      <circle cx="8.5" cy="9.5" r="2.4" />
      <circle cx="15.5" cy="9.5" r="2.4" />
      <path d="M4 18c.7-2.2 2.3-3.3 4.5-3.3S12.3 15.8 13 18M12.8 15c.8-.3 1.7-.4 2.7-.3 1.9.2 3.2 1.3 3.8 3.3" />
    </>
  ),
  zeit: (
    <>
      <circle cx="12" cy="12.5" r="6.5" />
      <path d="M12 9v3.8l2.6 1.5M10 3.5h4" />
    </>
  ),
  jobs: (
    <>
      <rect x="4.5" y="8" width="15" height="10.5" rx="2" />
      <path d="M9.5 8V6.5A1.5 1.5 0 0 1 11 5h2a1.5 1.5 0 0 1 1.5 1.5V8M4.5 12.5h15" />
    </>
  ),
  profil: (
    <>
      <path d="M12 4.5 5 7.5v4c0 4 2.7 6.8 7 8 4.3-1.2 7-4 7-8v-4z" />
      <path d="M9.3 12.1l2 2 3.4-3.7" />
    </>
  ),
  finanzen: (
    <>
      <path d="M5 18.5V5.5" />
      <path d="M5 18.5h14" />
      <path d="M8.5 14.5v-3M12 14.5V8.5M15.5 14.5v-4.5" />
    </>
  ),
  abo: (
    <>
      <path d="M6 5.5h12v13.5l-3-1.8-3 1.8-3-1.8-3 1.8z" />
      <path d="M9.5 9.5h5M9.5 12.5h3" />
    </>
  ),
  termine: (
    <>
      <rect x="4.5" y="6" width="15" height="13" rx="2" />
      <path d="M4.5 10.5h15M9 4v3.5M15 4v3.5M9.7 14.6l1.7 1.7 3-3.2" />
    </>
  ),
  fortschritt: (
    <>
      <path d="M5 17.5c2.5-1 3.6-6 6-8.5 1.7-1.8 4.3-2.6 8-2.5-.3 3.7-1.3 6.3-3.1 8-2.5 2.4-7.4.6-8.4 3" />
      <path d="M5 17.5c1.5-2.5 3.5-4 6.5-5" />
    </>
  ),
  dokumente: (
    <>
      <path d="M7 4.5h6.5L18 9v10.5H7z" />
      <path d="M13.5 4.5V9H18M9.8 13h4.4M9.8 16h4.4" />
    </>
  ),
  moderation: (
    <>
      <path d="M12 4.5 5 7.5v4c0 4 2.7 6.8 7 8 4.3-1.2 7-4 7-8v-4z" />
      <path d="M12 8.8v4M12 15.6v.4" />
    </>
  ),
  redaktion: (
    <>
      <path d="M6 18.5 16.8 7.7a2 2 0 0 0-2.9-2.9L3.2 15.6 2.5 19z" transform="translate(2 0)" />
      <path d="M13 7.5l2.9 2.9" transform="translate(2 0)" />
    </>
  ),
  vertrieb: (
    <>
      <path d="M4.5 14.5 9 10l3.5 3.5 7-7" />
      <path d="M14.5 6.5h5v5" />
    </>
  ),
  schluessel: (
    <>
      <circle cx="8.5" cy="12" r="3.5" />
      <path d="M12 12h7.5M17 12v2.8M19.5 12v2" />
    </>
  ),
  doku: (
    <>
      <path d="M12 6.5c-1.6-1.3-3.7-1.7-6.5-1.4v12.4c2.8-.3 4.9.1 6.5 1.4 1.6-1.3 3.7-1.7 6.5-1.4V5.1c-2.8-.3-4.9.1-6.5 1.4z" />
      <path d="M12 6.5V19" />
    </>
  ),
  einstellungen: (
    <>
      <circle cx="12" cy="12" r="2.6" />
      <path d="M12 4.5v2M12 17.5v2M4.5 12h2M17.5 12h2M6.7 6.7l1.4 1.4M15.9 15.9l1.4 1.4M17.3 6.7l-1.4 1.4M8.1 15.9l-1.4 1.4" />
    </>
  ),
};

export function NavIconGlyph({ icon, className = "" }: { icon: NavIcon; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={`size-[18px] shrink-0 ${className}`}
    >
      {PFADE[icon]}
    </svg>
  );
}

/** Sonne/Mond/Auto — Theme-Toggle (Topbar). */
export function ThemeIcon({ variante }: { variante: "sonne" | "mond" | "auto" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className="size-4 shrink-0"
    >
      {variante === "sonne" ? (
        <>
          <circle cx="12" cy="12" r="3.6" />
          <path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6 6l1.6 1.6M16.4 16.4 18 18M18 6l-1.6 1.6M7.6 16.4 6 18" />
        </>
      ) : variante === "mond" ? (
        <path d="M19 14.5A7.5 7.5 0 0 1 9.5 5 7.5 7.5 0 1 0 19 14.5z" />
      ) : (
        <>
          <circle cx="12" cy="12" r="7.5" />
          <path d="M12 4.5a7.5 7.5 0 0 1 0 15z" fill="currentColor" stroke="none" />
        </>
      )}
    </svg>
  );
}
