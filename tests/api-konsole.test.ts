import { beforeEach, describe, expect, it, vi } from "vitest";

// Muster tests/shell-actions.test.ts: server-only + DAL als Mocks — getestet
// wird die Zod-Grenze/Fail-Soft-Logik des Konsole-Datenpfads, nicht die DB
// (die RLS-Wahrheit für api_keys deckt tests/rls/os-fundament.test.ts ab).
vi.mock("server-only", () => ({}));
vi.mock("@/server/dal", () => ({ withCurrentUserContext: vi.fn() }));

import { withCurrentUserContext } from "@/server/dal";
import { getSchluesselUebersicht } from "@/modules/api/konsole";

const mockDal = vi.mocked(withCurrentUserContext);

function mitErgebnissen(...ergebnisse: Array<Array<Record<string, unknown>>>) {
  let i = 0;
  // tx-Double: konsole.ts nutzt ausschließlich tx.execute (Reihenfolge Zähler → Zeilen).
  mockDal.mockImplementation(async (fn) =>
    fn({ execute: async () => ergebnisse[i++] ?? [] } as never),
  );
}

beforeEach(() => {
  mockDal.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("getSchluesselUebersicht", () => {
  it("mappt Zähler + Zeilen (nur 0029-lesbare Spalten)", async () => {
    mitErgebnissen(
      [{ gesamt: 2, aktiv: 1 }],
      [
        {
          id: "44444444-4444-4444-8444-000000000001",
          prefix: "olk_dev_alpha",
          scopes: ["rest_read", "mcp"],
          status: "aktiv",
          partner_name: "dev_seed Partner Alpha",
          erstellt_am: "01.07.2026",
          laeuft_ab_am: null,
          zuletzt_verwendet_am: null,
        },
      ],
    );
    const u = await getSchluesselUebersicht({ limit: 20 });
    expect(u).toEqual({
      anzahlGesamt: 2,
      anzahlAktiv: 1,
      zeilen: [
        expect.objectContaining({ prefix: "olk_dev_alpha", status: "aktiv", scopes: ["rest_read", "mcp"] }),
      ],
    });
  });

  it("fail-soft: DB-Fehler → null (Karte zeigt den nicht-verfügbar-Zustand)", async () => {
    mockDal.mockRejectedValue(new Error("kaputt"));
    expect(await getSchluesselUebersicht()).toBeNull();
  });

  it("fail-closed Zod-Grenze: unerwarteter Status → null statt Durchreichen", async () => {
    mitErgebnissen(
      [{ gesamt: 1, aktiv: 1 }],
      [
        {
          id: "44444444-4444-4444-8444-000000000001",
          prefix: "olk_dev_alpha",
          scopes: ["rest_read"],
          status: "geheimnisvoll",
          partner_name: "x",
          erstellt_am: "01.07.2026",
          laeuft_ab_am: null,
          zuletzt_verwendet_am: null,
        },
      ],
    );
    expect(await getSchluesselUebersicht()).toBeNull();
  });
});
