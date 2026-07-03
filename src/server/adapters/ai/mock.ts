import "server-only";

import type { AiPort, AiCompletionRequest } from "./port";

/**
 * MockAiProvider — deterministischer KI-Adapter (OS-P2, Insights V1).
 * ============================================================================
 * Implementiert den AiPort OHNE Netzwerk und OHNE externen Anbieter: Der Prompt
 * ist per Vertrag (src/modules/insights) ein kompaktes JSON aus AUSSCHLIESSLICH
 * PII-freien Aggregaten — `rolle` (Kategorie) und `kennzahlen` (Schlüssel aus
 * einer festen Allowlist + Ganzzahlen). Der Mock formuliert daraus per Template
 * eine deutsche Tageszusammenfassung. Gleicher Input ⇒ gleicher Output
 * (testbar, kein Zufall, keine Uhrzeit).
 *
 * WARUM KEIN PRODUKTIONS-THROW (bewusste Abweichung vom DevLog-Mail-Muster):
 * Der DevLog-Mail-Adapter MUSS in Produktion werfen, weil er eine zugesagte
 * Wirkung (Mail-Zustellung) still verschlucken würde — ein Ausfall wäre
 * unsichtbar und geschäftsschädigend. Der Insights-Text hat KEINE zugesagte
 * Außenwirkung: Der Mock IST die ehrliche Fallback-Stufe („automatisch
 * erstellt", template-basiert) und bleibt auch in Produktion korrekt, nur
 * weniger eloquent. Ein Throw würde Dashboards grundlos brechen. Stattdessen
 * loggt getAiAdapter() (index.ts) die Adapter-Wahl EINMALIG (ohne PII), damit
 * der Betrieb sieht, dass kein echter Anbieter konfiguriert ist.
 *
 * DATENSCHUTZGRENZE: Dieser Adapter erhält NIE Namen, Freitexte oder
 * Kontaktdaten — nur Zahlen und Kategorie-Schlüssel. Unbekannte Schlüssel
 * werden generisch, aber ohne Inhalt wiedergegeben (kein Durchreichen roher
 * Strings in den Ausgabetext).
 */

/** Erwartete Prompt-Struktur (Vertrag mit src/modules/insights). */
interface InsightsPromptDaten {
  rolle: string;
  kennzahlen: Array<{ k: string; v: number }>;
}

/**
 * Formulierungs-Templates je Kennzahl-Schlüssel: [Singular, Plural].
 * `${n}` wird durch die Zahl ersetzt. Nur POSITIVE Werte werden formuliert;
 * 0-Werte fallen weg (ruhiger Satz statt Aufzählung von Nullen).
 */
const TEMPLATES: Record<string, [string, string]> = {
  anfragen_neu: ["${n} neue Anfrage wartet auf Antwort", "${n} neue Anfragen warten auf Antwort"],
  bewerbungen_neu: ["${n} neue Bewerbung ist eingegangen", "${n} neue Bewerbungen sind eingegangen"],
  termine_heute: ["heute steht ${n} Termin an", "heute stehen ${n} Termine an"],
  termine_morgen: ["morgen steht ${n} Termin an", "morgen stehen ${n} Termine an"],
  posten_offen: ["${n} Rechnung ist offen", "${n} Rechnungen sind offen"],
  slots_heute: ["${n} Verfügbarkeits-Slot ist für heute eingetragen", "${n} Verfügbarkeits-Slots sind für heute eingetragen"],
  schueler_aktiv: ["${n} aktive Anmeldung läuft", "${n} aktive Anmeldungen laufen"],
  leads_heute: ["${n} Anfrage ist heute plattformweit eingegangen", "${n} Anfragen sind heute plattformweit eingegangen"],
  bewerbungen_heute: ["${n} Bewerbung ist heute plattformweit eingegangen", "${n} Bewerbungen sind heute plattformweit eingegangen"],
  schulen_aktiv: ["${n} Fahrschule ist gelistet", "${n} Fahrschulen sind gelistet"],
  api_keys_aktiv: ["${n} API-Schlüssel ist aktiv", "${n} API-Schlüssel sind aktiv"],
  fahrstunden_absolviert: ["${n} Fahrstunde ist absolviert", "${n} Fahrstunden sind absolviert"],
};

/** Ruhige Grundsätze, wenn keine (positiven) Kennzahlen vorliegen. */
const RUHIG = "Alles ruhig — es liegen keine neuen Zahlen für heute vor.";

function formuliere(kennzahl: { k: string; v: number }): string | null {
  if (!Number.isFinite(kennzahl.v) || kennzahl.v <= 0) return null;
  const n = Math.floor(kennzahl.v);
  const template = TEMPLATES[kennzahl.k];
  // Unbekannter Schlüssel: bewusst NICHT den rohen String ausgeben (Grenze) —
  // generische Formulierung, damit neue Kennzahlen nie Text-Injection werden.
  if (!template) return `${n} weitere Kennzahl${n === 1 ? "" : "en"} liegt vor`;
  return template[n === 1 ? 0 : 1].replaceAll("${n}", String(n));
}

/** Prompt defensiv parsen — bei jeder Abweichung leeres Datenobjekt (fail-soft). */
function parsePrompt(prompt: string): InsightsPromptDaten {
  try {
    const roh = JSON.parse(prompt) as unknown;
    if (typeof roh !== "object" || roh === null) return { rolle: "", kennzahlen: [] };
    const r = roh as Record<string, unknown>;
    const kennzahlen = Array.isArray(r.kennzahlen)
      ? r.kennzahlen
          .filter(
            (e): e is { k: string; v: number } =>
              typeof e === "object" && e !== null &&
              typeof (e as { k?: unknown }).k === "string" &&
              typeof (e as { v?: unknown }).v === "number",
          )
          .slice(0, 24)
      : [];
    return { rolle: typeof r.rolle === "string" ? r.rolle : "", kennzahlen };
  } catch {
    return { rolle: "", kennzahlen: [] };
  }
}

export class MockAiProvider implements AiPort {
  async complete(request: AiCompletionRequest): Promise<string> {
    const daten = parsePrompt(request.prompt);
    const teile = daten.kennzahlen
      .map(formuliere)
      .filter((t): t is string => t !== null);

    if (teile.length === 0) return RUHIG;
    if (teile.length === 1) return `${grossAnfang(teile[0])}.`;
    const letzte = teile[teile.length - 1];
    return `${grossAnfang(teile.slice(0, -1).join(", "))} und ${letzte}.`;
  }
}

function grossAnfang(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
