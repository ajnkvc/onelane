import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getJobBySlug } from "@/modules/jobs/queries";
import { TrustBadge } from "@/components/trust/trust-badge";
import { titelMitMwd } from "@/lib/jobs-anzeige";

/**
 * Erfolgsseite des Bewerbungs-Funnels (SSR, noindex) — Muster: Anmelde-Danke.
 * ----------------------------------------------------------------------------
 * Sagt präzise, WAS an WEN gegangen ist (Bewerbung + Unterlagen an genau diese
 * Fahrschule) und benennt das Durchleitungs-Prinzip ehrlich: Unterlagen werden
 * NICHT bei uns gespeichert. Trust-Zeile zentriert. BEWUSST ohne Wiedergabe
 * personenbezogener Formulardaten (keine PII in URLs, kein anonymes SELECT auf
 * job_applications by design — Migration 0025).
 */
export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const job = await getJobBySlug(slug).catch(() => null);
  return {
    title: job ? `Bewerbung gesendet — ${job.schule.name}` : "Bewerbung gesendet",
    robots: { index: false, follow: false },
  };
}

export default async function BewerbungDankePage({ params }: { params: Params }) {
  const { slug } = await params;
  const job = await getJobBySlug(slug).catch(() => null);
  if (!job) notFound();

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
          Deine Bewerbung ist raus.
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Deine Bewerbung für „{titelMitMwd(job.titel)}“ wurde samt deiner Unterlagen sicher an{" "}
          <strong className="text-foreground">{job.schule.name}</strong> übermittelt — die
          Fahrschule meldet sich direkt bei dir. Deine Unterlagen haben wir weitergeleitet und
          nicht gespeichert.
        </p>

        {/* Trust-Zeile — zentriert (Funnel-Auflage) */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3 rounded-md border border-border bg-background px-4 py-3 text-center">
          <TrustBadge size="sm" />
          <p className="text-xs text-muted-foreground">
            Unser Versprechen: <span className="font-medium text-foreground">Wir fassen nach.</span>{" "}
            Meldet sich die Fahrschule nicht zeitnah, erinnern wir sie an deine Bewerbung.
          </p>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href={`/jobs/${job.slug}`}
            className="inline-flex min-h-12 items-center justify-center rounded-[4px] border border-border bg-background px-5 text-sm font-semibold transition-colors duration-[var(--motion-duration-fast)] ease-[var(--motion-ease)] hover:border-primary/50 hover:text-primary"
          >
            Zurück zur Stelle
          </Link>
          <Link
            href="/jobs"
            className="inline-flex min-h-12 items-center justify-center px-2 text-sm text-primary underline-offset-2 hover:underline"
          >
            Weitere Stellen ansehen
          </Link>
        </div>
      </div>
    </div>
  );
}
