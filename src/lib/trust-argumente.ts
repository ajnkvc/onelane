/**
 * trust-argumente.ts — EINE Quelle der fünf „onelane trust"-Argumente.
 * ----------------------------------------------------------------------------
 * Kurz-Titel + 2–3 Sätze Erklärtext, verwendet an ZWEI Stellen (deckungsgleich,
 * kein Text-Drift): im dunklen trust-Panel der Startseite (aufklappbare
 * <details>-Punkte) und auf /trust (ausführliches Register).
 *
 * AUSWAHL + REIHENFOLGE vom Gründer fest vorgegeben (2026-07-02): genau diese
 * fünf, in dieser Reihenfolge. Die früheren Punkte „Deine Anmeldung,
 * dokumentiert." und „Unsicher? Frag uns." sind bewusst herausgenommen
 * (Panel kompakter) — Wiederaufnahme nur mit Gründer-Freigabe.
 *
 * RECHTSLEITPLANKE: Marken-Versprechen, KEIN Gütesiegel — operativ leistbare
 * Zusagen ohne Fristen/Garantien und ohne „geprüft/zertifiziert"-Sprache.
 * Punkt 5 beschreibt die SITUATION vor Ort (Verkaufsgespräche sind
 * überzeugend), ohne Fahrschulen pauschal zu beschuldigen (§ 4 UWG).
 */
export const TRUST_ARGUMENTE: ReadonlyArray<{ title: string; text: string }> = [
  {
    title: "Bei Problemen stehen wir an deiner Seite.",
    text: "Unklarheiten nach der Anmeldung, Fragen zum Ablauf, Missverständnisse mit der Fahrschule: Sprich mit uns statt mit niemandem. Wir hören zu und helfen, zwischen dir und der Fahrschule zu vermitteln.",
  },
  {
    title: "Keine Rückmeldung? Wir haken nach.",
    text: "Meldet sich deine Fahrschule nicht, erinnern wir sie an deine Anfrage. Du musst nicht selbst hinterhertelefonieren oder deine Anfrage wiederholen — das übernehmen wir für dich.",
  },
  {
    title: "Passt es nicht? Wir helfen beim Wechsel.",
    text: "Manchmal passt es einfach nicht — das ist okay. Wenn du wechseln willst, findest du über uns eine neue Fahrschule, und wir bleiben dran, bis du bei der richtigen bist.",
  },
  {
    title: "Nur deine Fahrschule bekommt deine Daten.",
    text: "Deine Anfrage geht ausschließlich an die eine Fahrschule, die du ausgewählt hast — sonst niemand. Kein Verteilen an mehrere Schulen, kein Weiterreichen an Dritte. Wir fragen außerdem nur ab, was für deine Anmeldung wirklich nötig ist.",
  },
  {
    title: "Digitale Anmeldung ohne Druck.",
    text: "Vor Ort fällt es oft schwer, ‚Ich überlege noch‘ zu sagen — ein Gespräch im Büro kann sehr überzeugend sein. Bei onelane entscheidest du digital und in Ruhe: vergleichen, nachdenken, mit anderen sprechen — und erst anmelden, wenn du wirklich so weit bist.",
  },
];
