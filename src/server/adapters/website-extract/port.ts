import "server-only";

/**
 * WebsiteExtractPort — Vertrag für die assistierte Website-Prüfung (Stufe 2).
 * ----------------------------------------------------------------------------
 * Phase 2+: NUR DER VERTRAG, KEINE Implementierung. Bewusst kein Live-Scraper:
 * die Pipeline BEREITET die MANUELLE Prüfung vor — ein Mensch gibt frei. Ergebnis
 * sind IMMER nur Vorschläge in die Review-Queue, NIE Auto-Publish.
 *
 * SICHERHEITS-/RECHTSGRENZEN (verbindlich, siehe docs/SECURITY.md §8.1, §9 und
 * docs/crawler/STAGE2-EXTRACTION-DESIGN.md):
 * - Nur die EIGENE, hinterlegte Website der Schule (registrierbare Domain). SSRF-
 *   Härtung: nur http(s), keine IP-Literale/localhost/private Netze; jede Redirect-
 *   Stufe gegen die Site-Grenze prüfen (fremde final_url → Review, keine Evidenz).
 * - robots.txt wird je Pfad respektiert (absent=erlaubt, disallow=block+Review,
 *   unerreichbar/malformed=fail-closed Review). Identifizierender, neutraler UA,
 *   Timeout, Byte-Limit, niedrige Rate + Pause zwischen Abrufen (siehe RateLimiterPort).
 * - KEIN PII-Massenspeichern: kein HTML-Body und keine Kontakt-Klartexte dauerhaft
 *   ablegen — nur Provenienz (URL/final_url/abgerufen_am/content_hash) + Kandidaten
 *   zur sofortigen menschlichen Prüfung. Kein Raten (kein `info@domain`).
 * - Halluzinations-Schutz: jeder Kandidat braucht einen Beleg (Quelle/Provenienz)
 *   oder bleibt leer. LLM-Parsing NUR als Fallback HINTER dem vorhandenen AiPort.
 * - Anwalts-Gate vor Skalierung (Crawling-/Datennutzungs-Bedingungen, DSGVO B2B);
 *   manuelle Provenienz wird nie automatisch überschrieben; is_listed bleibt false.
 */

/** Wie ein Abruf gegenüber robots.txt + Site-Grenze ausging. */
export type FetchOutcome =
  | "fetched"
  | "robots_disallow"
  | "robots_unreachable"
  | "off_site_redirect"
  | "blocked_unsafe_target"
  | "rate_limited"
  | "error";

/** Belegt, WOHER ein Wert/Abruf stammt — Pflicht gegen Halluzination, ohne Body-Speicherung. */
export interface ExtractProvenance {
  /** Angeforderte URL (eigene Domain der Schule). */
  url: string;
  /** Tatsächliche End-URL nach erlaubten Redirects (Site-Grenze geprüft). */
  finalUrl?: string;
  /** Zeitpunkt des Abrufs (ISO 8601). */
  abgerufenAm: string;
  /** Hash des Inhalts (kein Klartext-Body), z. B. zur Wiedererkennung. */
  contentHash?: string;
}

/** Ergebnis eines robots-geprüften, ratenbegrenzten Abrufs der eigenen Website. */
export interface RobotsCheckedFetch {
  outcome: FetchOutcome;
  provenance: ExtractProvenance;
  httpStatus?: number;
  /** Typisierter/gekürzter Fehler (kein verbose Leak), nur falls outcome != "fetched". */
  error?: string;
}

/** Ein einzelner Kandidatenwert mit Konfidenz + Belegstelle (oder bleibt ungesetzt). */
export interface FieldCandidate<T = string> {
  /** Vorgeschlagener Wert; fehlt, wenn kein Beleg gefunden wurde (kein Raten). */
  value?: T;
  /** Heuristik-/Modell-Konfidenz 0..1 — rein informativ für die manuelle Prüfung. */
  confidence: number;
  /** Pflicht-Beleg: woher der Wert stammt (kein Beleg → kein Wert). */
  provenance: ExtractProvenance;
}

/** Strukturierte Kandidaten-Felder — alle optional, alle belegt oder leer. */
export interface ExtractionCandidates {
  name?: FieldCandidate;
  strasse?: FieldCandidate;
  hausnummer?: FieldCandidate;
  plz?: FieldCandidate;
  ort?: FieldCandidate;
  telefon?: FieldCandidate;
  email?: FieldCandidate;
  /** Evtl. abweichender/neuer Website-Link, falls auf der Seite gefunden. */
  websiteCandidate?: FieldCandidate;
}

/** Welche Unterseite für den Screenshot gemeint ist (nur diese sind vorgesehen). */
export type ScreenshotSubject = "impressum" | "kontakt";

/** Verweis auf einen erzeugten Screenshot — Pfad/Blob-Ref, kein Inline-Bild. */
export interface ScreenshotReference {
  subject: ScreenshotSubject;
  /** Speicher-/Blob-Referenz (z. B. Storage-Pfad), zur menschlichen Sichtprüfung. */
  ref: string;
  provenance: ExtractProvenance;
}

export interface WebsiteExtractPort {
  /**
   * (i) Ruft EINE Seite der eigenen Website robots-geprüft + ratenbegrenzt ab.
   * Liefert nur Provenienz/Status (kein dauerhaft gespeicherter Body).
   */
  fetchRespectingRobots(url: string): Promise<RobotsCheckedFetch>;

  /**
   * (ii) Extrahiert strukturierte Kandidaten-Felder MIT Konfidenz + Belegstelle.
   * Werte ohne Beleg bleiben ungesetzt (Halluzinations-Schutz); LLM-Parsing nur
   * als Fallback hinter dem AiPort. Ausgabe ist ein Vorschlag, keine Übernahme.
   */
  extractCandidates(fetched: RobotsCheckedFetch): Promise<ExtractionCandidates>;

  /**
   * (iii) Optionaler Screenshot der Impressum-/Kontaktseite (nur diese), damit der
   * Mensch ihn NEBEN dem Datensatz abgleichen kann. Liefert eine Pfad-/Blob-Ref.
   */
  captureScreenshot(
    url: string,
    subject: ScreenshotSubject,
  ): Promise<ScreenshotReference | null>;
}
