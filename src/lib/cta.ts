/**
 * cta.ts — zentrale Wortwahl der Anmelde-CTAs (Gründer-Direktive).
 * ----------------------------------------------------------------------------
 * „Anmeldung starten" klingt nach Vertragsbindung und schreckt ab, solange das
 * Partner-Vertragssystem noch nicht live ist. Bis dahin heißen ALLE
 * Anmelde-Buttons „Jetzt anfragen" (kurz+einladend; „kostenlos & unverbindlich" steht als Microcopy daneben). Geht das Vertragssystem live
 * (VERTRAGSSYSTEM_LIVE = true — die EINZIGE Flip-Stelle), wechseln NUR
 * Partner-Schulen auf „Anmeldung starten"; alle übrigen bleiben bei der
 * Anfrage-Formulierung. Kontexte ohne Partner-Bezug (z. B. Startseite)
 * verwenden das Literal „Jetzt anfragen".
 */

/** Einzige Flip-Stelle: erst auf true stellen, wenn das Partner-Vertragssystem live ist. */
export const VERTRAGSSYSTEM_LIVE = false;

/** Button-Label für Anmelde-CTAs: „Anmeldung starten" NUR für Partner bei livem Vertragssystem. */
export function ctaLabel(opts: { isPartner: boolean; vertragssystemLive?: boolean }): string {
  const live = opts.vertragssystemLive ?? VERTRAGSSYSTEM_LIVE;
  return opts.isPartner && live ? "Anmeldung starten" : "Jetzt anfragen";
}
