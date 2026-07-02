import Link from "next/link";
import { RatgeberArtikel, ratgeberMetadata } from "@/components/ratgeber/artikel";

/**
 * /ratgeber/fuehrerscheinklassen-ueberblick — Klassen-Überblick (SSR, indexierbar).
 * ----------------------------------------------------------------------------
 * Meta/Cover/Stand/Lesezeit kommen aus der Registry (src/lib/ratgeber.ts);
 * diese Datei liefert NUR die Prosa als Kinder der Shell. Inhalt: die gängigen
 * Klassen verständlich erklärt — B (Pkw), B197 (Automatik lernen, Schaltwagen
 * fahren dürfen, ohne Automatik-Eintrag), B96/BE (Anhänger), AM (Roller) und
 * die Motorrad-Stufen A1/A2/A — je Klasse Alltagsnutzen + für wen sinnvoll,
 * am Ende die Brücke zum Klassen-Filter der Fahrschulsuche. rechtsHinweis ist
 * gesetzt, weil der Artikel konkrete amtliche Angaben (Mindestalter, Gewichts-
 * und Leistungsgrenzen) nennt; zusätzlich trägt der Einstieg einen eigenen
 * Stand-Vermerk im Fließtext (ohne Gewähr). Keine Preise, keine Quoten, keine
 * Erfolgsversprechen (§ 32 FahrlG, UWG).
 */
export const dynamic = "force-dynamic";

export const metadata = ratgeberMetadata("fuehrerscheinklassen-ueberblick");

export default function ArtikelPage() {
  return (
    <RatgeberArtikel slug="fuehrerscheinklassen-ueberblick" rechtsHinweis>
      <p>
        Auf dem Antrag bei der Führerscheinstelle sieht die Klassenliste aus wie
        Buchstabensuppe: B, B96, BE, A1, AM, dazu Schlüsselzahlen wie 197. Die gute
        Nachricht: Für die meisten ist die Antwort ziemlich einfach. Trotzdem lohnt der
        Überblick — denn manche Klasse steckt schon in einer anderen drin, manche lässt
        sich später unkompliziert erweitern, und eine Entscheidung wie B197 triffst du am
        besten, bevor die erste Fahrstunde beginnt. Alle Alters-, Gewichts- und
        Leistungsangaben hier: Stand Juli 2026, ohne Gewähr — was für dich verbindlich
        gilt, klären deine Führerscheinstelle und deine Fahrschule.
      </p>

      <h2>Klasse B: der Klassiker fürs Auto</h2>
      <p>
        Klasse B ist der ganz normale Autoführerschein — und der Grund, warum die meisten
        überhaupt eine Fahrschule suchen. Sie gilt für Pkw bis 3,5 Tonnen zulässiger
        Gesamtmasse, also praktisch alles vom Kleinwagen bis zum großen Van, und erlaubt
        zusätzlich einen kleinen Anhänger bis 750 Kilogramm. Das Mindestalter liegt bei
        18 Jahren — oder bei 17, wenn du mit{" "}
        <Link href="/ratgeber/bf17-begleitetes-fahren">BF17</Link> startest und bis zur
        Volljährigkeit begleitet fährst.
      </p>
      <p>
        Praktisch zu wissen: Die Rollerklasse AM ist in B enthalten. Wer den
        Autoführerschein macht, muss fürs Mofa oder den 45-km/h-Roller also nichts extra
        beantragen.
      </p>

      <h2>B197: Automatik lernen, Schaltwagen fahren dürfen</h2>
      <p>
        B197 ist keine eigene Klasse, sondern ein anderer Weg zur Klasse B. Du lernst und
        prüfst auf einem Automatikauto — was viele gerade im Stadtverkehr als entspannter
        empfinden, weil Kuppeln und Anfahren am Berg wegfallen. Damit trotzdem kein
        Automatik-Eintrag im Führerschein landet, fährst du während der Ausbildung
        zusätzlich einige Fahrstunden auf einem Schaltwagen und zeigst in einer kurzen
        Testfahrt mit deiner Fahrschule, dass du das Schalten beherrschst. Die Prüfung
        selbst legst du dann auf dem Automatikfahrzeug ab.
      </p>
      <p>
        Das Ergebnis: ein Führerschein mit der Schlüsselzahl 197, mit dem du beides fahren
        darfst — Automatik und Schaltwagen. Sinnvoll ist das für alle, die absehbar
        Automatik oder E-Auto fahren, sich den Schaltwagen aber offenhalten wollen, etwa
        für den Familienwagen oder das Mietauto im Urlaub. Frag vorher nach, ob deine
        Wunschfahrschule Automatikfahrzeuge im Fuhrpark hat — das ist noch nicht überall
        selbstverständlich.
      </p>
      <blockquote>
        <p>
          Der Unterschied in einem Satz: Eine reine Automatik-Ausbildung führt zu einem
          Automatik-Eintrag — dann ist der Schaltwagen tabu. B197 vermeidet genau das.
        </p>
      </blockquote>

      <h2>Anhänger: B96 und BE</h2>
      <p>
        Der kleine Anhänger bis 750 Kilogramm ist bei Klasse B schon dabei. Wird die
        Kombination schwerer, gibt es zwei Stufen:
      </p>
      <ul>
        <li>
          <strong>B96</strong> ist keine eigene Klasse, sondern eine kompakte Schulung bei
          der Fahrschule — ohne Prüfung. Danach darfst du Gespanne bis 4,25 Tonnen
          zulässiger Gesamtmasse fahren. Das reicht oft für den mittleren Wohnwagen oder
          einen größeren Transportanhänger.
        </li>
        <li>
          <strong>BE</strong> ist die eigene Anhängerklasse mit praktischer Ausbildung und
          praktischer Prüfung (eine zusätzliche Theorieprüfung gibt es nicht). Sie erlaubt
          Anhänger bis 3,5 Tonnen hinter dem Pkw — die Wahl für Pferdeanhänger, große
          Wohnwagen oder den Maschinentransport im Handwerk.
        </li>
      </ul>
      <p>
        Für wen lohnt sich was? Wenn du nur gelegentlich etwas Sperriges ziehst, reicht B
        oft schon. Steht ein konkreter Anhänger vor der Tür, hilft ein Blick in dessen
        Papiere — und das Gespräch mit der Fahrschule, ob B96 genügt oder es BE sein muss.
      </p>

      <h2>Zwei Räder: AM, A1, A2 und A</h2>
      <p>
        Beim Motorrad führt der Weg über Stufen — je nach Alter und Erfahrung:
      </p>
      <ul>
        <li>
          <strong>AM (ab 15):</strong> Roller und Mopeds bis 45 km/h. Für viele die erste
          eigene Mobilität, gerade auf dem Land, wo der Bus zweimal am Tag fährt. Wer
          später Klasse B macht, hat AM automatisch mit drin.
        </li>
        <li>
          <strong>A1 (ab 16):</strong> Leichtkrafträder bis 125 cm³. Der Einstieg ins
          echte Motorradfahren — flott genug für Landstraße und Alltag, aber mit
          überschaubarer Leistung.
        </li>
        <li>
          <strong>A2 (ab 18):</strong> Motorräder mit begrenzter Leistung. Die Klasse für
          alle, die richtig Motorrad fahren wollen, ohne gleich in der offenen Klasse zu
          starten.
        </li>
        <li>
          <strong>A:</strong> die offene Klasse ohne Leistungsgrenze. Direkt einsteigen
          kannst du erst ab 24 — oder du steigst nach zwei Jahren A2 mit einer praktischen
          Prüfung auf. Dieser Stufenweg ist der übliche: Du wächst mit der Maschine mit.
        </li>
      </ul>
      <p>
        Übrigens: Wer den B-Führerschein schon länger besitzt, kann unter bestimmten
        Voraussetzungen über eine Fahrerschulung (Schlüsselzahl B196) auf 125er-Maschinen
        erweitern — ohne eigene Prüfung, allerdings nur in Deutschland gültig. Ob das für
        dich infrage kommt, weiß deine Fahrschule.
      </p>

      <h2>So findest du deine Klasse</h2>
      <p>Am Ende helfen drei ehrliche Fragen mehr als jede Tabelle:</p>
      <ul>
        <li>
          <strong>Was willst du in den nächsten Jahren wirklich fahren?</strong> Nicht,
          was irgendwann mal spannend wäre — erweitern kannst du später immer noch.
        </li>
        <li>
          <strong>Reicht dir Automatik im Alltag?</strong> Dann ist B197 einen genauen
          Blick wert, weil du dir den Schaltwagen trotzdem offenhältst.
        </li>
        <li>
          <strong>Hängt regelmäßig etwas hinten dran?</strong> Dann sprich früh über B96
          oder BE — manches lässt sich direkt mit der B-Ausbildung verbinden.
        </li>
      </ul>
      <p>
        Was die Ausbildung kostet, hängt unter anderem von der Klasse und deinem Übungsbedarf
        ab — aus welchen Bausteinen sich jeder Preisaushang zusammensetzt, erklären wir im
        Artikel{" "}
        <Link href="/ratgeber/was-der-fuehrerschein-kostet">
          zu den Führerschein-Kosten
        </Link>
        . Und wenn du weißt, welche Klasse es werden soll: Nicht jede Fahrschule bildet in
        jeder Klasse aus. In unserer <Link href="/fahrschulen">Fahrschulsuche</Link> kannst
        du deshalb gezielt nach Klassen filtern — so siehst du von Anfang an nur Schulen,
        die zu deinem Plan passen.
      </p>
    </RatgeberArtikel>
  );
}
