/**
 * zeiten.ts — reine, testbare Zeit-Helfer für strukturierte Öffnungs-/Theoriezeiten.
 * ----------------------------------------------------------------------------
 * Datenvertrag: Zeilen aus `school_opening_hours` (siehe modules/schools/profile.ts):
 * `art` ('buero' | 'theorie' | 'praxis' | …), `wochentag` (0 = Montag … 6 = Sonntag),
 * `von`/`bis` als "HH:MM"- oder "HH:MM:SS"-Strings. KEIN Freitext — nur daraus
 * lassen sich Status-Aussagen wie „Jetzt geöffnet · bis 18:00" ableiten.
 *
 * Grundsätze:
 *  - KEIN `server-only`, KEINE Fremdbibliothek, KEIN implizites `Date.now()`:
 *    jede Statusfunktion nimmt ein EXPLIZITES `now` (deterministisch testbar).
 *  - Zeitzonen-Umrechnung ausschließlich über `Intl.DateTimeFormat` mit
 *    `timeZone` (Standard 'Europe/Berlin') — damit sind Sommer-/Winterzeit
 *    (DST) korrekt, ohne eigene Offset-Tabellen.
 *  - Rechenmodell: Minuten der Woche (0 = Mo 00:00 … 10079 = So 23:59).
 *    Blöcke über Mitternacht (bis ≤ von) laufen in den Folgetag; Wochen-
 *    Überlauf (So-Nacht → Mo) wird per Modulo behandelt.
 */

export interface ZeitenRow {
  art: string;
  /** 0 = Montag … 6 = Sonntag (DB-Konvention aus Migration 0001). */
  wochentag: number;
  von: string;
  bis: string;
}

export type OeffnungsStatusArt = "geoeffnet" | "schliesst_bald" | "geschlossen" | "oeffnet_bald";

export interface OeffnungsStatus {
  status: OeffnungsStatusArt;
  /** Fertiges Anzeige-Label, z. B. „Jetzt geöffnet · bis 18:00". */
  label: string;
}

export interface TheorieTermin {
  /** „heute" | „morgen" | Kurz-Wochentag („Mi"). */
  tagLabel: string;
  von: string;
  bis: string;
}

export interface RasterBlock {
  art: string;
  von: string;
  bis: string;
  /** Minuten seit 00:00 des Spaltentags (für Balken-Geometrie). */
  startMin: number;
  endMin: number;
}

export interface RasterTag {
  wochentag: number;
  label: string;
  bloecke: RasterBlock[];
}

const TAGE_KURZ = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"] as const;
const TAG_MIN = 24 * 60;
const WOCHE_MIN = 7 * TAG_MIN;
/** Schwelle für „schließt bald" / „öffnet bald" (Minuten). */
export const BALD_SCHWELLE_MIN = 60;

/** "HH:MM[:SS]" → Minuten seit 00:00; ungültig → null. */
function parseHm(t: string): number | null {
  const m = /^(\d{2}):(\d{2})/.exec(t);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** "HH:MM[:SS]" → "HH:MM" (reine String-Kürzung für Labels). */
const hhmm = (t: string): string => t.slice(0, 5);

/** Minute-der-Woche → "HH:MM" (Tagesanteil). */
function minToHm(minOfWeek: number): string {
  const m = ((minOfWeek % TAG_MIN) + TAG_MIN) % TAG_MIN;
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

// Intl liefert bei en-US Kurz-Wochentage — stabile Schlüssel für die Umrechnung
// auf unsere Konvention 0 = Montag.
const WD_INDEX: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

/**
 * Instant → lokale Minute-der-Woche in `tz` (DST-korrekt via Intl, ohne Fremdlib).
 * Exportiert für Tests der TZ-/DST-Kanten.
 */
export function minuteDerWoche(now: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  let tag = 0;
  let stunde = 0;
  let minute = 0;
  for (const p of parts) {
    if (p.type === "weekday") tag = WD_INDEX[p.value] ?? 0;
    else if (p.type === "hour") stunde = Number(p.value);
    else if (p.type === "minute") minute = Number(p.value);
  }
  return tag * TAG_MIN + stunde * 60 + minute;
}

interface Intervall {
  /** Minute der Woche (0…10079). */
  start: number;
  /** Ende; kann `start + x` mit Überlauf über die Wochengrenze sein (end > start immer). */
  end: number;
  row: ZeitenRow;
}

/** Zeilen einer Art → validierte Wochen-Intervalle (Mitternachts-Blöcke laufen über). */
function intervalle(rows: ZeitenRow[], art: string): Intervall[] {
  const out: Intervall[] = [];
  for (const row of rows) {
    if (row.art !== art) continue;
    if (!Number.isInteger(row.wochentag) || row.wochentag < 0 || row.wochentag > 6) continue;
    const von = parseHm(row.von);
    const bis = parseHm(row.bis);
    if (von == null || bis == null) continue;
    const start = row.wochentag * TAG_MIN + von;
    // bis ≤ von ⇒ Block läuft über Mitternacht in den Folgetag.
    const end = bis <= von ? start + (TAG_MIN - von) + bis : row.wochentag * TAG_MIN + bis;
    if (end <= start) continue;
    out.push({ start, end, row });
  }
  return out.sort((a, b) => a.start - b.start);
}

/** „heute"/„morgen"/Kurz-Wochentag für eine Ziel-Minute relativ zu `nowMin`. */
function tagLabelFuer(zielMinAbs: number, nowMin: number): string {
  const tagDiff = Math.floor(zielMinAbs / TAG_MIN) - Math.floor(nowMin / TAG_MIN);
  if (tagDiff === 0) return "heute";
  if (tagDiff === 1) return "morgen";
  return TAGE_KURZ[Math.floor(zielMinAbs / TAG_MIN) % 7];
}

/**
 * (a) Öffnungsstatus der BÜRO-Zeiten zum Zeitpunkt `now`.
 * Rückgabe null, wenn keine verwertbaren Büro-Zeilen vorliegen — die UI rendert
 * den Status dann bewusst NICHT (keine falsche „geschlossen"-Behauptung).
 */
export function openingStatus(
  rows: ZeitenRow[],
  now: Date,
  tz = "Europe/Berlin",
): OeffnungsStatus | null {
  const iv = intervalle(rows, "buero");
  if (iv.length === 0) return null;
  const nowMin = minuteDerWoche(now, tz);

  // Offen? (Kandidaten nowMin und nowMin+Woche decken den Wochen-Überlauf So→Mo ab.)
  for (const i of iv) {
    for (const n of [nowMin, nowMin + WOCHE_MIN]) {
      if (n >= i.start && n < i.end) {
        const bisLabel = minToHm(i.end);
        if (i.end - n <= BALD_SCHWELLE_MIN) {
          return { status: "schliesst_bald", label: `Schließt bald · ${bisLabel}` };
        }
        return { status: "geoeffnet", label: `Jetzt geöffnet · bis ${bisLabel}` };
      }
    }
  }

  // Geschlossen: nächste Öffnung suchen.
  let besteDelta = Infinity;
  let besteStart = 0;
  for (const i of iv) {
    const delta = (i.start - nowMin + WOCHE_MIN) % WOCHE_MIN;
    if (delta < besteDelta) {
      besteDelta = delta;
      besteStart = i.start;
    }
  }
  const vonLabel = minToHm(besteStart);
  if (besteDelta <= BALD_SCHWELLE_MIN) {
    return { status: "oeffnet_bald", label: `Öffnet um ${vonLabel}` };
  }
  const tag = tagLabelFuer(nowMin + besteDelta, nowMin);
  return { status: "geschlossen", label: `Geschlossen · Öffnet ${tag} ${vonLabel}` };
}

/**
 * (b) Die nächsten Theorie-Termine ab `now` (Standard: 3), chronologisch.
 * Bereits laufende Termine zählen nicht mehr als „nächste" — es geht um
 * Termine, die man noch erreichen kann.
 */
export function naechsteTheorie(
  rows: ZeitenRow[],
  now: Date,
  anzahl = 3,
  tz = "Europe/Berlin",
): TheorieTermin[] {
  const iv = intervalle(rows, "theorie");
  if (iv.length === 0) return [];
  const nowMin = minuteDerWoche(now, tz);
  // Wöchentlich wiederkehrende Slots über ZWEI Wochen ausrollen, damit `anzahl`
  // auch bei wenigen Wochen-Slots erfüllt wird (z. B. Mi/Fr → heute, Fr, Mi).
  return iv
    .flatMap((i) => {
      const delta = (i.start - nowMin + WOCHE_MIN) % WOCHE_MIN;
      return [
        { i, delta },
        { i, delta: delta + WOCHE_MIN },
      ];
    })
    .sort((a, b) => a.delta - b.delta)
    .slice(0, Math.max(0, anzahl))
    .map(({ i, delta }) => ({
      tagLabel: tagLabelFuer(nowMin + delta, nowMin),
      von: hhmm(i.row.von),
      bis: hhmm(i.row.bis),
    }));
}

/**
 * (c) 7-Spalten-Wochenraster Mo–So für die Balken-Visualisierung.
 * Mitternachts-Blöcke werden auf die betroffenen Tage AUFGETEILT (Spalte endet
 * um 24:00, Rest beginnt am Folgetag um 00:00) — jede Spalte bleibt in sich
 * konsistent (startMin < endMin, beides 0…1440).
 */
export function wochenraster(rows: ZeitenRow[]): RasterTag[] {
  const tage: RasterTag[] = TAGE_KURZ.map((label, wochentag) => ({
    wochentag,
    label,
    bloecke: [],
  }));

  for (const row of rows) {
    if (!Number.isInteger(row.wochentag) || row.wochentag < 0 || row.wochentag > 6) continue;
    const von = parseHm(row.von);
    const bis = parseHm(row.bis);
    if (von == null || bis == null) continue;

    if (bis > von) {
      tage[row.wochentag].bloecke.push({
        art: row.art,
        von: hhmm(row.von),
        bis: hhmm(row.bis),
        startMin: von,
        endMin: bis,
      });
    } else {
      // Über Mitternacht: Teil 1 bis 24:00, Teil 2 ab 00:00 am Folgetag.
      tage[row.wochentag].bloecke.push({
        art: row.art,
        von: hhmm(row.von),
        bis: "24:00",
        startMin: von,
        endMin: TAG_MIN,
      });
      if (bis > 0) {
        tage[(row.wochentag + 1) % 7].bloecke.push({
          art: row.art,
          von: "00:00",
          bis: hhmm(row.bis),
          startMin: 0,
          endMin: bis,
        });
      }
    }
  }

  for (const t of tage) t.bloecke.sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
  return tage;
}

/** Wochentag (0=Mo) des Zeitpunkts `now` in `tz` — für „heute"-Hervorhebung im Raster. */
export function wochentagVon(now: Date, tz = "Europe/Berlin"): number {
  return Math.floor(minuteDerWoche(now, tz) / TAG_MIN);
}
