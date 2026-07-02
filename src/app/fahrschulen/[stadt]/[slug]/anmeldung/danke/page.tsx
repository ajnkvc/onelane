import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSchoolProfile } from "@/modules/schools/profile";
import { TrustBadge } from "@/components/trust/trust-badge";
import { PhoneIcon } from "@/components/school/anmelde-aktionen";

/**
 * Erfolgsseite des Anmelde-Funnels (SSR, noindex).
 * ----------------------------------------------------------------------------
 * Sagt präzise, WAS an WEN gegangen ist (die gewählte Fahrschule) und was als
 * Nächstes passiert — inklusive onelane-trust-Versprechen („Wir fassen nach").
 * BEWUSST ohne Wiedergabe personenbezogener Formulardaten (keine PII in URLs,
 * kein anonymes SELECT auf Leads by design — Migration 0022).
 */
export const dynamic = "force-dynamic";

type Params = Promise<{ stadt: string; slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { stadt, slug } = await params;
  const school = await getSchoolProfile(stadt, slug).catch(() => null);
  return {
    title: school ? `Anfrage gesendet — ${school.name}` : "Anfrage gesendet",
    robots: { index: false, follow: false },
  };
}

export default async function AnmeldungDankePage({ params }: { params: Params }) {
  const { stadt, slug } = await params;
  const school = await getSchoolProfile(stadt, slug).catch(() => null);
  if (!school) notFound();

  const tel = school.telefon?.replace(/\s+/g, "") ?? null;
  const profilHref = `/fahrschulen/${school.stadtSlug}/${school.slug}`;

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-12 sm:px-6">
      <div className="rounded-md border border-border bg-[color-mix(in_oklab,var(--brand-sky)_5%,var(--background))] px-6 py-8">
        <span
          aria-hidden="true"
          className="grid size-12 place-items-center rounded-full bg-accent text-accent-foreground"
        >
          <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
          Deine Anfrage ist raus.
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Deine kostenfreie Anfrage wurde sicher an <strong className="text-foreground">{school.name}</strong>{" "}
          übermittelt — mit deiner Wunschklasse, deinem Startzeitraum und deinen Kontaktangaben.
          Die Fahrschule meldet sich direkt bei dir.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3 rounded-md border border-border bg-background px-4 py-3">
          <TrustBadge size="sm" />
          <p className="text-xs text-muted-foreground">
            Unser Versprechen: <span className="font-medium text-foreground">Wir fassen nach.</span>{" "}
            Meldet sich die Fahrschule nicht zeitnah, erinnern wir sie an deine Anfrage.
          </p>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href={profilHref}
            className="inline-flex min-h-12 items-center justify-center rounded-[4px] border border-border bg-background px-5 text-sm font-semibold transition-colors duration-[var(--motion-duration-fast)] ease-[var(--motion-ease)] hover:border-primary/50 hover:text-primary"
          >
            Zurück zum Profil
          </Link>
          {tel && (
            <a
              href={`tel:${tel}`}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[4px] border border-border bg-background px-5 text-sm font-semibold transition-colors duration-[var(--motion-duration-fast)] ease-[var(--motion-ease)] hover:border-primary/50 hover:text-primary"
            >
              <PhoneIcon />
              Direkt anrufen
            </a>
          )}
          <Link
            href="/fahrschulen"
            className="inline-flex min-h-12 items-center justify-center px-2 text-sm text-primary underline-offset-2 hover:underline"
          >
            Weitere Fahrschulen ansehen
          </Link>
        </div>
      </div>
    </div>
  );
}
