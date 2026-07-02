import type { Metadata } from "next";
import Link from "next/link";
import { DataBadge } from "@/components/school/data-badge";
import { TrustEmblem } from "@/components/trust/trust-emblem";

/**
 * /eltern — Eltern-Ratgeberseite (SSR, indexierbar).
 * ----------------------------------------------------------------------------
 * Richtet sich an die MITENTSCHEIDENDEN und meist MITZAHLENDEN Eltern:
 * Kosten-Bausteine verstehen (zahlenlos, § 32 FahrlG), 5 ehrliche Tipps fürs
 * Familiengespräch, Begleitetes Fahren (BF17) kompakt, U18-Einbindung bei
 * onelane + trust-Kurzblock. Abschluss: „Gemeinsam vergleichen".
 *
 * ANREDE (bewusste Ausnahme, Gründer 2026-07-02): Diese eine Seite spricht
 * durchgehend im respektvoll-warmen SIE — Eltern sind älter als unsere
 * Du-Kernzielgruppe (17–25); Mischformen auf einer Seite wirken unentschieden.
 * Alle übrigen Seiten bleiben beim Du.
 *
 * EHRLICHKEIT: nur Wahres, keine Quoten-/Monats-/Preiszahlen; BF17-Fakten
 * (§ 48a FeV) mit „Stand"-Datum und „ohne Gewähr"-Hinweis — verbindlich ist
 * die Führerscheinstelle.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Für Eltern — den Führerschein gemeinsam meistern",
  description:
    "Was der Führerschein wirklich kostet (die fünf Preis-Bausteine), fünf ehrliche Tipps für das Familiengespräch, Begleitetes Fahren (BF17) kompakt — und wie onelane Eltern bei der Anmeldung Minderjähriger einbindet.",
};

/** Einheitlicher Fokus-Stil (WCAG 2.2: sichtbarer Fokus) für alle Interaktiven. */
const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/** Kapitel-Zeile (zentriert): Hairlines beidseitig, Mint-Punkt als Marker. */
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

/** Die fünf Preis-Bausteine — kurz erklärt, ZAHLENLOS (§ 32 FahrlG). */
const BAUSTEINE = [
  {
    title: "Grundbetrag",
    text: "Einmalig — deckt Theorieunterricht und die allgemeine Ausbildung ab.",
  },
  {
    title: "Fahrstunde",
    text: "Je Übungsstunde à 45 Minuten. Wie viele nötig sind, hängt vom Lernfortschritt ab — seriös lässt sich das nicht vorab versprechen.",
  },
  {
    title: "Sonderfahrten",
    text: "Gesetzlich vorgeschrieben: Überland, Autobahn, Dunkelheit — je Fahrtart einzeln ausgewiesen.",
  },
  {
    title: "Vorstellung zur Theorieprüfung",
    text: "Das Entgelt der Fahrschule für Anmeldung und Vorstellung zur theoretischen Prüfung.",
  },
  {
    title: "Vorstellung zur praktischen Prüfung",
    text: "Das Entgelt für die praktische Prüfung — inklusive Fahrzeug am Prüfungstag.",
  },
] as const;

/** Fünf ehrliche, praktische Tipps für das Familiengespräch. */
const TIPPS = [
  {
    title: "Gemeinsam vergleichen statt erstbeste Schule",
    text: "Sehen Sie sich zwei, drei Fahrschulen nebeneinander an — Lage, Preisbestandteile, Klassenangebot. Der Vergleich kostet eine Viertelstunde und verhindert teure Bauchentscheidungen.",
  },
  {
    title: "Auf bestätigte Angaben achten",
    text: "Bei uns trägt jede Angabe ihren Status: recherchiert oder von der Fahrschule bestätigt. Verlassen Sie sich im Zweifel auf bestätigte Preise — und fragen Sie sonst direkt nach dem aktuellen Preisaushang.",
  },
  {
    title: "Vertrag vor der Unterschrift lesen",
    text: "Alle Preisbestandteile gehören einzeln in den Vertrag. Prüfen Sie besonders Ausfallgebühren (kurzfristige Absagen), Kündigungs- und Erstattungsregeln — bevor unterschrieben wird.",
  },
  {
    title: "Erreichbarkeit testen",
    text: "Rufen Sie einmal an oder schreiben Sie eine Nachricht: Wer schon vor der Anmeldung schwer erreichbar ist, wird es während der Ausbildung selten besser machen.",
  },
  {
    title: "Realistisch planen",
    text: "Die Ausbildung dauert oft länger als beworben — Theorie, Fahrstunden und Prüfungstermine brauchen Vorlauf. Planen Sie großzügig, statt sich unter Druck setzen zu lassen.",
  },
] as const;

export default function ElternPage() {
  return (
    <div className="bg-background text-foreground">
      <div className="mx-auto w-full max-w-3xl px-6 pb-24 pt-16 sm:pt-24">
        {/* ================= Kopf ================= */}
        <header className="text-center">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
            onelane · für Eltern
          </p>
          <h1 className="mt-6 text-4xl font-light tracking-tight text-balance sm:text-6xl">
            Den Führerschein <span className="font-semibold">gemeinsam meistern.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl leading-relaxed text-muted-foreground">
            Sie zahlen mit, Sie entscheiden mit — und bei Minderjährigen unterschreiben Sie mit.
            Diese Seite gibt Ihnen den Überblick: Was der Führerschein kostet, worauf Sie beim
            Vertrag achten sollten und wie onelane Sie einbindet.
          </p>
        </header>

        {/* ================= 01 · Kosten verstehen ================= */}
        <section aria-labelledby="kosten-heading" className="mt-20 sm:mt-24">
          <Kicker n="01">Kosten verstehen</Kicker>
          <h2 id="kosten-heading" className="mt-8 text-center text-3xl font-light tracking-tight sm:text-4xl">
            Was der Führerschein <span className="font-semibold">wirklich kostet.</span>
          </h2>
          <p className="mt-10 leading-relaxed text-muted-foreground">
            Einen seriösen Gesamtpreis gibt es vorab nicht: Wie viele Fahrstunden Ihr Kind
            braucht, entscheidet der Lernfortschritt. Fahrschulen weisen ihre Preise deshalb
            gesetzlich nach Bestandteilen aus (§ 32 FahrlG) — diese fünf sollten Sie kennen:
          </p>
          <ul className="mt-8 space-y-5">
            {BAUSTEINE.map((b, i) => (
              <li key={b.title} className="flex gap-4 border-t border-border pt-5">
                <span aria-hidden="true" className="text-2xl font-light tabular-nums text-muted-foreground/40">
                  {i + 1}
                </span>
                <p className="leading-relaxed text-muted-foreground">
                  <span className="font-semibold text-foreground">{b.title}.</span> {b.text}
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-8 border-l-2 border-accent pl-6 leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground">Dazu kommen amtliche Prüfgebühren</span>{" "}
            — für die Prüforganisation (z.&nbsp;B. TÜV oder DEKRA) und die Führerscheinbehörde.
            Sie sind gesetzlich festgelegt und kein Teil des Fahrschulpreises.
          </p>
          {/* Kennzeichnung: beide Badge-Zustände live gezeigt (wie /so-sortieren-wir) */}
          <div className="mt-10 rounded-2xl border border-border bg-card p-6">
            <p className="text-sm font-semibold">So kennzeichnen wir Preisangaben:</p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <DataBadge status="recherchiert" />
              <DataBadge status="bestaetigt" />
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Recherchierte Angaben stammen aus öffentlichen Quellen und gelten ohne Gewähr —
              erst wenn die Fahrschule sie selbst geprüft und bestätigt hat, tragen sie das
              grüne Abzeichen.{" "}
              <Link
                href="/so-sortieren-wir"
                className={`font-medium text-primary underline-offset-4 hover:underline ${focusRing} rounded-md`}
              >
                Mehr dazu: So sortieren wir
              </Link>
            </p>
          </div>
        </section>

        {/* ================= 02 · Fünf Tipps ================= */}
        <section aria-labelledby="tipps-heading" className="mt-20 border-t border-border pt-16 sm:mt-24">
          <Kicker n="02">Familiengespräch</Kicker>
          <h2 id="tipps-heading" className="mt-8 text-center text-3xl font-light tracking-tight sm:text-4xl">
            Fünf Tipps für das <span className="font-semibold">Familiengespräch.</span>
          </h2>
          <ol className="mt-10 space-y-8">
            {TIPPS.map((t, i) => (
              <li key={t.title} className="flex gap-4">
                <span
                  aria-hidden="true"
                  className="grid size-9 shrink-0 place-items-center rounded-full border border-brand-sky/50 bg-card font-mono text-sm text-primary"
                >
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-semibold tracking-tight">{t.title}</h3>
                  <p className="mt-1.5 leading-relaxed text-muted-foreground">{t.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* ================= 03 · Begleitetes Fahren (BF17) ================= */}
        <section aria-labelledby="bf17-heading" className="mt-20 border-t border-border pt-16 sm:mt-24">
          <Kicker n="03">Begleitetes Fahren</Kicker>
          <h2 id="bf17-heading" className="mt-8 text-center text-3xl font-light tracking-tight sm:text-4xl">
            BF17: Sie als <span className="font-semibold">Begleitperson.</span>
          </h2>
          <p className="mt-10 leading-relaxed text-muted-foreground">
            Beim Begleiteten Fahren ab 17 sammelt Ihr Kind nach bestandener Prüfung Fahrpraxis
            unter Begleitung — ein ruhigerer Einstieg in den Alltag auf der Straße. Als
            Begleitperson eingetragen werden kann, wer diese Voraussetzungen erfüllt
            (§&nbsp;48a FeV):
          </p>
          <ul className="mt-8 space-y-4">
            {[
              "Mindestens 30 Jahre alt",
              "Seit mindestens 5 Jahren im Besitz der Fahrerlaubnis Klasse B",
              "Höchstens 1 Punkt im Fahreignungsregister in Flensburg",
            ].map((v) => (
              <li key={v} className="flex items-start gap-3.5">
                <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 bg-accent" />
                <p className="leading-relaxed text-muted-foreground">{v}</p>
              </li>
            ))}
          </ul>
          <p className="mt-8 text-sm leading-relaxed text-muted-foreground">
            Stand: Juli 2026 — Details ohne Gewähr; verbindliche Auskunft gibt Ihre
            Führerscheinstelle.
          </p>
        </section>

        {/* ================= 04 · So bindet onelane Sie ein ================= */}
        <section aria-labelledby="einbindung-heading" className="mt-20 border-t border-border pt-16 sm:mt-24">
          <Kicker n="04">Ihre Rolle</Kicker>
          <h2 id="einbindung-heading" className="mt-8 text-center text-3xl font-light tracking-tight sm:text-4xl">
            So bindet onelane <span className="font-semibold">Sie ein.</span>
          </h2>
          <div className="mt-10 space-y-6 leading-relaxed text-muted-foreground">
            <p>
              <span className="font-semibold text-foreground">Bei Minderjährigen sind Sie dabei.</span>{" "}
              Fragt Ihr Kind unter 18 bei einer Fahrschule an, werden Ihre Kontaktdaten als
              Erziehungsberechtigte miterfasst — den Ausbildungsvertrag schließt die Fahrschule
              anschließend mit Ihnen gemeinsam.
            </p>
            <p>
              <span className="font-semibold text-foreground">Datenminimierung.</span> Wir fragen
              nur ab, was für die Anmeldung wirklich nötig ist — gerade bei Minderjährigen gilt:
              so wenige Daten wie möglich. Die Angaben gehen ausschließlich an die gewählte
              Fahrschule.
            </p>
            <p>
              <span className="font-semibold text-foreground">Ohne Konto, ohne Tracking.</span>{" "}
              Vergleichen funktioniert bei uns ohne Registrierung — schicken Sie sich in der
              Familie einfach den Link zur Auswahl.
            </p>
          </div>
          {/* trust-Kurzblock: Plakette (verlinkt) + ein Satz */}
          <div className="mt-10 flex flex-col items-center gap-4 rounded-2xl border border-border bg-card p-6 text-center">
            <TrustEmblem size="sm" />
            <p className="text-sm leading-relaxed text-muted-foreground">
              onelane trust ist unser Versprechen an Ihre Familie: Wir übermitteln die Anfrage
              strukturiert, haken nach, wenn sich die Fahrschule nicht meldet — und helfen beim
              Wechsel, wenn es nicht passt.
            </p>
          </div>
        </section>

        {/* ================= Abschluss: CTA ================= */}
        <section aria-label="Gemeinsam vergleichen" className="mt-16 text-center sm:mt-20">
          <Link
            href="/fahrschulen"
            className={`inline-flex min-h-12 items-center gap-2 rounded-full bg-accent px-7 py-3 text-base font-semibold text-accent-foreground transition-colors duration-[var(--motion-duration-fast)] ease-[var(--motion-ease)] hover:bg-brand-lime ${focusRing}`}
          >
            Gemeinsam vergleichen
          </Link>
          <p className="mt-3 text-xs text-muted-foreground">kostenlos &amp; ohne Konto</p>
          <p className="mt-8 text-sm text-muted-foreground">
            Wie unsere Betreuung funktioniert:{" "}
            <Link
              href="/trust"
              className={`font-medium text-primary underline-offset-4 hover:underline ${focusRing} rounded-md`}
            >
              onelane trust
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}
