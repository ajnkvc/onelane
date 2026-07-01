import { getSiteUrl } from "@/lib/public-config";

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

## Fahrschul-Profile
- Veröffentlichte Fahrschul-Profile sind indexierbar unter
  ${base}/fahrschulen/{stadt}/{fahrschule} und vollständig in der Sitemap gelistet:
  ${base}/sitemap.xml
- Stadt-/Bezirks-Übersichtsseiten folgen und werden hier ergänzt, sobald veröffentlicht.

## Status
- Inhalte werden serverseitig gerendert (für Menschen und Maschinen lesbar).
- Strukturierte Daten (Schema.org/JSON-LD) auf den Profilseiten.
`;

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
