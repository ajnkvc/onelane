import { describe, it, expect } from "vitest";
import { bauePortalNavigation, type PortalNavigation } from "@/modules/portal/navigation";
import type { PortalIdentity, SchoolMembership } from "@/server/auth/portal-guards";

/**
 * Tests des rollenbasierten Navigationsmodells (OS-P2):
 *  - je Rolle NUR die erlaubten Sektionen,
 *  - Schüler sehen NIRGENDS „os" (weder Badge noch Pfade),
 *  - VERTRAULICHKEITS-SWEEP: keinerlei pay-/Buchungs-Begriffe im Modell.
 */

const membership = (rolle: SchoolMembership["rolle"]): SchoolMembership => ({
  schoolId: "11111111-1111-4111-8111-000000000099",
  schoolName: "Fahrschule Test",
  rolle,
});

function identity(teil: Partial<PortalIdentity>): PortalIdentity {
  return {
    user: { id: "u", email: null, aal: "aal2", amr: [] },
    accountTyp: null,
    platformRoles: [],
    memberships: [],
    aktiveSchule: null,
    anzeigeName: "Test",
    ...teil,
  } as PortalIdentity;
}

function allePfade(nav: PortalNavigation): string[] {
  return nav.sektionen.flatMap((s) => s.items.map((i) => i.href));
}
function alleLabels(nav: PortalNavigation): string[] {
  return nav.sektionen.flatMap((s) => [s.titel ?? "", ...s.items.map((i) => i.label)]);
}

describe("bauePortalNavigation — Rollen-Zuschnitt", () => {
  it("inhaber: os-Badge + Betrieb/Organisation inkl. Finanzen + Tarif", () => {
    const nav = bauePortalNavigation(
      identity({ accountTyp: "school_staff", aktiveSchule: membership("inhaber") }),
    );
    expect(nav.produktBadge).toBe("os");
    const pfade = allePfade(nav);
    expect(pfade).toContain("/app/os/anfragen");
    expect(pfade).toContain("/app/os/finanzen");
    expect(pfade).toContain("/app/os/abo");
    expect(pfade).toContain("/app/einstellungen");
  });

  it("verwaltung: wie inhaber, aber OHNE Tarif (abo)", () => {
    const nav = bauePortalNavigation(
      identity({ accountTyp: "school_staff", aktiveSchule: membership("verwaltung") }),
    );
    expect(nav.produktBadge).toBe("os");
    expect(allePfade(nav)).not.toContain("/app/os/abo");
    expect(allePfade(nav)).toContain("/app/os/finanzen");
  });

  it("fahrlehrer: reduzierter os-Zuschnitt (kein Anfragen/Finanzen/Team)", () => {
    const nav = bauePortalNavigation(
      identity({ accountTyp: "school_staff", aktiveSchule: membership("fahrlehrer") }),
    );
    expect(nav.produktBadge).toBe("os");
    const pfade = allePfade(nav);
    expect(pfade).toContain("/app/os/kalender");
    expect(pfade).toContain("/app/os/schueler");
    expect(pfade).not.toContain("/app/os/anfragen");
    expect(pfade).not.toContain("/app/os/finanzen");
    expect(pfade).not.toContain("/app/os/team");
  });

  it("student: dein Bereich — NIRGENDS 'os' (Badge, Pfade, Labels)", () => {
    const nav = bauePortalNavigation(identity({ accountTyp: "student" }));
    expect(nav.produktBadge).toBeNull();
    const alles = [...allePfade(nav), ...alleLabels(nav)].join(" ").toLowerCase();
    expect(alles).not.toContain("os");
    expect(allePfade(nav)).toContain("/app/mein-bereich/termine");
    expect(nav.sektionen[0].titel).toBe("dein Bereich");
  });

  it("platform_staff admin: intern-Navigation mit Moderation", () => {
    const nav = bauePortalNavigation(
      identity({ accountTyp: "platform_staff", platformRoles: ["admin"] }),
    );
    expect(nav.produktBadge).toBe("intern");
    expect(allePfade(nav)).toContain("/app/intern/moderation");
    expect(allePfade(nav)).not.toContain("/app/os/anfragen");
  });

  it("support: intern ohne Moderation/Redaktion/Vertrieb", () => {
    const nav = bauePortalNavigation(
      identity({ accountTyp: "platform_staff", platformRoles: ["support"] }),
    );
    const pfade = allePfade(nav);
    expect(pfade).not.toContain("/app/intern/moderation");
    expect(pfade).not.toContain("/app/redaktion/briefings");
    expect(pfade).not.toContain("/app/vertrieb");
  });

  it("editor: Redaktions-Sektion; vertrieb: Vertriebs-Sektion", () => {
    const editor = bauePortalNavigation(
      identity({ accountTyp: "platform_staff", platformRoles: ["editor"] }),
    );
    expect(allePfade(editor)).toContain("/app/redaktion/briefings");
    expect(allePfade(editor)).not.toContain("/app/vertrieb");

    const vertrieb = bauePortalNavigation(
      identity({ accountTyp: "platform_staff", platformRoles: ["vertrieb"] }),
    );
    expect(allePfade(vertrieb)).toContain("/app/vertrieb");
    expect(allePfade(vertrieb)).not.toContain("/app/redaktion/briefings");
  });

  it("api-partner-Mitglied (Ghost-Muster): Partner-API-Sektion + api-Badge", () => {
    const nav = bauePortalNavigation(
      identity({ accountTyp: "school_staff" }),
      { istApiPartnerMitglied: true },
    );
    expect(nav.produktBadge).toBe("api");
    expect(allePfade(nav)).toContain("/app/partner-api/keys");
  });

  it("rollenloses Konto: nur Übersicht + Einstellungen", () => {
    const nav = bauePortalNavigation(identity({ accountTyp: "school_staff" }));
    expect(allePfade(nav)).toEqual(["/app", "/app/einstellungen"]);
  });
});

describe("VERTRAULICHKEITS-SWEEP (Nav-Modell)", () => {
  it("keine pay-/Buchungs-Begriffe in irgendeiner Rollen-Navigation", () => {
    const varianten: PortalNavigation[] = [
      bauePortalNavigation(identity({ accountTyp: "platform_staff", platformRoles: ["admin"] })),
      bauePortalNavigation(identity({ accountTyp: "platform_staff", platformRoles: ["support"] })),
      bauePortalNavigation(identity({ accountTyp: "platform_staff", platformRoles: ["editor"] })),
      bauePortalNavigation(identity({ accountTyp: "platform_staff", platformRoles: ["vertrieb"] })),
      bauePortalNavigation(identity({ accountTyp: "student" })),
      bauePortalNavigation(identity({ accountTyp: "school_staff", aktiveSchule: membership("inhaber") })),
      bauePortalNavigation(identity({ accountTyp: "school_staff", aktiveSchule: membership("verwaltung") })),
      bauePortalNavigation(identity({ accountTyp: "school_staff", aktiveSchule: membership("fahrlehrer") })),
      bauePortalNavigation(identity({ accountTyp: "school_staff" }), { istApiPartnerMitglied: true }),
    ];
    for (const nav of varianten) {
      const alles = JSON.stringify(nav).toLowerCase();
      expect(alles).not.toContain("pay");
      expect(alles).not.toContain("buchung");
      expect(alles).not.toContain("booking");
    }
  });
});
