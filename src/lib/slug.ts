/**
 * slug.ts — deterministische Slugifizierung (z. B. Stadtname → URL-Segment).
 * Muss identisch in Profil-Lookup UND Ergebnislisten-Verlinkung genutzt werden,
 * damit erzeugte Links exakt auf die Detailroute matchen.
 */
const COMBINING_MARKS = /[̀-ͯ]/g;

export function slugify(input: string): string {
  return input
    .toLowerCase()
    // Deutsche Umlaute/ß VOR dem Entfernen der Diakritika ausschreiben:
    // München→muenchen, Köln→koeln, Düsseldorf→duesseldorf, Straße→strasse.
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(COMBINING_MARKS, "") // restliche Diakritika entfernen (é→e …)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
