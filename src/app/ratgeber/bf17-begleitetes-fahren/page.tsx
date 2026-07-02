import Link from "next/link";
import { RatgeberArtikel, ratgeberMetadata } from "@/components/ratgeber/artikel";

/**
 * /ratgeber/bf17-begleitetes-fahren — Begleitetes Fahren ab 17 (SSR, indexierbar).
 * ----------------------------------------------------------------------------
 * Meta/Cover/Stand/Lesezeit kommen aus der Registry (src/lib/ratgeber.ts);
 * diese Datei liefert NUR die Prosa als Kinder der Shell. Inhalt: Was BF17 ist,
 * Ablauf (Prüfung ab 17, Fahren mit eingetragener Begleitperson bis 18),
 * Voraussetzungen der Begleitperson nach § 48a FeV, warum sich das Jahr lohnt,
 * Hinweis auf die Eltern-Seite. rechtsHinweis ist gesetzt, weil der Artikel
 * konkrete gesetzliche Anforderungen nennt; die § 48a-Angaben tragen zusätzlich
 * einen eigenen Stand-Vermerk im Fließtext (ohne Gewähr). Keine Preise, keine
 * Quoten, keine Erfolgsversprechen (§ 32 FahrlG, UWG).
 */
export const dynamic = "force-dynamic";

export const metadata = ratgeberMetadata("bf17-begleitetes-fahren");

export default function ArtikelPage() {
  return (
    <RatgeberArtikel slug="bf17-begleitetes-fahren" rechtsHinweis>
      <p>
        Mit 16 in der Fahrschule, mit 17 den Autoschlüssel in der Hand — für viele ist BF17
        längst der normale Weg zum Führerschein. Die Idee ist einfach: Du machst Ausbildung
        und Prüfung wie alle anderen, nur früher. Und bis zu deinem 18. Geburtstag fährst du
        nicht allein, sondern mit einer festen Begleitperson an deiner Seite. Was zuerst nach
        Einschränkung klingt, ist in Wahrheit ein entspannter Einstieg: ein ganzes Jahr
        Fahrpraxis, bevor du zum ersten Mal ohne Beifahrer unterwegs bist.
      </p>

      <h2>Was BF17 ist — und was nicht</h2>
      <p>
        BF17 steht für „Begleitetes Fahren ab 17“ und ist eine besondere Form der
        Fahrerlaubnis der Klasse B. An deiner Ausbildung ändert sich dadurch nichts: Du
        besuchst denselben Theorieunterricht, fährst dieselben Fahrstunden und Sonderfahrten
        und legst dieselben Prüfungen bei einer Prüforganisation wie TÜV oder DEKRA ab wie
        alle anderen auch.
      </p>
      <p>
        Der Unterschied kommt nach der bestandenen Prüfung: Statt des Kartenführerscheins
        bekommst du zunächst eine Prüfbescheinigung. Mit ihr darfst du Auto fahren —
        allerdings nur, wenn eine der Begleitpersonen mitfährt, die in deinem Antrag
        eingetragen sind. Ab deinem 18. Geburtstag entfällt diese Auflage, und aus der
        Bescheinigung wird der reguläre Führerschein.
      </p>
      <p>
        Gut zu wissen: Die Prüfbescheinigung gilt grundsätzlich nur in Deutschland. Wenn ihr
        eine Fahrt ins Ausland plant, klärt vorher mit eurer Führerscheinstelle, was dort
        erlaubt ist.
      </p>

      <h2>So läuft der Weg zu BF17 ab</h2>
      <p>
        Der Ablauf unterscheidet sich kaum vom klassischen Führerschein — du fängst nur
        früher an:
      </p>
      <ol>
        <li>
          <strong>Fahrschule aussuchen und anmelden.</strong> Mit der Ausbildung kannst du
          schon vor deinem 17. Geburtstag beginnen — wann der Einstieg für dich sinnvoll
          ist, besprichst du am besten direkt mit deiner Fahrschule.
        </li>
        <li>
          <strong>Antrag bei der Führerscheinstelle stellen.</strong> Hier beantragst du
          BF17 und benennst deine Begleitpersonen. Plane dafür Zeit ein — Behörden brauchen
          manchmal ein paar Wochen.
        </li>
        <li>
          <strong>Theorie und Praxis absolvieren.</strong> Unterricht, Fahrstunden,
          Sonderfahrten — alles wie bei der regulären Klasse B.
        </li>
        <li>
          <strong>Prüfungen ablegen.</strong> Erst die Theorie, dann die Praxis. Die
          praktische Prüfung ist rund um deinen 17. Geburtstag möglich — die genauen
          Fristen kennt deine Fahrschule.
        </li>
        <li>
          <strong>Losfahren — mit Begleitung.</strong> Nach bestandener Prüfung bekommst du
          die Prüfbescheinigung und darfst fahren, sobald eine eingetragene Begleitperson
          neben dir sitzt.
        </li>
      </ol>

      <h2>Wer als Begleitperson infrage kommt</h2>
      <p>
        Damit das Jahr mit Begleitung funktioniert, stellt der Gesetzgeber ein paar
        Anforderungen an die Menschen auf dem Beifahrersitz. Eine Begleitperson muss
        (§ 48a FeV, Stand: Juli 2026 — ohne Gewähr, verbindlich ist deine
        Führerscheinstelle):
      </p>
      <ul>
        <li>mindestens 30 Jahre alt sein,</li>
        <li>
          seit mindestens fünf Jahren ununterbrochen die Fahrerlaubnis der Klasse B
          besitzen und
        </li>
        <li>höchstens einen Punkt im Fahreignungsregister haben.</li>
      </ul>
      <p>
        Du kannst mehrere Begleitpersonen eintragen lassen — und das lohnt sich. Je mehr
        Menschen infrage kommen, etwa Eltern, ältere Geschwister oder Freunde der Familie,
        desto öfter kommst du tatsächlich zum Fahren. Klar ist auch: Wer dich begleitet,
        muss fahrtüchtig sein — für Begleitpersonen gelten während der Fahrt strenge
        Alkoholgrenzen.
      </p>
      <blockquote>
        <p>
          Die Begleitperson ist kein zweiter Fahrlehrer: Sie greift nicht ins Lenkrad, hat
          keine Pedale und muss nichts benoten. Ihre Aufgabe ist es, da zu sein — als
          ruhige, erfahrene Ansprechperson neben dir.
        </p>
      </blockquote>
      <p>
        Und noch etwas gehört zur Ehrlichkeit dazu: Ohne eingetragene Begleitperson zu
        fahren ist keine Kleinigkeit, sondern gefährdet deine Fahrerlaubnis. Das eine Mal
        „nur schnell rüber“ ist es nicht wert.
      </p>

      <h2>Warum sich das Jahr mit Begleitung lohnt</h2>
      <p>
        Fahren lernst du nicht in der Prüfung, sondern in den tausend Situationen danach:
        Regen auf der Landstraße, die enge Parkhaus-Spindel, dichter Berufsverkehr, die
        erste lange Autobahnfahrt. Genau dafür ist BF17 gedacht — du sammelst diese
        Erfahrungen, während jemand neben dir sitzt, der sie alle schon kennt.
      </p>
      <p>
        Nach der Fahrt könnt ihr in Ruhe besprechen, was gut lief und was sich komisch
        angefühlt hat. Routine entsteht durch Kilometer — und die fährst du in diesem Jahr
        unter deutlich entspannteren Bedingungen, als wenn du alles allein herausfinden
        müsstest.
      </p>
      <p>
        Ehrlich gesagt hängt der Nutzen aber davon ab, wie oft ihr wirklich zusammen
        fahrt. Ein Eintrag im Antrag allein macht dich nicht sicherer — nutzt das Jahr
        aktiv, auch für kurze Alltagsfahrten zum Einkaufen oder Training.
      </p>

      <h2>Was ihr zu Hause klären solltet</h2>
      <p>
        BF17 ist ein Stück weit ein Familienprojekt. Drei Dinge lohnt es sich früh zu
        besprechen:
      </p>
      <ul>
        <li>
          <strong>Wer wird eingetragen?</strong> Lieber eine Person mehr als eine zu wenig —
          nachtragen geht, kostet aber wieder einen Behördengang.
        </li>
        <li>
          <strong>Mit welchem Auto fährst du?</strong> Die Kfz-Versicherung des Wagens
          sollte Bescheid wissen. Ob und wie sich dadurch etwas am Vertrag ändert,
          beantwortet euch der Versicherer.
        </li>
        <li>
          <strong>Wann fahrt ihr regelmäßig?</strong> Feste Anlässe — der Wocheneinkauf,
          die Fahrt zu den Großeltern — sorgen dafür, dass aus dem Plan echte Praxis wird.
        </li>
      </ul>
      <p>
        Wenn deine Eltern noch Fragen haben — zu ihrer Rolle als Begleitperson, zum Ablauf
        oder dazu, wie sie dich sinnvoll unterstützen —, findest du auf unserer{" "}
        <Link href="/eltern">Seite für Eltern</Link> einen eigenen Überblick. Und falls du
        noch keine Fahrschule hast: Beim Blick auf die{" "}
        <Link href="/fahrschulen">Fahrschulen in deiner Nähe</Link> lohnt die Frage, wie
        eine Schule den Einstieg mit 16 oder 17 begleitet. Dann steht deinem Jahr auf dem
        Fahrersitz nichts mehr im Weg.
      </p>
    </RatgeberArtikel>
  );
}
