import { getSiteUrl } from "@/lib/public-config";
import { RATGEBER_GUIDES } from "@/lib/ratgeber";

/**
 * llms.txt — kuratierter, LLM-freundlicher Index der wichtigsten Inhalte.
 * Dynamisch, damit er mitwächst (Schulen/Städte/Artikel) — Fundament-Platzhalter.
 * Wird an der Domain-Wurzel als /llms.txt ausgeliefert.
 */
export function GET() {
  const base = getSiteUrl();
  const body = `# Fahrschul-Plattform

> Vergleichsportal für Fahrschulen in der DACH-Region: Suche, Filter,
> Bewertungen und Online-Buchung. Phase 1 (Vergleichsportal) im Aufbau.

## Verfügbare Bereiche
- Startseite: ${base}
- Fahrschul-Suche: ${base}/fahrschulen
- Vergleichsmodus (bis zu 4 Fahrschulen nebeneinander, Preisbestandteile nach
  § 32 FahrlG — ohne Gesamtpreis): ${base}/vergleich
- onelane trust (unser Betreuungs-Versprechen): ${base}/trust
- Für Eltern (Kosten, Tipps, BF17, U18-Einbindung): ${base}/eltern
- Ratgeber (ehrliches Wissen rund um Führerschein & Fahrschule): ${base}/ratgeber
- Jobbörse (kuratierte Stellen von Fahrschulen, ohne bezahlte Platzierung): ${base}/jobs
- Fahrlehrer:in werden (Quereinstieg kompakt erklärt): ${base}/jobs/fahrlehrer-werden
- So sortieren wir (Transparenz zu Suche und Stellenanzeigen): ${base}/so-sortieren-wir

## Ratgeber-Artikel
${RATGEBER_GUIDES.map((g) => `- ${g.titel}: ${base}/ratgeber/${g.slug}`).join("\n")}

## Fahrschul-Profile
- Veröffentlichte Fahrschul-Profile sind indexierbar unter
  ${base}/fahrschulen/{stadt}/{fahrschule} und vollständig in der Sitemap gelistet:
  ${base}/sitemap.xml
- Stadt-/Bezirks-Übersichtsseiten folgen und werden hier ergänzt, sobald veröffentlicht.

## Stellenanzeigen
- Aktive Stellenanzeigen von Fahrschulen sind indexierbar unter
  ${base}/jobs/{stelle} (JobPosting-JSON-LD) und in der Sitemap gelistet;
  abgelaufene Anzeigen verschwinden automatisch.

## Status
- Inhalte werden serverseitig gerendert (für Menschen und Maschinen lesbar).
- Strukturierte Daten (Schema.org/JSON-LD) auf den Profilseiten.
`;

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
