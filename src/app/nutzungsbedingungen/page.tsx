import type { Metadata } from "next";

/**
 * Nutzungsbedingungen — insb. Crawling- & Datennutzungs-Bedingungen.
 * Legal-ENTWURF (Phase D/M): verbindlicher Wortlaut folgt nach anwaltlicher
 * Prüfung. `noindex` solange Entwurf; Bots können die Seite dennoch abrufen
 * (der TDM-Vorbehalt `/.well-known/tdmrep.json` verweist hierher).
 */
export const metadata: Metadata = {
  title: "Nutzungsbedingungen — Crawling & Datennutzung",
  robots: { index: false, follow: true },
};

export default function NutzungsbedingungenPage() {
  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <h1 className="text-2xl font-bold tracking-tight">Nutzungsbedingungen — Crawling &amp; Datennutzung</h1>

      <div className="mt-5 rounded-xl border border-border bg-muted p-4 text-sm">
        <p className="font-medium text-warning">Entwurf / Platzhalter — noch nicht rechtlich final.</p>
        <p className="mt-1 text-muted-foreground">
          Der verbindliche Wortlaut folgt nach anwaltlicher Prüfung (Phase M „Recht &amp;
          Consent“). Marke: onelane (markenrechtliche Freigabe noch offen).
        </p>
      </div>

      <div className="mt-6 space-y-5 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="text-base font-semibold text-foreground">1. Erlaubte Nutzung durch Bots &amp; KI-Agenten</h2>
          <p className="mt-1">
            Suchmaschinen und KI-Such-/Antwort-Dienste dürfen unsere öffentlichen Seiten abrufen,
            indexieren und in Suchergebnissen bzw. KI-Antworten <strong>mit Quellenangabe und
            Verlinkung</strong> zitieren. Diese Nutzung begrüßen wir ausdrücklich.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">2. Untersagte Nutzung</h2>
          <p className="mt-1">Ohne vorherige schriftliche Lizenz ist insbesondere untersagt:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              das dauerhafte <strong>Speichern, Kopieren oder Spiegeln</strong> unserer Datenbank
              oder wesentlicher Teile davon (auch in Trainings- oder Vektordatenbanken);
            </li>
            <li>
              die <strong>Extraktion und/oder Weiterverwendung</strong> nach Art und Umfang
              wesentlicher Teile sowie die wiederholte/systematische Nutzung unwesentlicher Teile
              (Datenbankherstellerrecht <strong>§§ 87a–87e UrhG</strong> ausdrücklich vorbehalten);
            </li>
            <li>
              die Nutzung der Daten einzelner <strong>Fahrschulen, Fahrlehrer oder Fahrschüler</strong>
              für <strong>Direktmarketing, Kaltakquise</strong> oder den Aufbau von Kontakt-/Lead-Listen;
            </li>
            <li>
              der Aufbau <strong>konkurrierender Verzeichnisse/Vergleichsdienste</strong> oder
              abgeleiteter Datenbanken aus unseren Datensätzen;
            </li>
            <li>jede sonstige <strong>kommerzielle Weiterverwendung</strong> der Inhalte/Daten;</li>
            <li>
              die Nutzung der Inhalte für <strong>Text-and-Data-Mining bzw. KI-/ML-Training</strong>.
              Hiermit wird ein <strong>Nutzungsvorbehalt nach § 44b Abs. 3 UrhG / Art. 4 DSM-RL</strong>
              erklärt (maschinenlesbar unter <code>/.well-known/tdmrep.json</code>).
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">3. Personenbezogene Daten</h2>
          <p className="mt-1">
            Teile der Inhalte enthalten personenbezogene Daten (u. a. von Fahrlehrern und teils
            minderjährigen Nutzern). Deren Erhebung/Weiterverwendung — insbesondere zu Werbe-/
            Marketingzwecken — ist ohne Rechtsgrundlage nach <strong>DSGVO</strong> unzulässig.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">4. Fremdquellen / OpenStreetMap</h2>
          <p className="mt-1">
            Die vorstehenden Vorbehalte betreffen unsere eigene Leistung (Verifizierung, Pflege,
            Struktur, Preise). Aus <strong>OpenStreetMap</strong> stammende Rohdaten unterliegen
            weiterhin der <strong>ODbL</strong>; insoweit beanspruchen wir kein Exklusivrecht.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">5. Lizenz &amp; Kontakt</h2>
          <p className="mt-1">
            Eine über Ziffer 1 hinausgehende Nutzung bedarf einer schriftlichen Lizenz. Anfragen:
            <em> folgt</em>.
          </p>
        </section>
      </div>
    </div>
  );
}
