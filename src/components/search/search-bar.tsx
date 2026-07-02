"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CityIcon } from "./city-icons";

/**
 * SearchBar — eigene CI-Suchleiste (kein fremdes Widget), „Adresse zuerst".
 * ----------------------------------------------------------------------------
 *  - Bei FOKUS öffnet sich das Dropdown VOR dem Tippen: oben „Standort verwenden"
 *    (Geolocation-Prompt erst HIER per Klick — nie beim Laden), darunter BELIEBTE
 *    STÄDTE als Quick-Picks mit Mini-Wahrzeichen (city-icons.tsx). KEINE
 *    konkreten Fahrschulen.
 *  - Beim Tippen: Autocomplete (debounced) über /api/geocode (unverändert).
 *  - Führerscheinklasse als CHIP-Reihe unter der Leiste (kein Select).
 *  - Optionale Prop `klasse`: EXTERN gesteuerte Klassen-Vorauswahl (z. B. die
 *    Hero-Kategorie-Tabs). Ist sie gesetzt (auch ""), gewinnt sie über die
 *    interne Chip-Auswahl und reist beim Submit als `&klasse=…` mit; leerer
 *    String heißt „keine Vorauswahl" (kein Param). Die Chips bleiben für alle
 *    Einsatzorte OHNE externe Steuerung unverändert.
 * Combobox-A11y: role=combobox + listbox/option, aria-expanded, Esc schließt.
 */
type Suggestion = { label: string; latitude: number; longitude: number; kind: string };

const KLASSEN = ["B", "B197", "BE", "B96", "A", "A2", "A1", "AM"];
const POPULAR_CITIES = [
  "München",
  "Berlin",
  "Hamburg",
  "Köln",
  "Frankfurt am Main",
  "Stuttgart",
  "Nürnberg",
  "Augsburg",
];

export function SearchBar({
  compact = false,
  klasse: klasseExtern,
}: { compact?: boolean; klasse?: string } = {}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [klasse, setKlasse] = useState("");
  // Externe Vorauswahl (Prop) gewinnt über die interne Chip-Auswahl.
  const effKlasse = klasseExtern !== undefined ? klasseExtern : klasse;
  const [picked, setPicked] = useState<Suggestion | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [geoBusy, setGeoBusy] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const typing = text.trim().length > 0 && !picked;
  const showSuggestions = typing && suggestions.length > 0;
  const showCities = !typing;

  useEffect(() => {
    const q = text.trim();
    if (q.length < 1 || picked) return;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
        if (!res.ok) return;
        const data = (await res.json()) as { suggestions: Suggestion[] };
        setSuggestions(data.suggestions ?? []);
        setOpen(true);
      } catch {
        /* offline/Fehler: still */
      }
    }, 200);
    return () => clearTimeout(t);
  }, [text, picked]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function go(params: Record<string, string>) {
    const sp = new URLSearchParams(params);
    router.push(`/fahrschulen?${sp.toString()}`);
  }

  function submit() {
    if (picked) {
      go({ lat: String(picked.latitude), lng: String(picked.longitude), ort: picked.label, ...(effKlasse ? { klasse: effKlasse } : {}) });
    } else if (text.trim()) {
      go({ ort: text.trim(), ...(effKlasse ? { klasse: effKlasse } : {}) });
    }
  }

  function useMyLocation() {
    if (!("geolocation" in navigator)) return;
    setGeoBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoBusy(false);
        go({ lat: String(pos.coords.latitude), lng: String(pos.coords.longitude), ort: "Mein Standort", ...(effKlasse ? { klasse: effKlasse } : {}) });
      },
      () => setGeoBusy(false),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  const optionCls = "flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition hover:bg-secondary";

  return (
    <div ref={boxRef} className="w-full max-w-2xl">
      {/* Such-Pille (z-30, damit das Dropdown über den Klassen-Chips liegt) */}
      <div className="relative z-30 flex items-center gap-2 rounded-full border border-border bg-card/95 p-1.5 pl-5 shadow-lg shadow-brand-ink/5 ring-1 ring-transparent backdrop-blur transition focus-within:border-brand-sky/50 focus-within:ring-brand-sky/30">
        {/* Standort-Pin statt zweiter Lupe (Gründer 2026-07-02): das Icon IM
            Feld beschreibt die EINGABE (Ort/Adresse), der runde Button rechts
            die AKTION (Lupe) — Standardmuster gegen das Doppel-Icon. */}
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" className="shrink-0 text-brand-sky">
          <path d="M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="2" />
        </svg>
        <input
          type="text"
          value={text}
          onChange={(e) => {
            const v = e.target.value;
            setText(v);
            setPicked(null);
            if (!v.trim()) setSuggestions([]);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder="Deine Adresse eingeben …"
          aria-label="Adresse oder Ort"
          aria-expanded={open}
          aria-controls="search-suggestions"
          role="combobox"
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent py-2.5 text-base outline-none placeholder:text-muted-foreground"
        />
        {/* Runder Icon-Button nach Airbnb-Vorbild (Gründer 2026-07-02):
            kompakter Mint-Kreis mit Lupe; ab sm erweitert um das
            „Suchen"-Label (beide Formen ≥48px Touch-Ziel). */}
        <button
          type="button"
          onClick={submit}
          aria-label="Suchen"
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent font-semibold text-accent-foreground transition-transform duration-200 hover:scale-[1.05] hover:bg-brand-lime active:scale-[0.95] sm:size-auto sm:min-h-12 sm:gap-2 sm:px-6"
        >
          <svg
            className="size-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <span className="hidden text-base sm:inline">Suchen</span>
        </button>

        {open && (showSuggestions || showCities) && (
          <ul
            id="search-suggestions"
            role="listbox"
            className="absolute left-0 top-[calc(100%+0.5rem)] z-20 w-full overflow-hidden rounded-2xl border border-border bg-popover py-1.5 shadow-xl"
          >
            <li role="option" aria-selected="false">
              <button type="button" onClick={useMyLocation} disabled={geoBusy} className={`${optionCls} font-medium`}>
                <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-sky/15 text-brand-sky">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/><circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="2"/></svg>
                </span>
                {geoBusy ? "Standort wird ermittelt…" : "Standort verwenden — Fahrschulen in deiner Nähe"}
              </button>
            </li>

            {showSuggestions ? (
              suggestions.map((s) => (
                <li key={`${s.label}-${s.latitude}`} role="option" aria-selected="false">
                  <button
                    type="button"
                    onClick={() => {
                      setPicked(s);
                      setText(s.label);
                      setOpen(false);
                    }}
                    className={optionCls}
                  >
                    <span aria-hidden="true" className="text-muted-foreground">⌖</span>
                    {s.label}
                  </button>
                </li>
              ))
            ) : (
              <>
                <li className="px-4 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Beliebte Städte</li>
                {POPULAR_CITIES.map((c) => (
                  <li key={c} role="option" aria-selected="false">
                    <button type="button" onClick={() => go({ ort: c, ...(effKlasse ? { klasse: effKlasse } : {}) })} className={optionCls}>
                      <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center">
                        <CityIcon city={c} className="size-6" />
                      </span>
                      {c}
                    </button>
                  </li>
                ))}
              </>
            )}
          </ul>
        )}
      </div>

      {/* Führerscheinklasse als Chips (im Kompakt-Modus, z. B. Sticky-Suche, ausgeblendet) */}
      {!compact && (
      <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
        <span className="mr-1 text-xs text-muted-foreground">Klasse:</span>
        {["", ...KLASSEN].map((k) => {
          const active = klasse === k;
          return (
            <button
              key={k || "alle"}
              type="button"
              aria-pressed={active}
              onClick={() => setKlasse(k)}
              className={`rounded-full px-3 py-1 text-sm font-medium transition ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-card text-muted-foreground hover:border-brand-sky/50 hover:text-foreground"
              }`}
            >
              {k || "Alle"}
            </button>
          );
        })}
      </div>
      )}
    </div>
  );
}
