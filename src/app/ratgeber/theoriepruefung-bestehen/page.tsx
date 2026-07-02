import Link from "next/link";
import { RatgeberArtikel, ratgeberMetadata } from "@/components/ratgeber/artikel";

/**
 * /ratgeber/theoriepruefung-bestehen — Ratgeber-Artikel „Theorieprüfung:
 * Verstehen schlägt Auswendiglernen" (SSR, indexierbar).
 * ----------------------------------------------------------------------------
 * Meta/Cover/Stand/Lesezeit kommen aus der Registry (src/lib/ratgeber.ts);
 * diese Datei liefert NUR die Prosa als Kinder der Shell
 * (components/ratgeber/artikel.tsx). Kapitel: Ablauf der Prüfung →
 * Warum Verstehen trägt → Lernstrategien → Stolperfallen → Nicht bestanden.
 *
 * EHRLICHKEIT (§ 32 FahrlG, UWG): keine konkreten Fragen-/Fehlerpunkt-Zahlen
 * oder Fristen (amtlich geregelt, änderbar) — nur das System erklären, mit
 * „Stand: Juli 2026"-Bezug und „ohne Gewähr"-Hinweis im Fließtext. Keine
 * Preise, keine Quoten, keine Erfolgsversprechen. TÜV/DEKRA nur neutral als
 * Prüforganisationen erwähnt.
 */
export const dynamic = "force-dynamic";

export const metadata = ratgeberMetadata("theoriepruefung-bestehen");

export default function ArtikelPage() {
  return (
    <RatgeberArtikel slug="theoriepruefung-bestehen">
      <p>
        Für viele ist die Theorieprüfung die erste richtige Prüfung außerhalb der Schule — und
        entsprechend groß ist der Respekt davor. Die gute Nachricht: Sie ist machbar, und zwar ohne
        durchgemachte Nächte über der Lern-App. Was es braucht, ist weniger Pauk-Marathon und mehr
        die richtige Herangehensweise. Hier liest du, wie die Prüfung abläuft, wie du so lernst,
        dass es wirklich sitzt — und warum ein nicht bestandener Versuch kein Weltuntergang ist.
      </p>

      <h2>So läuft die Theorieprüfung ab</h2>
      <p>
        <strong>Grundlage ist der amtliche Fragenkatalog.</strong> Er ist bundesweit einheitlich und
        wird regelmäßig aktualisiert — deshalb lohnt es sich, mit aktuellem Material zu lernen. Die
        Prüfung selbst legst du bei einer amtlich anerkannten Prüforganisation ab, in Deutschland je
        nach Region zum Beispiel TÜV oder DEKRA. Geprüft wird am Bildschirm: Du beantwortest eine
        Auswahl von Fragen aus dem Katalog, darunter auch Videofragen, bei denen du eine kurze
        Verkehrssituation beobachtest und anschließend dazu antwortest.
      </p>
      <p>
        Bewertet wird nach einem Fehlerpunkte-System: Jede Frage ist gewichtet, je nachdem, wie
        sicherheitsrelevant sie ist. Sammelst du zu viele oder zu schwerwiegende Fehler, ist die
        Prüfung nicht bestanden. Wie viele Fragen drankommen und welche Grenzen genau gelten, ist
        amtlich geregelt und kann sich ändern — den aktuellen Stand nennt dir deine Fahrschule
        (Stand: Juli 2026, ohne Gewähr — verbindlich sind deine Führerscheinstelle und deine
        Fahrschule). Zur Prüfung angemeldet wirst du über deine Fahrschule, sobald deine Ausbildung
        so weit ist. Das Ergebnis erfährst du direkt im Anschluss.
      </p>

      <h2>Warum Auswendiglernen allein nicht reicht</h2>
      <p>
        Der Fragenkatalog ist groß — zu groß, um ihn stumpf auswendig zu lernen, ohne dass unterwegs
        etwas durcheinandergerät. Vor allem aber prüfen viele Fragen nicht dein Gedächtnis, sondern
        dein Urteilsvermögen: Videofragen und Situationsbilder lassen sich kaum pauken, weil es aufs
        Erkennen der Lage ankommt. Wer verstanden hat, warum eine Regel existiert, kann die Antwort
        herleiten, statt sie erinnern zu müssen.
      </p>
      <blockquote>
        <p>
          Wer erklären kann, warum eine Regel gilt, muss ihre Antwort nicht auswendig wissen — und
          hat sie auch nach der Prüfung noch parat.
        </p>
      </blockquote>
      <p>
        Genau darum geht es: Die Theorie ist kein Hindernis auf dem Weg zum Führerschein, sondern
        das Fundament für die Fahrstunden und für jede Fahrt danach. Was du jetzt verstehst, musst
        du dir im Auto nicht mehr mühsam zusammenreimen.
      </p>

      <h2>Lernen, das wirklich trägt</h2>
      <p>
        Es gibt nicht die eine perfekte Methode — aber ein paar Prinzipien, die sich immer wieder
        bewähren:
      </p>
      <ul>
        <li>
          <strong>Regelmäßig statt Nachtschicht.</strong> Kurze Einheiten über Wochen verteilt
          bleiben hängen; eine Nacht vor der Prüfung verpufft. Plane lieber täglich eine kleine
          Portion ein als einmal pro Woche einen Kraftakt.
        </li>
        <li>
          <strong>Erst das Thema, dann die Fragen.</strong> Verschaffe dir zuerst ein Bild vom
          Kapitel — Vorfahrt, Abstand, Vorrang beim Abbiegen — und übe dann die Fragen dazu. Wer nur
          Antworten durchklickt, lernt Muster, keine Regeln.
        </li>
        <li>
          <strong>Den Alltag nutzen.</strong> Als Mitfahrer:in bist du mitten im Lehrmaterial:
          Erkläre dir Schilder, beobachte, wer warum wartet, und stelle dir vor, wie du entscheiden
          würdest. Das ist kostenloses Training mit echten Situationen.
        </li>
        <li>
          <strong>Eine Fehlerliste führen.</strong> Sammle die Fragen, die du falsch beantwortest,
          und wiederhole gezielt diese Themen — nicht immer wieder das, was du längst kannst.
        </li>
        <li>
          <strong>Den Unterricht aktiv nutzen.</strong> Der Theorieunterricht ist der Ort für deine
          Fragen. Eine gute Fahrschule erklärt, statt nur abzufragen —{" "}
          <Link href="/ratgeber/gute-fahrschule-erkennen">woran du sie erkennst</Link>, haben wir
          separat aufgeschrieben.
        </li>
      </ul>

      <h2>Typische Stolperfallen</h2>
      <ul>
        <li>
          <strong>Fragen nur überfliegen.</strong> Viele Fehler entstehen nicht aus Nichtwissen,
          sondern aus Hektik: Ein übersehenes „nicht“ dreht die ganze Frage um. Lies jede Frage und
          jede Antwortmöglichkeit zu Ende — niemand belohnt dich dafür, als Erste:r fertig zu sein.
        </li>
        <li>
          <strong>Nur im Prüfungsmodus üben.</strong> Simulationen sind eine gute Generalprobe, aber
          ein schlechter Startpunkt. Erst verstehen, dann üben, zuletzt simulieren.
        </li>
        <li>
          <strong>Videofragen unterschätzen.</strong> Schau die Situation konzentriert an, bevor du
          antwortest, und achte auf alle Verkehrsteilnehmer — nicht nur auf das, was direkt vor dem
          eigenen Fahrzeug passiert.
        </li>
        <li>
          <strong>Am Prüfungstag noch pauken.</strong> Was bis dahin nicht sitzt, kommt in der
          letzten Stunde nicht mehr dazu. Geh lieber ausgeschlafen und in Ruhe hin.
        </li>
      </ul>

      <h2>Nicht bestanden? Ärgerlich, aber kein Drama</h2>
      <p>
        Es passiert — und es sagt nichts darüber aus, ob aus dir ein guter Fahrer oder eine gute
        Fahrerin wird. Du darfst die Prüfung wiederholen, in der Regel nach einer kurzen Wartezeit;
        die Details dazu kennt deine Fahrschule. Wichtiger als der neue Termin ist die Auswertung:
        Welche Themen haben dich Punkte gekostet? Sprich das Ergebnis mit deiner Fahrlehrerin oder
        deinem Fahrlehrer durch und lerne gezielt dort nach, wo es gehakt hat — nicht einfach alles
        noch einmal von vorn.
      </p>
      <p>
        Und dann: durchatmen. Die Theorieprüfung ist eine Etappe, kein Urteil. Wenn du verstehst
        statt paukst, regelmäßig lernst und den Alltag als Übungsraum nutzt, hast du das Rüstzeug —
        für die Prüfung und für alles, was danach kommt. Wie es nach der Theorie weitergeht, liest
        du im Ratgeber zur{" "}
        <Link href="/ratgeber/praktische-pruefung-ablauf">praktischen Prüfung</Link>.
      </p>
    </RatgeberArtikel>
  );
}
