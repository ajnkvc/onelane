import { z } from "zod";
import { withMutationGuards } from "@/modules/guards";
import { ereignisRateLimiter } from "@/modules/ratelimit";
import { zaehleEreignis } from "@/modules/ereignisse/zaehler";

/**
 * POST /api/ereignis — anonymer, PII-freier Ereignis-Zähler (Migration 0024).
 * ----------------------------------------------------------------------------
 * Empfängt sendBeacon-/fetch-POSTs der Profilseite (zunächst Telefon-Klicks)
 * und zählt aggregiert je Schule × Typ × Tag. KEINE Besucherdaten: Body enthält
 * nur Schul-Slug + Typ; die IP dient ausschließlich dem transienten Rate-Limit
 * und wird nicht gespeichert. Same-Origin via withMutationGuards (CSRF-Linie);
 * die eigentlichen Gates (Slug→gelistete Schule, Typ-Whitelist, Tages-Cap)
 * erzwingt die DB-Funktion app.zaehle_ereignis.
 *
 * Antwort bewusst IMMER 204 (auch wenn nicht gezählt wurde) — der Endpunkt darf
 * nicht als Orakel taugen, welche Slugs existieren/gelistet sind.
 */
const bodySchema = z.object({
  slug: z.string().min(1).max(200),
  typ: z.literal("tel_klick"),
  /** Ort disambiguiert Slug-Kollisionen (Slugs nur je (land, ort) eindeutig). */
  ort: z.string().min(1).max(120).optional(),
});

export const POST = withMutationGuards(async (request: Request): Promise<Response> => {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "local";
  const { allowed, resetMs } = ereignisRateLimiter.check(ip);
  if (!allowed) {
    return new Response(null, {
      status: 429,
      headers: { "retry-after": String(Math.ceil(resetMs / 1000)) },
    });
  }

  let parsed: z.infer<typeof bodySchema> | null = null;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch {
    parsed = null; // ungültiger Body → stilles 204 (kein Format-Orakel)
  }
  if (parsed) await zaehleEreignis(parsed.slug, parsed.typ, parsed.ort ?? null);

  return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
});
