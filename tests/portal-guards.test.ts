import { beforeEach, describe, expect, it, vi } from "vitest";

// server-only + next/headers in Vitest (Node) als No-op mocken.
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));
// Session + DAL werden pro Fall gestellt (Identität kommt sonst aus DB/RLS).
vi.mock("@/server/auth/session", () => ({ getVerifiedUser: vi.fn() }));
vi.mock("@/server/dal", () => ({ withCurrentUserContext: vi.fn() }));

import { getVerifiedUser } from "@/server/auth/session";
import { withCurrentUserContext } from "@/server/dal";
import {
  getPortalIdentity,
  istMfaPflichtig,
  requireAal2ForRole,
  withPortalActionGuards,
  withPortalRouteGuards,
  MfaRequiredError,
} from "@/server/auth/portal-guards";
import {
  AuthenticationRequiredError,
  ForbiddenError,
} from "@/server/auth/permissions";

/**
 * portal-guards.test.ts — MFA-/Guard-Kette des App-Portals (Review-Auflage 1):
 * AAL1-platform_staff wird von Action UND Route geblockt (403 mfa_required);
 * Studenten ohne MFA-Pflicht kommen durch; ohne Session 401; Rollen-Prädikat 403.
 */
const sessionMock = vi.mocked(getVerifiedUser);
const dalMock = vi.mocked(withCurrentUserContext);

const UID = "11111111-1111-4111-8111-111111111111";
const SCHULE = "22222222-2222-4222-8222-222222222222";

type Aal = "aal1" | "aal2";

function stelleSession(aal: Aal | null) {
  if (aal === null) {
    sessionMock.mockResolvedValue(null);
    return;
  }
  sessionMock.mockResolvedValue({ id: UID, email: "t@test.de", aal, amr: [] });
}

function stelleIdentityRow(row: Record<string, unknown>) {
  dalMock.mockImplementation((async (work: (tx: unknown) => Promise<unknown>) =>
    work({ execute: async () => [row] })) as typeof withCurrentUserContext);
}

const PLATFORM_ADMIN_ROW = {
  account_typ: "platform_staff",
  email: "admin@test.de",
  vorname: "Alex",
  nachname: "Admin",
  platform_roles: ["admin"],
  memberships: [],
};
const INHABER_ROW = {
  account_typ: "school_staff",
  email: "inhaber@test.de",
  vorname: null,
  nachname: null,
  platform_roles: [],
  memberships: [{ schoolId: SCHULE, schoolName: "Fahrschule A", rolle: "inhaber" }],
};
const STUDENT_ROW = {
  account_typ: "student",
  email: "sam@test.de",
  vorname: "Sam",
  nachname: null,
  platform_roles: [],
  memberships: [],
};

beforeEach(() => {
  sessionMock.mockReset();
  dalMock.mockReset();
});

/** Request-Stub für Route-Guards (Origin localhost = Dev-Allowlist). */
function req(method: string): Request {
  return {
    method,
    headers: {
      get: (k: string) =>
        k.toLowerCase() === "origin" ? "http://localhost:3000" : null,
    },
  } as unknown as Request;
}

describe("getPortalIdentity — DB-Wahrheit + Anzeige", () => {
  it("liefert null ohne Session; Identität mit Rollen/Memberships mit Session", async () => {
    stelleSession(null);
    expect(await getPortalIdentity()).toBeNull();

    stelleSession("aal2");
    stelleIdentityRow(INHABER_ROW);
    const identity = await getPortalIdentity();
    expect(identity?.accountTyp).toBe("school_staff");
    expect(identity?.memberships).toHaveLength(1);
    expect(identity?.aktiveSchule?.schoolId).toBe(SCHULE);
    expect(identity?.anzeigeName).toBe("inhaber@test.de");
  });
});

describe("MFA-Pflicht (rollenabgeleitet)", () => {
  it("platform_staff und inhaber-Membership sind pflichtig, Studenten nicht", () => {
    expect(istMfaPflichtig({ accountTyp: "platform_staff", memberships: [] })).toBe(true);
    expect(
      istMfaPflichtig({
        accountTyp: "school_staff",
        memberships: [{ schoolId: SCHULE, schoolName: "A", rolle: "inhaber" }],
      }),
    ).toBe(true);
    expect(
      istMfaPflichtig({
        accountTyp: "school_staff",
        memberships: [{ schoolId: SCHULE, schoolName: "A", rolle: "fahrlehrer" }],
      }),
    ).toBe(false);
    expect(istMfaPflichtig({ accountTyp: "student", memberships: [] })).toBe(false);
  });
});

describe("withPortalActionGuards — Action-Kette", () => {
  it("BLOCKT AAL1-platform_staff mit 403 mfa_required", async () => {
    stelleSession("aal1");
    stelleIdentityRow(PLATFORM_ADMIN_ROW);
    const action = withPortalActionGuards(async () => "geheim");
    await expect(action()).rejects.toMatchObject({
      name: "MfaRequiredError",
      status: 403,
      code: "mfa_required",
    });
  });

  it("BLOCKT AAL1-inhaber; lässt aal2-inhaber durch", async () => {
    stelleSession("aal1");
    stelleIdentityRow(INHABER_ROW);
    const action = withPortalActionGuards(async (identity) => identity.anzeigeName);
    await expect(action()).rejects.toBeInstanceOf(MfaRequiredError);

    stelleSession("aal2");
    await expect(action()).resolves.toBe("inhaber@test.de");
  });

  it("Student ohne MFA (aal1) kommt durch (keine Pflichtrolle)", async () => {
    stelleSession("aal1");
    stelleIdentityRow(STUDENT_ROW);
    const action = withPortalActionGuards(async (identity) => identity.accountTyp);
    await expect(action()).resolves.toBe("student");
  });

  it("ohne Session 401; Rollen-Prädikat false → 403 forbidden", async () => {
    stelleSession(null);
    const action = withPortalActionGuards(async () => "x");
    await expect(action()).rejects.toBeInstanceOf(AuthenticationRequiredError);

    stelleSession("aal1");
    stelleIdentityRow(STUDENT_ROW);
    const nurAdmin = withPortalActionGuards(async () => "x", {
      require: (identity) => identity.platformRoles.includes("admin"),
    });
    await expect(nurAdmin()).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("withPortalRouteGuards — Route-Kette (inkl. zentralem Fehler-Mapping)", () => {
  const handler = withPortalRouteGuards(async () => Response.json({ ok: true }));

  it("BLOCKT AAL1-platform_staff: 403 { error: 'mfa_required' }", async () => {
    stelleSession("aal1");
    stelleIdentityRow(PLATFORM_ADMIN_ROW);
    const res = await handler(req("GET"));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "mfa_required" });
  });

  it("ohne Session: 401; Student aal1: 200 (durchgelassen)", async () => {
    stelleSession(null);
    expect((await handler(req("GET"))).status).toBe(401);

    stelleSession("aal1");
    stelleIdentityRow(STUDENT_ROW);
    const res = await handler(req("GET"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("mutierend bleibt Same-Origin Pflicht (fremde Origin → 403 csrf_origin)", async () => {
    stelleSession("aal2");
    stelleIdentityRow(PLATFORM_ADMIN_ROW);
    const fremd = {
      method: "POST",
      headers: { get: (k: string) => (k === "origin" ? "https://boese.example" : null) },
    } as unknown as Request;
    const res = await handler(fremd);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "csrf_origin" });
  });

  it("requireAal2ForRole wirft direkt (Baustein für Layout/Custom-Pfade)", async () => {
    stelleSession("aal1");
    stelleIdentityRow(PLATFORM_ADMIN_ROW);
    const identity = await getPortalIdentity();
    expect(identity).not.toBeNull();
    expect(() => requireAal2ForRole(identity!)).toThrow(MfaRequiredError);
  });
});
