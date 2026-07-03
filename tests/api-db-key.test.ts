import { beforeEach, describe, expect, it, vi } from "vitest";

// DB-Adapter des KeyAuthPort (Welle 2): der DAL-Lookup wird gemockt — geprüft
// wird das fail-closed-Mapping (Zeile → Datensatz, Junk/Fehler → null) und
// dass NIE Hash-Material in Logs landet.
vi.mock("server-only", () => ({}));
vi.mock("@/server/dal", () => ({ apiKeyAuthLookup: vi.fn() }));

import { apiKeyAuthLookup } from "@/server/dal";
import { DB_KEY_AUTH_PORT, resolveKeyAuthPort } from "@/modules/api/db-key";
import { sha256Hex } from "@/modules/api/port";

const lookupMock = vi.mocked(apiKeyAuthLookup);

const HASH = sha256Hex("olk_test_0123456789abcdef0123456789");
const ZEILE = {
  key_id: "22222222-2222-4222-8222-000000000001",
  prefix: "olk_test",
  scopes: ["rest_read", "mcp"],
  status: "aktiv",
  expires_at: null,
  partner_id: "22222222-2222-4222-8222-000000000002",
  partner_name: "Partner Test",
  partner_status: "aktiv",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("DB_KEY_AUTH_PORT (Welle 2)", () => {
  it("mappt die Definer-Zeile auf den ApiKeyDatensatz", async () => {
    lookupMock.mockResolvedValue(ZEILE);
    const d = await DB_KEY_AUTH_PORT.findeSchluessel(HASH);
    expect(d).toEqual({
      id: ZEILE.key_id,
      prefix: "olk_test",
      scopes: ["rest_read", "mcp"],
      status: "aktiv",
      expiresAt: null,
      partnerId: ZEILE.partner_id,
      partnerName: "Partner Test",
      partnerStatus: "aktiv",
    });
    expect(lookupMock).toHaveBeenCalledWith(HASH);
  });

  it("expires_at (Date aus der DB) wird durchgereicht", async () => {
    const ablauf = new Date("2027-01-01T00:00:00Z");
    lookupMock.mockResolvedValue({ ...ZEILE, expires_at: ablauf });
    const d = await DB_KEY_AUTH_PORT.findeSchluessel(HASH);
    expect(d?.expiresAt?.toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });

  it("unbekannter Hash (DAL: null) → null", async () => {
    lookupMock.mockResolvedValue(null);
    expect(await DB_KEY_AUTH_PORT.findeSchluessel(HASH)).toBeNull();
  });

  it("fail-closed: unerwartete Zeile (Zod) → null statt Durchreichen", async () => {
    const stumm = vi.spyOn(console, "error").mockImplementation(() => {});
    lookupMock.mockResolvedValue({ ...ZEILE, status: "hyperaktiv" });
    expect(await DB_KEY_AUTH_PORT.findeSchluessel(HASH)).toBeNull();
    stumm.mockRestore();
  });

  it("fail-closed: DAL-Fehler → null; Log ohne Hash-Material (gescrubbt)", async () => {
    const logs: string[] = [];
    const spion = vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      logs.push(args.map(String).join(" "));
    });
    lookupMock.mockRejectedValue(new Error(`kaputt bei ${HASH} via Bearer olk_test_geheim_0123456789`));
    expect(await DB_KEY_AUTH_PORT.findeSchluessel(HASH)).toBeNull();
    const gesamt = logs.join("\n");
    expect(gesamt).toContain("[api-key-auth]");
    expect(gesamt).not.toContain(HASH);
    expect(gesamt).not.toContain("olk_test_geheim");
    spion.mockRestore();
  });

  it("resolveKeyAuthPort liefert den DB-Adapter (Welle-2-Standardpfad)", () => {
    expect(resolveKeyAuthPort()).toBe(DB_KEY_AUTH_PORT);
  });
});
