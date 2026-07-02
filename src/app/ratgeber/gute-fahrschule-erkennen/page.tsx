import Link from "next/link";
import { RatgeberArtikel, ratgeberMetadata } from "@/components/ratgeber/artikel";

/**
 * /ratgeber/gute-fahrschule-erkennen — Auswahl-Guide: Woran du eine gute
 * Fahrschule erkennst (SSR, indexierbar).
 * ----------------------------------------------------------------------------
 * Meta/Cover/Stand/Lesezeit kommen aus der Registry (src/lib/ratgeber.ts);
 * diese Datei liefert NUR die Prosa als Kinder der Shell. Fünf ehrliche
 * Prüfkriterien: Erreichbarkeit testen, vollständiger Preisaushang (alle
 * Bausteine schriftlich, amtliche Gebühren getrennt), Vertrags-Checkliste
 * (Kündigungsregeln, nach Leistung zahlen), Alltagstauglichkeit
 * (Theorie-Zeiten, Fahrzeuge, Sprachen), Kennenlernen ohne Unterschrift-Druck.
 *
 * EHRLICHKEIT (§ 32 FahrlG, UWG): zahlenlos — keine Preise, keine Quoten,
 * keine erfundenen Statistiken, kein Fahrschul-Bashing. Vertrags-/Rechtsbezug
 * → rechtsHinweis an der Shell (sichtbare „keine Rechtsberatung"-Zeile).
 */
export const dynamic = "force-dynamic";

export const metadata = ratgeberMetadata("gute-fahrschule-erkennen");

export default function ArtikelPage() {
  return (
    <RatgeberArtikel slug="gute-fahrschule-erkennen" rechtsHinweis>
      <p>
        Irgendwann steht die Frage im Raum: Welche Fahrschule soll es sein? Viele nehmen die,
        die am nächsten liegt — oder die, bei der schon Freunde waren. Das kann gut gehen, muss
        es aber nicht. Denn du verbringst dort viele Stunden, vertraust jemandem dein Lernen an,
        und es geht um spürbar viel Geld.
      </p>
      <p>
        Die gute Nachricht: Du brauchst kein Insiderwissen, um Qualität zu erkennen. Die
        wichtigsten Signale kannst du selbst prüfen — kostenlos, ohne Termin und lange bevor du
        irgendetwas unterschreibst.
      </p>

      <h2>Teste die Erreichbarkeit — bevor sie wichtig wird</h2>
      <p>
        Schreib der Fahrschule eine Nachricht oder ruf an, bevor du dich entscheidest. Nicht als
        Falle, sondern weil du so erlebst, wie sie mit dir umgeht, solange du noch gar nicht
        angemeldet bist. Kommt eine Antwort? Ist sie freundlich? Geht sie auf deine Frage ein
        oder bekommst du einen Standardsatz?
      </p>
      <p>
        Zur fairen Einordnung: Fahrlehrerinnen und Fahrlehrer sitzen den größten Teil des Tages
        im Auto. Dass niemand sofort ans Telefon geht, sagt wenig aus. Entscheidend ist, ob und
        wie sich jemand zurückmeldet. Genau diese Erreichbarkeit brauchst du nämlich später —
        wenn du eine Fahrstunde verschieben musst oder kurz vor der Prüfung eine Frage hast.
      </p>

      <h2>Der Preisaushang: alle Bausteine, schwarz auf weiß</h2>
      <p>
        Einen seriösen Gesamtpreis kann dir vorab niemand nennen — wie viele Fahrstunden du
        brauchst, entscheidet dein Lernfortschritt. Was eine gute Fahrschule dir aber immer
        zeigen kann: was welche einzelne Leistung kostet. Zum vollständigen Bild gehören:
      </p>
      <ul>
        <li>
          <strong>Grundbetrag</strong> — deckt den Theorieunterricht und die allgemeine
          Ausbildung ab.
        </li>
        <li>
          <strong>Preis je Fahrstunde</strong> — die normale Übungsfahrt.
        </li>
        <li>
          <strong>Sonderfahrten</strong> — Überland, Autobahn und Fahrten bei Dunkelheit, je
          Fahrtart einzeln ausgewiesen.
        </li>
        <li>
          <strong>Vorstellung zur Theorieprüfung</strong> und{" "}
          <strong>Vorstellung zur praktischen Prüfung</strong> — jeweils als eigene Position.
        </li>
      </ul>
      <p>
        Dazu kommen amtliche Gebühren für die Prüforganisation (etwa TÜV oder DEKRA) und die
        Führerscheinbehörde — sie sind kein Teil des Fahrschulpreises und werden getrennt
        fällig. Nennt dir jemand nur eine Pauschale nach dem Motto „alles inklusive“, frag nach
        den Einzelposten. Wie die Bausteine zusammenspielen, liest du ausführlich in{" "}
        <Link href="/ratgeber/was-der-fuehrerschein-kostet">
          Was der Führerschein wirklich kostet
        </Link>
        .
      </p>

      <h2>Der Vertrag: kurz lesen, lange profitieren</h2>
      <p>
        Bevor du unterschreibst, wirf einen ruhigen Blick in den Vertrag. Drei Punkte machen den
        Unterschied:
      </p>
      <ul>
        <li>
          <strong>Alle Bestandteile schriftlich.</strong> Grundbetrag, Fahrstunde, Sonderfahrten
          und Prüfungsentgelte stehen einzeln im Vertrag — nicht als Sammelposten versteckt.
        </li>
        <li>
          <strong>Kündigungsregeln verstehen.</strong> Was gilt, wenn du pausierst, umziehst
          oder wechseln möchtest? Ein fairer Vertrag beantwortet das, bevor die Frage überhaupt
          auftaucht.
        </li>
        <li>
          <strong>Nach Leistung zahlen.</strong> Zahle möglichst je erbrachter Leistung statt
          großer Summen im Voraus. So behältst du die Kontrolle — auch wenn sich deine Pläne
          ändern.
        </li>
      </ul>
      <p>
        Und falls es später doch nicht passt: Ein Wechsel ist möglich und kein Drama. Wie er
        ruhig gelingt, erklären wir in{" "}
        <Link href="/ratgeber/fahrschule-wechseln">Fahrschule wechseln</Link>.
      </p>

      <h2>Passt die Fahrschule in dein Leben?</h2>
      <p>
        Die beste Fahrschule nützt wenig, wenn ihr Unterricht ständig mit deinem Alltag
        kollidiert. Frag deshalb konkret nach:
      </p>
      <ul>
        <li>
          <strong>Theorie-Zeiten.</strong> Wann findet der Unterricht statt — und passt das zu
          Schule, Ausbildung oder Job? Gibt es kompakte Kurse, etwa in den Ferien?
        </li>
        <li>
          <strong>Fahrzeuge.</strong> Willst du auf Schaltung oder Automatik lernen? Und fühlst
          du dich in dem Fahrzeug wohl, mit dem du üben wirst?
        </li>
        <li>
          <strong>Sprachen.</strong> Wenn Deutsch nicht deine stärkste Sprache ist: Frag, ob
          Unterricht oder Lernmaterial auch in anderen Sprachen möglich sind.
        </li>
      </ul>
      <p>
        Frag außerdem offen nach Wartezeiten: Wie schnell bekommst du aktuell Termine für
        Fahrstunden? Eine ehrliche, realistische Antwort ist hier mehr wert als ein vollmundiges
        Versprechen.
      </p>

      <h2>Das Kennenlernen: Bauchgefühl ohne Unterschrift-Druck</h2>
      <p>
        Am Ende entscheidet auch das Gefühl. Geh vorbei, stell deine Fragen — und wenn es sich
        ergibt, lern die Person kennen, die dich später unterrichtet. Mit ihr verbringst du
        viele Stunden auf engem Raum, da darf die Chemie ruhig stimmen. Wenn deine Eltern
        mitentscheiden oder mitbezahlen, nimm sie einfach mit: Vier Augen sehen mehr als zwei,
        und für Eltern haben wir die wichtigsten Punkte unter{" "}
        <Link href="/eltern">onelane für Eltern</Link> zusammengestellt.
      </p>
      <blockquote>
        <p>
          Merk dir: Ein gutes Angebot hält eine Nacht Bedenkzeit aus. Nimm Preisaushang und
          Vertrag mit nach Hause und entscheide in Ruhe. Niemand muss beim ersten Besuch
          unterschreiben — und eine gute Fahrschule erwartet das auch nicht von dir.
        </p>
      </blockquote>
      <p>
        Wenn alle Punkte zusammenkommen — jemand meldet sich verlässlich, die Preise liegen
        vollständig schriftlich vor, der Vertrag ist fair, die Zeiten passen und das Gefühl
        stimmt —, hast du sehr wahrscheinlich eine gute Fahrschule gefunden. Für den Überblick
        davor kannst du auf onelane{" "}
        <Link href="/fahrschulen">Fahrschulen in deiner Stadt vergleichen</Link>: Unsere
        Sortierung ist <Link href="/so-sortieren-wir">transparent erklärt</Link> und nicht
        kaufbar — keine Fahrschule kann sich bei uns nach oben bezahlen.
      </p>
    </RatgeberArtikel>
  );
}
