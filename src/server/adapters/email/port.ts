/**
 * EmailPort — Vertrag für E-Mail-Versand (anbieterunabhängig).
 * Die Geschäftslogik kennt nur diesen Vertrag, nie den konkreten Anbieter.
 * Anbieterwechsel = neue Adapter-Implementierung + Auswahl in ./index.ts.
 */

/**
 * Anhang (z. B. Bewerbungs-CV/-Foto im Durchleitungs-Prinzip): Inhalte liegen NUR
 * im Speicher des laufenden Requests und werden nie persistiert. Adapter dürfen
 * für Logs/Debugging AUSSCHLIESSLICH Metadaten (filename/contentType/Größe)
 * verwenden — nie den Inhalt.
 */
export interface EmailAttachment {
  filename: string;
  content: Uint8Array;
  contentType: string;
}

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: EmailAttachment[];
}

export interface EmailPort {
  send(message: EmailMessage): Promise<void>;
}
