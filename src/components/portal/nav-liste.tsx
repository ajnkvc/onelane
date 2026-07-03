"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavSektion } from "@/modules/portal/navigation";
import { NavIconGlyph } from "./icons";

/**
 * nav-liste.tsx — Navigations-Liste der Sidebar (kleine Client-Insel).
 * ----------------------------------------------------------------------------
 * Client nur für den AKTIV-Zustand (usePathname → aria-current); die Links
 * selbst sind reine <a>-Navigation und funktionieren ohne JS vollständig.
 * Das Nav-MODELL kommt serverseitig aus bauePortalNavigation (Props sind
 * serialisierbar) — hier wird nichts autorisiert, nur gerendert.
 */
export function NavListe({ sektionen }: { sektionen: NavSektion[] }) {
  const pathname = usePathname() ?? "";

  const istAktiv = (href: string, exakt?: boolean) =>
    exakt ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav aria-label="Portal-Navigation" className="flex flex-1 flex-col gap-5 overflow-y-auto">
      {sektionen.map((sektion, i) => (
        <div key={sektion.titel ?? `sektion-${i}`}>
          {sektion.titel ? (
            <p className="px-3 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              {sektion.titel}
            </p>
          ) : null}
          <ul className={sektion.titel ? "mt-1.5 grid gap-0.5" : "grid gap-0.5"}>
            {sektion.items.map((item) => {
              const aktiv = istAktiv(item.href, item.exakt);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={aktiv ? "page" : undefined}
                    className={`group flex min-h-9 items-center gap-2.5 rounded-lg px-3 text-sm motion-safe:transition-colors motion-safe:duration-[var(--motion-duration-fast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring ${
                      aktiv
                        ? "bg-sidebar-primary/10 font-medium text-sidebar-primary"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent/15 hover:text-sidebar-foreground"
                    }`}
                  >
                    <NavIconGlyph
                      icon={item.icon}
                      className={aktiv ? "text-sidebar-primary" : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground/80"}
                    />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
