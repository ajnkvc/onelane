"use client";

import { useState } from "react";
import { SearchBar } from "./search-bar";

/**
 * HeroSuche — Client-Insel: Kategorie-Tabs + SearchBar als EIN Suchmodul.
 * ----------------------------------------------------------------------------
 * Die Kategorie-Tabs (Airbnb-Muster) sind reine VORAUSWAHL: Ein Klick startet
 * KEINE Suche mehr (früher navigierten sie sofort nach /fahrschulen), sondern
 * merkt sich die Gruppe — gesucht wird erst mit der Ortseingabe. Die gewählte
 * Gruppe reist dann als `&klasse=…` mit (SearchBar-Prop `klasse`).
 *
 * MVP-SEMANTIK „Gruppe = Leitklasse": Jede Gruppe steht für ihre häufigste
 * Klasse (auto→B, motorrad→A, anhaenger→BE, alle→kein Param). Die Fein-Klassen
 * (B196/B197/B96, A1/A2/AM …) wählt der Nutzer auf der Suchseite über die
 * Filter — bewusst NICHT hier im Hero (schlanke Bühne, keine Chip-Flut).
 *
 * PROGRESSIVE ENHANCEMENT (bewusste Entscheidung, dokumentiert): Die Tabs sind
 * <button aria-pressed> und ohne JS nicht interaktiv. Das ist die sauberste
 * Lösung, denn die SearchBar selbst ist eine Client-Insel (router.push +
 * Geocode-Fetch) — ohne JS ist die gesamte Hero-Suche funktionslos, eine
 * Link-Variante der Tabs würde also nur EINEN Schritt „retten" und dabei das
 * alte Sofort-Navigieren wieder einführen. No-JS-Nutzer erreichen die
 * Ergebnisseite über die SSR-Links der Seite (CTAs, Städte-Kacheln, Header).
 *
 * A11y: Tabs als Toolbar-Buttons mit aria-pressed (Zustand hörbar), Aktiv-Stil
 * bleibt der Mint-Look (border-brand-lime bg-accent/25 text-primary), Touch
 * ≥44px, sichtbarer Fokus-Ring.
 */

type Gruppe = "alle" | "auto" | "motorrad" | "anhaenger";

/** Gruppe → Leitklasse (Query-Param `klasse`); "" = kein Param (alle). */
const GRUPPE_KLASSE: Record<Gruppe, string> = {
  alle: "",
  auto: "B",
  motorrad: "A",
  anhaenger: "BE",
};

const KATEGORIE_TABS: ReadonlyArray<{ key: Gruppe; label: string }> = [
  { key: "alle", label: "Alle" },
  { key: "auto", label: "Auto" },
  { key: "motorrad", label: "Motorrad" },
  { key: "anhaenger", label: "Anhänger" },
];

/** Filigrane Strich-Icons der vier Gruppen (rein dekorativ). */
function KategorieIcon({ kategorie }: { kategorie: Gruppe }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="26"
      height="26"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {kategorie === "alle" && (
        <>
          <rect x="4" y="4" width="7" height="7" rx="1.5" />
          <rect x="13" y="4" width="7" height="7" rx="1.5" />
          <rect x="4" y="13" width="7" height="7" rx="1.5" />
          <rect x="13" y="13" width="7" height="7" rx="1.5" />
        </>
      )}
      {kategorie === "auto" && (
        <>
          <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
          <circle cx="7" cy="17" r="2" />
          <path d="M9 17h6" />
          <circle cx="17" cy="17" r="2" />
        </>
      )}
      {kategorie === "motorrad" && (
        <>
          <circle cx="5.5" cy="17" r="3.3" />
          <circle cx="18.5" cy="17" r="3.3" />
          <path d="M5.5 17l2.6-5.2h4.7l2.7-3.8h2.5" />
          <path d="M13.2 11.8 18.5 17M8 8h3.5" />
        </>
      )}
      {kategorie === "anhaenger" && (
        <>
          <rect x="2.5" y="7.5" width="12" height="8" rx="1" />
          <circle cx="8.5" cy="18" r="2" />
          <path d="M14.5 11.5H21" />
          <circle cx="21.5" cy="11.5" r="0.8" />
        </>
      )}
    </svg>
  );
}

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export function HeroSuche() {
  const [gruppe, setGruppe] = useState<Gruppe>("alle");

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <div role="group" aria-label="Fahrzeug-Kategorie vorwählen" className="w-full">
        <ul className="flex items-end justify-center gap-1 sm:gap-5">
          {KATEGORIE_TABS.map((t) => {
            const aktiv = t.key === gruppe;
            return (
              <li key={t.key}>
                <button
                  type="button"
                  aria-pressed={aktiv}
                  onClick={() => setGruppe(t.key)}
                  className={`flex min-h-11 min-w-16 flex-col items-center justify-end gap-1 border-b-2 px-2 pb-1.5 text-xs font-medium transition-colors duration-[var(--motion-duration-fast)] ease-[var(--motion-ease)] ${
                    aktiv
                      ? // Aktiver Tab in der Akzentfarbe (Gründer 2026-07-02): Mint-Unterstrich
                        // + kräftiger Marken-Text — konsistent mit Suchen-Button/CTAs.
                        "border-brand-lime bg-accent/25 text-primary"
                      : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
                  } ${focusRing} rounded-t-md`}
                >
                  <KategorieIcon kategorie={t.key} />
                  {t.label}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <SearchBar compact klasse={GRUPPE_KLASSE[gruppe]} />
    </div>
  );
}
