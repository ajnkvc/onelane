import { getSiteUrl } from "@/lib/public-config";

/**
 * TDM Reservation Protocol (TDMRep, W3C) — maschinenlesbarer Vorbehalt gegen
 * Text-and-Data-Mining nach § 44b Abs. 3 UrhG / Art. 4 DSM-Richtlinie.
 * ----------------------------------------------------------------------------
 * Wird an `/.well-known/tdmrep.json` ausgeliefert. `tdm-reservation: 1` = TDM
 * (insb. KI-Training/Data-Mining) für die GESAMTE Domain ausdrücklich
 * VORBEHALTEN. `tdm-policy` verweist auf unsere Nutzungsbedingungen, unter denen
 * eine Lizenz erhältlich ist. Dies ist — anders als robots.txt — der
 * rechtlich anerkannte, maschinenlesbare Opt-out.
 *
 * Hinweis (OSM/ODbL): Der Vorbehalt schützt unsere Eigenleistung; aus
 * OpenStreetMap stammende Rohdaten unterliegen weiterhin der ODbL.
 */
export function GET() {
  const base = getSiteUrl();
  const body = [
    {
      location: base,
      "tdm-reservation": 1,
      "tdm-policy": `${base}/nutzungsbedingungen`,
    },
  ];
  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/tdmrep+json; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
