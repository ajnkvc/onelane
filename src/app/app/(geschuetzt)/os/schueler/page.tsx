import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPortalIdentity } from "@/modules/portal/identity";
import { istSchulRolle } from "@/modules/portal/rollen";
import {
  ANMELDUNG_STATUS_LABEL,
  ANMELDUNG_STATUS_WERTE,
  KLASSE_FILTER_REGEX,
  anmeldungStatusSchema,
  cursorDekodieren,
  getSchuelerListe,
  type AnmeldungStatus,
  type SchuelerEintrag,
} from "@/modules/portal/os-kern";
import { DashboardHero, TERMIN_STATUS_LABEL, TYP_LABEL } from "@/components/portal/dashboards/hero";
import { EmptyState } from "@/components/portal/empty-state";
import { Kennzahl, KarteNichtVerfuegbar, StatusPunkt } from "@/components/portal/karten";

/**
 * os/schueler — Schülerdatenbank V1 der aktiven Schule (OS-P3, Paket A).
 * ----------------------------------------------------------------------------
 * GATE (P2-Platzhalter 1:1): alle drei Schul-Rollen — auch fahrlehrer
 * (Gründer-Entscheid Quer-Routing; RLS 0029 liest schulweit). Daten NUR über
 * modules/portal/os-kern. NAMEN seit Welle 2 über den geprüften Definer-Pfad
 * app.schueler_namen (Migration 0031, NUR vorname/nachname bei aktivem
 * Enrollment) — ohne aktives Enrollment fällt die Zeile ehrlich auf die
 * Anmeldungs-Kurz-ID zurück. Filterleiste (Status/Klasse) als GET-Formular,
 * Cursor-Pagination ab 20.
 */
export const metadata: Metadata = { title: "Schüler" };

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

function parseStatus(raw: unknown): AnmeldungStatus | undefined {
  const parsed = anmeldungStatusSchema.safeParse(raw);
  return parsed.success ? parsed.data : undefined;
}

function parseKlasse(raw: unknown): string | undefined {
  return typeof raw === "string" && KLASSE_FILTER_REGEX.test(raw) ? raw : undefined;
}

function listeHref(filter: { status?: AnmeldungStatus; klasse?: string; cursor?: string }): string {
  const params = new URLSearchParams();
  if (filter.status) params.set("status", filter.status);
  if (filter.klasse) params.set("klasse", filter.klasse);
  if (filter.cursor) params.set("cursor", filter.cursor);
  const query = params.toString();
  return query ? `/app/os/schueler?${query}` : "/app/os/schueler";
}

function seitLabel(tage: number): string {
  if (tage < 1) return "seit heute";
  if (tage === 1) return "seit 1 Tag";
  if (tage < 60) return `seit ${tage} Tagen`;
  const monate = Math.floor(tage / 30);
  return `seit ${monate} Monaten`;
}

function statusTon(status: AnmeldungStatus): "neutral" | "ok" | "warnung" {
  if (status === "active") return "ok";
  if (status === "pending") return "warnung";
  return "neutral";
}

function SchuelerZeile({ eintrag }: { eintrag: SchuelerEintrag }) {
  return (
    <li className="py-4 first:pt-2 last:pb-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="flex min-w-0 items-center gap-2 text-sm font-medium">
          <StatusPunkt ton={statusTon(eintrag.status)} />
          {eintrag.name ? (
            <span className="truncate">{eintrag.name}</span>
          ) : null}
          <span className="font-mono text-xs tracking-wide text-muted-foreground">
            {eintrag.name ? eintrag.idKurz : `Anmeldung ${eintrag.idKurz}`}
          </span>
          {eintrag.klasse ? (
            <span className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
              Klasse {eintrag.klasse}
            </span>
          ) : null}
          <span className="text-xs font-normal text-muted-foreground">
            {ANMELDUNG_STATUS_LABEL[eintrag.status]}
          </span>
        </p>
        <p className="shrink-0 text-xs text-muted-foreground tabular-nums">
          {seitLabel(eintrag.seitTagen)}
        </p>
      </div>

      <p className="mt-1.5 text-xs text-muted-foreground">
        <span className="font-medium text-foreground tabular-nums">
          {eintrag.fahrstundenAbsolviert}
        </span>{" "}
        Fahrstunde{eintrag.fahrstundenAbsolviert === 1 ? "" : "n"} absolviert ·{" "}
        <span className="tabular-nums">{eintrag.termineGesamt}</span> Termin
        {eintrag.termineGesamt === 1 ? "" : "e"} gesamt
      </p>

      {eintrag.historie.length > 0 ? (
        <details className="group mt-2">
          <summary
            className={`inline-flex cursor-pointer list-none items-center gap-1 rounded-sm text-xs font-medium text-primary [&::-webkit-details-marker]:hidden ${focusRing}`}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
              className="size-3.5 motion-safe:transition-transform group-open:rotate-90"
            >
              <path d="m9 6 6 6-6 6" />
            </svg>
            letzte Termine
          </summary>
          <ul className="mt-1.5 divide-y divide-border rounded-lg bg-muted px-3 py-1 text-xs">
            {eintrag.historie.map((t, i) => (
              <li key={i} className="flex flex-wrap items-baseline justify-between gap-x-3 py-1.5">
                <span className="tabular-nums">
                  {t.tag} · {t.von} · {TYP_LABEL[t.typ] ?? t.typ}
                  {t.fahrlehrer_name ? ` · ${t.fahrlehrer_name}` : ""}
                </span>
                <span className="text-muted-foreground">
                  {TERMIN_STATUS_LABEL[t.status] ?? t.status}
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </li>
  );
}

export default async function Seite({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; klasse?: string; cursor?: string }>;
}) {
  const identity = await getPortalIdentity();
  if (
    !identity ||
    !istSchulRolle(identity, "inhaber", "verwaltung", "fahrlehrer") ||
    !identity.aktiveSchule
  ) {
    notFound();
  }

  const params = await searchParams;
  const status = parseStatus(params.status);
  const klasse = parseKlasse(params.klasse);
  const cursor = cursorDekodieren(params.cursor);

  const liste = await getSchuelerListe(identity.aktiveSchule.schoolId, { status, klasse, cursor });

  const gefiltert = Boolean(status || klasse);
  const satz = liste
    ? `${liste.anzahlAktiv} aktive Anmeldung${liste.anzahlAktiv === 1 ? "" : "en"} bei ${identity.aktiveSchule.schoolName}.`
    : null;

  return (
    <div className="grid gap-6">
      <DashboardHero kicker="schüler" titel="Schüler" satz={satz} />

      <section aria-label="Kennzahlen" className="grid grid-cols-2 gap-3 sm:max-w-md">
        <Kennzahl label="aktive Anmeldungen" wert={liste ? liste.anzahlAktiv : "—"} />
        <Kennzahl label="Anmeldungen gesamt" wert={liste ? liste.anzahlGesamt : "—"} />
      </section>

      {/* Filterleiste: GET-Formular — funktioniert ohne JS, URL bleibt teilbar. */}
      <form
        method="get"
        action="/app/os/schueler"
        className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-4 shadow-elevation-1"
      >
        <label className="grid gap-1 text-xs font-medium">
          Status
          <select
            name="status"
            defaultValue={status ?? ""}
            className={`min-h-9 rounded-lg border border-border bg-background px-2.5 text-sm ${focusRing}`}
          >
            <option value="">alle</option>
            {ANMELDUNG_STATUS_WERTE.map((s) => (
              <option key={s} value={s}>
                {ANMELDUNG_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-medium">
          Klasse
          <select
            name="klasse"
            defaultValue={klasse ?? ""}
            className={`min-h-9 rounded-lg border border-border bg-background px-2.5 text-sm ${focusRing}`}
          >
            <option value="">alle</option>
            {(liste?.klassen ?? []).map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className={`inline-flex min-h-9 items-center rounded-full border border-border bg-card px-4 text-sm font-medium shadow-elevation-1 motion-safe:transition-colors motion-safe:duration-[var(--motion-duration-fast)] hover:border-brand-sky/60 ${focusRing}`}
        >
          filtern
        </button>
        {gefiltert ? (
          <Link
            href="/app/os/schueler"
            className={`inline-flex min-h-9 items-center rounded-full px-3 text-sm text-muted-foreground underline-offset-4 hover:underline ${focusRing}`}
          >
            Filter zurücksetzen
          </Link>
        ) : null}
      </form>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-elevation-1">
        {liste === null ? (
          <KarteNichtVerfuegbar />
        ) : liste.eintraege.length === 0 ? (
          <EmptyState
            szene="strecke"
            titel={gefiltert ? "Keine Anmeldungen für diesen Filter" : "Noch keine Anmeldungen"}
            beschreibung={
              gefiltert
                ? "Mit anderen Filtern findest du die übrigen Anmeldungen deiner Schule."
                : "Sobald sich Fahrschüler anmelden, erscheint hier ihre Ausbildung."
            }
            aktion={gefiltert ? { href: "/app/os/schueler", label: "Filter zurücksetzen" } : undefined}
          />
        ) : (
          <>
            <ul className="divide-y divide-border">
              {liste.eintraege.map((eintrag) => (
                <SchuelerZeile key={eintrag.id} eintrag={eintrag} />
              ))}
            </ul>
            {liste.naechsterCursor ? (
              <div className="mt-3 border-t border-border pt-4 text-center">
                <Link
                  href={listeHref({ status, klasse, cursor: liste.naechsterCursor })}
                  className={`inline-flex min-h-9 items-center rounded-full border border-border bg-card px-4 text-sm font-medium shadow-elevation-1 motion-safe:transition-colors motion-safe:duration-[var(--motion-duration-fast)] hover:border-brand-sky/60 ${focusRing}`}
                >
                  ältere Anmeldungen anzeigen
                </Link>
              </div>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
