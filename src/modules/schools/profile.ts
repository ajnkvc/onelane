import "server-only";
import { cache } from "react";
import { sql } from "drizzle-orm";
import { withAnonContext } from "@/server/dal";
import { slugify } from "@/lib/slug";
import { normalizePublicHttpUrl } from "@/lib/public-config";

/**
 * profile.ts — öffentliche Fahrschul-Detailseite (Phase H).
 * ----------------------------------------------------------------------------
 * Läuft über den DAL (`withAnonContext` → RLS als `app_user`). Anonym sind NUR
 * gelistete Schulen sichtbar; Strukturzeilen (Bilder/Fahrzeuge/FAQ/Zeiten/Jobs)
 * nur, wenn `aktiv` — die DB erzwingt das (Migration 0001), nicht dieser Code.
 * Die `show_*`-Flags am Profil steuern zusätzlich, ob eine Sektion angezeigt wird
 * (im Backend pro Schule deaktivierbar). Lookup über Slug + Stadt-Slug (passend
 * zur Eindeutigkeit `(land, ort, slug)`).
 */
export interface ProfileImage {
  kategorie: string;
  url: string;
  alt: string | null;
}
export interface ProfileVehicle {
  marke: string | null;
  modell: string | null;
  getriebe: string | null;
  klasse: string | null;
  besonderheiten: string[];
}
export interface ProfileFaq {
  frage: string;
  antwort: string;
}
export interface ProfileHour {
  art: string;
  wochentag: number;
  von: string;
  bis: string;
}
export interface ProfileInstructor {
  name: string;
  slug: string;
}
export interface ProfileReview {
  rating: number;
  text: string | null;
  publishedAt: string | null;
}
export interface ProfileJob {
  titel: string;
  beschreibung: string | null;
  art: string;
}

export interface SchoolProfileDetail {
  id: string;
  name: string;
  slug: string;
  stadtSlug: string;
  strasse: string | null;
  plz: string | null;
  ort: string | null;
  stadtbezirk: string | null;
  bundesland: string | null;
  land: string;
  latitude: number | null;
  longitude: number | null;
  googleRating: string | null;
  googleReviewsCount: number | null;
  failRate: string | null;
  sprachen: string[];
  klassen: string[];
  isPartner: boolean;
  isVerified: boolean;
  beschreibung: string | null;
  logoUrl: string | null;
  telefon: string | null;
  email: string | null;
  website: string | null;
  show: {
    images: boolean;
    vehicles: boolean;
    instructors: boolean;
    faq: boolean;
    zeiten: boolean;
    jobs: boolean;
  };
  images: ProfileImage[];
  vehicles: ProfileVehicle[];
  faq: ProfileFaq[];
  hours: ProfileHour[];
  instructors: ProfileInstructor[];
  reviews: ProfileReview[];
  jobs: ProfileJob[];
}

type Row = Record<string, unknown>;
const str = (v: unknown): string | null => (v != null ? String(v) : null);
const num = (v: unknown): number | null => (v != null ? Number(v) : null);
const arr = (v: unknown): string[] => (Array.isArray(v) ? (v as string[]) : []);

// Request-lokal memoisiert (React cache): generateMetadata() UND die Seite rufen
// getSchoolProfile mit denselben Argumenten auf → nur EINE (teure) DB-Ladung pro Request
// statt zwei (Latenz-/DoS-Schutz auf der öffentlichen Profilroute).
export const getSchoolProfile = cache(async (
  stadt: string,
  slug: string,
): Promise<SchoolProfileDetail | null> => {
  return withAnonContext(async (tx) => {
    // Basis: Schule + Profil (RLS: nur gelistet). Slug ist je (land,ort) eindeutig;
    // bei theoretischer Stadt-übergreifender Kollision wählt der Stadt-Slug die Zeile.
    const baseRows = (await tx.execute(sql`
      select s.id, s.name, s.slug, s.strasse, s.plz, s.ort, s.stadtbezirk,
             s.bundesland, s.land, s.latitude, s.longitude,
             s.google_rating, s.google_reviews_count, s.fail_rate, s.sprachen,
             s.is_partner, s.is_verified,
             pr.beschreibung, pr.fuehrerscheinklassen, pr.logo_url,
             pr.telefon, pr.email, pr.website,
             pr.show_images, pr.show_vehicles, pr.show_instructors,
             pr.show_faq, pr.show_zeiten, pr.show_jobs
      from public.driving_schools s
      left join public.school_profiles pr on pr.school_id = s.id
      where s.slug = ${slug}
    `)) as unknown as Row[];
    // F-061 (Perf, VERSCHOBEN): der Stadt-Slug filtert danach in-memory die richtige Zeile. Ein
    // hartes SQL-`limit` wäre falsch (könnte die gesuchte Stadt ausschließen → 404). Der saubere
    // Fix ist eine persistierte, indizierte stadt_slug-Spalte (per JS-slugify befüllt: Migration +
    // Backfill-Script + Schreibpfade), dann `where slug=$slug and stadt_slug=$stadt limit 1`. Bis
    // dahin bleibt der (korrekte) In-Memory-Filter; die Zeilenzahl ist real durch gleichnamige
    // Schulen über Städte begrenzt (kein Millionen-Scan) — kein Security-, sondern ein Skalierungspunkt.

    const base = baseRows.find((r) => slugify(String(r.ort ?? "")) === stadt) ?? null;
    if (!base) return null;
    const id = String(base.id);

    // Strukturdaten SEQUENZIELL (eine Transaktions-Verbindung → keine parallelen
    // Queries). RLS filtert auf aktiv + gelistet.
    // Defensive LIMITs (F-…): kein unbegrenztes Laden SEO-relevanter Medien/Texte pro Schule
    // (Schutz gegen SSR-/Crawler-DoS + aufgeblähte HTML-/JSON-LD-Antworten durch böswillige Pflege).
    const images = (await tx.execute(sql`select kategorie, url, alt from public.school_images where school_id = ${id} order by position asc, created_at asc limit 40`)) as unknown as Row[];
    const vehicles = (await tx.execute(sql`select marke, modell, getriebe, klasse, besonderheiten from public.school_vehicles where school_id = ${id} order by position asc, created_at asc limit 40`)) as unknown as Row[];
    const faq = (await tx.execute(sql`select frage, antwort from public.school_faq_items where school_id = ${id} order by position asc, created_at asc limit 60`)) as unknown as Row[];
    const hours = (await tx.execute(sql`select art, wochentag, von, bis from public.school_opening_hours where school_id = ${id} order by wochentag asc, von asc limit 120`)) as unknown as Row[];
    const instructors = (await tx.execute(sql`select name, slug from public.instructors_public where school_id = ${id} and aktiv = true order by name asc limit 100`)) as unknown as Row[];
    const reviews = (await tx.execute(sql`select rating, text, published_at from public.reviews_public where school_id = ${id} and moderation_status = 'published' order by published_at desc nulls last limit 8`)) as unknown as Row[];
    const jobs = (await tx.execute(sql`select titel, beschreibung, art from public.school_jobs where school_id = ${id} order by created_at desc limit 50`)) as unknown as Row[];

    return {
      id,
      name: String(base.name),
      slug: String(base.slug),
      stadtSlug: stadt,
      strasse: str(base.strasse),
      plz: str(base.plz),
      ort: str(base.ort),
      stadtbezirk: str(base.stadtbezirk),
      bundesland: str(base.bundesland),
      land: String(base.land),
      latitude: num(base.latitude),
      longitude: num(base.longitude),
      googleRating: str(base.google_rating),
      googleReviewsCount: num(base.google_reviews_count),
      failRate: str(base.fail_rate),
      sprachen: arr(base.sprachen),
      klassen: arr(base.fuehrerscheinklassen),
      isPartner: base.is_partner === true,
      isVerified: base.is_verified === true,
      beschreibung: str(base.beschreibung),
      logoUrl: str(base.logo_url),
      telefon: str(base.telefon),
      email: str(base.email),
      // F-… stored-URL-XSS/Phishing: nur validierte http(s)-URL ausgeben (href + JSON-LD), sonst null.
      website: normalizePublicHttpUrl(str(base.website)),
      show: {
        images: base.show_images !== false,
        vehicles: base.show_vehicles !== false,
        instructors: base.show_instructors !== false,
        faq: base.show_faq !== false,
        zeiten: base.show_zeiten !== false,
        jobs: base.show_jobs !== false,
      },
      images: images.map((r) => ({ kategorie: String(r.kategorie), url: String(r.url), alt: str(r.alt) })),
      vehicles: vehicles.map((r) => ({
        marke: str(r.marke), modell: str(r.modell), getriebe: str(r.getriebe),
        klasse: str(r.klasse), besonderheiten: arr(r.besonderheiten),
      })),
      faq: faq.map((r) => ({ frage: String(r.frage), antwort: String(r.antwort) })),
      hours: hours.map((r) => ({
        art: String(r.art), wochentag: Number(r.wochentag),
        von: String(r.von), bis: String(r.bis),
      })),
      instructors: instructors.map((r) => ({ name: String(r.name), slug: String(r.slug) })),
      reviews: reviews.map((r) => ({
        rating: Number(r.rating), text: str(r.text), publishedAt: str(r.published_at),
      })),
      jobs: jobs.map((r) => ({ titel: String(r.titel), beschreibung: str(r.beschreibung), art: String(r.art) })),
    };
  });
});
