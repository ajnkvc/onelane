import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSchoolProfile } from "@/modules/schools/profile";
import { submitLead } from "@/modules/leads/actions";
import { KLASSE_REGEX, ZEITRAUM_WERTE, RUECKRUF_WERTE } from "@/modules/leads/schema";
import { TrustBadge } from "@/components/trust/trust-badge";
import { ctaLabel } from "@/lib/cta";

/**
 * Anfrage-Funnel /fahrschulen/[stadt]/[slug]/anmeldung — EIN Formular in
 * Schritten-Optik (SSR, noindex). Wortlaut „Kostenfreie Anfrage" (lib/cta.ts).
 * ----------------------------------------------------------------------------
 * Progressive Disclosure rein über Reihenfolge + CSS (U18-Guardian-Block via
 * peer-checked) — das Ganze ist EIN POST auf die Server Action und funktioniert
 * VOLLSTÄNDIG ohne JavaScript. Native Validierung (required/type/maxLength)
 * fängt die meisten Fehler clientseitig; die Server Action validiert alles
 * erneut (Zod) und antwortet bei Problemen mit einem GENERISCHEN Fehler-Flag
 * (?fehler=1) — nur Klasse/Zeitraum reisen zurück (keine PII in URLs).
 * Anti-Bot: Honeypot-Feld `website` (visually-hidden) + Zeitfalle (hidden ts).
 * Einwilligungen: Datenschutz + Weitergabe an GENAU DIESE Schule (Schulname im
 * Label). Vertrauens-Punkt am Submit: TrustBadge + „kostenlos & unverbindlich"
 * (bewusst OHNE weitere Zusätze — Vermittler-Klarstellung nur im FAQ).
 */
export const dynamic = "force-dynamic";

type Params = Promise<{ stadt: string; slug: string }>;
type SP = Promise<Record<string, string | string[] | undefined>>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { stadt, slug } = await params;
  const school = await getSchoolProfile(stadt, slug).catch(() => null);
  return {
    title: school ? `Kostenfreie Anfrage an ${school.name}` : "Kostenfreie Anfrage",
    robots: { index: false, follow: false },
  };
}

const ZEITRAUM_LABEL: Record<(typeof ZEITRAUM_WERTE)[number], string> = {
  sofort: "So bald wie möglich",
  in_1_3_monaten: "In 1–3 Monaten",
  spaeter: "Später — ich schaue mich um",
};
const RUECKRUF_ANZEIGE: Record<(typeof RUECKRUF_WERTE)[number], string> = {
  vormittags: "Vormittags",
  nachmittags: "Nachmittags",
  abends: "Abends",
  egal: "Egal / jederzeit",
};

/** Schritt-Kopf: Mono-Nummer + Titel (Dossier-Sprache des Profils). */
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

const FELD_KLASSE =
  "min-h-11 w-full rounded-[4px] border border-input bg-background px-3 text-sm outline-none placeholder:text-muted-foreground focus:border-ring";
const LABEL_KLASSE =
  "mb-1 block font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground";

export default async function AnmeldungPage({ params, searchParams }: { params: Params; searchParams: SP }) {
  const { stadt, slug } = await params;
  const sp = await searchParams;
  const school = await getSchoolProfile(stadt, slug).catch(() => null);
  if (!school) notFound();

  const klassen = school.klassen.length > 0 ? school.klassen : ["B"];
  const klasseParam = first(sp.klasse)?.trim().toUpperCase() ?? "";
  const vorbelegteKlasse =
    KLASSE_REGEX.test(klasseParam) && klassen.includes(klasseParam) ? klasseParam : klassen[0];
  const hatFehler = first(sp.fehler) === "1";

  const profilHref = `/fahrschulen/${school.stadtSlug}/${school.slug}`;
  // school_id wird NIE aus dem Formular gelesen: die Route bindet Stadt/Slug an
  // die Action (Next signiert gebundene Argumente), der Server löst die Schule auf.
  const action = submitLead.bind(null, { stadt: school.stadtSlug, slug: school.slug });

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6">
      <nav className="text-sm text-muted-foreground" aria-label="Brotkrumen">
        <Link href={profilHref} className="underline-offset-2 hover:underline">
          ← {school.name}
        </Link>
      </nav>

      <header className="mt-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Anfrage · kostenlos &amp; unverbindlich
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
          Kostenfreie Anfrage an {school.name}
        </h1>
        {/* BEWUSST kein Telefon-Angebot im Funnel (Gründer 2026-07-02): jede
            Anfrage soll über die Lead-Mail an die Schule laufen (Erstkontakt in
            onelane-CI + Zählung) — der Anruf-Button lebt auf der Profilseite. */}
        <p className="mt-2 text-sm text-muted-foreground">
          Deine Anfrage geht direkt an die Fahrschule — sie meldet sich bei dir.
        </p>
      </header>

      {hatFehler && (
        <p
          role="alert"
          className="mt-5 rounded-[4px] border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          Das hat leider nicht geklappt. Bitte prüfe deine Angaben und sende das Formular
          erneut — es wurden keine Daten übermittelt.
        </p>
      )}

      <form action={action} className="mt-6 flex flex-col gap-6">
        {/* Zeitfalle: Render-Zeitpunkt; Server verlangt min. 3 s Ausfüllzeit */}
        <input type="hidden" name="ts" value={new Date().getTime()} />
        {/* Honeypot: für Menschen unsichtbar — jede Eingabe führt zur Ablehnung */}
        <div aria-hidden="true" className="sr-only">
          <label htmlFor="lead-website">Website (bitte leer lassen)</label>
          <input id="lead-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
        </div>

        {/* Schritt 1 — Klasse */}
        <section className="rounded-md border border-border bg-[color-mix(in_oklab,var(--brand-sky)_5%,var(--background))] px-5 py-5">
          <Schritt nr="01" titel="Welche Klasse?" />
          <fieldset>
            <legend className="sr-only">Führerscheinklasse wählen</legend>
            <div className="flex flex-wrap gap-2">
              {klassen.map((k) => (
                <label
                  key={k}
                  className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-[4px] border border-border bg-background px-4 text-sm font-medium transition-colors duration-[var(--motion-duration-fast)] ease-[var(--motion-ease)] has-checked:border-primary has-checked:bg-primary/5 has-checked:text-primary"
                >
                  <input
                    type="radio"
                    name="klasse"
                    value={k}
                    defaultChecked={k === vorbelegteKlasse}
                    required
                    className="size-4 accent-[var(--primary)]"
                  />
                  Klasse {k}
                </label>
              ))}
            </div>
          </fieldset>
        </section>

        {/* Schritt 2 — Zeitraum */}
        <section className="rounded-md border border-border bg-background px-5 py-5">
          <Schritt nr="02" titel="Wann willst du starten?" />
          <fieldset>
            <legend className="sr-only">Gewünschter Startzeitraum</legend>
            <div className="flex flex-col gap-2 sm:flex-row">
              {ZEITRAUM_WERTE.map((z, i) => (
                <label
                  key={z}
                  className="inline-flex min-h-11 flex-1 cursor-pointer items-center gap-2 rounded-[4px] border border-border bg-background px-4 text-sm transition-colors duration-[var(--motion-duration-fast)] ease-[var(--motion-ease)] has-checked:border-primary has-checked:bg-primary/5"
                >
                  <input
                    type="radio"
                    name="zeitraum"
                    value={z}
                    defaultChecked={i === 0}
                    required
                    className="size-4 accent-[var(--primary)]"
                  />
                  {ZEITRAUM_LABEL[z]}
                </label>
              ))}
            </div>
          </fieldset>
        </section>

        {/* Schritt 3 — Kontakt */}
        <section className="rounded-md border border-border bg-[color-mix(in_oklab,var(--brand-sky)_5%,var(--background))] px-5 py-5">
          <Schritt nr="03" titel="Wie erreicht dich die Fahrschule?" hinweis="E-Mail ODER Telefon genügt — mindestens eines." />
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="lead-vorname" className={LABEL_KLASSE}>Vorname *</label>
              <input id="lead-vorname" name="vorname" required minLength={2} maxLength={100} autoComplete="given-name" className={FELD_KLASSE} />
            </div>
            <div>
              <label htmlFor="lead-nachname" className={LABEL_KLASSE}>Nachname</label>
              <input id="lead-nachname" name="nachname" maxLength={100} autoComplete="family-name" className={FELD_KLASSE} />
            </div>
            <div>
              <label htmlFor="lead-email" className={LABEL_KLASSE}>E-Mail</label>
              <input id="lead-email" name="email" type="email" maxLength={254} autoComplete="email" className={FELD_KLASSE} />
            </div>
            <div>
              <label htmlFor="lead-telefon" className={LABEL_KLASSE}>Telefon</label>
              <input id="lead-telefon" name="telefon" type="tel" maxLength={64} autoComplete="tel" placeholder="z. B. 089 1234567" className={FELD_KLASSE} />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="lead-rueckruf" className={LABEL_KLASSE}>Wunsch-Rückrufzeit</label>
              <select id="lead-rueckruf" name="rueckruf" defaultValue="egal" className={FELD_KLASSE}>
                {RUECKRUF_WERTE.map((r) => (
                  <option key={r} value={r}>{RUECKRUF_ANZEIGE[r]}</option>
                ))}
              </select>
            </div>
            {/* Wunsch-Fahrlehrer (Gründer 2026-07-02): optionale Auswahl aus dem
                ÖFFENTLICHEN Team der Schule — Server validiert den Wert erneut
                gegen instructors_public (kein freier Text in der DB). */}
            {school.show.instructors && school.instructors.length > 0 && (
              <fieldset className="sm:col-span-2">
                <legend className={LABEL_KLASSE}>Wunsch-Fahrlehrer:in (optional)</legend>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-border bg-background px-4 text-sm font-medium has-[:checked]:border-primary has-[:checked]:bg-primary/5 has-[:checked]:text-primary">
                    <input type="radio" name="wunschFahrlehrer" value="" defaultChecked className="accent-[var(--primary)]" />
                    Keine Präferenz
                  </label>
                  {school.instructors.map((i) => (
                    <label
                      key={i.slug}
                      className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-border bg-background px-4 text-sm font-medium has-[:checked]:border-primary has-[:checked]:bg-primary/5 has-[:checked]:text-primary"
                    >
                      <input type="radio" name="wunschFahrlehrer" value={i.name} className="accent-[var(--primary)]" />
                      {i.name}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            <div className="sm:col-span-2">
              <label htmlFor="lead-nachricht" className={LABEL_KLASSE}>Nachricht (optional)</label>
              <textarea
                id="lead-nachricht"
                name="nachricht"
                rows={4}
                maxLength={2000}
                placeholder="z. B. Vorerfahrung, Fragen, Terminwünsche …"
                className={`${FELD_KLASSE} min-h-24 py-2`}
              />
            </div>
          </div>

          {/* U18: Guardian-Block via peer-checked — reines CSS, HTML immer vorhanden.
              Serverseitig NUR gefordert, wenn die Checkbox gesetzt ist (Zod-Gate). */}
          <div className="mt-4 flex flex-wrap items-center gap-x-3 rounded-[4px] border border-border bg-background px-4 py-3">
            <input
              id="lead-u18"
              type="checkbox"
              name="minderjaehrig"
              className="peer size-5 shrink-0 accent-[var(--primary)]"
            />
            <label
              htmlFor="lead-u18"
              className="flex min-h-11 flex-1 cursor-pointer items-center text-sm font-medium"
            >
              Ich bin unter 18 Jahre alt
            </label>
            <fieldset className="mt-1 hidden w-full gap-4 border-t border-border pt-4 peer-checked:grid sm:peer-checked:grid-cols-2">
              <legend className="sr-only">Erziehungsberechtigte Person (bei unter 18 erforderlich)</legend>
              <p className="text-xs text-muted-foreground sm:col-span-2">
                Bei Minderjährigen braucht die Fahrschule eine erziehungsberechtigte Kontaktperson.
              </p>
              <div>
                <label htmlFor="lead-gname" className={LABEL_KLASSE}>Name Erziehungsberechtigte:r</label>
                <input id="lead-gname" name="guardianName" maxLength={100} autoComplete="off" className={FELD_KLASSE} />
              </div>
              <div>
                <label htmlFor="lead-gemail" className={LABEL_KLASSE}>E-Mail Erziehungsberechtigte:r</label>
                <input id="lead-gemail" name="guardianEmail" type="email" maxLength={254} autoComplete="off" className={FELD_KLASSE} />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="lead-gtel" className={LABEL_KLASSE}>Telefon Erziehungsberechtigte:r</label>
                <input id="lead-gtel" name="guardianTelefon" type="tel" maxLength={64} autoComplete="off" className={FELD_KLASSE} />
              </div>
            </fieldset>
          </div>
        </section>

        {/* Schritt 4 — Einwilligungen + Absenden */}
        <section className="rounded-md border border-border bg-background px-5 py-5">
          <Schritt nr="04" titel="Einwilligung & Absenden" />
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
            <label className="flex cursor-pointer items-start gap-3 text-sm">
              <input type="checkbox" name="weitergabe" required className="mt-0.5 size-5 shrink-0 accent-[var(--primary)]" />
              <span>
                Meine Anfrage darf an <strong>{school.name}</strong> weitergegeben werden, damit
                sie mich zu meiner Anmeldung kontaktiert. *
              </span>
            </label>
          </div>

          <div className="mt-5 flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
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
              {ctaLabel({ isPartner: school.isPartner })}
            </button>
          </div>
        </section>
      </form>
    </div>
  );
}
