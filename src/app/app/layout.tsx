import type { Metadata } from "next";

/**
 * /app-Layout (dünn) — gemeinsamer Rahmen ALLER Portal-Routen inkl. Login/2FA.
 * ----------------------------------------------------------------------------
 * BEWUSST OHNE Session-Gate: /app/login und /app/einrichtung/2fa liegen unter
 * diesem Layout und müssen ohne (volle) Session erreichbar sein. Das Gate
 * (Session → Identity → MFA) sitzt im Routen-Group-Layout (geschuetzt)/ —
 * zusätzlich prüft JEDE künftige Fach-Action/-Route ihre Rechte selbst
 * (portal-guards; ein Layout ist keine Sicherheitsgrenze).
 * Das Portal ist nie für Suchmaschinen bestimmt (zusätzlich x-robots-tag im Proxy).
 */
export const metadata: Metadata = {
  title: {
    default: "onelane",
    template: "%s · onelane",
  },
  robots: { index: false, follow: false },
};

export default function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className="flex min-h-full flex-1 flex-col bg-background">{children}</div>;
}
