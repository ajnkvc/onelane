import type { Metadata } from "next";

/**
 * Impressum — Legal-STUB (Phase D). Bewusst Platzhalter; verbindliche Angaben
 * (§ 5 DDG) folgen nach anwaltlicher Prüfung (Phase M). `noindex`, solange Entwurf.
 */
export const metadata: Metadata = {
  title: "Impressum",
  robots: { index: false, follow: true },
};

export default function ImpressumPage() {
  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <h1 className="text-2xl font-bold tracking-tight">Impressum</h1>

      <div className="mt-5 rounded-xl border border-border bg-muted p-4 text-sm">
        <p className="font-medium text-warning">Entwurf / Platzhalter — noch nicht rechtlich final.</p>
        <p className="mt-1 text-muted-foreground">
          Die verbindliche Anbieterkennzeichnung nach § 5 DDG folgt nach anwaltlicher Prüfung
          (Phase M „Recht &amp; Consent“). Marke: onelane (markenrechtliche Freigabe noch offen).
        </p>
      </div>

      <div className="mt-6 space-y-2 text-sm text-muted-foreground">
        <p>Angaben gemäß § 5 DDG: <em>folgt</em></p>
        <p>Vertretungsberechtigte Person: <em>folgt</em></p>
        <p>Kontakt (E-Mail/Telefon): <em>folgt</em></p>
        <p>Umsatzsteuer-ID: <em>folgt</em></p>
      </div>
    </div>
  );
}
