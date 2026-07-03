import "server-only";

import { getAiAdapter } from "@/server/adapters/ai";

/**
 * modules/insights — KI-Insights V1 (OS-P2): Tageszusammenfassung, nächste
 * empfohlene Aktion und Risiko-Hinweise je Rolle.
 * ============================================================================
 * DATENSCHUTZGRENZE (verbindlich, auch für P3-Erweiterungen):
 * An den AiPort gehen AUSSCHLIESSLICH Zahlen und Kategorie-Schlüssel aus der
 * festen PROMPT_ALLOWLIST unten — NIEMALS Namen, Freitexte, E-Mail-Adressen,
 * Telefonnummern oder sonstige personenbeziehbare Daten. Die Kennzahlen sind
 * Aggregate aus den bereits RLS-geprüften dashboard.ts-Ergebnissen (Counts).
 * `baueAiPrompt` erzwingt die Grenze technisch: unbekannte Schlüssel und
 * Nicht-Zahlen werden verworfen, Werte auf nicht-negative Ganzzahlen normiert.
 *
 * ARBEITSTEILUNG:
 *  - Die ZUSAMMENFASSUNG formuliert der AiPort (V1: deterministischer
 *    MockAiProvider, Template-basiert — UI kennzeichnet sie als „automatisch
 *    erstellt").
 *  - AKTION + RISIKEN sind bewusst DETERMINISTISCHE Regeln in diesem Modul
 *    (nachvollziehbar, testbar, kein Modell-Ermessen bei Handlungsempfehlungen).
 *
 * FAIL-SOFT: Ein Adapter-Fehler bricht das Dashboard nicht — die
 * Zusammenfassung fällt dann auf einen ehrlichen Standardsatz zurück.
 */

/** Rollen-Kategorie (kein PII; steuert nur Formulierungs-Kontext + Regeln). */
export type InsightsRolle =
  | "inhaber"
  | "verwaltung"
  | "fahrlehrer"
  | "student"
  | "admin"
  | "support"
  | "moderator"
  | "editor"
  | "vertrieb"
  | "api_partner";

/**
 * Kennzahlen-Schlüssel. Die PROMPT-Schlüssel dürfen an den AiPort; die reinen
 * REGEL-Schlüssel (Risiko-/Aktionslogik) bleiben lokal in diesem Modul.
 */
const PROMPT_ALLOWLIST = [
  "anfragen_neu",
  "bewerbungen_neu",
  "termine_heute",
  "termine_morgen",
  "posten_offen",
  "slots_heute",
  "schueler_aktiv",
  "leads_heute",
  "bewerbungen_heute",
  "schulen_aktiv",
  "api_keys_aktiv",
  "fahrstunden_absolviert",
] as const;
type PromptKennzahl = (typeof PROMPT_ALLOWLIST)[number];

type RegelKennzahl =
  | "anfragen_neu_aelter_48h"
  | "verfuegbarkeit_heute_gepflegt" // 0|1
  | "termine_geplant";

export type InsightsKennzahlen = Partial<Record<PromptKennzahl | RegelKennzahl, number>>;

export interface InsightChip {
  ton: "hinweis" | "warnung";
  text: string;
}

export interface TagesInsights {
  /** Vom AiPort formulierte Tageszusammenfassung („automatisch erstellt"). */
  zusammenfassung: string;
  naechsteAktion: string | null;
  risiken: InsightChip[];
}

/** Nicht-negative Ganzzahl oder null (verworfen). */
function normZahl(wert: unknown): number | null {
  if (typeof wert !== "number" || !Number.isFinite(wert) || wert < 0) return null;
  return Math.floor(wert);
}

/**
 * Baut den AiPort-Prompt: JSON aus Rolle + allowlist-gefilterten Zahlen.
 * Exportiert für Tests (Nachweis der Datenschutzgrenze).
 */
export function baueAiPrompt(rolle: InsightsRolle, kennzahlen: InsightsKennzahlen): string {
  const gefiltert = PROMPT_ALLOWLIST.flatMap((k) => {
    const v = normZahl(kennzahlen[k]);
    return v === null ? [] : [{ k, v }];
  });
  return JSON.stringify({ rolle, kennzahlen: gefiltert });
}

/** Deterministische Regeln: nächste empfohlene Aktion + Risiko-Hinweise. */
export function leiteRegelnAb(
  rolle: InsightsRolle,
  kennzahlen: InsightsKennzahlen,
): { naechsteAktion: string | null; risiken: InsightChip[] } {
  const z = (k: PromptKennzahl | RegelKennzahl) => normZahl(kennzahlen[k]) ?? 0;
  const risiken: InsightChip[] = [];
  let naechsteAktion: string | null = null;

  if (rolle === "inhaber" || rolle === "verwaltung") {
    const alt = z("anfragen_neu_aelter_48h");
    if (alt > 0) {
      risiken.push({
        ton: "warnung",
        text:
          alt === 1
            ? "1 Anfrage ist älter als 48 h und unbeantwortet"
            : `${alt} Anfragen sind älter als 48 h und unbeantwortet`,
      });
      naechsteAktion = "Beantworte zuerst die älteste offene Anfrage.";
    } else if (z("anfragen_neu") > 0) {
      naechsteAktion = "Sieh dir die neuen Anfragen an.";
    } else if (z("bewerbungen_neu") > 0) {
      naechsteAktion = "Sieh dir die neue Bewerbung an.";
    }
    if (z("slots_heute") === 0) {
      risiken.push({
        ton: "hinweis",
        text: "Für heute sind keine Fahrlehrer-Verfügbarkeiten eingetragen",
      });
    }
    if (z("posten_offen") > 0) {
      risiken.push({
        ton: "hinweis",
        text:
          z("posten_offen") === 1
            ? "1 Rechnung ist noch offen"
            : `${z("posten_offen")} Rechnungen sind noch offen`,
      });
    }
  }

  if (rolle === "fahrlehrer") {
    if (z("verfuegbarkeit_heute_gepflegt") === 0) {
      risiken.push({
        ton: "warnung",
        text: "Deine Verfügbarkeit für heute ist nicht eingetragen",
      });
      naechsteAktion = "Trag deine Verfügbarkeit für heute ein.";
    } else if (z("termine_heute") > 0) {
      naechsteAktion = "Wirf einen Blick auf deinen Tagesplan.";
    }
  }

  if (rolle === "student") {
    naechsteAktion =
      z("termine_geplant") > 0
        ? "Sieh dir deine nächsten Termine an."
        : "Frag deine Fahrschule nach dem nächsten Termin.";
  }

  if (rolle === "admin" && z("leads_heute") + z("bewerbungen_heute") > 0) {
    naechsteAktion = "Prüfe die heutigen Anfragen und Bewerbungen.";
  }

  return { naechsteAktion, risiken };
}

const FALLBACK_ZUSAMMENFASSUNG =
  "Deine Zusammenfassung ist gerade nicht verfügbar — die Zahlen unten sind aktuell.";

/**
 * Erzeugt die Tages-Insights einer Rolle aus PII-freien Aggregaten.
 * Fail-soft: liefert bei Adapter-Fehlern eine Standard-Zusammenfassung,
 * Regeln (Aktion/Risiken) funktionieren immer.
 */
export async function erzeugeTagesInsights(
  rolle: InsightsRolle,
  kennzahlen: InsightsKennzahlen,
): Promise<TagesInsights> {
  const { naechsteAktion, risiken } = leiteRegelnAb(rolle, kennzahlen);

  let zusammenfassung = FALLBACK_ZUSAMMENFASSUNG;
  try {
    zusammenfassung = await getAiAdapter().complete({
      system:
        "Formuliere aus den PII-freien Kennzahlen eine kurze deutsche Tageszusammenfassung (Du-Form).",
      prompt: baueAiPrompt(rolle, kennzahlen),
    });
  } catch (fehler) {
    console.error(
      "[insights] AiPort-Aufruf fehlgeschlagen:",
      fehler instanceof Error ? fehler.message : "unbekannter Fehler",
    );
  }

  return { zusammenfassung, naechsteAktion, risiken };
}
