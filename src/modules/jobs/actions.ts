"use server";

import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { sql } from "drizzle-orm";
import { withAnonContext, withPublicSubmissionContext } from "@/server/dal";
import { createInMemoryRateLimiter } from "@/server/adapters/ratelimit";
import { getEmailAdapter } from "@/server/adapters/email";
import { getVermittlungEmail } from "@/lib/public-config";
import type { EmailAttachment } from "@/server/adapters/email/port";
import {
  bewerbungEingabeSchema,
  zeitfalleBestanden,
  pruefeCvDatei,
  pruefeFotoDatei,
  MAX_CV_BYTES,
  MAX_FOTO_BYTES,
} from "./schema";

/**
 * actions.ts — Server Action des öffentlichen Bewerbungs-Funnels (Jobbörse M5).
 * ----------------------------------------------------------------------------
 * Sicherheitskette (in dieser Reihenfolge, alles serverseitig — Leads-Muster 0022,
 * hier gegen Migration 0025):
 *  1. Job-Slug validieren (gebundenes Action-Argument aus der Route — von Next
 *     signiert, zusätzlich format-geprüft).
 *  2. Anti-Bot: Zeitfalle (min. 3 s) + Honeypot `website` (im Zod-Schema);
 *     Fehler bleiben GENERISCH (kein Bot-Orakel).
 *  3. Rate-Limit 5/min je (IP, Job-Slug) — bewusst enger als beim Anmelde-Lead
 *     (Datei-Uploads sind teurer). WICHTIG: der In-Memory-Limiter (geteiltes
 *     Util `createInMemoryRateLimiter`) wirkt nur PRO Instanz und ist ein
 *     ÜBERGANG — vor öffentlichem Betrieb MUSS ein Edge-/WAF-Rate-Limit
 *     (Cloudflare) vor dieser Route stehen (dokumentierte Auflage, SECURITY.md §8).
 *  4. DATEI-VALIDIERUNG (Durchleitungs-Prinzip): CV PFLICHT (PDF/DOC/DOCX ≤ 5 MB),
 *     Foto FREIWILLIG (JPG/PNG/WebP ≤ 3 MB) — Größe, MIME UND Magic-Bytes;
 *     Dateinamen sanitisiert. Die Dateien werden NICHT gespeichert (kein
 *     Storage/Vault in Phase 1 — kommt mit dem SaaS-Document-Vault): sie gehen
 *     AUSSCHLIESSLICH als Mail-Anhang an die Fahrschule; in der DB landen nur
 *     Metadaten (Name+Größe). Vorteile: keine Dokumenten-Haltung = kleinere
 *     Angriffsfläche, der 6-Monats-Purge bleibt DB-only.
 *  5. Zod-Validierung an der Modul-Grenze (strippt Unbekanntes; KEINE
 *     Gehaltshistorie-Felder — werden nie abgefragt).
 *  6. job_id/school AUSSCHLIESSLICH serverseitig per Slug-Auflösung über den
 *     anonymen Lese-DAL (RLS: nur aktive, gültige Anzeigen gelisteter Schulen
 *     auffindbar) — NIE aus dem Formular (IDOR-Schutz).
 *  7. INSERT über withPublicSubmissionContext mit EXAKT den per Spalten-Grant
 *     erlaubten Spalten, OHNE RETURNING; Einwilligungs-Zeitstempel = Serverzeit.
 *  8. LEAD-PARITÄT + VOLL-WEITERLEITUNG: jede Bewerbung ist ein Lead. Nach dem
 *     Insert geht die CI-Mail mit der VOLLSTÄNDIGEN Bewerbung (Schulen haben in
 *     Phase 1 keinen Portal-Zugang) + CV/Foto als ANHÄNGEN an
 *     `bewerbungs_email ?? email` der Schule — gedeckt durch die Pflicht-
 *     Einwilligung `einwilligung_weitergabe_at`. Fail-Verhalten: der Insert
 *     BLEIBT bestehen (Zählung!); ein Mail-Fehler bedeutet, dass die Unterlagen
 *     verloren gehen → interner No-PII-Fehlerlog. Outbox/Retry ist ein
 *     dokumentierter Phase-1b-Punkt.
 *
 * ZÄHLUNG (B2B-Währung): die job_applications-Zeilen sind die Zählbasis je
 * Schule (school_id über den Job) — „so viele Bewerbungen kamen über onelane".
 * Datenschutz: keine PII in URLs (Redirects tragen nur Pfad + generisches
 * Fehler-Flag), keine PII/Dateiinhalte in Logs.
 */

const SLUG_REGEX = /^[a-z0-9-]{1,200}$/;

// 5 Bewerbungen/Minute je (IP, Job-Slug) — großzügig für Menschen, eng für Skripte.
const bewerbungRateLimiter = createInMemoryRateLimiter({ windowMs: 60_000, max: 5 });

interface ZielJob {
  jobId: string;
  jobTitel: string;
  schulName: string;
}

/**
 * Slug → Job/Schule über den anonymen Lese-DAL. RLS garantiert: nur AKTIVE,
 * GÜLTIGE Anzeigen GELISTETER Schulen sind auflösbar — deckungsgleich mit der
 * INSERT-Policy (0025). Die expliziten Bedingungen dokumentieren das Fenster
 * zusätzlich (Defense-in-Depth, kostenneutral).
 */
async function resolveZielJob(slug: string): Promise<ZielJob | null> {
  try {
    return await withAnonContext(async (tx) => {
      const rows = (await tx.execute(sql`
        select j.id as job_id, j.titel, s.name as schul_name
        from public.school_jobs j
        join public.driving_schools s on s.id = j.school_id
        where j.slug = ${slug}
          and j.aktiv = true
          and (j.gueltig_bis is null or j.gueltig_bis >= current_date)
        limit 1
      `)) as unknown as Array<Record<string, unknown>>;
      const row = rows[0];
      if (!row) return null;
      return {
        jobId: String(row.job_id),
        jobTitel: String(row.titel),
        schulName: String(row.schul_name),
      };
    });
  } catch {
    return null;
  }
}

/** FormData-String defensiv lesen (Files/fehlende Felder → leerer String). */
function feld(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === "string" ? v : "";
}

/** Mehrfach-Auswahl (Checkboxen) defensiv lesen — nur Strings. */
function felder(formData: FormData, name: string): string[] {
  return formData.getAll(name).filter((v): v is string => typeof v === "string");
}

/** Datei defensiv lesen: nur echte, nicht-leere Files (leeres Input-Feld → null). */
function datei(formData: FormData, name: string): File | null {
  const v = formData.get(name);
  return v instanceof File && v.size > 0 && v.name !== "" ? v : null;
}

/** HTML-Escaping für Nutzertexte in der Bewerbungs-Mail. */
function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const STATUS_LABEL: Record<string, string> = {
  fahrlehrer: "Fahrlehrer:in (mit Fahrlehrerlaubnis)",
  anwaerter: "Fahrlehreranwärter:in (in Ausbildung)",
  quereinsteiger: "Quereinsteiger:in (interessiert an der Ausbildung)",
};

const VERFUEGBAR_LABEL: Record<string, string> = {
  sofort: "sofort",
  zum_datum: "zum Datum",
  flexibel: "flexibel / nach Absprache",
};

/**
 * Nimmt die Bewerbung entgegen. Wird in der Funnel-Seite via
 * `submitBewerbung.bind(null, { slug })` gebunden (Next signiert gebundene
 * Argumente) und funktioniert als reiner POST ohne JS — das Formular braucht
 * `encType="multipart/form-data"` (Datei-Upload).
 *
 * HINWEIS (Routen-Bau): Next begrenzt Server-Action-Bodies per Default auf 1 MB —
 * next.config.ts setzt dafür `experimental.serverActions.bodySizeLimit` (10 MB,
 * CV 5 MB + Foto 3 MB + Multipart-Overhead). Vor öffentlichem Betrieb zusätzlich
 * Edge-/WAF-Limits je Route (dokumentierte Auflage).
 */
export async function submitBewerbung(
  ziel: { slug: string },
  formData: FormData,
): Promise<void> {
  const slug = SLUG_REGEX.test(ziel.slug) ? ziel.slug : null;
  if (!slug) redirect("/jobs");

  const basisPfad = `/jobs/${slug}/bewerben`;
  // Generisches Fehlerziel — bewusst OHNE Feld-Details und OHNE PII in der URL.
  const fehlerZiel = `${basisPfad}?fehler=1`;

  // Anti-Bot-Kette VOR jeder teuren Arbeit: Zeitfalle …
  if (!zeitfalleBestanden(feld(formData, "ts"), Date.now())) redirect(fehlerZiel);

  // … und Rate-Limit je IP+Job-Slug (Header hinter vertrauenswürdigem Proxy gesetzt;
  // IP wird NICHT gespeichert/geloggt — nur flüchtiger Limiter-Schlüssel).
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
  if (!bewerbungRateLimiter.check(`${ip}:${slug}`).allowed) redirect(fehlerZiel);

  // Zod-Grenze: strippt Unbekanntes, prüft Status/Klassen/Verfügbarkeit/Honeypot.
  const parsed = bewerbungEingabeSchema.safeParse({
    name: feld(formData, "name"),
    email: feld(formData, "email"),
    telefon: feld(formData, "telefon"),
    bewerberStatus: feld(formData, "bewerberStatus"),
    klassen: felder(formData, "klassen"),
    verfuegbarStatus: feld(formData, "verfuegbarStatus") || "flexibel",
    verfuegbarAb: feld(formData, "verfuegbarAb"),
    nachricht: feld(formData, "nachricht"),
    datenschutz: formData.get("datenschutz") != null,
    weitergabe: formData.get("weitergabe") != null,
    website: feld(formData, "website"),
  });
  if (!parsed.success) redirect(fehlerZiel);
  const d = parsed.data;

  // DATEI-VALIDIERUNG: Größen-Check VOR dem Byte-Lesen (kein Puffern übergroßer
  // Dateien), dann MIME + Magic-Bytes. CV ist PFLICHT, Foto freiwillig.
  const cv = datei(formData, "cv");
  if (!cv || cv.size > MAX_CV_BYTES) redirect(fehlerZiel);
  const cvBytes = new Uint8Array(await cv.arrayBuffer());
  const cvOk = pruefeCvDatei(cv.name, cv.type, cvBytes.byteLength, cvBytes.subarray(0, 12));
  if (!cvOk.ok) redirect(fehlerZiel);

  const foto = datei(formData, "foto");
  let fotoBytes: Uint8Array | null = null;
  let fotoName: string | null = null;
  let fotoTyp: string | null = null;
  if (foto) {
    if (foto.size > MAX_FOTO_BYTES) redirect(fehlerZiel);
    fotoBytes = new Uint8Array(await foto.arrayBuffer());
    const fotoOk = pruefeFotoDatei(
      foto.name, foto.type, fotoBytes.byteLength, fotoBytes.subarray(0, 12),
    );
    if (!fotoOk.ok) redirect(fehlerZiel);
    fotoName = fotoOk.dateiname;
    fotoTyp = foto.type;
  }

  // job_id NUR aus der Slug-Auflösung (RLS: aktiv+gültig+gelistet), NIE aus dem Formular.
  const job = await resolveZielJob(slug);
  if (!job) redirect(fehlerZiel);

  // Klassen als Postgres-Array-Literal: Werte stammen aus der Zod-Allowlist
  // JOB_KLASSEN (nur [A-Z0-9]) — kein Escaping-Spielraum; ::text[] macht den
  // Parameter typklar (DB-CHECK 0025 prüft Allowlist/Cap/Duplikate erneut).
  const klassenLiteral = `{${d.klassen.join(",")}}`;

  // VERMITTLUNGS-ROUTING (Gründer 2026-07-02, USP + Ertragsquelle):
  // Quereinsteiger:innen sind AUSBILDUNGSPLATZ-Interessenten — sie gehen IMMER
  // an die onelane-Vermittlungsadresse und NIE blind an die Fahrschule (wir
  // übernehmen den vollständigen Vermittlungsprozess, Kommission möglich).
  // Nur echte Bewerbungen (fahrlehrer/anwaerter) werden direkt zugestellt.
  const istVermittlung = d.bewerberStatus === "quereinsteiger";

  // EMPFÄNGER-AUFLÖSUNG (0027): interne Zustell-Adresse (bewerbungs_email ?? email)
  // ist per Spalten-Grant NICHT mehr selektierbar — nur die GUC-gated
  // SECURITY-DEFINER-Funktion liefert sie, ausschließlich in diesem Kontext.
  let empfaengerEmail: string | null = null;
  if (istVermittlung) {
    empfaengerEmail = getVermittlungEmail();
  } else {
    try {
      empfaengerEmail = await withPublicSubmissionContext(async (tx) => {
        const rows = (await tx.execute(sql`
          select app.job_bewerbung_empfaenger(${job.jobId}::uuid) as empfaenger
        `)) as unknown as Array<Record<string, unknown>>;
        return rows[0]?.empfaenger != null ? String(rows[0].empfaenger) : null;
      });
    } catch {
      empfaengerEmail = null;
    }
  }
  // Ohne Zustelladresse KEINE Danke-Illusion: die Mail IST der Transportweg der
  // Unterlagen (Durchleitungs-Prinzip) — generischer Fehler statt stillem Verlust.
  if (!empfaengerEmail) redirect(fehlerZiel);

  // MAIL VOR INSERT (Sicherheits-Abnahme, Blocker 1): Erst wenn die Voll-Weiterleitung
  // (Daten + Anhänge) erfolgreich übergeben wurde, wird die Bewerbung gespeichert.
  // Scheitert der Versand (z. B. Adapter in Produktion nicht konfiguriert),
  // sieht der Bewerber den Fehlerpfad und kann es erneut versuchen — statt einer
  // Danke-Seite, während die Unterlagen verloren gehen. Kehrseite (dokumentiert):
  // Mail ok + Insert-Fehler ⇒ Schule hat die Bewerbung, Zählung fehlt; ein
  // Wiederholungsversuch dupliziert die Mail. Outbox/Retry = Phase 1b.
  {
    const anhaenge: EmailAttachment[] = [
      { filename: cvOk.dateiname, content: cvBytes, contentType: cv.type },
    ];
    if (fotoBytes && fotoName && fotoTyp) {
      anhaenge.push({ filename: fotoName, content: fotoBytes, contentType: fotoTyp });
    }
    const zeilen: Array<[string, string]> = [
      ["Stelle", job.jobTitel],
      ["Name", d.name],
      ["E-Mail", d.email],
      ["Telefon", d.telefon ?? "—"],
      ["Status", STATUS_LABEL[d.bewerberStatus] ?? d.bewerberStatus],
      ["Klassen", d.klassen.length > 0 ? d.klassen.join(", ") : "—"],
      [
        "Verfügbar",
        d.verfuegbarStatus === "zum_datum" && d.verfuegbarAb
          ? `zum ${d.verfuegbarAb}`
          : VERFUEGBAR_LABEL[d.verfuegbarStatus] ?? d.verfuegbarStatus,
      ],
      ["Nachricht", d.nachricht ?? "—"],
    ];
    let zugestellt = false;
    try {
      // Zwei Empfänger-Welten, EIN Versand: Schule (echte Bewerbung) vs.
      // onelane-Vermittlung (Quereinstieg — Kommissionsprozess, s. Routing oben).
      const introHtml = istVermittlung
        ? `<p><strong>Interne Vermittlung (Quereinstieg):</strong> Neuer Ausbildungsplatz-Interessent zur Stelle bei ${escapeHtml(job.schulName)}. NICHT an die Fahrschule weitergeleitet — Kontaktaufnahme, Fahrschul-Ansprache und Konditionen laufen über onelane.</p>`
        : `<p>Für ${escapeHtml(job.schulName)} liegt eine neue Bewerbung über onelane vor.</p>`;
      const outroHtml = istVermittlung
        ? "<p>Die Unterlagen hängen dieser E-Mail an — onelane speichert sie nicht.</p>"
        : "<p>Die Unterlagen (Lebenslauf, ggf. Foto) hängen dieser E-Mail an — onelane speichert sie nicht.</p>" +
          "<p>Profil verwalten und Daten bestätigen: Stellenanzeige und Angaben lassen sich kostenlos prüfen und aktuell halten.</p>";
      const introText = istVermittlung
        ? `Interne Vermittlung (Quereinstieg): Neuer Ausbildungsplatz-Interessent zur Stelle bei ${job.schulName}. NICHT an die Fahrschule weitergeleitet — Prozess läuft über onelane.\n`
        : `Für ${job.schulName} liegt eine neue Bewerbung über onelane vor.\n`;
      const outroText = istVermittlung
        ? "\nDie Unterlagen hängen dieser E-Mail an — onelane speichert sie nicht."
        : "\nDie Unterlagen hängen dieser E-Mail an — onelane speichert sie nicht." +
          "\nProfil verwalten und Daten bestätigen: Stellenanzeige und Angaben lassen sich kostenlos prüfen und aktuell halten.";
      await getEmailAdapter().send({
        to: empfaengerEmail,
        subject: istVermittlung
          ? `Vermittlungs-Interessent (Fahrlehrer-Ausbildung) — ${job.schulName} / ${job.jobTitel}`
          : `Neue Bewerbung über onelane — ${job.jobTitel}`,
        html: [
          introHtml,
          "<table>",
          ...zeilen.map(
            ([k, v]) => `<tr><td><strong>${k}</strong></td><td>${escapeHtml(v)}</td></tr>`,
          ),
          "</table>",
          outroHtml,
        ].join(""),
        text: introText + zeilen.map(([k, v]) => `${k}: ${v}`).join("\n") + outroText,
        attachments: anhaenge,
      });
      zugestellt = true;
    } catch {
      // No-PII-Fehlerlog: Zustellung gescheitert → HARTES Gate (kein Insert,
      // keine Danke-Illusion) — der Bewerber sieht den generischen Fehlerpfad.
      console.error("jobs: Bewerbungs-Mail fehlgeschlagen — Bewerbung nicht angenommen (Outbox/Retry: Phase 1b).");
    }
    if (!zugestellt) redirect(fehlerZiel);
  }

  // INSERT NACH erfolgreicher Zustellung (Zählung je Schule = Lead-Währung).
  let gespeichert = false;
  try {
    await withPublicSubmissionContext(async (tx) => {
      // Roh-SQL mit EXAKT den per Spalten-Grant erlaubten INSERT-Spalten (0025):
      // der Drizzle-Query-Builder würde ALLE Tabellenspalten listen (id/status/…
      // als DEFAULT) und am Spalten-Grant mit 42501 scheitern. Alle Werte sind
      // GEBUNDENE Parameter. BEWUSST ohne RETURNING: anonym existiert keine
      // SELECT-Policy (DAL-Doku, Migrationen 0023/0025).
      await tx.execute(sql`
        insert into public.job_applications
          (job_id, name, email, telefon, nachricht,
           bewerber_status, klassen, verfuegbar_status, verfuegbar_ab,
           cv_dateiname, cv_groesse_bytes, foto_dateiname, foto_groesse_bytes,
           einwilligung_datenschutz_at, einwilligung_weitergabe_at, quelle_pfad)
        values
          (${job.jobId}, ${d.name}, ${d.email}, ${d.telefon ?? null}, ${d.nachricht ?? null},
           ${d.bewerberStatus}, ${klassenLiteral}::text[], ${d.verfuegbarStatus},
           ${d.verfuegbarAb ?? null},
           ${cvOk.dateiname}, ${cvBytes.byteLength}, ${fotoName}, ${fotoBytes?.byteLength ?? null},
           now(), now(), ${basisPfad})
      `);
    });
    gespeichert = true;
  } catch {
    gespeichert = false; // generisch bleiben — keine DB-Details an den Client
  }
  if (!gespeichert) redirect(fehlerZiel);

  redirect(`${basisPfad}/danke`);
}
