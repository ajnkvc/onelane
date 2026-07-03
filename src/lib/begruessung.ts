/**
 * begruessung.ts — zeitabhängige Begrüßung + Datumszeile der App-Shell (OS-P2).
 * ----------------------------------------------------------------------------
 * Reine Funktionen (testbar), TZ-fest in Europe/Berlin (Server-TZ-unabhängig,
 * Muster src/lib/zeiten.ts). Grenzen: Morgen < 11 Uhr ≤ Tag < 18 Uhr ≤ Abend
 * (bis < 5 Uhr zählt zur Nacht → ebenfalls „Guten Abend").
 */

const TZ = "Europe/Berlin";

/** Stunde (0–23) des Zeitpunkts in Europe/Berlin. */
function stundeIn(now: Date, tz: string): number {
  const teil = new Intl.DateTimeFormat("de-DE", {
    timeZone: tz,
    hour: "numeric",
    hourCycle: "h23",
  }).format(now);
  const stunde = Number.parseInt(teil, 10);
  return Number.isFinite(stunde) ? stunde : 12;
}

/** „Guten Morgen/Tag/Abend" — ohne Name (den hängt die Shell an). */
export function begruessung(now: Date, tz: string = TZ): string {
  const stunde = stundeIn(now, tz);
  if (stunde >= 5 && stunde < 11) return "Guten Morgen";
  if (stunde >= 11 && stunde < 18) return "Guten Tag";
  return "Guten Abend";
}

/** Datumszeile der Topbar, z. B. „Donnerstag, 3. Juli 2026" (de-DE, Berlin). */
export function datumZeile(now: Date, tz: string = TZ): string {
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: tz,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(now);
}
