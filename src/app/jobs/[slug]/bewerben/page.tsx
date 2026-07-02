import type { Metadata } from "next";
import Link from "next/link";
import { getJobBySlug } from "@/modules/jobs/queries";
import { submitBewerbung } from "@/modules/jobs/actions";
import { JOB_KLASSEN, BEWERBER_STATUS_WERTE, VERFUEGBAR_WERTE } from "@/modules/jobs/schema";
import { TrustBadge } from "@/components/trust/trust-badge";
import { titelMitMwd } from "@/lib/jobs-anzeige";

/**
 * Bewerbungs-Funnel /jobs/[slug]/bewerben — EIN Formular in Schritten-Optik
 * (SSR, noindex). Muster: Anmelde-Funnel /fahrschulen/[stadt]/[slug]/anmeldung.
 * ----------------------------------------------------------------------------
 * EIN POST auf die Server Action (submitBewerbung, gebunden an den Slug —
 * Next signiert gebundene Argumente), `encType="multipart/form-data"` wegen
 * der Datei-Uploads — funktioniert VOLLSTÄNDIG ohne JavaScript. Progressive
 * Disclosure (Verfügbarkeits-Datum nur bei „zum Datum") rein über CSS
 * (group-has auf dem Radio). Native Validierung (required/type/maxLength)
 * fängt die meisten Fehler; die Server Action validiert ALLES erneut (Zod +
 * Datei-Magic-Bytes) und antwortet generisch mit ?fehler=1 (keine PII in URLs).
 * Anti-Bot: Honeypot `website` (sr-only) + Zeitfalle (hidden ts).
 *
 * DURCHLEITUNGS-PRINZIP (ehrlich benannt): CV PFLICHT (PDF/DOC/DOCX · max.
 * 5 MB), Foto FREIWILLIG („freiwillig — für deine Bewerbung nicht nötig",
 * AGG-sensibel). Die Unterlagen leiten wir an die Fahrschule weiter und
 * speichern sie NICHT; in der DB bleiben nur Metadaten + die Bewerbung selbst,
 * die 6 Monate nach Abschluss gelöscht wird (Migration 0025). Einwilligungen:
 * Datenschutz + Weitergabe an GENAU DIESE Fahrschule (Schulname im Label).
 * KEINE Gehaltshistorie-Frage — by design (Review-Auflagen).
 */
export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;
type SP = Promise<Record<string, string | string[] | undefined>>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const job = await getJobBySlug(slug).catch(() => null);
  return {
    title: job ? `Bewerbung — ${titelMitMwd(job.titel)}` : "Bewerbung",
    robots: { index: false, follow: false },
  };
}

const FELD_KLASSE =
  "min-h-11 w-full rounded-[4px] border border-input bg-background px-3 text-sm outline-none placeholder:text-muted-foreground focus:border-ring";
const LABEL_KLASSE =
  "mb-1 block font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground";

const STATUS_OPTIONEN: Record<(typeof BEWERBER_STATUS_WERTE)[number], { titel: string; hinweis: string }> = {
  fahrlehrer: { titel: "Fahrlehrer:in", hinweis: "mit Fahrlehrerlaubnis" },
  anwaerter: { titel: "Fahrlehreranwärter:in", hinweis: "in Ausbildung" },
  quereinsteiger: {
    titel: "Quereinsteiger:in",
    hinweis: "interessiert an der Ausbildung — onelane begleitet deine Vermittlung persönlich",
  },
};

const VERFUEGBAR_OPTIONEN: Record<(typeof VERFUEGBAR_WERTE)[number], string> = {
  sofort: "Sofort",
  zum_datum: "Zum Datum",
  flexibel: "Flexibel / nach Absprache",
};

/** Schritt-Kopf: Mono-Nummer + Titel (Dossier-Sprache, wie Anmelde-Funnel). */
function Schritt({ nr, titel, hinweis }: { nr: string; titel: string; hinweis?: string }) {
  return (
    <div className="mb-4 flex items-baseline gap-3 border-b border-border pb-3">
      <span aria-hidden="true" className="font-mono text-xs text-muted-foreground/70">{nr}</span>
      <div>
        <h2 className="text-base font-bold tracking-tight">{titel}</h2>
        {hinweis && <p className="mt-0.5 text-xs text-muted-foreground">{hinweis}</p>}
      </div>
    </div>
  );
}

export default async function BewerbenPage({ params, searchParams }: { params: Params; searchParams: SP }) {
  const { slug } = await params;
  const sp = await searchParams;
  const job = await getJobBySlug(slug).catch(() => null);

  // Abgelaufen/unbekannt: generische, ehrliche Hinweisseite (RLS unterscheidet
  // nicht — kein Formular, kein 404-Schreck, siehe /jobs/[slug]).
  if (!job) {
    return (
      <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-16 sm:px-6">
        <h1 className="text-3xl font-bold tracking-tight">Diese Stelle ist nicht mehr verfügbar.</h1>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          Auf diese Anzeige kannst du dich nicht mehr bewerben — sie ist abgelaufen oder besetzt.
        </p>
        <Link
          href="/jobs"
          className="mt-8 inline-flex min-h-12 items-center rounded-full bg-accent px-6 text-sm font-semibold text-accent-foreground transition-colors duration-[var(--motion-duration-fast)] ease-[var(--motion-ease)] hover:bg-brand-lime"
        >
          Offene Stellen ansehen
        </Link>
      </div>
    );
  }

  const hatFehler = first(sp.fehler) === "1";
  const detailHref = `/jobs/${job.slug}`;
  // job_id wird NIE aus dem Formular gelesen: die Route bindet den Slug an die
  // Action (Next signiert gebundene Argumente), der Server löst den Job auf.
  const action = submitBewerbung.bind(null, { slug: job.slug });

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6">
      <nav className="text-sm text-muted-foreground" aria-label="Brotkrumen">
        <Link href={detailHref} className="underline-offset-2 hover:underline">
          ← {titelMitMwd(job.titel)}
        </Link>
      </nav>

      <header className="mt-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Bewerbung · kostenlos &amp; direkt zur Fahrschule
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
          Bewerbung an {job.schule.name}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Für die Stelle „{titelMitMwd(job.titel)}“. Deine Unterlagen leiten wir direkt an die
          Fahrschule weiter — wir speichern sie nicht.
        </p>
      </header>

      {hatFehler && (
        <p
          role="alert"
          className="mt-5 rounded-[4px] border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          Das hat leider nicht geklappt. Bitte prüfe deine Angaben und Dateien (Lebenslauf als
          PDF, DOC oder DOCX, max. 5 MB) und sende das Formular erneut — es wurden keine Daten
          übermittelt.
        </p>
      )}

      <form action={action} encType="multipart/form-data" className="mt-6 flex flex-col gap-6">
        {/* Zeitfalle: Render-Zeitpunkt; Server verlangt min. 3 s Ausfüllzeit */}
        <input type="hidden" name="ts" value={new Date().getTime()} />
        {/* Honeypot: für Menschen unsichtbar — jede Eingabe führt zur Ablehnung */}
        <div aria-hidden="true" className="sr-only">
          <label htmlFor="bw-website">Website (bitte leer lassen)</label>
          <input id="bw-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
        </div>

        {/* Schritt 1 — Wer bist du gerade? */}
        <section className="rounded-md border border-border bg-[color-mix(in_oklab,var(--brand-sky)_5%,var(--background))] px-5 py-5">
          <Schritt nr="01" titel="Wo stehst du gerade?" />
          <fieldset>
            <legend className="sr-only">Dein aktueller Status</legend>
            <div className="flex flex-col gap-2">
              {BEWERBER_STATUS_WERTE.map((s, i) => (
                <label
                  key={s}
                  className="inline-flex min-h-11 cursor-pointer items-center gap-3 rounded-[4px] border border-border bg-background px-4 py-2 text-sm transition-colors duration-[var(--motion-duration-fast)] ease-[var(--motion-ease)] has-checked:border-primary has-checked:bg-primary/5"
                >
                  <input
                    type="radio"
                    name="bewerberStatus"
                    value={s}
                    defaultChecked={i === 0}
                    required
                    className="size-4 shrink-0 accent-[var(--primary)]"
                  />
                  <span>
                    <span className="font-medium">{STATUS_OPTIONEN[s].titel}</span>{" "}
                    <span className="text-muted-foreground">— {STATUS_OPTIONEN[s].hinweis}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="mt-5">
            <legend className={LABEL_KLASSE}>Klassen, die du ausbilden kannst oder willst (optional)</legend>
            <div className="flex flex-wrap gap-2">
              {JOB_KLASSEN.map((k) => (
                <label
                  key={k}
                  className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-[4px] border border-border bg-background px-2.5 font-mono text-xs transition-colors duration-[var(--motion-duration-fast)] ease-[var(--motion-ease)] has-checked:border-primary has-checked:bg-primary/5 has-checked:text-primary"
                >
                  <input type="checkbox" name="klassen" value={k} className="size-3.5 accent-[var(--primary)]" />
                  {k}
                </label>
              ))}
            </div>
          </fieldset>
        </section>

        {/* Schritt 2 — Verfügbarkeit (Datum nur bei „zum Datum", reines CSS) */}
        <section className="group/verf rounded-md border border-border bg-background px-5 py-5">
          <Schritt nr="02" titel="Ab wann kannst du?" />
          <fieldset>
            <legend className="sr-only">Verfügbarkeit</legend>
            <div className="flex flex-col gap-2 sm:flex-row">
              {VERFUEGBAR_WERTE.map((v) => (
                <label
                  key={v}
                  className="inline-flex min-h-11 flex-1 cursor-pointer items-center gap-2 rounded-[4px] border border-border bg-background px-4 text-sm transition-colors duration-[var(--motion-duration-fast)] ease-[var(--motion-ease)] has-checked:border-primary has-checked:bg-primary/5"
                >
                  <input
                    type="radio"
                    id={v === "zum_datum" ? "bw-verf-datum-radio" : undefined}
                    name="verfuegbarStatus"
                    value={v}
                    defaultChecked={v === "flexibel"}
                    required
                    className="size-4 accent-[var(--primary)]"
                  />
                  {VERFUEGBAR_OPTIONEN[v]}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="mt-4 hidden group-has-[#bw-verf-datum-radio:checked]/verf:block">
            <label htmlFor="bw-verfuegbar-ab" className={LABEL_KLASSE}>Verfügbar ab (Datum)</label>
            <input id="bw-verfuegbar-ab" name="verfuegbarAb" type="date" className={FELD_KLASSE} />
            <p className="mt-1 text-xs text-muted-foreground">Nur nötig, wenn du „Zum Datum“ gewählt hast.</p>
          </div>
        </section>

        {/* Schritt 3 — Kontakt + Nachricht */}
        <section className="rounded-md border border-border bg-[color-mix(in_oklab,var(--brand-sky)_5%,var(--background))] px-5 py-5">
          <Schritt nr="03" titel="Wie erreicht dich die Fahrschule?" />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="bw-name" className={LABEL_KLASSE}>Name *</label>
              <input id="bw-name" name="name" required minLength={2} maxLength={100} autoComplete="name" className={FELD_KLASSE} />
            </div>
            <div>
              <label htmlFor="bw-email" className={LABEL_KLASSE}>E-Mail *</label>
              <input id="bw-email" name="email" type="email" required maxLength={254} autoComplete="email" className={FELD_KLASSE} />
            </div>
            <div>
              <label htmlFor="bw-telefon" className={LABEL_KLASSE}>Telefon (optional)</label>
              <input id="bw-telefon" name="telefon" type="tel" maxLength={64} autoComplete="tel" placeholder="z. B. 089 1234567" className={FELD_KLASSE} />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="bw-nachricht" className={LABEL_KLASSE}>Nachricht (optional)</label>
              <textarea
                id="bw-nachricht"
                name="nachricht"
                rows={4}
                maxLength={2000}
                placeholder="z. B. Erfahrung, Wunsch-Arbeitszeiten, Fragen …"
                className={`${FELD_KLASSE} min-h-24 py-2`}
              />
            </div>
          </div>
        </section>

        {/* Schritt 4 — Unterlagen (Durchleitung, keine Speicherung) */}
        <section className="rounded-md border border-border bg-background px-5 py-5">
          <Schritt
            nr="04"
            titel="Deine Unterlagen"
            hinweis="Wir leiten sie an die Fahrschule weiter und speichern sie nicht."
          />
          <div className="flex flex-col gap-4">
            <div>
              <label htmlFor="bw-cv" className={LABEL_KLASSE}>Lebenslauf * · PDF, DOC oder DOCX · max. 5 MB</label>
              <input
                id="bw-cv"
                name="cv"
                type="file"
                required
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className={`${FELD_KLASSE} py-2 file:mr-3 file:rounded-[3px] file:border-0 file:bg-primary/10 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-primary`}
              />
            </div>
            <div>
              <label htmlFor="bw-foto" className={LABEL_KLASSE}>
                Foto · freiwillig — für deine Bewerbung nicht nötig · JPG, PNG oder WebP · max. 3 MB
              </label>
              <input
                id="bw-foto"
                name="foto"
                type="file"
                accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                className={`${FELD_KLASSE} py-2 file:mr-3 file:rounded-[3px] file:border-0 file:bg-primary/10 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-primary`}
              />
            </div>
          </div>
        </section>

        {/* Schritt 5 — Einwilligungen + Absenden */}
        <section className="rounded-md border border-border bg-[color-mix(in_oklab,var(--brand-sky)_5%,var(--background))] px-5 py-5">
          <Schritt nr="05" titel="Einwilligung & Absenden" />
          <div className="flex flex-col gap-3">
            <label className="flex cursor-pointer items-start gap-3 text-sm">
              <input type="checkbox" name="datenschutz" required className="mt-0.5 size-5 shrink-0 accent-[var(--primary)]" />
              <span>
                Ich habe die{" "}
                <Link href="/datenschutz" className="text-primary underline-offset-2 hover:underline">
                  Datenschutzerklärung
                </Link>{" "}
                gelesen und bin mit der Verarbeitung meiner Angaben einverstanden. *
              </span>
            </label>
            {/* Ehrlich für BEIDE Wege (Gründer 2026-07-02): Bewerbungen gehen
                direkt an die Schule; Quereinstiegs-/Ausbildungs-Interessenten
                laufen zuerst über onelane (persönliche Vermittlung — Routing in
                modules/jobs/actions.ts). Die Einwilligung deckt beide Wege. */}
            <label className="flex cursor-pointer items-start gap-3 text-sm">
              <input type="checkbox" name="weitergabe" required className="mt-0.5 size-5 shrink-0 accent-[var(--primary)]" />
              <span>
                Meine Bewerbung samt Unterlagen wird übermittelt: als Bewerbung direkt an{" "}
                <strong>{job.schule.name}</strong> — bei Ausbildungs-/Quereinstiegs-Interesse
                zunächst an onelane, das die Vermittlung an die Fahrschule persönlich begleitet. *
              </span>
            </label>
          </div>
          <p className="mt-4 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
            Deine Unterlagen leiten wir weiter und speichern sie nicht. Deine Bewerbungsdaten
            löschen wir spätestens 6 Monate nach Abschluss des Bewerbungsverfahrens.
          </p>

          <div className="mt-4 flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <TrustBadge size="sm" />
              <span className="text-[11px] leading-snug text-muted-foreground">
                kostenlos &amp; unverbindlich
              </span>
            </div>
            <button
              type="submit"
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-accent px-6 text-sm font-semibold text-accent-foreground transition-colors duration-[var(--motion-duration-fast)] ease-[var(--motion-ease)] hover:bg-brand-lime"
            >
              Bewerbung absenden
            </button>
          </div>
        </section>
      </form>
    </div>
  );
}
