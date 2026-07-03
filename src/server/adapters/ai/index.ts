import "server-only";

import type { AiPort } from "./port";
import { MockAiProvider } from "./mock";

/**
 * KI-Adapter-Auswahl (OS-P2, Insights V1).
 * ----------------------------------------------------------------------------
 * V1 kennt genau EINEN Adapter: den deterministischen MockAiProvider (kein
 * Netz, kein Anbieter, keine Konfiguration). Ein echter, anbieterneutral
 * konfigurierter Provider wird später HIER ergänzt und per Laufzeit-Config
 * gewählt — ohne Eingriff in die Insights-Logik (Port-Prinzip wie E-Mail).
 *
 * PRODUKTIONSVERHALTEN (bewusst anders als der DevLog-Mail-Adapter, Begründung
 * im Docblock von mock.ts): Der Mock wirft in Produktion NICHT — er ist der
 * ehrliche Fallback („automatisch erstellt", template-basiert) und bleibt
 * fachlich korrekt. Damit der Betrieb die fehlende Anbieter-Konfiguration
 * trotzdem SIEHT, wird die Adapter-Wahl EINMALIG pro Prozess geloggt
 * (nur der Adapter-Name — keine PII, keine Prompts).
 */

let instance: AiPort | null = null;
let gewaehltGeloggt = false;

export function getAiAdapter(): AiPort {
  if (!instance) {
    instance = new MockAiProvider();
    if (!gewaehltGeloggt) {
      gewaehltGeloggt = true;
      console.info(
        "[KI] Adapter-Wahl: mock (deterministisch, kein Netz) — echter Anbieter nicht konfiguriert.",
      );
    }
  }
  return instance;
}
