import Link from "next/link";
import { RatgeberArtikel, ratgeberMetadata } from "@/components/ratgeber/artikel";

/**
 * /ratgeber/fahrschule-wechseln — Wechsel-Guide: ruhig und geordnet statt
 * Drama (SSR, indexierbar).
 * ----------------------------------------------------------------------------
 * Meta/Cover/Stand/Lesezeit kommen aus der Registry (src/lib/ratgeber.ts);
 * diese Datei liefert NUR die Prosa als Kinder der Shell
 * (components/ratgeber/artikel.tsx). Kapitel: Wechselgründe (Funkstille,
 * keine Termine, kein Vertrauen) → erst das Gespräch suchen → Schritte
 * (Vertrag lesen, Ausbildungsnachweis sichern, neue Schule finden, offen
 * ankommen) → Fortschritt bleibt erhalten → trust-Brücke.
 *
 * EHRLICHKEIT (§ 32 FahrlG, UWG): zahlenlos — keine Preise, keine Fristen,
 * keine Quoten, keine Versprechen. Vertrags-/Rechtsthema → rechtsHinweis an
 * der Shell (sichtbare Zeile); die konkrete Sachaussage zum Ausbildungsstand
 * trägt zusätzlich ihren eigenen „ohne Gewähr"-Bezug im Fließtext.
 */
export const dynamic = "force-dynamic";

export const metadata = ratgeberMetadata("fahrschule-wechseln");

export default function ArtikelPage() {
  return (
    <RatgeberArtikel slug="fahrschule-wechseln" rechtsHinweis>
      <p>
        Vielleicht kennst du das: Du schreibst deiner Fahrschule, wartest — und nichts
        passiert. Oder du bekommst seit Wochen keine Fahrstunde, während deine Motivation
        langsam verpufft. Irgendwann steht die Frage im Raum: Soll ich wechseln?
      </p>
      <p>
        Die kurze Antwort: Du darfst. Ein Fahrschulwechsel ist nichts Ungewöhnliches und
        kein Scheitern — er will nur gut vorbereitet sein. Hier erfährst du, wann ein
        Wechsel sinnvoll sein kann, welche Schritte dazugehören und was mit deinem
        bisherigen Fortschritt passiert.
      </p>

      <h2>Wann ein Wechsel sinnvoll sein kann</h2>
      <p>
        Nicht jede Unzufriedenheit ist gleich ein Wechselgrund. Eine verschobene Stunde
        oder eine volle Warteliste in den Ferien kann überall passieren. Es gibt aber
        Situationen, in denen du deine Entscheidung ernsthaft prüfen solltest:
      </p>
      <ul>
        <li>
          <strong>Funkstille:</strong> Deine Nachrichten und Anrufe bleiben über längere
          Zeit unbeantwortet, und niemand fühlt sich für dich zuständig.
        </li>
        <li>
          <strong>Keine Termine, keine Perspektive:</strong> Du bekommst dauerhaft keine
          Fahrstunden — und auf Nachfrage keine ehrliche Auskunft, wann sich das ändert.
        </li>
        <li>
          <strong>Kein Vertrauen:</strong> Du fühlst dich im Auto nicht ernst genommen,
          wirst kleingeredet oder traust dich nicht mehr, Fragen zu stellen.
        </li>
        <li>
          <strong>Nur eine Nummer:</strong> Niemand kennt deinen Ausbildungsstand, und
          jede Stunde fühlt sich an, als würdest du bei null anfangen.
        </li>
      </ul>
      <blockquote>
        <p>
          Lernen braucht Vertrauen. Wenn du dich über Monate eher verwaltet als
          ausgebildet fühlst, ist das ein legitimer Grund, dich umzusehen.
        </p>
      </blockquote>

      <h2>Erst das Gespräch suchen</h2>
      <p>
        Bevor du kündigst, lohnt sich ein offenes Gespräch — nicht zwischen Tür und
        Angel, sondern in Ruhe. Sag konkret, was dich stört, und was du dir wünschst.
        Vieles lässt sich intern lösen: eine andere Fahrlehrerin oder ein anderer
        Fahrlehrer, andere Zeiten, ein klarer Plan für die nächsten Wochen.
      </p>
      <p>
        Bleibt danach alles beim Alten, hast du deine Antwort — und kannst mit gutem
        Gewissen gehen. Du schuldest niemandem eine endlose zweite Chance.
      </p>

      <h2>Schritt für Schritt: So läuft der Wechsel</h2>
      <ol>
        <li>
          <strong>Vertrag lesen.</strong> Schau in deinen Ausbildungsvertrag: Wie ist die
          Kündigung geregelt, und wie werden bereits erbrachte Leistungen abgerechnet?
          Üblicherweise bezahlst du, was du tatsächlich in Anspruch genommen hast — die
          Details stehen in deinem Vertrag. Kündige am besten schriftlich, damit alles
          nachvollziehbar bleibt.
        </li>
        <li>
          <strong>Ausbildungsnachweis mitnehmen.</strong> Lass dir eine Bescheinigung
          über deine bisherige Ausbildung geben — besuchte Theoriestunden, gefahrene
          Übungsstunden, Sonderfahrten. Dieses Dokument ist dein Gedächtnis für die neue
          Fahrschule.
        </li>
        <li>
          <strong>Neue Fahrschule in Ruhe auswählen.</strong> Diesmal weißt du genauer,
          worauf es dir ankommt: Erreichbarkeit, Terminlage, Umgangston. Bei{" "}
          <Link href="/fahrschulen">unserem Fahrschulvergleich</Link> siehst du die
          Schulen in deiner Nähe im Überblick — und woran du Qualität erkennst, liest du
          im Guide{" "}
          <Link href="/ratgeber/gute-fahrschule-erkennen">
            „Woran du eine gute Fahrschule erkennst“
          </Link>
          .
        </li>
        <li>
          <strong>Offen ins erste Gespräch gehen.</strong> Erzähl ehrlich, warum du
          wechselst und wo du gerade stehst. Eine gute Fahrschule hört zu, statt zu
          urteilen — und verschafft sich in den ersten Stunden ein eigenes Bild von
          deinem Können.
        </li>
      </ol>

      <h2>Dein Fortschritt geht nicht verloren</h2>
      <p>
        Die größte Sorge beim Wechsel ist meist: Muss ich von vorn anfangen? In aller
        Regel nicht. Deine besuchten Theoriestunden und dein Ausbildungsstand sind
        dokumentiert und können bei der neuen Fahrschule berücksichtigt werden; auch dein
        Antrag bei der Führerscheinstelle hängt nicht an einer bestimmten Fahrschule
        (Stand: Juli 2026, ohne Gewähr — verbindlich ist die Auskunft deiner
        Führerscheinstelle und deiner Fahrschule).
      </p>
      <p>
        Rechne trotzdem mit einer kurzen Eingewöhnung: Deine neue Fahrlehrerin oder dein
        neuer Fahrlehrer möchte dich erst einmal kennenlernen und einschätzen, bevor es
        Richtung Prüfung geht. Das ist keine Schikane, sondern Sorgfalt — und am Ende
        fährst du damit sicherer.
      </p>

      <h2>Du musst das nicht allein stemmen</h2>
      <p>
        Ein Wechsel fühlt sich leichter an, wenn jemand an deiner Seite bleibt. Genau
        dafür gibt es <Link href="/trust">onelane trust</Link>: unser Versprechen, dich
        nicht nur bis zur Anmeldung zu begleiten, sondern auch dann, wenn unterwegs etwas
        hakt. Melde dich, wenn du beim Wechsel Fragen hast oder nicht weiterkommst — wir
        hören zu und helfen dir, den nächsten Schritt zu sortieren.
      </p>
      <p>
        Kurz gesagt: Wechseln ist keine Niederlage, sondern eine Entscheidung für deine
        Ausbildung. Klär deinen Vertrag, sichere deinen Ausbildungsnachweis, such dir in
        Ruhe eine Schule, bei der es menschlich und organisatorisch passt — und dann:
        weiterfahren.
      </p>
    </RatgeberArtikel>
  );
}
