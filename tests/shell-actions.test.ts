import { beforeEach, describe, expect, it, vi } from "vitest";

// server-only + next/headers als Mocks (Muster tests/portal-guards.test.ts);
// cookies() liefert hier zusätzlich set/delete-Spies für den Switcher.
vi.mock("server-only", () => ({}));
const cookieSet = vi.fn();
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: cookieSet }),
}));
vi.mock("@/server/auth/session", () => ({ getVerifiedUser: vi.fn() }));
vi.mock("@/server/dal", () => ({ withCurrentUserContext: vi.fn() }));

import { getVerifiedUser } from "@/server/auth/session";
import { withCurrentUserContext } from "@/server/dal";
import { MfaRequiredError } from "@/server/auth/portal-guards";
import { aktiveSchuleSetzen } from "@/modules/portal/shell-actions";

/**
 * shell-actions.test.ts — Schul-Switcher (OS-P2, P1-Kontrakt aktiveSchule):
 * volle Guard-Kette (Session→Identity→MFA) + Cookie NUR für EIGENE Memberships.
 * (Die Seeds haben je User nur EINE Schule — die Switcher-LOGIK wird deshalb
 * hier per Test mit zwei Schulen abgedeckt; UI zeigt bei einer Schule den
 * statischen „deine Fahrschule"-Zustand.)
 */
const sessionMock = vi.mocked(getVerifiedUser);
const dalMock = vi.mocked(withCurrentUserContext);

const UID = "11111111-1111-4111-8111-111111111111";
const SCHULE_A = "22222222-2222-4222-8222-222222222222";
const SCHULE_B = "33333333-3333-4333-8333-333333333333";
const FREMD = "44444444-4444-4444-8444-444444444444";

function stelleIdentity(aal: "aal1" | "aal2") {
  sessionMock.mockResolvedValue({ id: UID, email: "i@test.de", aal, amr: [] });
  dalMock.mockImplementation((async (work: (tx: unknown) => Promise<unknown>) =>
    work({
      execute: async () => [
        {
          account_typ: "school_staff",
          email: "i@test.de",
          vorname: "Ingrid",
          nachname: "Test",
          platform_roles: [],
          memberships: [
            { schoolId: SCHULE_A, schoolName: "Fahrschule A", rolle: "inhaber" },
            { schoolId: SCHULE_B, schoolName: "Fahrschule B", rolle: "inhaber" },
          ],
        },
      ],
    })) as typeof withCurrentUserContext);
}

function form(schoolId: string): FormData {
  const fd = new FormData();
  fd.set("schoolId", schoolId);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("aktiveSchuleSetzen (Schul-Switcher)", () => {
  it("setzt das httpOnly-Cookie für eine EIGENE Membership", async () => {
    stelleIdentity("aal2");
    await aktiveSchuleSetzen(form(SCHULE_B));
    expect(cookieSet).toHaveBeenCalledTimes(1);
    const [name, wert, optionen] = cookieSet.mock.calls[0];
    expect(name).toBe("onelane-aktive-schule");
    expect(wert).toBe(SCHULE_B);
    expect(optionen).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
  });

  it("ignoriert FREMDE Schul-IDs (kein Cookie, kein Fehler-Orakel)", async () => {
    stelleIdentity("aal2");
    await aktiveSchuleSetzen(form(FREMD));
    expect(cookieSet).not.toHaveBeenCalled();
  });

  it("ignoriert ungültige Eingaben (keine UUID / fehlendes Feld)", async () => {
    stelleIdentity("aal2");
    await aktiveSchuleSetzen(form("nicht-eine-uuid"));
    await aktiveSchuleSetzen(new FormData());
    expect(cookieSet).not.toHaveBeenCalled();
  });

  it("MFA-Kette greift: Inhaber mit aal1 wird geblockt (mfa_required)", async () => {
    stelleIdentity("aal1");
    await expect(aktiveSchuleSetzen(form(SCHULE_A))).rejects.toBeInstanceOf(MfaRequiredError);
    expect(cookieSet).not.toHaveBeenCalled();
  });
});
