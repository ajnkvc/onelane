import type { Metadata } from "next";

/**
 * Datenschutz — Legal-STUB (Phase D). Bewusst Platzhalter; vollständige
 * Datenschutzerklärung + Cookie-/Consent-Konzept folgen in Phase M (anwaltlich
 * geprüft). `noindex`, solange Entwurf.
 */
export const metadata: Metadata = {
  title: "Datenschutz",
  robots: { index: false, follow: true },
};

export default function DatenschutzPage() {
  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <h1 className="text-2xl font-bold tracking-tight">Datenschutzerklärung</h1>

      <div className="mt-5 rounded-xl border border-border bg-muted p-4 text-sm">
        <p className="font-medium text-warning">Entwurf / Platzhalter — noch nicht rechtlich final.</p>
        <p className="mt-1 text-muted-foreground">
          Die vollständige Datenschutzerklärung (DSGVO) sowie das Cookie-/Consent-Konzept folgen in
          Phase M nach anwaltlicher Prüfung. Grundsatz des Projekts: Datenminimierung,
          Minderjährigenschutz, keine unnötigen Drittdienste.
        </p>
      </div>

      <div className="mt-6 space-y-2 text-sm text-muted-foreground">
        <p>Verantwortlicher: <em>folgt</em></p>
        <p>Verarbeitete Daten &amp; Zwecke: <em>folgt</em></p>
        <p>Rechtsgrundlagen, Speicherdauer, Betroffenenrechte: <em>folgt</em></p>
        <p>Auftragsverarbeiter (z. B. Hosting): <em>folgt</em></p>
      </div>
    </div>
  );
}
