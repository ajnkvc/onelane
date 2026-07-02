"use server";

import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { sql } from "drizzle-orm";
import { withAnonContext, withPublicSubmissionContext } from "@/server/dal";
import { createInMemoryRateLimiter } from "@/server/adapters/ratelimit";
import { getEmailAdapter } from "@/server/adapters/email";
import { slugify } from "@/lib/slug";
import { leadEingabeSchema, zeitfalleBestanden, RUECKRUF_LABEL } from "./schema";

/**
 * actions.ts — Server Action des öffentlichen Anmelde-Funnels (Leads, 0022).
 * ----------------------------------------------------------------------------
 * Sicherheitskette (in dieser Reihenfolge, alles serverseitig):
 *  1. Ziel-Slugs validieren (kommen als GEBUNDENE Action-Argumente aus der
 *     Route — von Next signiert, zusätzlich hier format-geprüft).
 *  2. Anti-Bot: Honeypot (`website` leer) + Zeitfalle (min. 3 s) — beides im
 *     Zod-Schema bzw. schema.ts; Fehler bleiben GENERISCH (kein Bot-Orakel).
 *  3. Rate-Limit 10/min je IP+Schul-Slug (In-Memory-Port; Edge-WAF ist die
 *     belastbare Linie, SECURITY.md §8). IP aus x-forwarded-for (fälschbar,
 *     bewusst nur Basisschutz) — wird NICHT gespeichert/geloggt.
 *  4. Zod-Validierung an der Modul-Grenze (strippt Unbekanntes; Kontakt-
 *     Mindestregel; U18-Guardian-Gate).
 *  5. school_id AUSSCHLIESSLICH serverseitig per Slug-Auflösung über den
 *     anonymen Lese-DAL (RLS: nur gelistete Schulen auffindbar) — NIE aus dem
 *     Formular (IDOR-Schutz).
 *  6. INSERT über withPublicSubmissionContext OHNE RETURNING (anonymes SELECT
 *     existiert bewusst nicht); Einwilligungs-Zeitstempel = Serverzeit.
 *  7. Benachrichtigung der Schule über den EmailPort (Phase 1: DevLog) —
 *     fail-soft: ein Mail-Fehler verwirft den gespeicherten Lead nicht.
 * Datenschutz: keine PII in URLs (Redirects tragen nur Pfad + generisches
 * Fehler-Flag), keine PII in Logs.
 */

const SLUG_REGEX = /^[a-z0-9-]{1,120}$/;

// 10 Anfragen/Minute je (IP, Schul-Slug) — großzügig für Menschen, eng für Skripte.
const leadRateLimiter = createInMemoryRateLimiter({ windowMs: 60_000, max: 10 });

interface ZielSchule {
  id: string;
  name: string;
}

/**
 * Slug → Schule (id/name) über den anonymen Lese-DAL. RLS garantiert:
 * nur GELISTETE Schulen sind auflösbar (deckungsgleich mit der INSERT-Policy).
 * Muster wie modules/schools/profile.ts: Slug ist je (land, ort) eindeutig,
 * der Stadt-Slug wählt bei Namensgleichheit über Städte die richtige Zeile.
 * Die ZUSTELL-Adresse wird hier bewusst NICHT gelesen — sie kommt aus der
 * GUC-gated Definer-Funktion app.lead_anfrage_empfaenger (0028:
 * anfragen_email ?? email, konfigurierbar je Schule).
 */
async function resolveZielSchule(stadt: string, slug: string): Promise<ZielSchule | null> {
  try {
    return await withAnonContext(async (tx) => {
      const rows = (await tx.execute(sql`
        select s.id, s.name, s.ort
        from public.driving_schools s
        where s.slug = ${slug}
      `)) as unknown as Array<Record<string, unknown>>;
      const row = rows.find((r) => slugify(String(r.ort ?? "")) === stadt);
      if (!row) return null;
      return {
        id: String(row.id),
        name: String(row.name),
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

/**
 * Nimmt die Anmeldung entgegen. Wird in der Funnel-Seite via
 * `submitLead.bind(null, { stadt, slug })` an die Route gebunden (Next
 * signiert gebundene Argumente) und funktioniert als reiner POST ohne JS.
 */
export async function submitLead(
  ziel: { stadt: string; slug: string },
  formData: FormData,
): Promise<void> {
  const stadt = SLUG_REGEX.test(ziel.stadt) ? ziel.stadt : null;
  const slug = SLUG_REGEX.test(ziel.slug) ? ziel.slug : null;
  if (!stadt || !slug) redirect("/fahrschulen");

  const basisPfad = `/fahrschulen/${stadt}/${slug}/anmeldung`;
  // Generisches, felder-schonendes Fehlerziel: Klasse/Zeitraum (KEINE PII)
  // bleiben über die URL vorbelegt, damit der Nutzer nicht bei null beginnt.
  const klasseRoh = feld(formData, "klasse").trim().toUpperCase();
  const fehlerParams = new URLSearchParams({ fehler: "1" });
  if (/^[A-Z][A-Z0-9]{0,5}$/.test(klasseRoh)) fehlerParams.set("klasse", klasseRoh);
  const fehlerZiel = `${basisPfad}?${fehlerParams.toString()}`;

  // Anti-Bot-Kette VOR jeder teuren Arbeit: Zeitfalle …
  if (!zeitfalleBestanden(feld(formData, "ts"), Date.now())) redirect(fehlerZiel);

  // … und Rate-Limit je IP+Slug (Header hinter vertrauenswürdigem Proxy gesetzt).
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
  if (!leadRateLimiter.check(`${ip}:${slug}`).allowed) redirect(fehlerZiel);

  // Zod-Grenze: strippt Unbekanntes, prüft Honeypot/Kontaktregel/U18-Gate.
  const parsed = leadEingabeSchema.safeParse({
    klasse: klasseRoh,
    zeitraum: feld(formData, "zeitraum"),
    vorname: feld(formData, "vorname"),
    nachname: feld(formData, "nachname"),
    email: feld(formData, "email"),
    telefon: feld(formData, "telefon"),
    nachricht: feld(formData, "nachricht"),
    istMinderjaehrig: formData.get("minderjaehrig") != null,
    guardianName: feld(formData, "guardianName"),
    guardianEmail: feld(formData, "guardianEmail"),
    guardianTelefon: feld(formData, "guardianTelefon"),
    rueckruf: feld(formData, "rueckruf") || "egal",
    datenschutz: formData.get("datenschutz") != null,
    weitergabe: formData.get("weitergabe") != null,
    website: feld(formData, "website"),
    wunschFahrlehrer: feld(formData, "wunschFahrlehrer"),
  });
  if (!parsed.success) redirect(fehlerZiel);
  const d = parsed.data;

  // school_id NUR aus der Slug-Auflösung (RLS: gelistet), NIE aus dem Formular.
  const schule = await resolveZielSchule(stadt, slug);
  if (!schule) redirect(fehlerZiel);

  // Wunsch-Rückrufzeit strukturiert an die Nachricht anhängen (keine Schema-Änderung).
  const nachricht = [d.nachricht, `Rückruf: ${RUECKRUF_LABEL[d.rueckruf]}`]
    .filter(Boolean)
    .join("\n\n");

  let gespeichert = false;
  try {
    await withPublicSubmissionContext(async (tx) => {
      // Wunsch-Fahrlehrer NUR übernehmen, wenn der Name wirklich zum öffentlich
      // sichtbaren, aktiven Team der ZIEL-Schule gehört (instructors_public) —
      // sonst still verwerfen (kein freier Text in der DB, kein Fehler-Orakel).
      let wunschFahrlehrer: string | null = null;
      if (d.wunschFahrlehrer) {
        const treffer = (await tx.execute(sql`
          select 1 from public.instructors_public
          where school_id = ${schule.id} and name = ${d.wunschFahrlehrer} and aktiv = true
          limit 1
        `)) as unknown as unknown[];
        wunschFahrlehrer = treffer.length > 0 ? d.wunschFahrlehrer : null;
      }
      // Roh-SQL mit EXAKT den per Spalten-Grant erlaubten INSERT-Spalten (0022,
      // +wunsch_fahrlehrer aus 0026): der Drizzle-Query-Builder listet sonst ALLE
      // Tabellenspalten (id/status/created_at … als DEFAULT) — das scheitert am
      // Spalten-Grant mit 42501. Alle Werte sind GEBUNDENE Parameter. BEWUSST
      // ohne RETURNING: anonym existiert keine SELECT-Policy (Migration 0022).
      await tx.execute(sql`
        insert into public.leads
          (school_id, klasse, zeitraum, vorname, nachname, email, telefon, nachricht,
           ist_minderjaehrig, guardian_name, guardian_email, guardian_telefon,
           einwilligung_datenschutz_at, einwilligung_weitergabe_at, quelle_pfad,
           wunsch_fahrlehrer)
        values
          (${schule.id}, ${d.klasse}, ${d.zeitraum}, ${d.vorname}, ${d.nachname ?? null},
           ${d.email ?? null}, ${d.telefon ?? null}, ${nachricht}, ${d.istMinderjaehrig},
           ${d.guardianName ?? null}, ${d.guardianEmail ?? null}, ${d.guardianTelefon ?? null},
           now(), now(), ${basisPfad}, ${wunschFahrlehrer})
      `);
    });
    gespeichert = true;
  } catch {
    gespeichert = false; // generisch bleiben — keine DB-Details an den Client
  }
  if (!gespeichert) redirect(fehlerZiel);

  // Schule benachrichtigen (EmailPort; Phase 1 = DevLog-Adapter, versendet nichts).
  // Fail-soft: der Lead ist gespeichert — ein Mail-Fehler darf ihn nicht verwerfen
  // (anders als bei Bewerbungen transportiert die Mail hier keine Unterlagen).
  // Zustell-Adresse: anfragen_email ?? email, je Schule konfigurierbar (0028) —
  // via GUC-gated Definer-Funktion, die Spalte selbst ist app_user-unlesbar.
  let empfaenger: string | null = null;
  try {
    empfaenger = await withPublicSubmissionContext(async (tx) => {
      const rows = (await tx.execute(sql`
        select app.lead_anfrage_empfaenger(${schule.id}::uuid) as empfaenger
      `)) as unknown as Array<Record<string, unknown>>;
      return rows[0]?.empfaenger != null ? String(rows[0].empfaenger) : null;
    });
  } catch {
    empfaenger = null;
  }
  if (empfaenger) {
    try {
      await getEmailAdapter().send({
        to: empfaenger,
        subject: `Neue Anmeldung über onelane — ${schule.name}`,
        html: [
          `<p>Für ${schule.name} liegt eine neue Anmelde-Anfrage über onelane vor.</p>`,
          `<p>Details (Name, Kontakt, Wunschklasse) stehen im Fahrschul-Bereich bereit.</p>`,
          `<p>Profil verwalten und Daten bestätigen: Preisaushang und Angaben lassen sich dort kostenlos prüfen und freigeben.</p>`,
        ].join(""),
        text:
          `Für ${schule.name} liegt eine neue Anmelde-Anfrage über onelane vor. ` +
          `Details stehen im Fahrschul-Bereich bereit. Dort lassen sich auch Profil verwalten und Daten bestätigen.`,
      });
    } catch {
      // bewusst still (kein PII-Log); Zustellung ist Aufgabe des echten Adapters
    }
  }

  redirect(`${basisPfad}/danke`);
}
