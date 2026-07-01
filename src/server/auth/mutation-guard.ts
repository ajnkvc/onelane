import "server-only";
import { assertSameOrigin } from "@/server/auth/origin-guard";
import { toHttpAuthError } from "@/server/auth/permissions";

/**
 * mutation-guard.ts — zentrales Gate für MUTIERENDE Route Handler (F-056).
 * ============================================================================
 * CSRF/Origin-Schutz darf nicht Kommentar-Konvention bleiben: jeder mutierende
 * Route Handler wird über `withMutationGuards()` exportiert, das VOR dem Handler
 * Same-Origin erzwingt und Autorisierungs-/CSRF-Fehler zentral auf saubere
 * Statuscodes mappt (kein 500-Leak, keine Fehlerdetails nach außen).
 *
 * Nutzung:
 *   export const POST = withMutationGuards(async (request) => { ... });
 *
 * (Auth/Rate-Limit/Body-Limits kommen hier als weitere zentrale Guards hinzu,
 *  sobald die jeweiligen Flows/Endpunkte entstehen.)
 */
export type RouteHandler = (request: Request) => Promise<Response> | Response;

export function withMutationGuards(handler: RouteHandler): RouteHandler {
  return async (request: Request): Promise<Response> => {
    try {
      // CSRF erste Linie: mutierende Methoden müssen von einer erlaubten Origin kommen.
      assertSameOrigin(request);
      return await handler(request);
    } catch (err) {
      const { status, code } = toHttpAuthError(err);
      return Response.json({ error: code }, { status });
    }
  };
}
