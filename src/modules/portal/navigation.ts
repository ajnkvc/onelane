import type { PortalIdentity } from "@/server/auth/portal-guards";
import {
  aktiveSchulRolle,
  hatPlattformRolle,
  istPlattformPersonal,
  istStudent,
} from "./rollen";

/**
 * modules/portal/navigation.ts — rollenbasiertes Navigationsmodell der
 * App-Shell (OS-P2). REINE Funktion über der (eingefrorenen) PortalIdentity —
 * ohne React, ohne DB, dadurch vollständig unit-testbar.
 * ============================================================================
 * REGELN:
 *  - Die Navigation ist KOMFORT, keine Sicherheitsgrenze: jede Ziel-Seite prüft
 *    ihre Rolle serverseitig selbst (rollen.ts-Prädikate → notFound), RLS bleibt
 *    letzte Linie.
 *  - Schüler sehen NIE „os" — weder als Badge noch in Link-Pfaden (eigener
 *    /app/mein-bereich-Baum, reduziert).
 *  - VERTRAULICH: keinerlei pay-/Buchungs-Einträge — das existiert in P2
 *    nirgends (P3: nur intern hinter Flag + admin).
 *  - P3-Module sind als Links auf Platzhalter-Seiten enthalten (hochwertige
 *    Empty-States) — nichts Totes, nichts 404.
 */

export type NavIcon =
  | "uebersicht"
  | "anfragen"
  | "bewerbungen"
  | "schueler"
  | "kalender"
  | "team"
  | "zeit"
  | "jobs"
  | "profil"
  | "finanzen"
  | "abo"
  | "termine"
  | "fortschritt"
  | "dokumente"
  | "moderation"
  | "redaktion"
  | "vertrieb"
  | "schluessel"
  | "doku"
  | "einstellungen";

export interface NavItem {
  href: string;
  label: string;
  icon: NavIcon;
  /** exakter Pfad-Match für den Aktiv-Zustand (Übersicht), sonst Präfix-Match. */
  exakt?: boolean;
}

export interface NavSektion {
  titel: string | null;
  items: NavItem[];
}

export interface PortalNavigation {
  /** Produkt-Badge neben der Wortmarke: Schul-Rollen „os", intern „intern", Partner „api". */
  produktBadge: "os" | "intern" | "api" | null;
  sektionen: NavSektion[];
}

const UEBERSICHT: NavItem = { href: "/app", label: "Übersicht", icon: "uebersicht", exakt: true };
const EINSTELLUNGEN: NavSektion = {
  titel: null,
  items: [{ href: "/app/einstellungen", label: "Einstellungen", icon: "einstellungen" }],
};

export function bauePortalNavigation(
  identity: Pick<PortalIdentity, "accountTyp" | "platformRoles" | "aktiveSchule">,
  options: { istApiPartnerMitglied?: boolean } = {},
): PortalNavigation {
  const sektionen: NavSektion[] = [];

  // ---- Plattform-Personal (intern / Redaktion / Vertrieb) -------------------
  if (istPlattformPersonal(identity)) {
    const intern: NavItem[] = [UEBERSICHT];
    if (hatPlattformRolle(identity, "admin", "moderator")) {
      intern.push({ href: "/app/intern/moderation", label: "Moderation", icon: "moderation" });
    }
    sektionen.push({ titel: "intern", items: intern });

    if (hatPlattformRolle(identity, "editor", "admin")) {
      sektionen.push({
        titel: "redaktion",
        items: [
          { href: "/app/redaktion/briefings", label: "Briefings", icon: "redaktion" },
          { href: "/app/redaktion/artikel", label: "Artikel", icon: "dokumente" },
        ],
      });
    }
    if (hatPlattformRolle(identity, "vertrieb", "admin")) {
      sektionen.push({
        titel: "vertrieb",
        items: [{ href: "/app/vertrieb", label: "Vertrieb", icon: "vertrieb" }],
      });
    }
    sektionen.push(EINSTELLUNGEN);
    return { produktBadge: "intern", sektionen };
  }

  // ---- Schüler („dein Bereich", reduziert — nie „os") -----------------------
  if (istStudent(identity)) {
    sektionen.push({
      titel: "dein Bereich",
      items: [
        UEBERSICHT,
        { href: "/app/mein-bereich/termine", label: "Termine", icon: "termine" },
        { href: "/app/mein-bereich/fortschritt", label: "Fortschritt", icon: "fortschritt" },
        { href: "/app/mein-bereich/dokumente", label: "Dokumente", icon: "dokumente" },
      ],
    });
    sektionen.push(EINSTELLUNGEN);
    return { produktBadge: null, sektionen };
  }

  // ---- Schul-Rollen (onelane os) --------------------------------------------
  const rolle = aktiveSchulRolle(identity);
  if (rolle === "inhaber" || rolle === "verwaltung") {
    sektionen.push({ titel: "heute", items: [UEBERSICHT] });
    sektionen.push({
      titel: "betrieb",
      items: [
        { href: "/app/os/anfragen", label: "Anfragen", icon: "anfragen" },
        { href: "/app/os/bewerbungen", label: "Bewerbungen", icon: "bewerbungen" },
        { href: "/app/os/schueler", label: "Schüler", icon: "schueler" },
        { href: "/app/os/kalender", label: "Kalender", icon: "kalender" },
      ],
    });
    const organisation: NavItem[] = [
      { href: "/app/os/team", label: "Team", icon: "team" },
      { href: "/app/os/zeiterfassung", label: "Zeiterfassung", icon: "zeit" },
      { href: "/app/os/jobs", label: "Stellenanzeigen", icon: "jobs" },
      { href: "/app/os/profil-pflege", label: "Profil-Pflege", icon: "profil" },
      { href: "/app/os/finanzen", label: "Finanzen", icon: "finanzen" },
    ];
    if (rolle === "inhaber") {
      organisation.push({ href: "/app/os/abo", label: "Tarif", icon: "abo" });
    }
    sektionen.push({ titel: "organisation", items: organisation });
    sektionen.push(EINSTELLUNGEN);
    return { produktBadge: "os", sektionen };
  }
  if (rolle === "fahrlehrer") {
    sektionen.push({
      titel: "mein Tag",
      items: [
        UEBERSICHT,
        { href: "/app/os/kalender", label: "Kalender", icon: "kalender" },
        { href: "/app/os/schueler", label: "Schüler", icon: "schueler" },
        { href: "/app/os/zeiterfassung", label: "Zeiterfassung", icon: "zeit" },
      ],
    });
    sektionen.push(EINSTELLUNGEN);
    return { produktBadge: "os", sektionen };
  }

  // ---- API-Partner-Mitglied (school_staff ohne Membership, P1-Ghost-Muster) --
  if (options.istApiPartnerMitglied) {
    sektionen.push({
      titel: "Partner-API",
      items: [
        UEBERSICHT,
        { href: "/app/partner-api/keys", label: "API-Schlüssel", icon: "schluessel" },
        { href: "/app/partner-api/docs", label: "Dokumentation", icon: "doku" },
      ],
    });
    sektionen.push(EINSTELLUNGEN);
    return { produktBadge: "api", sektionen };
  }

  // ---- Fallback: Konto ohne Rollenzuordnung ---------------------------------
  sektionen.push({ titel: null, items: [UEBERSICHT] });
  sektionen.push(EINSTELLUNGEN);
  return { produktBadge: null, sektionen };
}
