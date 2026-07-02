import { DataBadge } from "@/components/school/data-badge";
import {
  PREIS_KOMPONENTEN,
  hatPflichtangabenSet,
  formatEuro,
  formatStand,
  type SchoolPriceRow,
} from "@/lib/preise";

/**
 * preisaushang.tsx — der Held der Profilseite: amtlicher Preisaushang je Klasse.
 * ----------------------------------------------------------------------------
 * RECHTSRAHMEN (§ 32 FahrlG, Anlage 4): Preise NUR als Komponenten-Register,
 * NIE als Gesamt-/Pauschal-/Schätzpreis. §32-GATING: Nur Klassen mit
 * VOLLSTÄNDIGEM Pflichtangaben-Set (hatPflichtangabenSet) werden herausgestellt
 * (markierter Rahmen, „Aushang vollständig"); unvollständige Sets erscheinen
 * als NEUTRALE Tabelle mit „Preisaushang unvollständig"-Hinweis, ganz ohne
 * Angaben als ehrlicher „keine Preisangabe"-Block. An jeder Klasse hängt die
 * Provenienz (DataBadge: recherchiert/bestätigt + Stand); die Fußzeile weist
 * amtliche Prüfgebühren (TÜV/DEKRA) stets als getrennte Drittgebühren aus.
 * KLASSEN-FOKUS: Nur EINE Klasse ist aufgeklappt (Priorität: ?klasse=-Wunsch
 * der Seite → 'B' → erste vorhandene); alle übrigen Klassen liegen in
 * geschlossenen details/summary-Aufklappern („Klasse X anzeigen") — kein
 * Ewig-Scrollen. Server-tauglich, kein JS, tabular-nums für alle Beträge.
 */

function hatIrgendeineAngabe(row: SchoolPriceRow): boolean {
  return PREIS_KOMPONENTEN.some((k) => row.komponenten[k.key] != null);
}

function KlassenRegister({ row, rahmenlos = false }: { row: SchoolPriceRow; rahmenlos?: boolean }) {
  const vollstaendig = hatPflichtangabenSet(row);

  return (
    <div
      className={
        rahmenlos
          ? "bg-background"
          : `rounded-md border bg-background ${
              vollstaendig ? "border-primary/35 shadow-elevation-1" : "border-border"
            }`
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <span className="inline-flex flex-wrap items-center gap-2">
          <span className="rounded-[3px] bg-foreground px-2 py-0.5 font-mono text-xs font-semibold text-background">
            Klasse {row.klasse}
          </span>
          {vollstaendig ? (
            <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
              Aushang vollständig
            </span>
          ) : (
            <span className="rounded-[3px] border border-border px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
              Preisaushang unvollständig
            </span>
          )}
        </span>
        <DataBadge status={row.status} stand={row.stand} />
      </div>

      {hatIrgendeineAngabe(row) ? (
        <ol className="px-4">
          {PREIS_KOMPONENTEN.map((k, i) => {
            const wert = row.komponenten[k.key];
            return (
              <li
                key={k.key}
                className="flex items-baseline gap-3 border-b border-border/70 py-2.5 last:border-b-0"
              >
                <span aria-hidden="true" className="w-6 shrink-0 font-mono text-xs text-muted-foreground/70">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-sm text-foreground/90">{k.label}</span>
                <span aria-hidden="true" className="mx-1 flex-1 border-b border-dotted border-border" />
                {wert != null ? (
                  <span
                    className={`text-right font-mono text-sm tabular-nums ${
                      vollstaendig ? "font-semibold" : ""
                    }`}
                  >
                    {formatEuro(wert)}
                  </span>
                ) : (
                  <span className="text-right text-sm text-muted-foreground/70">keine Angabe</span>
                )}
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="px-4 py-4 text-sm text-muted-foreground">
          Keine Preisangabe — die Komponenten des Aushangs gibt es direkt bei der Fahrschule.
        </p>
      )}

      {formatStand(row.stand) && (
        <p className="border-t border-border px-4 py-2 font-mono text-[11px] text-muted-foreground">
          {formatStand(row.stand)} · Komponenten nach § 32 FahrlG — kein Gesamtpreis
        </p>
      )}
    </div>
  );
}

/** Fokus-Klasse auflösen: Wunsch (?klasse=) → 'B' → erste vorhandene Zeile. */
export function waehleFokusKlasse(rows: SchoolPriceRow[], wunsch?: string | null): string | null {
  if (rows.length === 0) return null;
  const w = wunsch?.trim().toUpperCase();
  const treffer = w ? rows.find((r) => r.klasse.toUpperCase() === w) : undefined;
  return (treffer ?? rows.find((r) => r.klasse === "B") ?? rows[0]).klasse;
}

export function Preisaushang({
  rows,
  fokusKlasse,
}: {
  rows: SchoolPriceRow[];
  /** Gewünschte Klasse (z. B. aus ?klasse=); Auflösung fail-soft über waehleFokusKlasse. */
  fokusKlasse?: string | null;
}) {
  const fokus = waehleFokusKlasse(rows, fokusKlasse);
  const fokusRow = rows.find((r) => r.klasse === fokus) ?? null;
  const weitere = rows.filter((r) => r !== fokusRow);

  return (
    <div>
      {rows.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-background px-5 py-8">
          <p className="font-semibold">Keine Preisangabe</p>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Für diese Fahrschule liegen uns noch keine Bestandteile des Preisaushangs vor.
            Wir schätzen grundsätzlich nicht — die Komponenten gibt es vor Ort oder telefonisch.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {fokusRow && <KlassenRegister row={fokusRow} />}
          {weitere.map((row) => (
            <details key={row.klasse} className="group rounded-md border border-border bg-background">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-2.5 marker:content-none [&::-webkit-details-marker]:hidden">
                <span className="inline-flex flex-wrap items-center gap-2 text-sm font-medium">
                  <span className="rounded-[3px] border border-border px-2 py-0.5 font-mono text-xs font-semibold">
                    Klasse {row.klasse}
                  </span>
                  <span className="text-muted-foreground group-open:hidden">anzeigen</span>
                  <span className="hidden text-muted-foreground group-open:inline">ausblenden</span>
                </span>
                <span className="inline-flex items-center gap-2">
                  <DataBadge status={row.status} stand={row.stand} />
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    className="size-4 shrink-0 text-muted-foreground motion-safe:transition-transform motion-safe:duration-[var(--motion-duration-fast)] motion-safe:ease-[var(--motion-ease)] group-open:rotate-45"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  >
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </span>
              </summary>
              <div className="border-t border-border">
                <KlassenRegister row={row} rahmenlos />
              </div>
            </details>
          ))}
        </div>
      )}

      <p className="mt-4 max-w-3xl font-mono text-[11px] leading-relaxed text-muted-foreground">
        Alle Beträge sind einzelne Preisbestandteile des amtlichen Aushangs (§ 32 FahrlG) —
        bewusst kein Gesamtpreis, der hängt vom persönlichen Übungsbedarf ab. Es gelten
        zzgl. amtlicher Prüfgebühren (TÜV/DEKRA) — Drittgebühren, keine Fahrschul-Entgelte.
        „Recherchiert“ = ohne Gewähr, bis die Fahrschule die Angaben bestätigt.
      </p>
    </div>
  );
}
