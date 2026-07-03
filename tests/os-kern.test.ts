import { beforeEach, describe, expect, it, vi } from "vitest";

// server-only in Vitest (Node) als No-op mocken; der DAL wird pro Fall gestellt
// (Muster tests/portal-guards.test.ts) — RLS selbst ist in tests/rls abgedeckt.
vi.mock("server-only", () => ({}));
vi.mock("@/server/dal", () => ({ withCurrentUserContext: vi.fn() }));

import { withCurrentUserContext } from "@/server/dal";
import {
  ANFRAGE_STATUS_LABEL,
  aelter48hText,
  anfrageStatusSetzen,
  bewerbungStatusSetzen,
  cursorDekodieren,
  cursorKodieren,
  getAnfragenListe,
  getBewerbungenListe,
  getSchuelerListe,
  neutralisiereVermittlung,
  schneideSeite,
  trenneRueckruf,
  verfuegbarLabel,
} from "@/modules/portal/os-kern";

/**
 * os-kern.test.ts — OS-Kern-Datenmodul (OS-P3, Paket A):
 *  - Pure Helfer: Cursor (fail-closed), Rückruf-Trennung, Seiten-Schnitt,
 *    Vermittlungs-Neutralisierung (Quereinsteiger OHNE Kontakte), Labels.
 *  - Datenfunktionen gegen gemockten DAL: Mapping, Cursor-Folgeseite,
 *    Fail-Soft (null/false), Schul-Bindung als gebundener SQL-Parameter,
 *    Klassen-Filter fail-closed.
 */

const dalMock = vi.mocked(withCurrentUserContext);

type Rows = Array<Record<string, unknown>>;

/** Stellt den DAL: execute liefert die Antworten der Reihe nach. */
function stelleDb(antworten: Rows[]): ReturnType<typeof vi.fn> {
  const execute = vi.fn();
  for (const rows of antworten) execute.mockResolvedValueOnce(rows);
  dalMock.mockImplementation(async (work) =>
    work({ execute } as unknown as Parameters<typeof work>[0]),
  );
  return execute;
}

/**
 * Zieht alle gebundenen Parameter-Werte aus einem drizzle-SQL-Objekt:
 * primitive Chunks in queryChunks sind Parameter (StringChunk trägt den
 * SQL-Text als string[]-`value` und wird übersprungen); verschachtelte
 * SQL-Fragmente (Filter) werden rekursiv besucht.
 */
function sammleParams(obj: unknown, acc: unknown[] = [], seen = new Set<object>()): unknown[] {
  if (typeof obj === "string" || typeof obj === "number") {
    acc.push(obj);
    return acc;
  }
  if (!obj || typeof obj !== "object" || seen.has(obj as object)) return acc;
  seen.add(obj as object);
  const kandidat = obj as Record<string, unknown>;
  if (Array.isArray(kandidat.queryChunks)) {
    for (const chunk of kandidat.queryChunks) sammleParams(chunk, acc, seen);
    return acc;
  }
  if ("value" in kandidat && (typeof kandidat.value === "string" || typeof kandidat.value === "number")) {
    acc.push(kandidat.value); // Param-Wrapper (z. B. bei künftigen drizzle-Versionen)
  }
  return acc;
}

const SCHULE = "22222222-2222-4222-8222-222222222222";
const FREMDE_ID = "33333333-3333-4333-8333-333333333333";
const LEAD = "44444444-4444-4444-8444-444444444444";
const TS = "2026-07-01 08:00:00.123456+00";

beforeEach(() => {
  vi.restoreAllMocks();
  dalMock.mockReset();
});

// ----------------------------------------------------------------------------
// Pure Helfer
// ----------------------------------------------------------------------------

describe("cursorKodieren/cursorDekodieren", () => {
  it("Roundtrip erhält ts + id exakt", () => {
    const token = cursorKodieren(TS, LEAD);
    expect(cursorDekodieren(token)).toEqual({ ts: TS, id: LEAD });
  });

  it("fail-closed: Müll, fremde Formate und überlange Token → null", () => {
    expect(cursorDekodieren(undefined)).toBeNull();
    expect(cursorDekodieren("")).toBeNull();
    expect(cursorDekodieren("kein-base64url-!!")).toBeNull();
    expect(cursorDekodieren(Buffer.from("nur-ein-teil").toString("base64url"))).toBeNull();
    expect(cursorDekodieren(cursorKodieren(TS, "keine-uuid"))).toBeNull();
    expect(cursorDekodieren(cursorKodieren("drop table leads;--", LEAD))).toBeNull();
    expect(cursorDekodieren("A".repeat(300))).toBeNull();
  });
});

describe("trenneRueckruf", () => {
  it("trennt die strukturierte Rückruf-Zeile vom Freitext", () => {
    expect(trenneRueckruf("Hallo!\n\nRückruf: vormittags")).toEqual({
      text: "Hallo!",
      rueckruf: "vormittags",
    });
  });

  it("nur Rückruf-Zeile → text null; ohne Rückruf → unverändert; null → beides null", () => {
    expect(trenneRueckruf("Rückruf: jederzeit")).toEqual({ text: null, rueckruf: "jederzeit" });
    expect(trenneRueckruf("Nur eine Frage.")).toEqual({ text: "Nur eine Frage.", rueckruf: null });
    expect(trenneRueckruf(null)).toEqual({ text: null, rueckruf: null });
  });

  it("Rückruf mitten im Text wird NICHT abgeschnitten (nur letzte Zeile zählt)", () => {
    const text = "Rückruf: bitte nicht\nIch schreibe lieber per Mail.";
    expect(trenneRueckruf(text)).toEqual({ text, rueckruf: null });
  });
});

describe("schneideSeite", () => {
  const zeile = (n: number) => ({ id: LEAD, cursorTs: `${TS}-${n}`, n });

  it("unter dem Limit: alles, kein Folge-Cursor", () => {
    const { seite, naechsterCursor } = schneideSeite([zeile(1), zeile(2)], 20);
    expect(seite).toHaveLength(2);
    expect(naechsterCursor).toBeNull();
  });

  it("limit+1-Zeilen: Seite wird geschnitten, Cursor zeigt auf die LETZTE Seiten-Zeile", () => {
    const { seite, naechsterCursor } = schneideSeite([zeile(1), zeile(2)], 1);
    expect(seite).toHaveLength(1);
    expect(naechsterCursor).toBe(cursorKodieren(`${TS}-1`, LEAD));
  });
});

describe("Labels", () => {
  it("48-h-Text nutzt die Insights-Formulierung (Singular/Plural)", () => {
    expect(aelter48hText(1)).toBe("1 Anfrage ist älter als 48 h und unbeantwortet");
    expect(aelter48hText(3)).toBe("3 Anfragen sind älter als 48 h und unbeantwortet");
  });

  it("'gesehen' heißt in der UI 'kontaktiert' (Tab-Kontrakt ohne Migration)", () => {
    expect(ANFRAGE_STATUS_LABEL.gesehen).toBe("kontaktiert");
  });

  it("verfuegbarLabel deckt alle Werte ab", () => {
    expect(verfuegbarLabel("sofort", null)).toBe("sofort verfügbar");
    expect(verfuegbarLabel("flexibel", null)).toBe("flexibel");
    expect(verfuegbarLabel("zum_datum", "01.09.2026")).toBe("verfügbar ab 01.09.2026");
    expect(verfuegbarLabel("zum_datum", null)).toBe("nach Absprache");
    expect(verfuegbarLabel(null, null)).toBeNull();
  });
});

describe("neutralisiereVermittlung", () => {
  const basis = {
    id: LEAD,
    name: "Quinn Beispiel",
    email: "quinn@example.org",
    telefon: "089 123456",
    nachricht: "Interesse an der Ausbildung.",
    bewerber_status: "quereinsteiger" as const,
    klassen_csv: "B,BE",
    verfuegbar_status: "flexibel",
    verfuegbar_ab: null,
    cv_dateiname: "cv.pdf",
    job_titel: "Fahrlehrer (m/w/d)",
    status: "neu" as const,
    alter_stunden: 8,
    eingegangen: "02.07.2026",
    cursor_ts: TS,
  };

  it("Quereinsteiger: KEIN Name, KEINE Kontakte, KEINE Nachricht, KEINE Unterlagen", () => {
    const e = neutralisiereVermittlung(basis);
    expect(e.vermittelt).toBe(true);
    expect(e.name).toBeNull();
    expect(e.email).toBeNull();
    expect(e.telefon).toBeNull();
    expect(e.nachricht).toBeNull();
    expect(e.cvDateiname).toBeNull();
    expect(e.bewerberStatus).toBeNull();
    // Nicht-personenbezogene Felder bleiben nutzbar:
    expect(e.jobTitel).toBe("Fahrlehrer (m/w/d)");
    expect(e.klassen).toEqual(["B", "BE"]);
  });

  it("echte Bewerbung (fahrlehrer): Daten bleiben vollständig erhalten", () => {
    const e = neutralisiereVermittlung({ ...basis, bewerber_status: "fahrlehrer" });
    expect(e.vermittelt).toBe(false);
    expect(e.name).toBe("Quinn Beispiel");
    expect(e.email).toBe("quinn@example.org");
    expect(e.nachricht).toBe("Interesse an der Ausbildung.");
    expect(e.cvDateiname).toBe("cv.pdf");
    expect(e.bewerberStatus).toBe("Fahrlehrer:in");
  });
});

// ----------------------------------------------------------------------------
// Datenfunktionen (gemockter DAL)
// ----------------------------------------------------------------------------

const anfrageRow = {
  id: LEAD,
  vorname: "Lena",
  nachname: "Beispiel",
  email: "lena@example.org",
  telefon: null,
  klasse: "B",
  zeitraum: "sofort",
  status: "neu",
  nachricht: "Hallo!\n\nRückruf: vormittags",
  wunsch_fahrlehrer: "Frida Dev",
  ist_minderjaehrig: false,
  guardian_name: null,
  guardian_email: null,
  guardian_telefon: null,
  alter_stunden: 3,
  eingegangen: "01.07.2026",
  cursor_ts: TS,
};

describe("getAnfragenListe", () => {
  it("mappt Zeilen (Name, Rückruf-Trennung, Guardian nur bei Minderjährigen)", async () => {
    stelleDb([
      [{ neu: 2, kontaktiert: 1, erledigt: 0, neu_alt: 1 }],
      [anfrageRow],
    ]);
    const liste = await getAnfragenListe(SCHULE);
    expect(liste).not.toBeNull();
    expect(liste?.zaehler).toEqual({ neu: 2, kontaktiert: 1, erledigt: 0, neuAelter48h: 1 });
    const e = liste!.eintraege[0];
    expect(e.name).toBe("Lena Beispiel");
    expect(e.nachricht).toBe("Hallo!");
    expect(e.rueckruf).toBe("vormittags");
    expect(e.wunschFahrlehrer).toBe("Frida Dev");
    expect(e.guardian).toBeNull();
    expect(liste?.naechsterCursor).toBeNull();
  });

  it("limit+1-Fetch: Folge-Cursor zeigt auf die letzte Zeile der Seite", async () => {
    stelleDb([
      [{ neu: 2, kontaktiert: 0, erledigt: 0, neu_alt: 0 }],
      [anfrageRow, { ...anfrageRow, id: FREMDE_ID }],
    ]);
    const liste = await getAnfragenListe(SCHULE, { limit: 1 });
    expect(liste?.eintraege).toHaveLength(1);
    expect(liste?.naechsterCursor).toBe(cursorKodieren(TS, LEAD));
  });

  it("fail-soft: DB-Fehler → null (Seite rendert 'nicht verfügbar')", async () => {
    dalMock.mockRejectedValueOnce(new Error("kaputt"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await getAnfragenListe(SCHULE)).toBeNull();
    expect(spy).toHaveBeenCalled();
  });
});

describe("anfrageStatusSetzen", () => {
  it("bindet Schule UND Lead als Parameter (Schul-Bindung) und liefert true bei 1 Zeile", async () => {
    const execute = stelleDb([[{ id: LEAD }]]);
    expect(await anfrageStatusSetzen(SCHULE, LEAD, "gesehen")).toBe(true);
    const params = sammleParams(execute.mock.calls[0][0]);
    expect(params).toContain(SCHULE);
    expect(params).toContain(LEAD);
    expect(params).toContain("gesehen");
  });

  it("0 Zeilen (fremde Schule/fremder Lead) → false", async () => {
    stelleDb([[]]);
    expect(await anfrageStatusSetzen(SCHULE, LEAD, "erledigt")).toBe(false);
  });

  it("fail-closed: ungültiger Status/keine UUID → false OHNE DB-Aufruf", async () => {
    expect(await anfrageStatusSetzen(SCHULE, LEAD, "geloescht" as never)).toBe(false);
    expect(await anfrageStatusSetzen("keine-uuid", LEAD, "neu")).toBe(false);
    expect(dalMock).not.toHaveBeenCalled();
  });

  it("fail-soft: DB-Fehler → false", async () => {
    dalMock.mockRejectedValueOnce(new Error("kaputt"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await anfrageStatusSetzen(SCHULE, LEAD, "neu")).toBe(false);
    expect(spy).toHaveBeenCalled();
  });
});

describe("getBewerbungenListe", () => {
  const bewerbungRow = {
    id: LEAD,
    name: "Jan Beispiel",
    email: "jan@example.org",
    telefon: null,
    nachricht: "BE vorhanden.",
    bewerber_status: "fahrlehrer",
    klassen_csv: "B,BE",
    verfuegbar_status: "sofort",
    verfuegbar_ab: null,
    cv_dateiname: "cv.pdf",
    job_titel: "Fahrlehrer (m/w/d)",
    status: "neu",
    alter_stunden: 26,
    eingegangen: "01.07.2026",
    cursor_ts: TS,
  };

  it("neutralisiert Quereinsteiger-Zeilen in der Liste (über onelane vermittelt)", async () => {
    stelleDb([
      [{ neu: 2, kontaktiert: 0, erledigt: 0, vermittelt: 1 }],
      [bewerbungRow, { ...bewerbungRow, id: FREMDE_ID, bewerber_status: "quereinsteiger" }],
    ]);
    const liste = await getBewerbungenListe(SCHULE);
    expect(liste?.zaehler.vermittelt).toBe(1);
    expect(liste?.eintraege[0].vermittelt).toBe(false);
    expect(liste?.eintraege[0].name).toBe("Jan Beispiel");
    expect(liste?.eintraege[1].vermittelt).toBe(true);
    expect(liste?.eintraege[1].name).toBeNull();
    expect(liste?.eintraege[1].email).toBeNull();
    expect(liste?.eintraege[1].cvDateiname).toBeNull();
  });
});

describe("bewerbungStatusSetzen", () => {
  it("bindet Schule + Bewerbung als Parameter; true bei 1 Zeile", async () => {
    const execute = stelleDb([[{ id: LEAD }]]);
    expect(await bewerbungStatusSetzen(SCHULE, LEAD, "erledigt")).toBe(true);
    const params = sammleParams(execute.mock.calls[0][0]);
    expect(params).toContain(SCHULE);
    expect(params).toContain(LEAD);
  });

  it("0 Zeilen (auch Quereinsteiger-Zeile — SQL-seitig ausgenommen) → false", async () => {
    stelleDb([[]]);
    expect(await bewerbungStatusSetzen(SCHULE, LEAD, "gesehen")).toBe(false);
  });
});

describe("getSchuelerListe", () => {
  const schuelerRow = {
    id: LEAD,
    // Welle 2: Name aus dem 0031-Definer app.schueler_namen — null, wenn kein
    // aktives Enrollment (die UI fällt dann auf die ID-Kurzform zurück).
    name: "Sam Dev",
    klasse: "B",
    status: "active",
    seit_tagen: 42,
    fahrstunden_absolviert: 7,
    termine_gesamt: 9,
    historie: [
      { typ: "fahrstunde", status: "completed", tag: "01.07.26", von: "09:00", fahrlehrer_name: "Frida Dev" },
    ],
    cursor_ts: TS,
  };

  it("mappt Zähler, Klassenliste, Kurz-ID, Name (Welle 2) und Termin-Historie", async () => {
    stelleDb([
      [{ gesamt: 3, aktiv: 1 }],
      [{ klasse: "A1" }, { klasse: "B" }],
      [schuelerRow],
    ]);
    const liste = await getSchuelerListe(SCHULE);
    expect(liste?.anzahlGesamt).toBe(3);
    expect(liste?.anzahlAktiv).toBe(1);
    expect(liste?.klassen).toEqual(["A1", "B"]);
    const e = liste!.eintraege[0];
    expect(e.idKurz).toBe(LEAD.slice(0, 8).toUpperCase());
    expect(e.name).toBe("Sam Dev");
    expect(e.fahrstundenAbsolviert).toBe(7);
    expect(e.historie[0].fahrlehrer_name).toBe("Frida Dev");
  });

  it("Name null (kein aktives Enrollment) bleibt null — ID-Kurzform-Fallback", async () => {
    stelleDb([
      [{ gesamt: 1, aktiv: 0 }],
      [],
      [{ ...schuelerRow, name: null, status: "completed" }],
    ]);
    const liste = await getSchuelerListe(SCHULE);
    expect(liste?.eintraege[0].name).toBeNull();
  });

  it("fail-closed: ungültige Klassen-Filter erreichen die Query NICHT", async () => {
    const execute = stelleDb([
      [{ gesamt: 0, aktiv: 0 }],
      [],
      [],
    ]);
    await getSchuelerListe(SCHULE, { klasse: "b'; drop table enrollments;--" });
    const params = execute.mock.calls.flatMap((c) => sammleParams(c[0]));
    expect(params.some((p) => String(p).includes("drop table"))).toBe(false);
  });

  it("kaputte Klassen-Werte aus der DB werden aus der Filterliste gefiltert", async () => {
    stelleDb([
      [{ gesamt: 1, aktiv: 1 }],
      [{ klasse: "B" }, { klasse: "<script>" }],
      [],
    ]);
    const liste = await getSchuelerListe(SCHULE);
    expect(liste?.klassen).toEqual(["B"]);
  });
});
