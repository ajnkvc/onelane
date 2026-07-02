/**
 * faq-ergaenzung.ts — reine, testbare Auto-Ergänzung des Schul-FAQ.
 * ----------------------------------------------------------------------------
 * Benchmark guter Portale: 8–10 FAQ je Profil. Wir ergänzen die von der
 * Fahrschule gepflegten Fragen um bis zu 4 AUTO-GENERIERTE, SCHUL-INDIVIDUELLE
 * Q&A aus den Strukturdaten — NUR wenn die Datengrundlage wirklich existiert.
 * Jede Antwort nennt Schulname und echte Werte (keine identischen Massentexte).
 * Themen-Dedupe: Behandelt eine vorhandene Frage das Thema bereits
 * (Stichwort-Treffer), entfällt die generierte Frage. Kein server-only, keine
 * DB — deterministisch unit-testbar. Das FAQPage-JSON-LD bleibt deckungsgleich,
 * weil die Profilseite sichtbares FAQ und JSON-LD aus DERSELBEN kombinierten
 * Liste baut.
 */

export interface FaqItem {
  frage: string;
  antwort: string;
}

export interface FaqErgaenzungInput {
  name: string;
  klassen: string[];
  /** Anzeige-Namen der Sprachen (z. B. „Deutsch", „Englisch"), NICHT die Codes. */
  sprachen: string[];
  vehicles?: { marke?: string | null; modell?: string | null; getriebe?: string | null }[];
  /** Strukturierte Theoriezeiten (Datenform aus lib/zeiten.ts: 0 = Montag). */
  theorieZeiten?: { wochentag: number; von: string; bis: string }[];
  /** Bereits vorhandene FAQ-Fragen der Schule (Themen-Dedupe). */
  vorhandeneFragen?: string[];
}

const MAX_ERGAENZUNGEN = 4;

const WOCHENTAG_ADV = [
  "montags",
  "dienstags",
  "mittwochs",
  "donnerstags",
  "freitags",
  "samstags",
  "sonntags",
] as const;

/** „A", „A und B", „A, B und C" — deutsche Aufzählung. */
function listeUnd(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} und ${items[items.length - 1]}`;
}

/** "HH:MM[:SS]" → "HH:MM"; ungültige Werte → null. */
function hhmm(t: string): string | null {
  return /^\d{2}:\d{2}/.test(t) ? t.slice(0, 5) : null;
}

/** Prüft, ob eine vorhandene Frage das Thema bereits behandelt (Stichwort). */
function themaVorhanden(fragen: string[], stichwort: RegExp): boolean {
  return fragen.some((f) => stichwort.test(f));
}

/**
 * Leitet bis zu 4 schul-individuelle FAQ aus Strukturdaten ab. Reihenfolge:
 * Automatik → Sprachen → Theoriezeiten → Klassen. Nur mit echter Datengrundlage.
 */
export function ergaenzeFaq(input: FaqErgaenzungInput): FaqItem[] {
  const name = input.name.trim();
  if (!name) return [];
  const vorhandene = input.vorhandeneFragen ?? [];
  const out: FaqItem[] = [];

  // 1) Automatik — nur wenn mindestens ein Fahrzeug mit Automatikgetriebe existiert.
  const automatik = (input.vehicles ?? []).filter((v) => v.getriebe === "automatik");
  if (automatik.length > 0 && !themaVorhanden(vorhandene, /automatik/i)) {
    const namen = automatik
      .map((v) => [v.marke, v.modell].filter((t): t is string => !!t && t.trim() !== "").join(" ").trim())
      .filter((t) => t !== "");
    const antwort =
      namen.length === 0
        ? `Ja — ${name} bildet auch auf einem Fahrzeug mit Automatikgetriebe aus.`
        : namen.length === 1
          ? `Ja — bei ${name} steht dafür ein ${namen[0]} zur Verfügung.`
          : `Ja — bei ${name} stehen dafür ${listeUnd(namen)} zur Verfügung.`;
    out.push({ frage: `Bietet ${name} Automatik-Ausbildung an?`, antwort });
  }

  // 2) Sprachen — nur wenn Sprachangaben vorliegen.
  if (input.sprachen.length > 0 && !themaVorhanden(vorhandene, /sprach/i)) {
    const antwort =
      input.sprachen.length === 1
        ? `Der Unterricht bei ${name} findet auf ${input.sprachen[0]} statt.`
        : `Der Unterricht bei ${name} ist auf ${listeUnd(input.sprachen)} möglich.`;
    out.push({ frage: `In welchen Sprachen unterrichtet ${name}?`, antwort });
  }

  // 3) Theoriezeiten — nur mit validen strukturierten Zeilen; gleiche Zeitfenster
  //    werden zu „montags, mittwochs und donnerstags von 18:30 bis 20:00 Uhr" gebündelt.
  const gruppen = new Map<string, { von: string; bis: string; tage: Set<number> }>();
  for (const z of input.theorieZeiten ?? []) {
    const von = hhmm(z.von);
    const bis = hhmm(z.bis);
    if (von == null || bis == null) continue;
    if (!Number.isInteger(z.wochentag) || z.wochentag < 0 || z.wochentag > 6) continue;
    const key = `${von}–${bis}`;
    const g = gruppen.get(key) ?? { von, bis, tage: new Set<number>() };
    g.tage.add(z.wochentag);
    gruppen.set(key, g);
  }
  if (gruppen.size > 0 && !themaVorhanden(vorhandene, /theorie/i)) {
    const teile = [...gruppen.values()].map(
      (g) =>
        `${listeUnd([...g.tage].sort((a, b) => a - b).map((t) => WOCHENTAG_ADV[t]))} von ${g.von} bis ${g.bis} Uhr`,
    );
    out.push({
      frage: "Wann findet der Theorieunterricht statt?",
      antwort: `Der Theorieunterricht bei ${name} findet ${teile.join(" sowie ")} statt.`,
    });
  }

  // 4) Führerscheinklassen — nur wenn Klassen gepflegt sind.
  if (input.klassen.length > 0 && !themaVorhanden(vorhandene, /klasse/i)) {
    const antwort =
      input.klassen.length === 1
        ? `${name} bildet in der Klasse ${input.klassen[0]} aus.`
        : `${name} bildet in den Klassen ${listeUnd(input.klassen)} aus.`;
    out.push({ frage: `Welche Führerscheinklassen bietet ${name} an?`, antwort });
  }

  return out.slice(0, MAX_ERGAENZUNGEN);
}
