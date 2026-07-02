"use client";

import { useCallback, useEffect, useState } from "react";
import { MAX_VERGLEICH } from "@/lib/vergleich";

/**
 * vergleich-merker.tsx — „Vergleichen"-Toggle je Suchergebnis-Zeile + Merker-Store.
 * ----------------------------------------------------------------------------
 * PROGRESSIVE ENHANCEMENT: Der Vergleichs-UI-Layer (Toggle + Compare-Bar) ist
 * eine Client-Insel. Der Server rendert die Toggles zwar mit (Hydration-
 * Grundzustand), aber NICHT interaktiv — ohne JS bleiben sie folgenlos, und
 * die Compare-Bar (der eigentliche Navigations-Layer) erscheint ohne JS NIE
 * (SSR-Grundzustand: leerer Merker → null). Die /vergleich-URLs selbst
 * funktionieren dagegen IMMER ohne JS (reine SSR-Seite) — geteilte Links
 * bleiben also für alle nutzbar.
 *
 * PERSISTENZ: localStorage-Key `onelane.vergleich.v1`, Wert = Array aus
 * {stadtSlug, slug, name}, dedupliziert, hartes Cap MAX_VERGLEICH (4). Lesen
 * ist defensiv (fremder/kaputter JSON → leerer Merker). Mehrere Inseln auf der
 * Seite synchronisieren sich über ein CustomEvent (gleicher Tab) und das
 * native `storage`-Event (andere Tabs).
 *
 * Der Toggle liegt im Zeilen-Design ÜBER dem Zeilen-Overlay-Link (relative
 * z-10, wie die bestehenden CTAs), Touch-Ziel ≥ 44 px, Zustand via aria-pressed.
 * Bei vollem Merker ist Hinzufügen deaktiviert (Tooltip „maximal 4").
 */

export interface VergleichsEintrag {
  stadtSlug: string;
  slug: string;
  name: string;
}

const STORAGE_KEY = "onelane.vergleich.v1"; // gitleaks:allow (localStorage-Schluessel, kein Secret)
const SYNC_EVENT = "onelane:vergleich";
const SLUG_MUSTER = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function istEintrag(e: unknown): e is VergleichsEintrag {
  if (e == null || typeof e !== "object") return false;
  const { stadtSlug, slug, name } = e as Record<string, unknown>;
  return (
    typeof stadtSlug === "string" && SLUG_MUSTER.test(stadtSlug) && stadtSlug.length <= 200 &&
    typeof slug === "string" && SLUG_MUSTER.test(slug) && slug.length <= 200 &&
    typeof name === "string" && name.length > 0
  );
}

/** Merker defensiv aus localStorage lesen (kaputt/fremd → leer, nie werfen). */
export function leseMerker(): VergleichsEintrag[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: VergleichsEintrag[] = [];
    const gesehen = new Set<string>();
    for (const e of parsed) {
      if (!istEintrag(e)) continue;
      const key = `${e.stadtSlug}/${e.slug}`;
      if (gesehen.has(key)) continue;
      gesehen.add(key);
      out.push({ stadtSlug: e.stadtSlug, slug: e.slug, name: e.name.slice(0, 120) });
      if (out.length >= MAX_VERGLEICH) break;
    }
    return out;
  } catch {
    return [];
  }
}

function schreibeMerker(liste: VergleichsEintrag[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(liste.slice(0, MAX_VERGLEICH)));
  } catch {
    // Storage voll/blockiert (z. B. Private Mode): UI-State lebt trotzdem weiter.
  }
  window.dispatchEvent(new CustomEvent(SYNC_EVENT));
}

/**
 * Gemeinsamer Hook aller Vergleichs-Inseln (Toggles + Compare-Bar).
 * Initialer State ist LEER (SSR-/Hydration-stabil); der echte Merker kommt im
 * Effect — dadurch kein Hydration-Mismatch und kein Layout-Shift beim Laden.
 */
export function useVergleichsMerker() {
  const [liste, setListe] = useState<VergleichsEintrag[]>([]);

  useEffect(() => {
    const sync = () => setListe(leseMerker());
    sync();
    window.addEventListener(SYNC_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(SYNC_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const toggle = useCallback((eintrag: VergleichsEintrag) => {
    const aktuell = leseMerker();
    const ohne = aktuell.filter(
      (e) => !(e.stadtSlug === eintrag.stadtSlug && e.slug === eintrag.slug),
    );
    if (ohne.length < aktuell.length) {
      schreibeMerker(ohne); // war gemerkt → entfernen
    } else if (aktuell.length < MAX_VERGLEICH) {
      schreibeMerker([...aktuell, eintrag]);
    }
  }, []);

  const entferne = useCallback((stadtSlug: string, slug: string) => {
    schreibeMerker(leseMerker().filter((e) => !(e.stadtSlug === stadtSlug && e.slug === slug)));
  }, []);

  const leeren = useCallback(() => schreibeMerker([]), []);

  return { liste, toggle, entferne, leeren };
}

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/** Waage-Glyph des Vergleichs (dekorativ; Zustand trägt Text + aria-pressed). */
function VergleichGlyph({ aktiv }: { aktiv: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-3.5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {aktiv ? <path d="M20 6 9 17l-5-5" /> : <path d="M12 5v14M5 12h14" />}
    </svg>
  );
}

export function VergleichMerker({ stadtSlug, slug, name }: VergleichsEintrag) {
  const { liste, toggle } = useVergleichsMerker();
  const gemerkt = liste.some((e) => e.stadtSlug === stadtSlug && e.slug === slug);
  const voll = !gemerkt && liste.length >= MAX_VERGLEICH;

  return (
    <button
      type="button"
      onClick={() => toggle({ stadtSlug, slug, name })}
      disabled={voll}
      aria-pressed={gemerkt}
      aria-label={
        voll
          ? `Vergleich voll — maximal ${MAX_VERGLEICH} Fahrschulen`
          : `${name} ${gemerkt ? "aus dem Vergleich entfernen" : "zum Vergleich hinzufügen"}`
      }
      title={voll ? `maximal ${MAX_VERGLEICH} Fahrschulen im Vergleich` : undefined}
      className={`relative z-10 inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm transition-colors duration-[var(--motion-duration-fast)] ease-[var(--motion-ease)] disabled:cursor-not-allowed disabled:opacity-45 ${
        gemerkt
          ? "border-primary/50 bg-primary/10 font-semibold text-primary"
          : "border-border bg-background font-medium text-muted-foreground hover:border-primary/50 hover:text-primary"
      } ${focusRing}`}
    >
      <VergleichGlyph aktiv={gemerkt} />
      {gemerkt ? "Im Vergleich" : "Vergleichen"}
    </button>
  );
}
