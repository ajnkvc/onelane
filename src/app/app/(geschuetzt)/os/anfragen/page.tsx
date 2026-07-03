import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPortalIdentity } from "@/modules/portal/identity";
import { istSchulManager } from "@/modules/portal/rollen";
import {
  ANFRAGE_STATUS_LABEL,
  aelter48hText,
  cursorDekodieren,
  getAnfragenListe,
  type AnfrageEintrag,
  type AnfrageStatus,
} from "@/modules/portal/os-kern";
import { DashboardHero, alterLabel } from "@/components/portal/dashboards/hero";
import { EmptyState } from "@/components/portal/empty-state";
import { KarteNichtVerfuegbar, StatusPunkt } from "@/components/portal/karten";
import { anfrageStatusAktualisieren } from "./actions";

/**
 * os/anfragen — Lead-Verwaltung der aktiven Schule (OS-P3, Paket A).
 * ----------------------------------------------------------------------------
 * GATE (P2-Platzhalter 1:1 übernommen): istSchulManager, sonst notFound()
 * (fahrlehrer hat via Navigation keinen Zugriff; RLS 0022 bleibt letzte Linie).
 * Daten NUR über modules/portal/os-kern (withCurrentUserContext, fail-soft).
 * Status-Tabs: neu | kontaktiert | erledigt — die DB-Allowlist bleibt
 * neu|gesehen|erledigt ('gesehen' wird als „kontaktiert" angezeigt, os-kern).
 */
export const metadata: Metadata = { title: "Anfragen" };

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/** UI-Tabs → DB-Status ('kontaktiert' ist das Anzeige-Label von 'gesehen'). */
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
  return query ? `/app/os/anfragen?${query}` : "/app/os/anfragen";
}

function Chip({
  children,
  ton = "neutral",
}: {
  children: React.ReactNode;
  ton?: "neutral" | "warnung";
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] ${
        ton === "warnung"
          ? "border-warning/40 bg-warning/10 text-warning"
          : "border-border bg-muted text-muted-foreground"
      }`}
    >
      {children}
    </span>
  );
}

/** Status-Knöpfe je Zeile: kleine Formulare auf die geprüfte Server Action. */
function StatusAktionen({ eintrag }: { eintrag: AnfrageEintrag }) {
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
        <form key={k.status} action={anfrageStatusAktualisieren}>
          <input type="hidden" name="leadId" value={eintrag.id} />
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

function AnfrageZeile({ eintrag }: { eintrag: AnfrageEintrag }) {
  return (
    <li className="py-4 first:pt-2 last:pb-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="flex min-w-0 items-center gap-2 text-sm font-medium">
          <StatusPunkt
            ton={eintrag.status === "neu" ? "warnung" : eintrag.status === "erledigt" ? "ok" : "neutral"}
          />
          <span className="truncate">{eintrag.name}</span>
          <span className="shrink-0 text-xs font-normal text-muted-foreground">
            Klasse {eintrag.klasse}
          </span>
        </p>
        <p className="shrink-0 text-xs text-muted-foreground tabular-nums">
          {alterLabel(eintrag.alterStunden)} · {eintrag.eingegangen}
        </p>
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <Chip>{ANFRAGE_STATUS_LABEL[eintrag.status]}</Chip>
        <Chip>{eintrag.zeitraum}</Chip>
        {eintrag.rueckruf ? <Chip>Rückruf: {eintrag.rueckruf}</Chip> : null}
        {eintrag.wunschFahrlehrer ? <Chip>Wunsch-Fahrlehrer: {eintrag.wunschFahrlehrer}</Chip> : null}
        {eintrag.istMinderjaehrig ? <Chip ton="warnung">unter 18</Chip> : null}
      </div>

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
        {!eintrag.email && !eintrag.telefon ? (
          <span className="text-muted-foreground">keine Kontaktdaten hinterlegt</span>
        ) : null}
      </div>

      {eintrag.guardian ? (
        <p className="mt-1.5 text-xs text-muted-foreground">
          Erziehungsberechtigt: <span className="text-foreground">{eintrag.guardian.name}</span>
          {eintrag.guardian.email ? <> · {eintrag.guardian.email}</> : null}
          {eintrag.guardian.telefon ? <> · {eintrag.guardian.telefon}</> : null}
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

  const liste = await getAnfragenListe(identity.aktiveSchule.schoolId, {
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
    ? `${liste.zaehler.neu} neue Anfrage${liste.zaehler.neu === 1 ? "" : "n"} bei ${identity.aktiveSchule.schoolName}.`
    : null;

  return (
    <div className="grid gap-6">
      <DashboardHero kicker="anfragen" titel="Anfragen" satz={satz} />

      {liste && liste.zaehler.neuAelter48h > 0 ? (
        // Wiederverwendeter Insights-Risiko-Chip (48-h-Regel, identische Formulierung).
        <p className="-mt-2">
          <span className="inline-flex items-center rounded-full border border-warning/40 bg-warning/10 px-2.5 py-1 text-xs text-warning">
            {aelter48hText(liste.zaehler.neuAelter48h)}
          </span>
        </p>
      ) : null}

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
            titel={tab === "alle" ? "Noch keine Anfragen" : `Keine Anfragen mit Status „${tab}"`}
            beschreibung="Neue Anfragen aus dem Portal landen direkt hier."
          />
        ) : (
          <>
            <ul className="divide-y divide-border">
              {liste.eintraege.map((eintrag) => (
                <AnfrageZeile key={eintrag.id} eintrag={eintrag} />
              ))}
            </ul>
            {liste.naechsterCursor ? (
              <div className="mt-3 border-t border-border pt-4 text-center">
                <Link
                  href={tabHref(tab, liste.naechsterCursor)}
                  className={`inline-flex min-h-9 items-center rounded-full border border-border bg-card px-4 text-sm font-medium shadow-elevation-1 motion-safe:transition-colors motion-safe:duration-[var(--motion-duration-fast)] hover:border-brand-sky/60 ${focusRing}`}
                >
                  ältere Anfragen anzeigen
                </Link>
              </div>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
