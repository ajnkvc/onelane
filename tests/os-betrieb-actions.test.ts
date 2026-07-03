import { beforeEach, describe, expect, it, vi } from "vitest";

// Mocks nach dem Muster tests/shell-actions.test.ts: server-only/next-Nachbarn
// weg, Session + DAL kontrolliert — geprüft wird die GUARD-KETTE der
// Zeiterfassungs-Actions (Session → Identity → MFA → Rollen-Prädikat) und
// dass ungültige Eingaben NIE in einem Schreibpfad landen.
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
import { ausstempeln, einstempeln } from "@/app/app/(geschuetzt)/os/zeiterfassung/actions";

const sessionMock = vi.mocked(getVerifiedUser);
const dalMock = vi.mocked(withCurrentUserContext);

const UID = "11111111-1111-4111-8111-000000000007";
const SCHULE = "22222222-2222-4222-8222-222222222222";

/**
 * DAL-Doppelrolle: der ERSTE withCurrentUserContext-Aufruf ist die Identity-
 * Query (getPortalIdentity), jeder weitere ein Schreibpfad des Moduls. Die
 * Schreib-Aufrufe werden gezählt; `schreibZeilen` steuert das returning().
 */
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
        return [{ id: "33333333-3333-4333-8333-333333333333" }];
      },
    });
  }) as typeof withCurrentUserContext);
}

function form(kategorie: string, notiz = ""): FormData {
  const fd = new FormData();
  fd.set("kategorie", kategorie);
  if (notiz) fd.set("notiz", notiz);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  revalidatePath.mockClear();
  schreibAufrufe = 0;
});

describe("einstempeln (Guard-Kette + Validierung)", () => {
  it("Fahrlehrer (aal1, keine MFA-Pflicht) stempelt ein → Schreibpfad + Revalidate", async () => {
    stelleWelt({ rolle: "fahrlehrer", aal: "aal1" });
    await einstempeln(form("fahrstunde", "Block am Vormittag"));
    expect(schreibAufrufe).toBe(1);
    expect(revalidatePath).toHaveBeenCalledWith("/app/os/zeiterfassung");
  });

  it("Inhaber mit aal1 wird geblockt (MFA-Pflicht, Review-Auflage 1)", async () => {
    stelleWelt({ rolle: "inhaber", aal: "aal1" });
    await expect(einstempeln(form("buero"))).rejects.toBeInstanceOf(MfaRequiredError);
    expect(schreibAufrufe).toBe(0);
  });

  it("Inhaber mit aal2 darf", async () => {
    stelleWelt({ rolle: "inhaber", aal: "aal2" });
    await einstempeln(form("verwaltung"));
    expect(schreibAufrufe).toBe(1);
  });

  it("Student/ohne Schulrolle → ForbiddenError (Rollen-Prädikat)", async () => {
    stelleWelt({ rolle: null, aal: "aal1", accountTyp: "student" });
    await expect(einstempeln(form("buero"))).rejects.toBeInstanceOf(ForbiddenError);
    expect(schreibAufrufe).toBe(0);
  });

  it("fremde Kategorie ist ein stiller No-op (Allowlist, kein Orakel)", async () => {
    stelleWelt({ rolle: "fahrlehrer", aal: "aal1" });
    await einstempeln(form("kaffeepause"));
    expect(schreibAufrufe).toBe(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("überlange Notiz (>250 Zeichen) ist ein stiller No-op (DB-Byte-Cap)", async () => {
    stelleWelt({ rolle: "fahrlehrer", aal: "aal1" });
    await einstempeln(form("buero", "x".repeat(251)));
    expect(schreibAufrufe).toBe(0);
  });
});

describe("ausstempeln (Guard-Kette)", () => {
  it("Verwaltung (aal1) stempelt aus → Schreibpfad + Revalidate", async () => {
    stelleWelt({ rolle: "verwaltung", aal: "aal1" });
    await ausstempeln();
    expect(schreibAufrufe).toBe(1);
    expect(revalidatePath).toHaveBeenCalledWith("/app/os/zeiterfassung");
  });

  it("ohne Session → AuthenticationRequiredError", async () => {
    sessionMock.mockResolvedValue(null);
    await expect(ausstempeln()).rejects.toThrow();
    expect(schreibAufrufe).toBe(0);
  });

  it("Plattform-Personal ohne Schulrolle → ForbiddenError", async () => {
    stelleWelt({ rolle: null, aal: "aal2", accountTyp: "platform_staff" });
    await expect(ausstempeln()).rejects.toBeInstanceOf(ForbiddenError);
    expect(schreibAufrufe).toBe(0);
  });
});
