import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPortalIdentity } from "@/modules/portal/identity";
import { hatPlattformRolle } from "@/modules/portal/rollen";
import { istFeatureFlagGlobalAktiv } from "@/modules/portal/bereiche";
import { DashboardHero } from "@/components/portal/dashboards/hero";
import { PanelKarte, StatusPunkt, Zeile, ZeilenListe } from "@/components/portal/karten";

/**
 * intern/pay — VERTRAULICHER interner Vorbereitungs-Status (OS-P3, Paket D;
 * Plan-Entscheidung 8 EXAKT).
 * ----------------------------------------------------------------------------
 * DOPPELTES GATE, fail-closed: Plattformrolle 'admin' UND global aktives
 * feature_flag 'pay' — sonst notFound() (404 ist der NORMALZUSTAND, das Flag
 * ist standardmäßig aus). KEIN Nav-Eintrag (Zugriff nur per URL, Welle 1);
 * KEINE Produkttexte — ausschließlich interner Arbeitsstand als ruhige
 * Checkliste. Außerhalb dieser Route existiert der Bereich nirgends
 * (Sweep-Pflicht P4: pay/buchung/booking nur hier).
 */
export const metadata: Metadata = { title: "Interner Vorbereitungs-Status" };

/** Interner Arbeitsstand — bewusst statisch (kein DB-Modell in Welle 1). */
const CHECKLISTEN: Array<{
  titel: string;
  kicker: string;
  punkte: Array<{ text: string; stand: "offen" | "in Arbeit" | "konzipiert" }>;
}> = [
  {
    titel: "Stripe-Connect-Vorbereitung",
    kicker: "zahlungs-fundament",
    punkte: [
      { text: "Struktur Direct Charges + application_fee (Schule = Zahlungsempfänger)", stand: "konzipiert" },
      { text: "Bestätigung der Struktur durch Anwalt und Stripe (kein ZAG-/BaFin-Lizenzbedarf)", stand: "offen" },
      { text: "Risk-Ledger-Entwurf (Custom-Haftung, zahlart + payment_status je Vorgang)", stand: "in Arbeit" },
      { text: "Onboarding-Flow für Schul-Konten (KYC-Strecke, Capability-Flags)", stand: "offen" },
      { text: "Test-Umgebung mit Sandbox-Konten", stand: "offen" },
    ],
  },
  {
    titel: "Trigger-Konzept „Fahrt beenden“",
    kicker: "exactly-once",
    punkte: [
      { text: "Idempotency-Key je Abschluss-Ereignis (nie doppelt abbuchen)", stand: "konzipiert" },
      { text: "Dedup- und Offline-Queue-Verhalten (Funkloch-Fall)", stand: "in Arbeit" },
      { text: "Storno-Pfad: Rücküberweisung + Stornorechnung/Gutschrift (GoBD, auditiert)", stand: "konzipiert" },
      { text: "Mandats-Grundlage am Schülerprofil (tokenisiert, kein Roh-IBAN bei uns)", stand: "konzipiert" },
    ],
  },
  {
    titel: "Buchungsmaschine — Konzeptstatus",
    kicker: "vertraulich",
    punkte: [
      { text: "Konzept liegt ausschließlich in der internen Doku (nicht im Produkt, nicht öffentlich)", stand: "in Arbeit" },
      { text: "Erscheint nie als eigenes Modul — Bestandteil dieses Abo-Bausteins", stand: "konzipiert" },
      { text: "Freischaltung später nur je Schule über das Schul-Flag (nie als Teaser)", stand: "konzipiert" },
    ],
  },
];

function standTon(stand: "offen" | "in Arbeit" | "konzipiert"): "neutral" | "ok" | "warnung" {
  return stand === "konzipiert" ? "ok" : stand === "in Arbeit" ? "warnung" : "neutral";
}

export default async function Seite() {
  const identity = await getPortalIdentity();
  if (!identity || !hatPlattformRolle(identity, "admin")) notFound();
  if (!(await istFeatureFlagGlobalAktiv("pay"))) notFound();

  return (
    <div className="grid gap-6">
      <DashboardHero
        kicker="intern · vertraulich"
        titel="Interner Vorbereitungs-Status"
        satz="Arbeitsstand des Zahlungs-Bausteins — nur für Berechtigte, ohne Außenwirkung."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {CHECKLISTEN.map((liste) => (
          <PanelKarte
            key={liste.titel}
            titel={liste.titel}
            kicker={liste.kicker}
            className={liste.punkte.length > 4 ? "lg:row-span-2" : undefined}
          >
            <ZeilenListe>
              {liste.punkte.map((punkt) => (
                <Zeile
                  key={punkt.text}
                  links={<span className="font-normal">{punkt.text}</span>}
                  rechts={
                    <span className="inline-flex items-center gap-1.5">
                      <StatusPunkt ton={standTon(punkt.stand)} />
                      {punkt.stand}
                    </span>
                  }
                />
              ))}
            </ZeilenListe>
          </PanelKarte>
        ))}
      </div>

      <PanelKarte titel="Leitplanken" kicker="verbindlich">
        <ul className="grid gap-2 text-sm text-muted-foreground">
          <li>Zahlung bleibt hart AUS, bis die offenen Bestätigungen (Anwalt, Stripe) vorliegen.</li>
          <li>Keine externe Zahlungs-Anbindung — der Baustein ist unser eigenes Produkt.</li>
          <li>Dieser Bereich erhält erst mit Flag-Ausbau (P4) einen Navigations-Eintrag.</li>
        </ul>
      </PanelKarte>
    </div>
  );
}
