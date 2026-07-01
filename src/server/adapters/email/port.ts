/**
 * EmailPort — Vertrag für E-Mail-Versand (anbieterunabhängig).
 * Die Geschäftslogik kennt nur diesen Vertrag, nie den konkreten Anbieter.
 * Anbieterwechsel = neue Adapter-Implementierung + Auswahl in ./index.ts.
 */
export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface EmailPort {
  send(message: EmailMessage): Promise<void>;
}
