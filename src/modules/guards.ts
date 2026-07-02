import "server-only";

/**
 * Modul-Schicht-Naht für Route-Handler-Guards: Route Handler (src/app/api/**)
 * dürfen `@/server` nicht direkt importieren (ESLint-Schichtgrenze) — mutierende
 * Endpunkte beziehen den Same-Origin-/Fehler-Wrapper deshalb über diese Naht
 * (gleiches Muster wie src/modules/ratelimit für die Drosselung).
 */
export { withMutationGuards } from "@/server/auth/mutation-guard";
