import { describe, it, expect, vi } from "vitest";

// server-only in Vitest (Node) als No-op mocken (Muster tests/portal-guards.test.ts).
vi.mock("server-only", () => ({}));

import { MockAiProvider } from "@/server/adapters/ai/mock";
import { baueAiPrompt, leiteRegelnAb, erzeugeTagesInsights } from "@/modules/insights";

/**
 * Tests der KI-Insights V1 (OS-P2):
 *  - MockAiProvider: deterministisch, template-basiert, injektionsfest.
 *  - baueAiPrompt: DATENSCHUTZGRENZE — nur Allowlist-Schlüssel + Ganzzahlen.
 *  - leiteRegelnAb: deterministische Aktion/Risiken (48-h-Regel usw.).
 */

describe("MockAiProvider", () => {
  const mock = new MockAiProvider();

  it("gleicher Input ⇒ gleicher Output (deterministisch)", async () => {
    const prompt = JSON.stringify({
      rolle: "inhaber",
      kennzahlen: [
        { k: "anfragen_neu", v: 2 },
        { k: "termine_heute", v: 4 },
      ],
    });
    const a = await mock.complete({ prompt });
    const b = await mock.complete({ prompt });
    expect(a).toBe(b);
    expect(a).toContain("2 neue Anfragen");
    expect(a).toContain("4 Termine");
  });

  it("Singular/Plural korrekt, 0-Werte fallen weg", async () => {
    const text = await mock.complete({
      prompt: JSON.stringify({
        rolle: "inhaber",
        kennzahlen: [
          { k: "anfragen_neu", v: 1 },
          { k: "bewerbungen_neu", v: 0 },
        ],
      }),
    });
    expect(text).toContain("1 neue Anfrage wartet");
    expect(text).not.toContain("Bewerbung");
  });

  it("leere/kaputte Prompts ⇒ ruhiger Standardsatz (fail-soft)", async () => {
    expect(await mock.complete({ prompt: "kein json" })).toContain("Alles ruhig");
    expect(await mock.complete({ prompt: "{}" })).toContain("Alles ruhig");
  });

  it("unbekannte Schlüssel werden NIE in den Text durchgereicht (Injektionsschutz)", async () => {
    const text = await mock.complete({
      prompt: JSON.stringify({
        rolle: "inhaber",
        kennzahlen: [{ k: "<script>alert(1)</script>", v: 3 }],
      }),
    });
    expect(text).not.toContain("<script>");
    expect(text).toContain("3 weitere Kennzahlen");
  });
});

describe("baueAiPrompt — Datenschutzgrenze", () => {
  it("filtert fremde Schlüssel und Nicht-Zahlen heraus", () => {
    const prompt = baueAiPrompt("inhaber", {
      anfragen_neu: 3,
      // @ts-expect-error — bewusst fremder Schlüssel (Grenz-Test)
      kunden_name: "Max Mustermann",
      termine_heute: Number.NaN,
    });
    const daten = JSON.parse(prompt) as { kennzahlen: Array<{ k: string; v: number }> };
    expect(daten.kennzahlen).toEqual([{ k: "anfragen_neu", v: 3 }]);
    expect(prompt).not.toContain("Mustermann");
  });

  it("Regel-Schlüssel (48h, Verfügbarkeit) gehen NICHT an den AiPort", () => {
    const prompt = baueAiPrompt("fahrlehrer", {
      termine_heute: 2,
      anfragen_neu_aelter_48h: 5,
      verfuegbarkeit_heute_gepflegt: 0,
    });
    expect(prompt).not.toContain("aelter_48h");
    expect(prompt).not.toContain("verfuegbarkeit");
  });
});

describe("leiteRegelnAb — deterministische Regeln", () => {
  it("48-h-Regel: Warnung + Aktion für Schul-Manager", () => {
    const { naechsteAktion, risiken } = leiteRegelnAb("inhaber", {
      anfragen_neu: 4,
      anfragen_neu_aelter_48h: 3,
      slots_heute: 2,
    });
    expect(risiken.some((r) => r.ton === "warnung" && r.text.includes("48 h"))).toBe(true);
    expect(risiken.some((r) => r.text.includes("3 Anfragen"))).toBe(true);
    expect(naechsteAktion).toContain("älteste");
  });

  it("fehlende Verfügbarkeit: Warnung für Fahrlehrer", () => {
    const { naechsteAktion, risiken } = leiteRegelnAb("fahrlehrer", {
      termine_heute: 2,
      verfuegbarkeit_heute_gepflegt: 0,
    });
    expect(risiken.some((r) => r.ton === "warnung")).toBe(true);
    expect(naechsteAktion).toContain("Verfügbarkeit");
  });

  it("Student: Aktion hängt an geplanten Terminen", () => {
    expect(leiteRegelnAb("student", { termine_geplant: 2 }).naechsteAktion).toContain(
      "nächsten Termine",
    );
    expect(leiteRegelnAb("student", { termine_geplant: 0 }).naechsteAktion).toContain(
      "Fahrschule",
    );
  });

  it("ruhiger Tag: keine Aktion, keine Risiken (editor)", () => {
    const { naechsteAktion, risiken } = leiteRegelnAb("editor", {});
    expect(naechsteAktion).toBeNull();
    // editor hat keine slots-Regel — keine falschen Warnungen
    expect(risiken).toEqual([]);
  });
});

describe("erzeugeTagesInsights — Ende-zu-Ende (Mock)", () => {
  it("liefert Zusammenfassung + Aktion + Risiken aus reinen Zahlen", async () => {
    const insights = await erzeugeTagesInsights("inhaber", {
      anfragen_neu: 2,
      anfragen_neu_aelter_48h: 1,
      termine_heute: 4,
      slots_heute: 3,
      posten_offen: 1,
    });
    expect(insights.zusammenfassung).toContain("2 neue Anfragen");
    expect(insights.naechsteAktion).toContain("älteste");
    expect(insights.risiken.length).toBeGreaterThan(0);
  });
});
