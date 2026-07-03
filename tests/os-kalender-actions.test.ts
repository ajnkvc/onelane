import { beforeEach, describe, expect, it, vi } from "vitest";

// Guard-Ketten-Test der Verfügbarkeits-Actions (Welle 2) — Mocks nach dem
// Muster tests/os-betrieb-actions.test.ts: Session + DAL kontrolliert; geprüft
// wird Session → Identity → MFA → Rollen-Prädikat und dass ungültige Eingaben
// NIE einen Schreibpfad erreichen.
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: vi.fn() }),
}));
const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (...args: unknown[]) => revalidatePath(...args) }));
vi.mock("@/server/auth/session", () => ({ getVerifiedUser: vi.fn() }));
vi.mock("@/server/dal", () => ({ withCurrentUserContext: vi.fn() }));

import { getVerifiedUser } from "@/server/auth/session";
import { withCurrentUserContext } from "@/server/dal";
import { ForbiddenError } from "@/server/auth/permissions";
import { MfaRequiredError } from "@/server/auth/portal-guards";
import {
  verfuegbarkeitEintragen,
  verfuegbarkeitEntfernen,
} from "@/app/app/(geschuetzt)/os/kalender/actions";

const sessionMock = vi.mocked(getVerifiedUser);
const dalMock = vi.mocked(withCurrentUserContext);

const UID = "11111111-1111-4111-8111-000000000007";
const SCHULE = "22222222-2222-4222-8222-222222222222";
const INSTRUCTOR = "44444444-4444-4444-8444-444444444444";
const SLOT = "55555555-5555-4555-8555-555555555555";

let schreibAufrufe = 0;
function stelleWelt(options: {
  rolle: "inhaber" | "verwaltung" | "fahrlehrer" | null;
  aal: "aal1" | "aal2";
  accountTyp?: string;
}) {
  schreibAufrufe = 0;
  sessionMock.mockResolvedValue({ id: UID, email: "t@test.de", aal: options.aal, amr: [] });
  let aufruf = 0;
  dalMock.mockImplementation((async (work: (tx: unknown) => Promise<unknown>) => {
    aufruf += 1;
    if (aufruf === 1) {
      return work({
        execute: async () => [
          {
            account_typ: options.accountTyp ?? (options.rolle ? "school_staff" : "student"),
            email: "t@test.de",
            vorname: "Testa",
            nachname: "Tester",
            platform_roles: [],
            memberships: options.rolle
              ? [{ schoolId: SCHULE, schoolName: "Fahrschule Test", rolle: options.rolle }]
              : [],
          },
        ],
      });
    }
    return work({
      execute: async () => {
        schreibAufrufe += 1;
        return [{ id: SLOT }];
      },
    });
  }) as typeof withCurrentUserContext);
}

function eintragForm(over: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set("instructorId", over.instructorId ?? INSTRUCTOR);
  fd.set("tag", over.tag ?? "d:2026-07-06");
  fd.set("von", over.von ?? "08:00");
  fd.set("bis", over.bis ?? "12:00");
  if (over.istBlockiert) fd.set("istBlockiert", over.istBlockiert);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  revalidatePath.mockClear();
  schreibAufrufe = 0;
});

describe("verfuegbarkeitEintragen — Guard-Kette", () => {
  it("aal1-Inhaber (MFA-Pflicht) → MfaRequiredError, kein Schreibpfad", async () => {
    stelleWelt({ rolle: "inhaber", aal: "aal1" });
    await expect(verfuegbarkeitEintragen(eintragForm())).rejects.toThrow(MfaRequiredError);
    expect(schreibAufrufe).toBe(0);
  });

  it("Student → ForbiddenError", async () => {
    stelleWelt({ rolle: null, aal: "aal2" });
    await expect(verfuegbarkeitEintragen(eintragForm())).rejects.toThrow(ForbiddenError);
    expect(schreibAufrufe).toBe(0);
  });

  it("Fahrlehrer:in (aal2) → Schreibpfad läuft + revalidatePath", async () => {
    stelleWelt({ rolle: "fahrlehrer", aal: "aal2" });
    await verfuegbarkeitEintragen(eintragForm());
    expect(schreibAufrufe).toBe(1);
    expect(revalidatePath).toHaveBeenCalledWith("/app/os/kalender");
  });

  it("wiederkehrender Wochentag (w:0) läuft; Junk-Tag/Zeiten sind stille No-ops", async () => {
    stelleWelt({ rolle: "verwaltung", aal: "aal2" });
    await verfuegbarkeitEintragen(eintragForm({ tag: "w:0" }));
    expect(schreibAufrufe).toBe(1);

    for (const kaputt of [
      eintragForm({ tag: "w:7" }),
      eintragForm({ tag: "d:06.07.2026" }),
      eintragForm({ von: "25:00" }),
      eintragForm({ instructorId: "kein-uuid" }),
    ]) {
      // Welt je Aufruf neu stellen (der DAL-Mock zählt Aufrufe ab Identity).
      stelleWelt({ rolle: "verwaltung", aal: "aal2" });
      await verfuegbarkeitEintragen(kaputt);
      expect(schreibAufrufe).toBe(0);
    }
  });

  it("von >= bis wird im Modul verworfen (kein Schreibpfad)", async () => {
    stelleWelt({ rolle: "inhaber", aal: "aal2" });
    await verfuegbarkeitEintragen(eintragForm({ von: "12:00", bis: "12:00" }));
    expect(schreibAufrufe).toBe(0);
  });
});

describe("verfuegbarkeitEntfernen — Guard-Kette", () => {
  it("Manager (aal2) löscht; kaputte slotId ist stiller No-op", async () => {
    stelleWelt({ rolle: "inhaber", aal: "aal2" });
    const fd = new FormData();
    fd.set("slotId", SLOT);
    await verfuegbarkeitEntfernen(fd);
    expect(schreibAufrufe).toBe(1);

    stelleWelt({ rolle: "inhaber", aal: "aal2" });
    const junk = new FormData();
    junk.set("slotId", "'; drop table--");
    await verfuegbarkeitEntfernen(junk);
    expect(schreibAufrufe).toBe(0);
  });

  it("aal1 → MfaRequiredError (Inhaber ist MFA-pflichtig)", async () => {
    stelleWelt({ rolle: "inhaber", aal: "aal1" });
    const fd = new FormData();
    fd.set("slotId", SLOT);
    await expect(verfuegbarkeitEntfernen(fd)).rejects.toThrow(MfaRequiredError);
    expect(schreibAufrufe).toBe(0);
  });
});
