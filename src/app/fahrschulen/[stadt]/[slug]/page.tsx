import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/seo/json-ld";
import { getRequestNonce } from "@/lib/nonce";
import type { JsonLdValue } from "@/lib/safe-json-ld";
import ResultsMap, { type MapMarker } from "@/components/search/results-map";
import { getTileConfig, type MapTileConfig } from "@/modules/maps";
import { getSiteUrl } from "@/lib/public-config";
import { getSchoolProfile, type SchoolProfileDetail } from "@/modules/schools/profile";
import Gallery from "@/components/school/gallery";
import {
  TrustHeader,
  Description,
  OpeningHoursSection,
  FaqSection,
  ReviewsSection,
  JobSection,
  ContactCta,
} from "@/components/school/sections";
import { ProfileBento, AspectRatings, InstructorTiles, VehicleTiles } from "@/components/school/bento";
import { CostEstimator } from "@/components/school/cost-estimator";

/**
 * Fahrschul-Detailseite (Phase H, SSR). INDEXIERBAR mit canonical (echte
 * Inhaltsseite, anders als die noindex-Suche). Adaptive Komposition: nur
 * vorhandene + aktivierte Sektionen werden gerendert → nie „abgehakt". JSON-LD
 * DrivingSchool (+ FAQPage bei sichtbaren FAQ) ist deckungsgleich mit dem
 * sichtbaren Inhalt. Datenzugriff ausschließlich über das Profil-Modul (RLS).
 */
export const dynamic = "force-dynamic";

type Params = Promise<{ stadt: string; slug: string }>;

function siteUrl(): string {
  return getSiteUrl().replace(/\/+$/, "");
}
function abs(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${siteUrl()}${path.startsWith("/") ? "" : "/"}${path}`;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { stadt, slug } = await params;
  const school = await getSchoolProfile(stadt, slug).catch(() => null);
  if (!school) return { robots: { index: false, follow: false } };

  const loc = school.stadtbezirk ?? school.ort ?? "";
  const title = `${school.name}${loc ? ` – Fahrschule in ${loc}` : ""}`;
  const description =
    school.beschreibung?.replace(/\s+/g, " ").trim().slice(0, 155) ||
    `Fahrschule ${school.name}${loc ? ` in ${loc}` : ""} – Klassen, Fahrzeuge, Öffnungszeiten und Bewertungen im Überblick.`;
  const canonical = `${siteUrl()}/fahrschulen/${school.stadtSlug}/${school.slug}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical, type: "website" },
  };
}

function buildJsonLd(school: SchoolProfileDetail, showImages: boolean, showFaq: boolean) {
  const loc = school.stadtbezirk ?? school.ort ?? "";
  const drivingSchool: JsonLdValue = {
    "@context": "https://schema.org",
    "@type": "DrivingSchool",
    name: school.name,
    ...(school.beschreibung ? { description: school.beschreibung } : {}),
    ...(school.strasse || school.plz || school.ort
      ? {
          address: {
            "@type": "PostalAddress",
            ...(school.strasse ? { streetAddress: school.strasse } : {}),
            ...(school.plz ? { postalCode: school.plz } : {}),
            ...(loc ? { addressLocality: loc } : {}),
            addressCountry: school.land,
          },
        }
      : {}),
    ...(school.latitude != null && school.longitude != null
      ? { geo: { "@type": "GeoCoordinates", latitude: school.latitude, longitude: school.longitude } }
      : {}),
    ...(school.telefon ? { telephone: school.telefon } : {}),
    ...(school.email ? { email: school.email } : {}),
    ...(school.website ? { url: school.website } : {}),
    ...(school.sprachen.length ? { knowsLanguage: school.sprachen } : {}),
    ...(showImages ? { image: school.images.map((im) => abs(im.url)) } : {}),
    ...(school.googleRating
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: school.googleRating,
            ...(school.googleReviewsCount ? { reviewCount: school.googleReviewsCount } : {}),
          },
        }
      : {}),
  };

  const faqPage: JsonLdValue | null = showFaq
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: school.faq.map((f) => ({
          "@type": "Question",
          name: f.frage,
          acceptedAnswer: { "@type": "Answer", text: f.antwort },
        })),
      }
    : null;

  return { drivingSchool, faqPage };
}

export default async function SchoolProfilePage({ params }: { params: Params }) {
  const { stadt, slug } = await params;
  const school = await getSchoolProfile(stadt, slug).catch(() => null);
  if (!school) notFound();

  const showImages = school.show.images && school.images.length > 0;
  const showVehicles = school.show.vehicles && school.vehicles.length > 0;
  const showInstructors = school.show.instructors && school.instructors.length > 0;
  const showHours = school.show.zeiten && school.hours.length > 0;
  const showFaq = school.show.faq && school.faq.length > 0;
  const showJobs = school.show.jobs && school.jobs.length > 0;

  let tile: MapTileConfig | null = null;
  try {
    tile = getTileConfig();
  } catch {
    tile = null;
  }
  const hasGeo = school.latitude != null && school.longitude != null;
  const markers: MapMarker[] = hasGeo
    ? [{ id: school.id, name: school.name, lat: school.latitude as number, lng: school.longitude as number, partner: school.isPartner }]
    : [];

  const { drivingSchool, faqPage } = buildJsonLd(school, showImages, showFaq);
  const nonce = await getRequestNonce(); // CSP-Nonce für JSON-LD (nonce-basierte CSP)

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
      <JsonLd data={drivingSchool} nonce={nonce} />
      {faqPage && <JsonLd data={faqPage} nonce={nonce} />}

      <nav className="mb-4 text-sm text-muted-foreground" aria-label="Brotkrumen">
        <Link href="/fahrschulen" className="underline-offset-2 hover:underline">Fahrschulen</Link>
        {school.ort ? <span> · {school.ort}</span> : null}
      </nav>

      {showImages && <Gallery images={school.images} schoolName={school.name} />}
      <TrustHeader school={school} hasImages={showImages} />

      {/* Bento „auf einen Blick" (Quote-Gauge, Ø-Preis, Bewertung, Fuhrpark, Klassen) */}
      <div className="mt-8">
        <ProfileBento school={school} />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Description school={school} />
          {showVehicles && <VehicleTiles vehicles={school.vehicles} />}
          {showInstructors && <InstructorTiles instructors={school.instructors} />}
          <AspectRatings school={school} />
          {showHours && <OpeningHoursSection hours={school.hours} />}
          {showFaq && <FaqSection faq={school.faq} />}
          <ReviewsSection
            reviews={school.reviews}
            googleRating={school.googleRating}
            googleReviewsCount={school.googleReviewsCount}
          />
          {showJobs && <JobSection jobs={school.jobs} schoolName={school.name} />}
        </div>

        <aside className="flex flex-col gap-6 self-start lg:sticky lg:top-6">
          <ContactCta school={school} />
          <CostEstimator basePrice={1290} klasse={school.klassen[0] ?? "B"} />
          {tile && markers.length > 0 && (
            <section className="rounded-2xl border border-border p-5">
              <h2 className="mb-3 text-base font-semibold">Standort</h2>
              <ResultsMap markers={markers} center={{ lat: school.latitude as number, lng: school.longitude as number }} tile={tile} />
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
