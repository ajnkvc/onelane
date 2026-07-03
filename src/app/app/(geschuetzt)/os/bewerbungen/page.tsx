import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPortalIdentity } from "@/modules/portal/identity";
import { istSchulManager } from "@/modules/portal/rollen";
import {
  ANFRAGE_STATUS_LABEL,
  cursorDekodieren,
  getBewerbungenListe,
  type BewerbungEintrag,
  type AnfrageStatus,
} from "@/modules/portal/os-kern";
import { DashboardHero, alterLabel } from "@/components/portal/dashboards/hero";
import { EmptyState } from "@/components/portal/empty-state";
import { KarteNichtVerfuegbar, StatusPunkt } from "@/components/portal/karten";
import { bewerbungStatusAktualisieren } from "./actions";

/**
 * os/bewerbungen — Bewerbungen auf die Stellenanzeigen der aktiven Schule
 * (OS-P3, Paket A).
 * ----------------------------------------------------------------------------
 * GATE (P2-Platzhalter 1:1): istSchulManager, sonst notFound(). Daten NUR über
 * modules/portal/os-kern (RLS 0023/0025 bleibt letzte Linie).
 * VERMITTLUNG: Quereinsteiger-Bewerbungen sind per RLS zwar sichtbar, werden
 * hier aber NEUTRALISIERT gezeigt („über onelane vermittelt", keine Kontakte,
 * keine Unterlagen, kein Status-Wechsel) — Neutralisierung liegt in os-kern.
 * Die Unterlagen echter Bewerbungen wurden per E-Mail zugestellt (Durchleitung,
 * modules/jobs) — onelane speichert sie nicht; hier steht nur der Dateiname.
 */
export const metadata: Metadata = { title: "Bewerbungen" };

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const TABS = [
  { key: "alle", label: "alle", status: null },
  { key: "neu", label: "neu", status: "neu" },
  { key: "kontaktiert", label: "kontaktiert", status: "gesehen" },
  { key: "erledigt", label: "erledigt", status: "erledigt" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

function parseTab(raw: unknown): TabKey {
  return TABS.some((t) => t.key === raw) ? (raw as TabKey) : "alle";
}

function tabHref(tab: TabKey, cursor?: string): string {
  const params = new URLSearchParams();
  if (tab !== "alle") params.set("status", tab);
  if (cursor) params.set("cursor", cursor);
  const query = params.toString();
  return query ? `/app/os/bewerbungen?${query}` : "/app/os/bewerbungen";
}

function Chip({
  children,
  ton = "neutral",
}: {
  children: React.ReactNode;
  ton?: "neutral" | "akzent";
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] ${
        ton === "akzent"
          ? "border-primary/30 bg-primary/10 text-primary"
          : "border-border bg-muted text-muted-foreground"
      }`}
    >
      {children}
    </span>
  );
}

function StatusAktionen({ eintrag }: { eintrag: BewerbungEintrag }) {
  // Vermittlungs-Zeilen pflegt die Schule nicht (Prozess läuft über onelane) —
  // os-kern sperrt das zusätzlich SQL-seitig.
  if (eintrag.vermittelt) return null;
  const knoepfe: Array<{ status: AnfrageStatus; label: string }> =
    eintrag.status === "neu"
      ? [
          { status: "gesehen", label: "als kontaktiert markieren" },
          { status: "erledigt", label: "erledigt" },
        ]
      : eintrag.status === "gesehen"
        ? [
            { status: "erledigt", label: "erledigt" },
            { status: "neu", label: "zurück auf neu" },
          ]
        : [{ status: "neu", label: "wieder öffnen" }];
  return (
    <div className="mt-2.5 flex flex-wrap gap-2">
      {knoepfe.map((k) => (
        <form key={k.status} action={bewerbungStatusAktualisieren}>
          <input type="hidden" name="bewerbungId" value={eintrag.id} />
          <input type="hidden" name="status" value={k.status} />
          <button
            type="submit"
            className={`inline-flex min-h-8 items-center rounded-full border border-border bg-card px-3 text-xs font-medium shadow-elevation-1 motion-safe:transition-colors motion-safe:duration-[var(--motion-duration-fast)] hover:border-brand-sky/60 ${focusRing}`}
          >
            {k.label}
          </button>
        </form>
      ))}
    </div>
  );
}

function BewerbungZeile({ eintrag }: { eintrag: BewerbungEintrag }) {
  return (
    <li className="py-4 first:pt-2 last:pb-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="flex min-w-0 items-center gap-2 text-sm font-medium">
          <StatusPunkt
            ton={eintrag.status === "neu" ? "warnung" : eintrag.status === "erledigt" ? "ok" : "neutral"}
          />
          <span className="truncate">
            {eintrag.vermittelt ? "über onelane vermittelt" : eintrag.name}
          </span>
        </p>
        <p className="shrink-0 text-xs text-muted-foreground tabular-nums">
          {alterLabel(eintrag.alterStunden)} · {eintrag.eingegangen}
        </p>
      </div>

      <p className="mt-0.5 text-xs text-muted-foreground">{eintrag.jobTitel}</p>

      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <Chip>{ANFRAGE_STATUS_LABEL[eintrag.status]}</Chip>
        {eintrag.vermittelt ? <Chip ton="akzent">über onelane vermittelt</Chip> : null}
        {eintrag.bewerberStatus ? <Chip>{eintrag.bewerberStatus}</Chip> : null}
        {eintrag.klassen.length > 0 ? <Chip>Klassen {eintrag.klassen.join(", ")}</Chip> : null}
        {!eintrag.vermittelt && eintrag.verfuegbar ? <Chip>{eintrag.verfuegbar}</Chip> : null}
      </div>

      {eintrag.vermittelt ? (
        <p className="mt-1.5 text-xs text-muted-foreground">
          Ausbildungs-Interessent:in — Kontaktaufnahme und Prozess laufen über onelane.
        </p>
      ) : (
        <>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
            {eintrag.email ? (
              <a
                href={`mailto:${eintrag.email}`}
                className={`rounded-sm text-primary underline-offset-4 hover:underline ${focusRing}`}
              >
                {eintrag.email}
              </a>
            ) : null}
            {eintrag.telefon ? (
              <a
                href={`tel:${eintrag.telefon}`}
                className={`rounded-sm text-primary underline-offset-4 hover:underline ${focusRing}`}
              >
                {eintrag.telefon}
              </a>
            ) : null}
          </div>
          {eintrag.cvDateiname ? (
            <p className="mt-1.5 text-xs text-muted-foreground">
              Unterlagen: <span className="text-foreground">{eintrag.cvDateiname}</span> — per
              E-Mail zugestellt, onelane speichert sie nicht.
            </p>
          ) : null}
          {eintrag.nachricht ? (
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
                Nachricht lesen
              </summary>
              <p className="mt-1.5 whitespace-pre-line rounded-lg bg-muted px-3 py-2 text-sm leading-relaxed">
                {eintrag.nachricht}
              </p>
            </details>
          ) : null}
        </>
      )}

      <StatusAktionen eintrag={eintrag} />
    </li>
  );
}

export default async function Seite({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; cursor?: string }>;
}) {
  const identity = await getPortalIdentity();
  if (!identity || !istSchulManager(identity) || !identity.aktiveSchule) notFound();

  const params = await searchParams;
  const tab = parseTab(params.status);
  const cursor = cursorDekodieren(params.cursor);
  const status = TABS.find((t) => t.key === tab)?.status ?? null;

  const liste = await getBewerbungenListe(identity.aktiveSchule.schoolId, {
    status: status ?? undefined,
    cursor,
  });

  const zaehlerJeTab: Record<TabKey, number | null> = liste
    ? {
        alle: liste.zaehler.neu + liste.zaehler.kontaktiert + liste.zaehler.erledigt,
        neu: liste.zaehler.neu,
        kontaktiert: liste.zaehler.kontaktiert,
        erledigt: liste.zaehler.erledigt,
      }
    : { alle: null, neu: null, kontaktiert: null, erledigt: null };

  const satz = liste
    ? `${liste.zaehler.neu} neue Bewerbung${liste.zaehler.neu === 1 ? "" : "en"} auf deine Stellenanzeigen.`
    : null;

  return (
    <div className="grid gap-6">
      <DashboardHero kicker="bewerbungen" titel="Bewerbungen" satz={satz} />

      <nav aria-label="Status-Filter" className="flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={tabHref(t.key)}
            aria-current={t.key === tab ? "page" : undefined}
            className={`inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium motion-safe:transition-colors motion-safe:duration-[var(--motion-duration-fast)] ${focusRing} ${
              t.key === tab
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground hover:border-brand-sky/60"
            }`}
          >
            {t.label}
            {zaehlerJeTab[t.key] !== null ? (
              <span className="tabular-nums">{zaehlerJeTab[t.key]}</span>
            ) : null}
          </Link>
        ))}
      </nav>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-elevation-1">
        {liste === null ? (
          <KarteNichtVerfuegbar />
        ) : liste.eintraege.length === 0 ? (
          <EmptyState
            szene="posteingang"
            titel={tab === "alle" ? "Noch keine Bewerbungen" : `Keine Bewerbungen mit Status „${tab}"`}
            beschreibung="Bewerbungen auf deine Stellenanzeigen erscheinen hier."
            aktion={{ href: "/app/os/jobs", label: "Stellenanzeigen ansehen" }}
          />
        ) : (
          <>
            <ul className="divide-y divide-border">
              {liste.eintraege.map((eintrag) => (
                <BewerbungZeile key={eintrag.id} eintrag={eintrag} />
              ))}
            </ul>
            {liste.naechsterCursor ? (
              <div className="mt-3 border-t border-border pt-4 text-center">
                <Link
                  href={tabHref(tab, liste.naechsterCursor)}
                  className={`inline-flex min-h-9 items-center rounded-full border border-border bg-card px-4 text-sm font-medium shadow-elevation-1 motion-safe:transition-colors motion-safe:duration-[var(--motion-duration-fast)] hover:border-brand-sky/60 ${focusRing}`}
                >
                  ältere Bewerbungen anzeigen
                </Link>
              </div>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
