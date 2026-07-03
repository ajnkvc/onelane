import { describe, it, expect, vi, afterEach } from "vitest";

/**
 * dal-pool-singleton.test.ts — Pool-Singleton über Modul-Neuinstanziierung hinweg.
 * ----------------------------------------------------------------------------
 * Hintergrund: Der Next-Dev-Server (Turbopack) instanziiert den Server-Modulgraphen
 * bei jedem HMR-Recompile neu. Ein NUR modul-lokaler Pool-Cache erzeugt dann pro
 * Recompile einen neuen postgres.js-Pool; die Verbindungen des alten Pools bleiben
 * offen (beobachtet 2026-07-03: 97 idle app_user-Verbindungen bei max_connections=100
 * → alle /app-Routen 500). Außerhalb der Produktion muss der Pool deshalb an
 * globalThis verankert sein und zeitliche Schutzlimits tragen; die Produktion bleibt
 * unverändert im Modul-Scope.
 *
 * `vi.resetModules()` simuliert hier die HMR-Neuinstanziierung des Moduls.
 */

// client.ts ist server-only; in Vitest (Node) als No-op mocken.
vi.mock("server-only", () => ({}));

// postgres.js mocken: zählt Pool-Instanziierungen, baut KEINE echten Verbindungen auf.
const { postgresMock } = vi.hoisted(() => ({
  postgresMock: vi.fn<(url: string, opts: Record<string, unknown>) => { end: () => void }>(
    () => ({ end: () => {} }),
  ),
}));
vi.mock("postgres", () => ({ default: postgresMock }));

// drizzle als dünner Wrapper: jede Instanziierung liefert ein NEUES Objekt, damit
// Identitätsvergleiche (toBe) echte Cache-Treffer nachweisen.
vi.mock("drizzle-orm/postgres-js", () => ({
  drizzle: vi.fn((client: unknown) => ({ client })),
}));

const APP_DSN = "postgres://app_user:pw@localhost:5432/app";
const TOOLING_DSN = "postgres://app_owner:pw@localhost:5432/app";

/** globalThis-Sicht der Tests auf die (privaten) Cache-Schlüssel der DAL-Module. */
const g = globalThis as { __onelanePgPool?: unknown; __onelanePgElevatedPool?: unknown };

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  postgresMock.mockClear();
  delete g.__onelanePgPool;
  delete g.__onelanePgElevatedPool;
});

/** Frische Modul-Instanz laden (entspricht einem HMR-Recompile). */
async function loadClient() {
  vi.resetModules();
  return import("@/server/dal/client");
}
async function loadElevated() {
  vi.resetModules();
  return import("@/server/dal/elevated");
}

function firstPoolOptions(): Record<string, unknown> {
  return postgresMock.mock.calls[0][1];
}

describe("client.ts — app_user-Pool über HMR-Recompiles (Dev)", () => {
  it("liefert nach Modul-Neuinstanziierung denselben Pool (postgres() nur einmal)", async () => {
    vi.stubEnv("DATABASE_URL", APP_DSN);
    const first = (await loadClient()).getDb();
    const second = (await loadClient()).getDb();
    expect(second).toBe(first);
    expect(postgresMock).toHaveBeenCalledTimes(1);
  });

  it("setzt außerhalb der Produktion idle_timeout und max_lifetime (Schutz gegen verwaiste Pools)", async () => {
    vi.stubEnv("DATABASE_URL", APP_DSN);
    (await loadClient()).getDb();
    const opts = firstPoolOptions();
    expect(opts).toMatchObject({ max: 10, prepare: false });
    expect(opts.idle_timeout).toBeTypeOf("number");
    expect(opts.idle_timeout as number).toBeGreaterThan(0);
    expect(opts.max_lifetime).toBeTypeOf("number");
    expect(opts.max_lifetime as number).toBeGreaterThan(0);
  });

  it("Produktion: Cache bleibt im Modul-Scope, kein globalThis-Key, keine Dev-Timeouts", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_URL", APP_DSN);
    const mod = await loadClient();
    const first = mod.getDb();
    expect(mod.getDb()).toBe(first);
    expect(postgresMock).toHaveBeenCalledTimes(1);
    expect(g.__onelanePgPool).toBeUndefined();
    const opts = firstPoolOptions();
    expect(opts).toMatchObject({ max: 10, prepare: false });
    expect(opts).not.toHaveProperty("idle_timeout");
    expect(opts).not.toHaveProperty("max_lifetime");
  });
});

describe("elevated.ts — Tooling-Pool über HMR-Recompiles (Dev)", () => {
  it("liefert nach Modul-Neuinstanziierung denselben Pool (postgres() nur einmal)", async () => {
    vi.stubEnv("TOOLING_DATABASE_URL", TOOLING_DSN);
    const first = (await loadElevated()).getElevatedDb();
    const second = (await loadElevated()).getElevatedDb();
    expect(second).toBe(first);
    expect(postgresMock).toHaveBeenCalledTimes(1);
    const opts = firstPoolOptions();
    expect(opts).toMatchObject({ max: 5, prepare: false });
    expect(opts.idle_timeout).toBeTypeOf("number");
    expect(opts.max_lifetime).toBeTypeOf("number");
  });

  it("Produktion: Cache bleibt im Modul-Scope, kein globalThis-Key, keine Dev-Timeouts", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("TOOLING_DATABASE_URL", TOOLING_DSN);
    const mod = await loadElevated();
    const first = mod.getElevatedDb();
    expect(mod.getElevatedDb()).toBe(first);
    expect(postgresMock).toHaveBeenCalledTimes(1);
    expect(g.__onelanePgElevatedPool).toBeUndefined();
    const opts = firstPoolOptions();
    expect(opts).not.toHaveProperty("idle_timeout");
    expect(opts).not.toHaveProperty("max_lifetime");
  });
});
