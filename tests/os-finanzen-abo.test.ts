import { beforeEach, describe, expect, it, vi } from "vitest";

// Finanz-/Abo-Module (Welle 2): DAL gemockt (Muster tests/api-konsole.test.ts) —
// geprüft werden Cent-Mapping, fail-soft/fail-closed-Grenzen und die neutrale
// Monats-Vorschau (KEINE Rechnung).
vi.mock("server-only", () => ({}));
vi.mock("@/server/dal", () => ({ withCurrentUserContext: vi.fn() }));

import { withCurrentUserContext } from "@/server/dal";
import { centAlsEuro, getOffenePostenListe } from "@/modules/portal/finanzen";
import { baueMonatsVorschau, getAboUebersicht, type AboPlan } from "@/modules/portal/abo";

const dalMock = vi.mocked(withCurrentUserContext);
const SCHULE = "22222222-2222-4222-8222-222222222222";

function dalLiefert(...antworten: unknown[][]): void {
  let aufruf = 0;
  dalMock.mockImplementation((async (work: (tx: unknown) => Promise<unknown>) =>
    work({
      execute: async () => antworten[Math.min(aufruf++, antworten.length - 1)],
    })) as typeof withCurrentUserContext);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("centAlsEuro", () => {
  it("formatiert deterministisch (Tausenderpunkt, Komma, €)", () => {
    expect(centAlsEuro(0)).toBe("0,00 €");
    expect(centAlsEuro(9900)).toBe("99,00 €");
    expect(centAlsEuro(123456)).toBe("1.234,56 €");
    expect(centAlsEuro(2900 * 3 + 9900)).toBe("186,00 €");
  });
});

describe("getOffenePostenListe", () => {
  it("mappt Kopf + Zeilen (Cent, Kurzref, Name aus dem 0031-Pfad)", async () => {
    dalLiefert(
      [{ anzahl: 2, summe_cent: 45600 }],
      [
        {
          id: "33333333-3333-4333-8333-333333333333",
          enrollment_id: "44444444-4444-4444-8444-444444444444",
          betrag_cent: 39600,
          status: "open",
          klasse: "B",
          schueler_name: "Sam Dev",
          offen_seit_tagen: 3,
          erstellt_am: "30.06.2026",
        },
      ],
    );
    const liste = await getOffenePostenListe(SCHULE);
    expect(liste).toMatchObject({ anzahl: 2, summeCent: 45600 });
    expect(liste?.posten[0]).toMatchObject({
      betrag_cent: 39600,
      schueler_name: "Sam Dev",
      enrollmentKurz: "44444444",
    });
  });

  it("fail-soft: DB-Fehler → null; fail-closed: fremder Status → null", async () => {
    const stumm = vi.spyOn(console, "error").mockImplementation(() => {});
    dalMock.mockImplementation(async () => {
      throw new Error("kaputt");
    });
    expect(await getOffenePostenListe(SCHULE)).toBeNull();

    dalLiefert(
      [{ anzahl: 1, summe_cent: 100 }],
      [{ id: "x", enrollment_id: "y", betrag_cent: 1, status: "paid", klasse: null, schueler_name: null, offen_seit_tagen: 0, erstellt_am: "01.07.2026" }],
    );
    expect(await getOffenePostenListe(SCHULE)).toBeNull();
    stumm.mockRestore();
  });
});

describe("getAboUebersicht", () => {
  const OS_PLAN = {
    code: "os", name: "onelane os", preis_monat_netto_cent: 9900,
    seat_preis_monat_netto_cent: 2900, aktion_preis_monat_netto_cent: 4900, aktion_monate: 3,
  };
  const START_PLAN = {
    code: "start", name: "onelane start", preis_monat_netto_cent: 0,
    seat_preis_monat_netto_cent: null, aktion_preis_monat_netto_cent: null, aktion_monate: null,
  };

  it("mit Abo: Plan + Vertragsdaten + Seat-Basis", async () => {
    dalLiefert(
      [{ status: "active", anzahl_lizenzen: 3, start_datum: "19.05.2026", ...OS_PLAN }],
      [START_PLAN, OS_PLAN],
      [{ anzahl: 4 }],
    );
    const abo = await getAboUebersicht(SCHULE);
    expect(abo).toMatchObject({
      hatAbo: true,
      aboStatus: "active",
      vertraglicheSeats: 3,
      fahrlehrerAktiv: 4,
      plan: { code: "os" },
    });
  });

  it("ohne Abo: ehrlicher start-Fallback aus dem Katalog", async () => {
    dalLiefert([], [START_PLAN, OS_PLAN], [{ anzahl: 2 }]);
    const abo = await getAboUebersicht(SCHULE);
    expect(abo).toMatchObject({
      hatAbo: false,
      aboStatus: null,
      vertraglicheSeats: null,
      plan: { code: "start", preis_monat_netto_cent: 0 },
    });
  });
});

describe("baueMonatsVorschau (neutral, keine Rechnung)", () => {
  const plan: AboPlan = {
    code: "os", name: "onelane os", preis_monat_netto_cent: 9900,
    seat_preis_monat_netto_cent: 2900, aktion_preis_monat_netto_cent: 4900, aktion_monate: 3,
  };

  it("Grundgebühr + Seats × Seat-Preis + Aktions-Summe", () => {
    expect(baueMonatsVorschau(plan, 3)).toEqual({
      grundCent: 9900,
      seatSummeCent: 8700,
      gesamtCent: 18600,
      aktionGesamtCent: 13600,
    });
  });

  it("Free-Tier ohne Seat-Preis/Aktion; negative Seats werden geklemmt", () => {
    const start: AboPlan = {
      code: "start", name: "onelane start", preis_monat_netto_cent: 0,
      seat_preis_monat_netto_cent: null, aktion_preis_monat_netto_cent: null, aktion_monate: null,
    };
    expect(baueMonatsVorschau(start, 5)).toEqual({
      grundCent: 0, seatSummeCent: 0, gesamtCent: 0, aktionGesamtCent: null,
    });
    expect(baueMonatsVorschau(plan, -2).seatSummeCent).toBe(0);
  });
});
