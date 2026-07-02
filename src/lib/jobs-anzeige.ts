import type { JobListItem } from "@/modules/jobs/queries";

/**
 * jobs-anzeige.ts — GEMEINSAME Darstellungs-Helfer der Jobbörse (M5).
 * ----------------------------------------------------------------------------
 * EINE Quelle für alles Wording, das auf /jobs, /jobs/[slug] und im
 * Bewerbungs-Funnel identisch sein MUSS (kein Text-Drift zwischen Karte,
 * Fakten-Box und JSON-LD). Rein und deterministisch — unit-testbar
 * (tests/jobs-anzeige.test.ts), bewusst OHNE `server-only`.
 *
 * VERBINDLICHE Wording-Auflagen (Review-Auflagen, bau-spec-jobboerse-m5):
 *  - AGG: Titel werden automatisch neutral gerendert — `… (m/w/d)` wird
 *    angehängt, wenn der Zusatz nicht bereits im Titel steckt.
 *  - Gehalt: NUR eine komplette, von der Fahrschule bestätigte Spanne wird
 *    angezeigt (die DB garantiert das — CHECK chk_school_jobs_gehalt, 0025),
 *    IMMER mit dem Pflicht-Label „Angabe der Fahrschule · bestätigt am <Datum>".
 *    Ohne bestätigte Spanne bleibt es neutral bei „Gehalt: auf Anfrage".
 *  - Quereinstiegs-Finanzierung: NUR das Flag-Wording „Ausbildungsfinanzierung
 *    möglich / anteilig / voll — nach Vereinbarung"; KEINE Bindungsdauer,
 *    KEINE Rückzahlungs- oder Fördergarantien.
 */

/** Hängt „ (m/w/d)" an, sofern der Titel den Zusatz nicht schon trägt (AGG). */
export function titelMitMwd(titel: string): string {
  const t = titel.trim();
  return /\(\s*m\s*\/\s*w\s*\/\s*d\s*\)/i.test(t) ? t : `${t} (m/w/d)`;
}

/** ISO-Datum (YYYY-MM-DD) → „TT.MM.JJJJ"; ungültig → null (nichts erfinden). */
export function formatDatum(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : null;
}

// Bis zu 2 Nachkommastellen, keine Pflicht-Nullen — NIE runden (bestätigte
// Beträge dürfen nicht verändert werden, z. B. Stundenlohn „28,50").
const euro = new Intl.NumberFormat("de-DE", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** Betrag-String der DB („3400.00") → „3.400"; nicht parsebar → null. */
function euroZahl(betrag: string): string | null {
  const n = Number.parseFloat(betrag);
  return Number.isFinite(n) ? euro.format(n) : null;
}

export const GEHALT_ZEITRAUM_LABEL: Record<"monat" | "jahr" | "stunde", string> = {
  monat: "pro Monat",
  jahr: "pro Jahr",
  stunde: "pro Stunde",
};

export interface GehaltsBadge {
  /** z. B. „3.400–3.900 € pro Monat" */
  spanne: string;
  /** Pflicht-Label: „Angabe der Fahrschule · bestätigt am 10.06.2026" */
  label: string;
}

/**
 * Bestätigte Gehaltsspanne + Pflicht-Label — oder null (dann zeigt die UI
 * neutral „Gehalt: auf Anfrage"). Es genügt, `gehaltBestaetigtAm` zu prüfen:
 * die DB (chk_school_jobs_gehalt, 0025) garantiert dann eine KOMPLETTE Spanne.
 */
export function gehaltsBadge(job: {
  gehaltVonEuro: string | null;
  gehaltBisEuro: string | null;
  gehaltZeitraum: "monat" | "jahr" | "stunde" | null;
  gehaltBestaetigtAm: string | null;
}): GehaltsBadge | null {
  if (!job.gehaltBestaetigtAm || !job.gehaltVonEuro || !job.gehaltBisEuro || !job.gehaltZeitraum) {
    return null;
  }
  const von = euroZahl(job.gehaltVonEuro);
  const bis = euroZahl(job.gehaltBisEuro);
  const datum = formatDatum(job.gehaltBestaetigtAm);
  if (!von || !bis || !datum) return null;
  return {
    spanne: `${von}–${bis} € ${GEHALT_ZEITRAUM_LABEL[job.gehaltZeitraum]}`,
    label: `Angabe der Fahrschule · bestätigt am ${datum}`,
  };
}

export const BESCHAEFTIGUNGSART_LABEL: Record<string, string> = {
  vollzeit: "Vollzeit",
  teilzeit: "Teilzeit",
  minijob: "Minijob",
  nebenberuflich: "Nebenberuflich",
};

export const ARBEITSZEIT_LABEL: Record<string, string> = {
  vollzeit: "Vollzeit",
  teilzeit: "Teilzeit",
  flexibel: "flexibel",
};

export const VERGUETUNGSMODELL_LABEL: Record<string, string> = {
  fix: "Festgehalt",
  fix_plus_umsatz: "Festgehalt + Umsatzbeteiligung",
  nach_vereinbarung: "nach Vereinbarung",
};

/**
 * Erlaubtes Finanzierungs-Wording (Flag, keine Zusagen): „Ausbildungsfinanzierung
 * möglich / anteilig / voll — nach Vereinbarung". `keine` → null (nichts zeigen).
 */
export function finanzierungsLabel(
  f: JobListItem["quereinsteigerFinanzierung"],
): string | null {
  switch (f) {
    case "voll":
      return "Ausbildungsfinanzierung voll — nach Vereinbarung";
    case "anteilig":
      return "Ausbildungsfinanzierung anteilig — nach Vereinbarung";
    case "nach_vereinbarung":
      return "Ausbildungsfinanzierung möglich — nach Vereinbarung";
    default:
      return null;
  }
}

/** Beschäftigungsart → Schema.org employmentType (JobPosting-JSON-LD). */
export const EMPLOYMENT_TYPE_SCHEMA: Record<string, string> = {
  vollzeit: "FULL_TIME",
  teilzeit: "PART_TIME",
  minijob: "PART_TIME",
  nebenberuflich: "PART_TIME",
};

/** Gehalts-Zeitraum → Schema.org unitText (QuantitativeValue der baseSalary). */
export const SALARY_UNIT_SCHEMA: Record<"monat" | "jahr" | "stunde", string> = {
  monat: "MONTH",
  jahr: "YEAR",
  stunde: "HOUR",
};

/**
 * §-2-FahrlG-Gesetzesblock — EIN Wortlaut für Detailseite und Conversion-Seite
 * (Review-Auflage, mit Stand-Hinweis und ohne Gewähr).
 */
export const FAHRLG_VORAUSSETZUNGEN = [
  "mindestens 21 Jahre alt",
  "Fahrerlaubnis der Klasse B seit mindestens 3 Jahren",
  "Fahrerlaubnis der Zielklasse, für die ausgebildet wird",
  "erforderliche Deutschkenntnisse",
] as const;

export const FAHRLG_STAND_HINWEIS =
  "Stand: Juli 2026, ohne Gewähr — verbindlich ist die Auskunft der zuständigen Erlaubnisbehörde.";
