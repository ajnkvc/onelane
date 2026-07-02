import Link from "next/link";
import { RatgeberArtikel, ratgeberMetadata } from "@/components/ratgeber/artikel";

/**
 * /ratgeber/fahrlehrer-werden — Karriere-Guide: Quereinstieg in den
 * Fahrlehrer-Beruf (SSR, indexierbar).
 * ----------------------------------------------------------------------------
 * Meta/Cover/Stand/Lesezeit kommen aus der Registry (src/lib/ratgeber.ts);
 * diese Datei liefert NUR die Prosa als Kinder der Shell
 * (components/ratgeber/artikel.tsx). Kapitel: Berufsbild + Nachfrage →
 * Voraussetzungen (Mindestalter, Führerschein-Vorbesitz, Vorbildung, Eignung)
 * → Ausbildungsweg (Ausbildungsstätte, Lehrpraktikum, Prüfungen) →
 * Finanzierung über Fahrschulen (Bindungsvereinbarung, als Möglichkeit) →
 * Brücke zu /jobs.
 *
 * EHRLICHKEIT (§ 32 FahrlG, UWG): keine Preise/Beträge, keine erfundenen
 * Quoten oder Marktzahlen, keine Job- oder Erfolgsgarantien. Gesetzliche
 * Eckpunkte (Mindestalter, Vorbesitz, Ausbildungsdauer) nur allgemein und im
 * Fließtext mit eigenem „Stand: Juli 2026"-/ohne-Gewähr-Bezug; Vertrags- und
 * Rechtsthema (Bindungsvereinbarung) → rechtsHinweis an der Shell.
 */
export const dynamic = "force-dynamic";

export const metadata = ratgeberMetadata("fahrlehrer-werden");

export default function ArtikelPage() {
  return (
    <RatgeberArtikel slug="fahrlehrer-werden" rechtsHinweis>
      <p>
        Es gibt Berufe, in die man hineinrutscht — und Berufe, die man sich irgendwann
        bewusst aussucht. Fahrlehrer:in gehört fast immer zur zweiten Sorte: Kaum jemand
        plant das mit 16, viele kommen später dazu — aus dem Handwerk, aus dem Büro, aus
        der Logistik. Und genau das ist die gute Nachricht: Der Weg in den Beruf ist ein
        klassischer Quereinstieg, mit klaren Voraussetzungen und einer geregelten
        Ausbildung.
      </p>
      <p>
        Hier liest du, was den Beruf ausmacht, welche Voraussetzungen grob gelten, wie
        die Ausbildung abläuft — und warum sich ein offenes Gespräch mit einer
        Fahrschule über die Finanzierung lohnen kann.
      </p>

      <h2>Was den Beruf ausmacht — und warum er gefragt ist</h2>
      <p>
        Fahrlehrer:in sein heißt nicht in erster Linie Auto fahren. Es heißt: Menschen
        begleiten. Neben dir sitzt jemand, der zum ersten Mal im Feierabendverkehr
        unterwegs ist — nervös, unsicher, manchmal kurz vorm Aufgeben. Deine Aufgabe ist
        es, aus dieser Unsicherheit Schritt für Schritt Können zu machen. Das ist
        Pädagogik im Alltag, mit echter Verantwortung: Du bildest Menschen für den
        Straßenverkehr aus, und was du ihnen mitgibst, fährt ein Leben lang mit.
      </p>
      <p>
        Dazu kommt die Lage am Markt: In vielen Regionen suchen Fahrschulen länger nach
        Fahrlehrer:innen, als ihnen lieb ist — auch, weil in den kommenden Jahren viele
        erfahrene Kolleg:innen in den Ruhestand gehen. Ein Versprechen auf einen
        bestimmten Arbeitsplatz ist das nicht. Aber es heißt: Wer die Ausbildung
        durchzieht, startet aus einer guten Position — mit Auswahl beim Arbeitgeber und
        später, wenn du magst, sogar mit der Option auf eine eigene Fahrschule.
      </p>

      <h2>Die Voraussetzungen: Das solltest du mitbringen</h2>
      <p>
        Wer Fahrlehrer:in werden darf, ist gesetzlich geregelt. Für die
        Fahrlehrerlaubnis der Klasse BE — also für die klassische Pkw-Ausbildung —
        gelten grob diese Eckpunkte (Stand: Juli 2026, ohne Gewähr — verbindlich ist
        die Auskunft der zuständigen Behörde und deiner Ausbildungsstätte):
      </p>
      <ul>
        <li>
          <strong>Mindestalter:</strong> Du musst mindestens 21 Jahre alt sein.
        </li>
        <li>
          <strong>Führerschein-Vorbesitz:</strong> Du brauchst die Fahrerlaubnis der
          Klasse, für die du ausbilden willst — für die Pkw-Ausbildung die Klasse BE —
          und bereits mehrjährige eigene Fahrpraxis.
        </li>
        <li>
          <strong>Vorbildung:</strong> In der Regel eine abgeschlossene Berufsausbildung
          oder eine vergleichbare Vorbildung. Ein Studium ist nicht nötig.
        </li>
        <li>
          <strong>Eignung und Zuverlässigkeit:</strong> Du bist körperlich und geistig
          fit für den Job und im Straßenverkehr zuverlässig unterwegs — grob gesagt
          sollten dein Führungszeugnis und dein Punktekonto keine großen Geschichten
          erzählen.
        </li>
      </ul>
      <p>
        Klingt machbar? Ist es für viele auch. Wichtig ist nur: Die Details hängen von
        deinem Einzelfall ab. Kläre deine persönliche Situation früh mit einer
        Fahrlehrer-Ausbildungsstätte, bevor du kündigst oder groß planst.
      </p>

      <h2>So läuft die Ausbildung ab</h2>
      <p>
        Fahrlehrer:in wird man nicht nebenbei, sondern über eine geregelte Ausbildung an
        einer amtlich anerkannten Fahrlehrer-Ausbildungsstätte. Dort lernst du alles,
        was du später vermitteln sollst — Verkehrsrecht, Fahrphysik, Technik — und vor
        allem, wie man es vermittelt: Verkehrspädagogik ist das Herzstück der
        Ausbildung.
      </p>
      <p>
        Danach folgt ein Lehrpraktikum in einer Ausbildungsfahrschule: Du unterrichtest
        unter Anleitung erfahrener Kolleg:innen, erst begleitet, dann zunehmend
        selbstständig. Den Abschluss bilden staatliche Prüfungen, in denen du Fachwissen
        und Unterrichten nachweist. In Vollzeit dauert der ganze Weg meist rund ein Jahr
        (Stand: Juli 2026, ohne Gewähr — den genauen Ablauf erklärt dir deine
        Ausbildungsstätte).
      </p>

      <h2>Finanzierung: Wenn die Fahrschule deine Ausbildung übernimmt</h2>
      <p>
        Die Ausbildung kostet Geld und vor allem Zeit — für viele Quereinsteiger:innen
        ist das die eigentliche Hürde. Es gibt aber einen Weg, den nicht alle kennen:
        Manche Fahrschulen finanzieren die Ausbildung ihrer künftigen Fahrlehrer:innen
        ganz oder teilweise. Im Gegenzug verpflichtest du dich, nach der Ausbildung für
        eine vereinbarte Zeit dort zu arbeiten. Das kann für beide Seiten fair sein: Die
        Schule investiert in dich, du bekommst Planbarkeit und einen Arbeitsplatz ab
        Tag eins.
      </p>
      <p>
        Ein Anspruch darauf ist das nicht — solche Modelle sind Vereinbarungssache und
        von Schule zu Schule verschieden. Frag trotzdem aktiv danach: Wer händeringend
        Verstärkung sucht, ist für dieses Gespräch oft offener, als du denkst. Je nach
        Lebenslage kann außerdem eine öffentliche Förderung infrage kommen — ob und in
        welcher Form, klärst du am besten mit der für dich zuständigen Beratungsstelle.
      </p>
      <blockquote>
        <p>
          Lies eine Bindungsvereinbarung in Ruhe, bevor du unterschreibst: Wie lange
          bindest du dich? Was gilt, wenn du die Ausbildung abbrichst oder früher gehst?
          Und steht alles, was mündlich besprochen wurde, auch wirklich im Vertrag?
        </p>
      </blockquote>

      <h2>Dein erster Schritt</h2>
      <p>
        Du musst dich heute nicht entscheiden — aber du kannst heute anfangen, dir ein
        Bild zu machen. Sprich mit Fahrlehrer:innen in deiner Nähe und frag, wie ihr
        Alltag wirklich aussieht. Viele Fahrschulen lassen dich gern mal in eine
        Theoriestunde reinschnuppern, bevor du dich festlegst. Und lass dich von einer
        Ausbildungsstätte beraten, ob deine Voraussetzungen passen.
      </p>
      <p>
        Wenn du sehen willst, wer gerade sucht: Auf unserer{" "}
        <Link href="/jobs">Jobbörse</Link> findest du offene Stellen von Fahrschulen —
        darunter auch Teams, die Quereinsteiger:innen ausdrücklich willkommen heißen.
        Vielleicht ist der Beifahrersitz ja genau der Arbeitsplatz, der dir bisher
        gefehlt hat.
      </p>
    </RatgeberArtikel>
  );
}
