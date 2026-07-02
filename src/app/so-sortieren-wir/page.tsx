import type { Metadata } from "next";
import Link from "next/link";
import { DataBadge } from "@/components/school/data-badge";

/**
 * /so-sortieren-wir — P2B-/UWG-Transparenzseite (SSR, indexierbar).
 * ----------------------------------------------------------------------------
 * Erklärt sachlich und kompakt: (1) wie die Reihenfolge der Suchergebnisse
 * entsteht (Standard = Entfernung; Bewertungs-Sortierung = Google-Aggregat mit
 * Quellenlabel; Position ist NICHT kaufbar; künftige Hervorhebungen immer
 * gekennzeichnet), (2) wie Angaben gekennzeichnet werden (beide DataBadge-
 * Zustände live gezeigt), (3) wie wir mit Bewertungen umgehen, (4) wie wir
 * STELLENANZEIGEN sortieren (Offenlegungs-Auflage M5 — deckungsgleich mit dem
 * Docblock in src/modules/jobs/queries.ts: Relevanz/Ort, Datenvollständigkeit
 * inkl. offen benanntem Gehalts-Datenqualitätsbonus, Aktualität; Zahlungen
 * beeinflussen das Ranking nicht), (5) wie man Fehler meldet. Editorialer
 * Kapitel-Stil (zentrierte Köpfe, schmale Lese-Spalte), keine
 * Marketing-Sprache, keine Beträge (§ 32 FahrlG).
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "So sortieren wir",
  description:
    "Wie die Reihenfolge der Suchergebnisse und Stellenanzeigen auf onelane entsteht, wie Angaben gekennzeichnet sind, wie wir mit Bewertungen umgehen — und wie du Fehler melden kannst.",
};

/** Kapitel-Zeile (zentriert): Hairlines beidseitig, Lime-Punkt als Marker. */
function Kicker({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center gap-4">
      <span aria-hidden="true" className="h-px w-10 bg-border" />
      <span aria-hidden="true" className="size-1.5 shrink-0 bg-accent" />
      <span className="shrink-0 font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
        {n} · {children}
      </span>
      <span aria-hidden="true" className="h-px w-10 bg-border" />
    </div>
  );
}

export default function SoSortierenWirPage() {
  return (
    <div className="bg-background text-foreground">
      <div className="mx-auto w-full max-w-3xl px-6 pb-24 pt-16 sm:pt-24">
        {/* ================= Kopf ================= */}
        <header className="text-center">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
            onelane · Transparenz
          </p>
          <h1 className="mt-6 text-4xl font-light tracking-tight text-balance sm:text-6xl">
            So <span className="font-semibold">sortieren</span> wir.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl leading-relaxed text-muted-foreground">
            Diese Seite erklärt, wie die Reihenfolge unserer Suchergebnisse entsteht, wie wir
            Angaben kennzeichnen und wie wir mit Bewertungen umgehen — kompakt und ohne
            Marketing-Sprache.
          </p>
        </header>

        {/* ================= 01 · Sortierung ================= */}
        <section aria-labelledby="sortierung-heading" className="mt-20 sm:mt-24">
          <Kicker n="01">Sortierung</Kicker>
          <h2 id="sortierung-heading" className="mt-8 text-center text-3xl font-light tracking-tight sm:text-4xl">
            Standard ist die <span className="font-semibold">Entfernung.</span>
          </h2>
          <div className="mt-10 space-y-6 leading-relaxed text-muted-foreground">
            <p>
              Suchst du mit einem Ort oder einer Adresse, sortieren wir die Ergebnisse nach der
              Distanz zu deinem Standort — die nächstgelegene Fahrschule steht oben. Diese
              Sortierung ist die Voreinstellung.
            </p>
            <p>
              Wählst du die Sortierung nach Bewertung (oder suchst du ohne Standortangabe), nutzen
              wir das öffentlich einsehbare Google-Bewertungs-Aggregat der jeweiligen Fahrschule.
              Es ist in der Oberfläche mit seiner Quelle gekennzeichnet — es sind keine
              Bewertungen von onelane.
            </p>
            <p className="border-l-2 border-accent pl-6 text-foreground">
              <span className="font-semibold">Position ist nicht kaufbar.</span>{" "}
              <span className="text-muted-foreground">
                Zahlungen von Fahrschulen an uns haben keinen Einfluss auf die Reihenfolge der
                Suchergebnisse.
              </span>
            </p>
            <p>
              Sollten wir künftig Hervorhebungen anbieten (zum Beispiel gekennzeichnete
              Partner-Einträge), werden sie immer deutlich als solche markiert — und sie verändern
              die Reihenfolge der übrigen Ergebnisse nicht.
            </p>
          </div>
        </section>

        {/* ================= 02 · Kennzeichnung ================= */}
        <section aria-labelledby="kennzeichnung-heading" className="mt-20 border-t border-border pt-16 sm:mt-24">
          <Kicker n="02">Kennzeichnung</Kicker>
          <h2 id="kennzeichnung-heading" className="mt-8 text-center text-3xl font-light tracking-tight sm:text-4xl">
            Jede Angabe trägt <span className="font-semibold">ihren Status.</span>
          </h2>
          <p className="mt-10 leading-relaxed text-muted-foreground">
            Du siehst bei jeder Angabe, woher sie stammt und wie belastbar sie ist — in genau zwei
            Zuständen:
          </p>
          <ul className="mt-8 space-y-8">
            <li className="border-t border-border pt-6">
              <DataBadge status="recherchiert" />
              <p className="mt-3 leading-relaxed text-muted-foreground">
                So starten alle Einträge: Angaben aus öffentlich zugänglichen Quellen und den
                Websites der Fahrschulen — sorgfältig recherchiert, aber ohne Gewähr, bis die
                Fahrschule sie selbst geprüft hat.
              </p>
            </li>
            <li className="border-t border-border pt-6">
              <DataBadge status="bestaetigt" />
              <p className="mt-3 leading-relaxed text-muted-foreground">
                Erst wenn die Fahrschule ihre Angaben selbst geprüft, korrigiert und bestätigt
                hat, tragen sie das grüne Abzeichen.
              </p>
            </li>
          </ul>
          <p className="mt-8 text-sm leading-relaxed text-muted-foreground">
            Davon zu unterscheiden:{" "}
            <Link
              href="/trust"
              aria-label="Mehr über onelane trust"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              „onelane trust“
            </Link>{" "}
            ist unser Marken-Versprechen an Fahrschüler (wir bleiben nach deiner Anmeldung an
            deiner Seite) — kein Prüfsiegel und keine Aussage über die Richtigkeit einzelner
            Angaben.
          </p>
        </section>

        {/* ================= 03 · Bewertungen ================= */}
        <section aria-labelledby="bewertungen-heading" className="mt-20 border-t border-border pt-16 sm:mt-24">
          <Kicker n="03">Bewertungen</Kicker>
          <h2 id="bewertungen-heading" className="mt-8 text-center text-3xl font-light tracking-tight sm:text-4xl">
            Keine eigenen Sterne — <span className="font-semibold">noch nicht.</span>
          </h2>
          <div className="mt-10 space-y-6 leading-relaxed text-muted-foreground">
            <p>
              Eigene Bewertungen zeigen wir erst, wenn wir sie verlässlich verifizieren können —
              dieses System bauen wir gerade. Bis dahin siehst du bei uns ausschließlich das
              gekennzeichnete Google-Aggregat.
            </p>
            <p>
              Gekaufte oder erfundene Sterne gibt es bei uns nicht — weder heute noch später.
            </p>
          </div>
        </section>

        {/* ================= 04 · Stellenanzeigen (Jobbörse) ================= */}
        {/* Offenlegung deckungsgleich mit der implementierten Sortierung
            (src/modules/jobs/queries.ts — Score: bestätigtes Gehalt +2,
            geprüft +1, Beschreibung +1, Klassen +1 → Aktualität → Position). */}
        <section aria-labelledby="jobs-sortierung-heading" className="mt-20 border-t border-border pt-16 sm:mt-24">
          <Kicker n="04">Stellenanzeigen</Kicker>
          <h2 id="jobs-sortierung-heading" className="mt-8 text-center text-3xl font-light tracking-tight sm:text-4xl">
            Wie wir <span className="font-semibold">Stellenanzeigen</span> sortieren.
          </h2>
          <div className="mt-10 space-y-6 leading-relaxed text-muted-foreground">
            <p>
              Auch auf unserer{" "}
              <Link href="/jobs" className="font-medium text-primary underline-offset-4 hover:underline">
                Jobbörse
              </Link>{" "}
              ist die Reihenfolge kein Zufall — und kein Geschäft. Die Hauptparameter sind:
            </p>
            <ul className="list-none space-y-4">
              <li className="border-l-2 border-border pl-6">
                <span className="font-semibold text-foreground">Relevanz und Ort:</span>{" "}
                Deine Filter (Ort oder Stichwort, Führerscheinklasse, Beschäftigungsart,
                Quereinstieg) grenzen die Treffermenge ein — was nicht passt, erscheint gar
                nicht erst.
              </li>
              <li className="border-l-2 border-border pl-6">
                <span className="font-semibold text-foreground">Datenvollständigkeit:</span>{" "}
                Vollständigere Anzeigen stehen weiter oben. Eine von der Fahrschule bestätigte
                Gehaltsspanne zählt dabei am stärksten — das ist ein offener
                Datenqualitätsbonus: Wer transparenter ist, wird sichtbarer. Daneben zählen ein
                gepflegtes Prüfdatum, eine Beschreibung und angegebene Führerscheinklassen.
              </li>
              <li className="border-l-2 border-border pl-6">
                <span className="font-semibold text-foreground">Aktualität:</span>{" "}
                Zuletzt geprüfte beziehungsweise veröffentlichte Anzeigen stehen vor älteren.
              </li>
            </ul>
            <p className="border-l-2 border-accent pl-6 text-foreground">
              <span className="font-semibold">Zahlungen beeinflussen das Ranking nicht.</span>{" "}
              <span className="text-muted-foreground">
                Es gibt keinen bezahlten Platz und keinen Partner-Boost — weder in der
                Fahrschulsuche noch in der Jobbörse.
              </span>
            </p>
            <p>
              Gehaltsangaben zeigen wir übrigens nur, wenn die Fahrschule ihre komplette Spanne
              selbst bestätigt hat — dann tragen sie das Label „Angabe der Fahrschule“ mit
              Datum. Wir schätzen keine Gehälter und übernehmen keine Fremd-Gehaltsdaten.
            </p>
          </div>
        </section>

        {/* ================= 05 · Fehler melden ================= */}
        <section aria-labelledby="korrektur-heading" className="mt-20 border-t border-border pt-16 sm:mt-24">
          <Kicker n="05">Korrektur</Kicker>
          <h2 id="korrektur-heading" className="mt-8 text-center text-3xl font-light tracking-tight sm:text-4xl">
            Angabe stimmt <span className="font-semibold">nicht?</span>
          </h2>
          <p className="mt-10 leading-relaxed text-muted-foreground">
            Du hast eine Angabe entdeckt, die nicht stimmt? Schreib uns kurz, um welche Fahrschule
            und welche Angabe es geht — wir prüfen und korrigieren sie.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <a
              href="mailto:kontakt@onelane.de?subject=Korrektur"
              className="inline-flex min-h-12 items-center gap-2 rounded-full border border-border bg-card px-7 py-3 text-base font-semibold transition-transform duration-[var(--motion-duration-fast)] ease-[var(--motion-ease)] hover:border-brand-sky/60 hover:text-primary motion-safe:hover:scale-[1.02] motion-safe:active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Korrektur melden
            </a>
            <span className="text-sm text-muted-foreground">kontakt@onelane.de · Betreff „Korrektur“</span>
          </div>
          <p className="mt-16 border-t border-border pt-8 text-sm text-muted-foreground">
            Zurück zur{" "}
            <Link href="/fahrschulen" className="font-medium text-primary underline-offset-4 hover:underline">
              Fahrschulsuche
            </Link>{" "}
            oder zur{" "}
            <Link href="/" className="font-medium text-primary underline-offset-4 hover:underline">
              Startseite
            </Link>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
