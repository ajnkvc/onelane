import Link from "next/link";
import { RatgeberArtikel, ratgeberMetadata } from "@/components/ratgeber/artikel";

/**
 * /ratgeber/was-der-fuehrerschein-kostet — Kosten-Guide (SSR, indexierbar):
 * erklärt die fünf Preis-Bausteine (Grundbetrag, Fahrstunde, Sonderfahrten je
 * Fahrtart, Vorstellung zur Theorie- und zur praktischen Prüfung), die
 * getrennten amtlichen Gebühren sowie die Einflussfaktoren auf den Endbetrag.
 * Meta/Cover/Stand/Lesezeit kommen aus der Registry (src/lib/ratgeber.ts);
 * diese Datei liefert NUR die Prosa als Kinder der Shell.
 *
 * EHRLICHKEIT (§ 32 FahrlG, UWG): bewusst OHNE Beträge, Spannen oder
 * Gesamtkosten-Schätzungen — der Artikel erklärt das System, nie die Höhe.
 * rechtsHinweis ist gesetzt, weil der Text gesetzliche Vorgaben (Preis-
 * bestandteile, B197) allgemein einordnet.
 */
export const dynamic = "force-dynamic";

export const metadata = ratgeberMetadata("was-der-fuehrerschein-kostet");

export default function ArtikelPage() {
  return (
    <RatgeberArtikel slug="was-der-fuehrerschein-kostet" rechtsHinweis>
      <p>
        „Und was kostet das jetzt alles?“ — kaum eine Frage hörst du vor der Anmeldung
        öfter, und kaum eine lässt sich schlechter mit einer einzigen Zahl beantworten.
        Nicht weil Fahrschulen mauern, sondern weil ein großer Teil des Preises erst
        während deiner Ausbildung entsteht: durch die Übungsstunden, die du wirklich
        brauchst.
      </p>
      <p>
        Die gute Nachricht: Das System dahinter ist überschaubar. Jeder Fahrschulpreis
        in Deutschland setzt sich aus denselben fünf Bausteinen zusammen. Wer sie einmal
        verstanden hat, kann jeden Preisaushang lesen, Angebote fair vergleichen — und
        merkt sofort, wenn ein Versprechen zu glatt klingt.
      </p>

      <h2>Warum ein Gesamtpreis vorab nicht seriös ist</h2>
      <p>
        Der größte Posten deiner Ausbildung sind die Fahrstunden — und wie viele du
        davon brauchst, weiß vor der ersten Fahrt niemand. Das hängt von deiner
        Vorerfahrung ab, davon, wie regelmäßig du übst, wie schnell du dich im Verkehr
        sicher fühlst und sogar davon, wo du fährst: Dichter Stadtverkehr will anders
        gelernt sein als Landstraße.
      </p>
      <p>
        Genau deshalb sieht das Gesetz vor, dass Fahrschulen ihre Entgelte nach
        einzelnen Bestandteilen ausweisen — nicht als Pauschale (Stand: Juli 2026; ohne
        Gewähr — verbindlich ist deine Fahrschule). Ein fester Endpreis vor der ersten
        Fahrstunde ist also keine Transparenz, sondern eine Wette. Und die geht selten
        zu deinen Gunsten aus: entweder über Aufschläge im Kleingedruckten oder über
        eine Kalkulation, die von Anfang an Luft für Enttäuschungen lässt.
      </p>
      <blockquote>
        <p>
          <strong>Merk dir:</strong> Wer dir vor der ersten Fahrstunde einen festen
          Gesamtpreis verspricht, verspricht etwas, das er noch gar nicht wissen kann.
        </p>
      </blockquote>

      <h2>Die fünf Bausteine, aus denen jeder Preis besteht</h2>
      <ul>
        <li>
          <strong>Grundbetrag.</strong> Fällt einmalig an und deckt die allgemeine
          Ausbildung ab — vor allem den Theorieunterricht und die Verwaltung deiner
          Ausbildung.
        </li>
        <li>
          <strong>Fahrstunde.</strong> Die normale Übungsfahrt, abgerechnet je Stunde à
          45 Minuten. Dieser Baustein multipliziert sich mit deinem Lernfortschritt —
          und ist damit der Teil, den du selbst am stärksten beeinflusst.
        </li>
        <li>
          <strong>Sonderfahrten.</strong> Gesetzlich vorgeschriebene Fahrten über Land,
          auf der Autobahn und bei Dunkelheit. Sie werden je Fahrtart einzeln
          ausgewiesen — ein Sammelposten „Sonderfahrten pauschal“ ist ein
          Warnsignal.
        </li>
        <li>
          <strong>Vorstellung zur Theorieprüfung.</strong> Das Entgelt der Fahrschule
          dafür, dich zur theoretischen Prüfung anzumelden und vorzustellen — fällt je
          Vorstellung an.
        </li>
        <li>
          <strong>Vorstellung zur praktischen Prüfung.</strong> Das Entgelt für den
          Prüfungstag selbst, inklusive des Fahrschulwagens, mit dem du zur Prüfung
          antrittst.
        </li>
      </ul>
      <p>
        Ein ehrlicher Preisaushang zeigt dir jeden dieser Bausteine einzeln. Erst aus
        ihnen ergibt sich am Ende dein persönlicher Betrag — je nachdem, wie viele
        Stunden und Prüfungsvorstellungen du tatsächlich gebraucht hast.
      </p>

      <h2>Dazu kommen amtliche Gebühren — getrennt vom Fahrschulpreis</h2>
      <p>
        Für die Prüfungen selbst zahlst du an die Prüforganisation, etwa TÜV oder
        DEKRA — diese Prüfgebühren sind gesetzlich geregelt und kein Teil des
        Fahrschulpreises. Auch die Führerscheinbehörde erhebt eigene Gebühren, zum
        Beispiel für deinen Antrag. Dazu kommen kleinere Posten wie Sehtest,
        Erste-Hilfe-Kurs und Passbilder. Nichts davon verhandelt die Fahrschule für
        dich — plane diese Positionen einfach von Anfang an mit ein, dann gibt es später
        keine Überraschung.
      </p>

      <h2>Was deinen Endbetrag wirklich beeinflusst</h2>
      <ul>
        <li>
          <strong>Dein Lernfortschritt.</strong> Der mit Abstand größte Hebel. Wer
          regelmäßig fährt, ohne lange Pausen dazwischen, kommt meist mit weniger
          Übungsstunden ans Ziel als jemand, dessen Ausbildung sich über viele Monate
          zieht.
        </li>
        <li>
          <strong>Deine Region.</strong> Fahrschulen kalkulieren mit ihren eigenen
          Kosten — Miete, Fahrzeuge, Personal. Die unterscheiden sich zwischen Großstadt
          und Land, und das spiegelt sich in den Bausteinen wider.
        </li>
        <li>
          <strong>Schaltung oder Automatik (B197).</strong> Bei B197 lernst du
          überwiegend auf Automatik und weist das Schalten in einer gesonderten
          Testfahrt nach — dein Führerschein bleibt dabei ohne Automatik-Beschränkung
          (Stand: Juli 2026; ohne Gewähr — verbindlich ist deine Führerscheinstelle).
          Für die Kosten heißt das: Es kommen andere Positionen ins Spiel. Lass dir
          zeigen, wie deine Fahrschule das im Preisverzeichnis abbildet.
        </li>
        <li>
          <strong>Deine Vorbereitung.</strong> Wer die Theorie parallel zum Fahren lernt
          statt kurz vor der Prüfung, ist auf der Straße schneller sicher — und braucht
          seltener eine zweite Vorstellung zur Prüfung, die jedes Mal erneut kostet.
        </li>
      </ul>

      <h2>Fazit: Vergleiche Bausteine, nicht Versprechen</h2>
      <p>
        Ein niedriger Grundbetrag sagt allein wenig, wenn andere Bausteine höher
        angesetzt sind. Aussagekräftig wird ein Vergleich erst, wenn du dieselben
        Bestandteile nebeneinanderlegst — Grundbetrag neben Grundbetrag, Fahrstunde
        neben Fahrstunde, Sonderfahrten je Fahrtart. Genau so zeigen wir es dir bei
        onelane: Auf <Link href="/fahrschulen">unserer Vergleichsseite</Link> siehst du
        die Preisbausteine je Fahrschule einzeln und mit Kennzeichnung, wie verlässlich
        die Angabe ist. Wie wir dabei sortieren, legen wir{" "}
        <Link href="/so-sortieren-wir">offen dar</Link>. Und weil der Preis ohnehin nur
        die halbe Entscheidung ist, lohnt sich danach ein Blick darauf,{" "}
        <Link href="/ratgeber/gute-fahrschule-erkennen">
          woran du eine gute Fahrschule erkennst
        </Link>
        .
      </p>
    </RatgeberArtikel>
  );
}
