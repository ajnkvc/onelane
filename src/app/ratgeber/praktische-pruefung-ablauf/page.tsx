import Link from "next/link";
import { RatgeberArtikel, ratgeberMetadata } from "@/components/ratgeber/artikel";

/**
 * /ratgeber/praktische-pruefung-ablauf — Die praktische Prüfung: Ablauf,
 * Nerven, Plan B (SSR, indexierbar).
 * ----------------------------------------------------------------------------
 * Erklärt ehrlich, was am Prüfungstag passiert (Prüfer:in von TÜV oder DEKRA
 * fährt mit, Fahrlehrer:in sitzt wie immer daneben, Grundfahraufgaben +
 * Alltagsverkehr), wie man mit Nervosität umgeht (Routinen, Schlaf, „normale
 * Fahrstunde mit Gast") und warum ein nicht bestandener Versuch kein
 * Weltuntergang ist. Meta/Cover/Stand/Lesezeit kommen aus der Registry
 * (src/lib/ratgeber.ts); diese Datei liefert NUR die Prosa als Kinder der
 * Shell.
 *
 * EHRLICHKEIT (§ 32 FahrlG, UWG): zahlenlos — keine Preise, keine Quoten,
 * keine Fristen, keine Erfolgsversprechen. Details zum Ablauf klären
 * Fahrschule und Prüforganisation verbindlich.
 */
export const dynamic = "force-dynamic";

export const metadata = ratgeberMetadata("praktische-pruefung-ablauf");

export default function ArtikelPage() {
  return (
    <RatgeberArtikel slug="praktische-pruefung-ablauf">
      <p>
        Der Termin steht, und plötzlich fühlt sich alles größer an, als es ist: die praktische
        Prüfung. Dabei hilft gegen die Aufregung vor allem eines — genau zu wissen, was an diesem
        Tag passiert. Denn das meiste kennst du längst aus deinen ganz normalen Fahrstunden. Neu
        ist eigentlich nur eine Person im Auto.
      </p>

      <h2>Wer sitzt im Auto — und was passiert wann</h2>
      <p>
        <strong>Die Sitzordnung bleibt vertraut.</strong> Du sitzt am Steuer, deine Fahrlehrerin
        oder dein Fahrlehrer sitzt wie in jeder Fahrstunde daneben. Dazu kommt eine Prüferin oder
        ein Prüfer einer amtlich anerkannten Prüforganisation — in Deutschland sind das je nach
        Region TÜV oder DEKRA. Diese Person sagt dir während der Fahrt an, wo es langgeht, und
        beobachtet, wie sicher und selbstständig du unterwegs bist.
      </p>
      <p>
        Der Ablauf folgt einem klaren Muster: Zuerst werden deine Unterlagen geprüft, oft folgen
        ein paar Fragen zur Technik oder eine kurze Abfahrtkontrolle — etwa Licht, Reifen oder
        Flüssigkeitsstände. Dann fährst du: durch den Alltagsverkehr in der Stadt, meist auch über
        Land, je nach Strecke und Klasse auch ein Stück Schnellstraße oder Autobahn. Dazu kommen
        die Grundfahraufgaben, die du aus der Ausbildung kennst — zum Beispiel Einparken,
        Rückwärtsfahren oder die Gefahrbremsung. Am Ende sagt dir die Prüferin oder der Prüfer
        direkt, ob du bestanden hast.
      </p>
      <p>
        Wichtig zu wissen: Es werden keine Fallen gestellt. Geprüft wird genau das, was du in den
        Fahrstunden geübt hast — Alltagssituationen, keine Kunststücke.
      </p>

      <h2>Nervosität ist normal — und machbar</h2>
      <p>
        Fast alle sind vor der praktischen Prüfung aufgeregt, egal ob mit siebzehn oder als
        Erwachsene:r, die den Führerschein später nachholt. Das ist kein Zeichen, dass etwas nicht
        stimmt — dein Körper nimmt den Termin ernst. Entscheidend ist, dass die Anspannung dich
        nicht blockiert. Dabei helfen erstaunlich unspektakuläre Dinge:
      </p>
      <ul>
        <li>
          <strong>Schlaf schlägt Lernen.</strong> Am Abend vorher bringt eine ruhige Nacht mehr
          als jede Extra-Runde Grübeln über mögliche Strecken.
        </li>
        <li>
          <strong>Routinen beibehalten.</strong> Iss und trink wie sonst auch, zieh Schuhe an, in
          denen du schon gefahren bist, und plane genug Zeit für den Weg zum Treffpunkt ein.
        </li>
        <li>
          <strong>Vorher einfahren.</strong> Viele Fahrschulen legen direkt vor die Prüfung eine
          Fahrstunde — so kommst du schon warm und im Fahr-Modus an.
        </li>
        <li>
          <strong>Fehler einplanen.</strong> Du musst nicht perfekt fahren. Kleine Unsauberkeiten
          gehören dazu — es zählt, dass du sicher, aufmerksam und selbstständig unterwegs bist.
        </li>
      </ul>
      <blockquote>
        <p>
          Die praktische Prüfung ist eine ganz normale Fahrstunde — nur mit einem Gast an Bord.
        </p>
      </blockquote>
      <p>
        Dieser Satz ist mehr als ein Trostpflaster: Die Prüferin oder der Prüfer will sehen, dass
        du im echten Verkehr zurechtkommst — nicht, dich scheitern lassen. Wenn du einen Moment
        unsicher bist, atme durch und fahr weiter. Eine korrigierte Entscheidung wirkt souveräner
        als hektisches Festhalten am ersten Impuls.
      </p>

      <h2>Nicht bestanden? Dein Plan B</h2>
      <p>
        Manchmal reicht es beim ersten Versuch nicht — wegen eines Fehlers, der an diesem Tag
        einfach passiert ist, oder weil die Nerven doch stärker waren. Das fühlt sich im ersten
        Moment bitter an, ändert aber nichts an dem, was du kannst: Deine Ausbildung, deine
        bestandene Theorie und deine Fahrpraxis bleiben. Du wiederholst nur die Prüfungsfahrt,
        nicht den ganzen Weg dorthin.
      </p>
      <p>
        Der sinnvollste nächste Schritt: das Feedback ernst nehmen. Die Prüferin oder der Prüfer
        benennt am Ende, woran es lag — und genau daran arbeitest du mit deiner Fahrschule
        gezielt weiter, statt pauschal alles noch einmal zu üben. Den neuen Termin stimmt deine
        Fahrschule mit dir und der Prüforganisation ab. Und falls du dich fragst, ob das nur dir
        passiert: nein. Du bist damit in guter Gesellschaft, auch wenn darüber seltener geredet
        wird als über bestandene Prüfungen. Wie du übrigens schon die Theorie so angehst, dass sie
        dich auch in der Praxis trägt, liest du im Guide{" "}
        <Link href="/ratgeber/theoriepruefung-bestehen">
          Theorieprüfung: Verstehen schlägt Auswendiglernen
        </Link>
        .
      </p>

      <h2>Was du von deiner Fahrschule erwarten darfst</h2>
      <p>
        Eine gute Fahrschule schickt dich erst in die Prüfung, wenn sie dich ehrlich für
        prüfungsreif hält — und sagt dir genauso ehrlich, wenn du noch nicht so weit bist. Beides
        ist ein Zeichen von Qualität: Ein zu früher Termin kostet dich Nerven und einen Versuch,
        unnötiges Hinauszögern kostet Vertrauen. Du darfst deshalb erwarten, dass deine Fahrschule
        deinen Stand offen mit dir bespricht, Prüfungssituationen vorher mit dir durchspielt und
        deine Fragen zum Ablauf ohne Ausweichen beantwortet. Woran du eine solche Fahrschule schon
        vor der Anmeldung erkennst, zeigt dir der Guide{" "}
        <Link href="/ratgeber/gute-fahrschule-erkennen">
          Woran du eine gute Fahrschule erkennst
        </Link>
        .
      </p>

      <h2>Kurz gesagt</h2>
      <p>
        Die praktische Prüfung ist kein Mysterium: vertraute Sitzordnung, vertraute Aufgaben, eine
        zusätzliche Person, die zusieht. Gegen die Nerven helfen Schlaf, Routinen und der Gedanke,
        dass du nur zeigen musst, was du längst kannst. Und wenn es beim ersten Mal nicht klappt,
        ist das ein Umweg — kein Urteil. Mit einer Fahrschule, die deine Prüfungsreife ehrlich
        einschätzt, gehst du diesen Tag so an, wie er gemeint ist: als letzte Fahrstunde vor dem
        Führerschein.
      </p>
    </RatgeberArtikel>
  );
}
