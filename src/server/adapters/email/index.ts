import "server-only";
import { isProduction } from "@/lib/public-config";
import type { EmailPort, EmailMessage } from "./port";

/**
 * E-Mail-Adapter-Auswahl.
 * ----------------------------------------------------------------------------
 * Phase 1: DevLogAdapter — protokolliert Mails nur lokal und VERSCHICKT NICHTS.
 * Ein echter EU-Anbieter (DSGVO, da teils Minderjährige) wird später ergänzt und
 * hier per Konfiguration ausgewählt — ohne Eingriff in die Geschäftslogik.
 */

/** E-Mail (PII) für Logs maskieren: nur erster Buchstabe + Domain. */
function maskEmail(address: string): string {
  const at = address.indexOf("@");
  if (at <= 0) return "***";
  return `${address[0]}***${address.slice(at)}`;
}

class DevLogAdapter implements EmailPort {
  async send(message: EmailMessage): Promise<void> {
    // Schutz: Der Dev-Adapter darf NIEMALS in Produktion aktiv sein (er versendet
    // nicht und würde Mails still verschlucken) → harter Fehler statt stiller Fehlfunktion.
    if (isProduction()) {
      throw new Error(
        "E-Mail: DevLog-Adapter ist in Produktion nicht erlaubt — echten EU-Anbieter konfigurieren.",
      );
    }
    // Nur maskierte Metadaten loggen (Datensparsamkeit; E-Mail ist PII).
    // Anhänge: AUSSCHLIESSLICH Metadaten (Name/Typ/Größe) — NIE Inhalte
    // (Durchleitungs-Prinzip: Bewerbungsunterlagen werden nicht persistiert).
    console.info("[E-Mail:DevLog] (nicht versendet)", {
      to: maskEmail(message.to),
      subject: message.subject,
      // Dateinamen maskieren: Bewerber benennen CVs oft nach sich selbst
      // („Max-Mustermann-Lebenslauf.pdf") — Namensbestandteile sind PII und
      // gehören nicht in Dev-/Staging-Logs (Sicherheits-Abnahme 2026-07-02).
      attachments: (message.attachments ?? []).map((a) => ({
        filename: a.filename.replace(/^(.{2}).*?(\.[A-Za-z0-9]+)?$/, "$1***$2"),
        contentType: a.contentType,
        bytes: a.content.byteLength,
      })),
    });
  }
}

let instance: EmailPort | null = null;

export function getEmailAdapter(): EmailPort {
  if (!instance) {
    instance = new DevLogAdapter();
  }
  return instance;
}
