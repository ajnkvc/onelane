import type {
  SchoolProfileDetail,
  ProfileVehicle,
  ProfileFaq,
  ProfileHour,
  ProfileInstructor,
  ProfileReview,
  ProfileJob,
} from "@/modules/schools/profile";

/**
 * sections.tsx — modulare Server-Sektionen der Fahrschul-Detailseite (Phase H).
 * Jede Sektion ist eigenständig; die Seite komponiert nur die Sektionen, für die
 * Daten vorhanden und die Sichtbarkeit aktiviert ist (adaptives Layout — nie
 * sichtbare Lücken). Reine Anzeige; Datenzugriff/RLS liegt im Profil-Modul.
 */

const DAYS = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
const hhmm = (t: string) => t.slice(0, 5);
const getriebeLabel = (g: string | null) =>
  g === "automatik" ? "Automatik" : g === "schaltung" ? "Schaltung" : null;
const artLabel = (a: string) =>
  a === "buero" ? "Büro" : a === "theorie" ? "Theorieunterricht" : a === "praxis" ? "Fahrpraxis" : a;

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border p-5 sm:p-6">
      <h2 className="mb-4 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-md bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">{children}</span>;
}

export function TrustHeader({
  school,
  hasImages,
}: {
  school: SchoolProfileDetail;
  hasImages: boolean;
}) {
  const addr = [
    school.strasse,
    [school.plz, school.ort].filter(Boolean).join(" "),
    school.stadtbezirk && school.stadtbezirk !== school.ort ? school.stadtbezirk : null,
  ].filter(Boolean).join(" · ");

  const q = school.failRate != null ? Number(school.failRate) : null;
  const failPct = q != null && Number.isFinite(q) ? (q <= 1 ? Math.round(q * 100) : Math.round(q)) : null;

  return (
    <header
      className={
        hasImages
          ? "mt-6 flex flex-col gap-3"
          : "mt-0 flex flex-col gap-3 rounded-2xl border bg-gradient-to-br from-primary/10 via-background to-accent/10 p-6 sm:p-8"
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        {school.isPartner && (
          <span className="rounded-md bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">Partner-Fahrschule</span>
        )}
        {school.isVerified && (
          <span className="rounded-md border px-2 py-0.5 text-xs font-medium text-muted-foreground">Verifiziert</span>
        )}
      </div>

      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{school.name}</h1>
      {addr && <p className="text-sm text-muted-foreground">{addr}</p>}

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        {school.googleRating && (
          <span className="font-medium">
            ★ {school.googleRating}
            {school.googleReviewsCount ? (
              <span className="font-normal text-muted-foreground"> · {school.googleReviewsCount} Google-Bewertungen</span>
            ) : null}
          </span>
        )}
        {failPct != null && (
          <span className="text-muted-foreground">Durchfallquote Praxis: {failPct}% (Angabe)</span>
        )}
        {school.sprachen.length > 0 && (
          <span className="text-muted-foreground">Sprachen: {school.sprachen.join(", ")}</span>
        )}
      </div>

      {school.klassen.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {school.klassen.map((k) => (
            <Chip key={k}>Klasse {k}</Chip>
          ))}
        </div>
      )}
    </header>
  );
}

export function Description({ school }: { school: SchoolProfileDetail }) {
  if (!school.beschreibung) return null;
  return (
    <Card title="Über die Fahrschule">
      <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{school.beschreibung}</p>
    </Card>
  );
}

export function VehiclesSection({ vehicles }: { vehicles: ProfileVehicle[] }) {
  return (
    <Card title="Fahrzeuge">
      <ul className="grid gap-3 sm:grid-cols-2">
        {vehicles.map((v, i) => {
          const label = [v.marke, v.modell].filter(Boolean).join(" ") || "Fahrzeug";
          const meta = [v.klasse ? `Klasse ${v.klasse}` : null, getriebeLabel(v.getriebe)].filter(Boolean).join(" · ");
          return (
            <li key={i} className="rounded-xl border p-3">
              <p className="font-medium">{label}</p>
              {meta && <p className="text-sm text-muted-foreground">{meta}</p>}
              {v.besonderheiten.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {v.besonderheiten.map((b, bi) => (
                    <Chip key={bi}>{b}</Chip>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

export function InstructorsSection({ instructors }: { instructors: ProfileInstructor[] }) {
  return (
    <Card title="Fahrlehrer">
      <ul className="flex flex-wrap gap-2">
        {instructors.map((ins) => (
          <li key={ins.slug} className="rounded-full border px-3 py-1 text-sm">{ins.name}</li>
        ))}
      </ul>
    </Card>
  );
}

export function OpeningHoursSection({ hours }: { hours: ProfileHour[] }) {
  const arts = ["buero", "theorie", "praxis"].filter((a) => hours.some((h) => h.art === a));
  return (
    <Card title="Öffnungs- & Theoriezeiten">
      <div className="flex flex-col gap-4">
        {arts.map((a) => {
          const rows = hours
            .filter((h) => h.art === a)
            .sort((x, y) => x.wochentag - y.wochentag || x.von.localeCompare(y.von));
          return (
            <div key={a}>
              <h3 className="mb-1 text-sm font-medium">{artLabel(a)}</h3>
              <ul className="text-sm text-muted-foreground">
                {rows.map((h, i) => (
                  <li key={i} className="flex justify-between gap-4 border-b py-1 last:border-b-0">
                    <span>{DAYS[h.wochentag] ?? `Tag ${h.wochentag}`}</span>
                    <span className="tabular-nums">{hhmm(h.von)}–{hhmm(h.bis)} Uhr</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export function FaqSection({ faq }: { faq: ProfileFaq[] }) {
  return (
    <Card title="Häufige Fragen">
      <div className="flex flex-col divide-y">
        {faq.map((f, i) => (
          <details key={i} className="group py-2">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-medium">
              {f.frage}
              <span className="text-muted-foreground transition group-open:rotate-45">+</span>
            </summary>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.antwort}</p>
          </details>
        ))}
      </div>
    </Card>
  );
}

export function ReviewsSection({
  reviews,
  googleRating,
  googleReviewsCount,
}: {
  reviews: ProfileReview[];
  googleRating: string | null;
  googleReviewsCount: number | null;
}) {
  const fmt = (iso: string | null) => {
    if (!iso) return null;
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString("de-DE");
  };
  return (
    <Card title="Bewertungen">
      {googleRating && (
        <p className="mb-3 text-sm text-muted-foreground">
          Google: ★ {googleRating}
          {googleReviewsCount ? ` · ${googleReviewsCount} Bewertungen` : ""}
        </p>
      )}
      {reviews.length === 0 ? (
        <p className="text-sm text-muted-foreground">Noch keine verifizierten Bewertungen auf unserer Plattform.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {reviews.map((r, i) => {
            const full = Math.max(0, Math.min(5, Math.round(r.rating)));
            const date = fmt(r.publishedAt);
            return (
              <li key={i} className="border-l-2 pl-3">
                <div className="text-sm" aria-label={`${full} von 5 Sternen`}>
                  <span className="text-amber-500">{"★".repeat(full)}</span>
                  <span className="text-muted-foreground">{"☆".repeat(5 - full)}</span>
                </div>
                {r.text && <p className="mt-1 text-sm">{r.text}</p>}
                {date && <p className="mt-1 text-xs text-muted-foreground">{date}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

export function JobSection({ jobs, schoolName }: { jobs: ProfileJob[]; schoolName: string }) {
  return (
    <Card title="Fahrlehrer gesucht">
      <div className="flex flex-col gap-4">
        {jobs.map((j, i) => (
          <div key={i} className="rounded-xl border border-accent/40 bg-accent/5 p-4">
            <p className="font-medium">{j.titel}</p>
            {j.beschreibung && <p className="mt-1 text-sm text-muted-foreground">{j.beschreibung}</p>}
            <p className="mt-2 text-xs text-muted-foreground">Stellenanzeige von {schoolName}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function ContactCta({ school }: { school: SchoolProfileDetail }) {
  const { isPartner, telefon, email, website } = school;
  const hasContact = Boolean(telefon || email || website);
  const tel = telefon?.replace(/\s+/g, "");
  return (
    <section className={`rounded-2xl border p-5 ${isPartner ? "border-primary/40 bg-primary/5" : ""}`}>
      <h2 className="text-base font-semibold">{isPartner ? "Anmeldung & Beratung" : "Kontakt"}</h2>
      {isPartner && (
        <p className="mt-1 text-sm text-muted-foreground">Partner-Fahrschule auf unserer Plattform.</p>
      )}

      <div className="mt-3 flex flex-col gap-2 text-sm">
        {telefon && (
          <a
            href={`tel:${tel}`}
            className={
              isPartner
                ? "rounded-lg bg-primary px-3 py-2 text-center font-medium text-primary-foreground transition hover:opacity-90"
                : "underline-offset-2 hover:underline"
            }
          >
            {isPartner ? `Anrufen: ${telefon}` : `Telefon: ${telefon}`}
          </a>
        )}
        {email && (
          <a href={`mailto:${email}`} className="underline-offset-2 hover:underline">E-Mail: {email}</a>
        )}
        {website && (
          <a href={website} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">
            Zur Website
          </a>
        )}
      </div>

      {!hasContact && <p className="mt-2 text-sm text-muted-foreground">Keine Kontaktdaten hinterlegt.</p>}
      <p className="mt-3 text-xs text-muted-foreground">Keine Online-Buchung — die Anmeldung erfolgt direkt bei der Fahrschule.</p>
    </section>
  );
}
