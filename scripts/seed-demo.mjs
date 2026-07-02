/**
 * seed-demo.mjs — Demo-/Testdaten für die LOKALE Dev-DB (Portal-UI-Entwicklung).
 * ============================================================================
 * Seedet eine FIKTIVE, aber glaubwürdige Fahrschul-Landschaft (1 Gruppe mit
 * 3 Standorten + 11 Einzelschulen in München/Augsburg/Nürnberg) inklusive
 * Profilen, Preisen (bestätigt/recherchiert/lückenhaft/fehlend), Öffnungs-/
 * Theoriezeiten, Fahrzeugen, Fahrlehrern, FAQ, Bildern (nur existierende
 * public/seed-Platzhalter) und Stellenanzeigen (inkl. Abgelaufen-Testfall).
 *
 * Kennzeichnung: driving_schools.source = 'dev_seed' (source_ref
 * 'dev_seed:<lauf-nr>-<schul-kurzname>'). ALLE Namen/Adressen/Kontakte sind
 * erfunden; E-Mail/Website nutzen ausschließlich reservierte example-Domains.
 * KEINE leads/job_applications (kommen durch echte Formulare), KEINE users.
 *
 * Idempotent: Vor jedem Seed werden ALLE 'dev_seed'-Bestände entfernt
 * (gleiche Logik wie --remove) — zweimal ausführen erzeugt keine Duplikate.
 *
 * NUR lokale Entwicklung. Aufruf:
 *   node --env-file=.env.development.local scripts/seed-demo.mjs           → seedet
 *   node --env-file=.env.development.local scripts/seed-demo.mjs --remove  → löscht rückstandsfrei
 *
 * Verbindung über TOOLING_DATABASE_URL (erhöhter Pfad, umgeht RLS/Grants —
 * Trigger feuern trotzdem). Löschreihenfolge beachtet die FK-RESTRICT-Pfade
 * (job_applications/leads ZUERST, dann Subressourcen, Schulen, verwaiste Brands).
 */
import postgres from "postgres";
import { getDbSslOption, dbHostFromUrl } from "./db-ssl.mjs";

if (process.env.NODE_ENV === "production") {
  console.error("seed-demo: nur lokale Entwicklung (NODE_ENV=production blockiert).");
  process.exit(1);
}
const tooling = process.env.TOOLING_DATABASE_URL;
const appUrl = process.env.DATABASE_URL;
if (!tooling || !appUrl) {
  console.error("Fehlt TOOLING_DATABASE_URL und/oder DATABASE_URL (.env.development.local).");
  process.exit(1);
}

// STRENGER als db-local (Sicherheits-Review M0): Demo-Daten dürfen AUSSCHLIESSLICH auf
// die Loopback-DB. Das breitere isLocalDbHost() (RFC1918/.internal — für Docker-
// Netze in db-local legitim) würde auch private Staging-/Prod-Netze einschließen;
// für Fantasie-Daten gibt es dafür keinen Grund → nur localhost/127.0.0.1/::1.
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
for (const [label, dsn] of [["TOOLING_DATABASE_URL", tooling], ["DATABASE_URL", appUrl]]) {
  const host = (dbHostFromUrl(dsn) ?? "").toLowerCase();
  if (!LOOPBACK_HOSTS.has(host)) {
    console.error(
      `seed-demo: ${label} zeigt nicht auf Loopback (${host || "?"}). ` +
        "Demo-Seeds sind AUSSCHLIESSLICH für die lokale Dev-DB (localhost/127.0.0.1/::1) erlaubt.",
    );
    process.exit(1);
  }
}

const removeOnly = process.argv.slice(2).includes("--remove");

// Lauf-Nummer im source_ref. Konstant, weil vor jedem Seed ALLE dev_seed-Bestände
// entfernt werden (Idempotenz per Wipe, nicht per Upsert).
const LAUF = 1;
const ref = (kurz) => `dev_seed:${LAUF}-${kurz}`;

// Wochentag-Konvention aus Migration 0001: 0=Montag … 6=Sonntag.
const WT = { Mo: 0, Di: 1, Mi: 2, Do: 3, Fr: 4, Sa: 5, So: 6 };
// Öffnungszeilen-Bauhelfer: gleiche von/bis-Spanne für mehrere Tage.
const tage = (namen, von, bis) => namen.map((t) => [t, von, bis]);

// ----------------------------------------------------------------------------
// Demo-Datensatz (alles FIKTIV; Beschreibungen bewusst ohne Superlative/Versprechen).
// sprachen/fuehrerscheinklassen/besonderheiten als Postgres-Array-Literale
// (Stil wie tests/rls/seed.ts) — nur einfache Tokens ohne Komma/Quote verwenden.
// ----------------------------------------------------------------------------
const BRAND = { name: "Fahrschule Meridian" };

const SCHULEN = [
  {
    kurz: "meridian-schwabing",
    brand: true,
    isMainLocation: true,
    name: "Fahrschule Meridian Schwabing",
    slug: "fahrschule-meridian-schwabing",
    strasse: "Hohenzollernstraße", hausnummer: "74", plz: "80796",
    ort: "München", stadtbezirk: "Schwabing", bundesland: "Bayern",
    lat: 48.1663, lng: 11.5807,
    isVerified: true, isPartner: false,
    sprachen: "{de,en}", rating: "4.7", reviews: 312,
    profil: {
      beschreibung:
        "Zentrale der Fahrschule Meridian mit weiteren Standorten in Sendling und Pasing. " +
        "Ausbildung in den Klassen B, B197, A1 und A. " +
        "Theorieunterricht findet an drei Abenden pro Woche in Schwabing statt.",
      klassen: "{B,B197,A1,A}",
      telefon: "089 21005110",
      email: "meridian-schwabing@example.de",
      website: "https://www.fahrschule-meridian.example",
    },
    preise: [
      { klasse: "B", status: "bestaetigt", grundbetrag: "460.00", fahrstunde: "68.00",
        ueberland: "76.00", autobahn: "78.00", daemmerung: "80.00",
        vorTheorie: "80.00", vorPraxis: "165.00", lehrmaterial: "95.00", stand: "2026-06-10" },
      { klasse: "A", status: "bestaetigt", grundbetrag: "430.00", fahrstunde: "72.00",
        ueberland: "80.00", autobahn: "82.00", daemmerung: "84.00",
        vorTheorie: "80.00", vorPraxis: "170.00", lehrmaterial: null, stand: "2026-06-10" },
    ],
    zeiten: {
      buero: [
        ...tage(["Mo", "Di", "Mi", "Do", "Fr"], "09:00", "12:30"),
        ...tage(["Mo", "Di", "Mi", "Do", "Fr"], "14:00", "18:00"),
      ],
      theorie: tage(["Mo", "Mi", "Fr"], "18:30", "20:00"),
    },
    fahrzeuge: [
      { marke: "VW", modell: "Golf", getriebe: "schaltung", klasse: "B", besonderheiten: "{}" },
      { marke: "VW", modell: "T-Roc", getriebe: "automatik", klasse: "B", besonderheiten: "{Rückfahrkamera}" },
      { marke: "Yamaha", modell: "MT-07", getriebe: "schaltung", klasse: "A", besonderheiten: "{}" },
    ],
    fahrlehrer: ["Bernd Auracher", "Sofia Petkov", "Murat Demir", "Anja Lindner"],
    faq: [
      { f: "Wie melde ich mich an?",
        a: "Die Anmeldung ist telefonisch, per E-Mail oder direkt im Büro in Schwabing möglich. Zur Anmeldung wird ein Ausweisdokument benötigt." },
      { f: "Wann findet der Theorieunterricht statt?",
        a: "Montags, mittwochs und freitags jeweils von 18:30 bis 20:00 Uhr. Der Einstieg ist zu jedem Termin möglich." },
      { f: "Kann ich in Raten zahlen?",
        a: "Ja, die Ausbildung kann in Teilbeträgen bezahlt werden. Die Aufteilung wird bei der Anmeldung schriftlich vereinbart." },
      { f: "Bildet ihr auch auf Automatik aus?",
        a: "Ja, mit der Klasse B197 findet die praktische Ausbildung überwiegend auf einem Automatikfahrzeug statt." },
      { f: "Wie lange dauert die Ausbildung?",
        a: "Das hängt von Vorkenntnissen, Terminlage und Übungsbedarf ab. Üblich sind mehrere Monate zwischen Anmeldung und Prüfung." },
    ],
    jobs: [
      {
        // M5-Testfall: KOMPLETT bestätigte Gehaltsspanne (Werte sind erfundene
        // dev_seed-Testdaten — Migration 0025 erzwingt Vollständigkeit DB-hart).
        titel: "Fahrlehrer/in Klasse B (Vollzeit)",
        slug: "fahrlehrer-klasse-b-vollzeit-meridian-schwabing",
        art: "fahrlehrer", beschaeftigungsart: "vollzeit",
        verguetung: null, gueltigBis: "2026-09-30",
        klassen: "{B,B197}", arbeitszeit: "vollzeit", samstag: false,
        gehaltVon: "3400.00", gehaltBis: "3900.00", gehaltZeitraum: "monat",
        gehaltBestaetigt: "2026-06-10", modell: "fix_plus_umsatz",
        geprueft: "2026-06-24", erstveroeffentlicht: "2026-06-01",
        beschreibung:
          "Für unseren Standort Schwabing suchen wir eine Fahrlehrerin oder einen Fahrlehrer mit " +
          "Fahrlehrerlaubnis BE in Vollzeit. Die Diensteinteilung erfolgt in Absprache; " +
          "Theorieunterricht kann nach Einarbeitung übernommen werden.",
      },
    ],
    bilder: [
      { kategorie: "gebaeude", url: "/seed/gebaeude.svg", alt: "Büro der Fahrschule Meridian Schwabing" },
      { kategorie: "theorie", url: "/seed/theorie.svg", alt: "Theorieraum am Standort Schwabing" },
      { kategorie: "fahrzeug", url: "/seed/fahrzeug.svg", alt: "Ausbildungsfahrzeug der Fahrschule Meridian" },
    ],
  },
  {
    kurz: "meridian-sendling",
    brand: true,
    name: "Fahrschule Meridian Sendling",
    slug: "fahrschule-meridian-sendling",
    strasse: "Plinganserstraße", hausnummer: "38", plz: "81369",
    ort: "München", stadtbezirk: "Sendling", bundesland: "Bayern",
    lat: 48.1149, lng: 11.5418,
    isVerified: true, isPartner: false,
    sprachen: "{de,en}", rating: "4.5", reviews: 98,
    profil: {
      beschreibung:
        "Standort der Fahrschule Meridian in Sendling mit Ausbildung in den Klassen B und B197. " +
        "Fahrstunden beginnen am Standort oder an einem vereinbarten Treffpunkt.",
      klassen: "{B,B197}",
      telefon: "089 21005120",
      email: "meridian-sendling@example.de",
      website: "https://www.fahrschule-meridian.example",
    },
    preise: [
      { klasse: "B", status: "bestaetigt", grundbetrag: "450.00", fahrstunde: "66.00",
        ueberland: "74.00", autobahn: "76.00", daemmerung: "78.00",
        vorTheorie: "75.00", vorPraxis: "160.00", lehrmaterial: "90.00", stand: "2026-06-10" },
    ],
    zeiten: {
      buero: [
        ...tage(["Mo", "Di", "Mi", "Do"], "10:00", "13:00"),
        ...tage(["Mo", "Di", "Mi", "Do"], "15:00", "18:00"),
        ...tage(["Fr"], "10:00", "14:00"),
      ],
      theorie: tage(["Di", "Do"], "19:00", "20:30"),
    },
    fahrzeuge: [
      { marke: "VW", modell: "Polo", getriebe: "schaltung", klasse: "B", besonderheiten: "{}" },
      { marke: "VW", modell: "T-Roc", getriebe: "automatik", klasse: "B", besonderheiten: "{}" },
    ],
    fahrlehrer: ["Petra Salzweg", "Jonas Kranich"],
    faq: [
      { f: "Wo melde ich mich für Sendling an?",
        a: "Direkt im Büro in der Plinganserstraße oder zentral über die Fahrschule Meridian. Die Unterlagen sind an allen Standorten identisch." },
      { f: "An welchen Tagen ist Theorie?",
        a: "Dienstags und donnerstags von 19:00 bis 20:30 Uhr. Termine anderer Meridian-Standorte können mitbesucht werden." },
      { f: "Welche Zahlungsweisen gibt es?",
        a: "Überweisung nach Rechnung oder Zahlung in Teilbeträgen nach schriftlicher Vereinbarung." },
      { f: "Gibt es ein Automatikfahrzeug?",
        a: "Ja, ein T-Roc mit Automatikgetriebe steht für die Ausbildung und die Klasse B197 zur Verfügung." },
    ],
    jobs: [],
    bilder: [
      { kategorie: "gebaeude", url: "/seed/gebaeude.svg", alt: "Büro der Fahrschule Meridian Sendling" },
      { kategorie: "fahrzeug", url: "/seed/fahrzeug.svg", alt: "Ausbildungsfahrzeug am Standort Sendling" },
    ],
  },
  {
    kurz: "meridian-pasing",
    brand: true,
    name: "Fahrschule Meridian Pasing",
    slug: "fahrschule-meridian-pasing",
    strasse: "Landsberger Straße", hausnummer: "512", plz: "81241",
    ort: "München", stadtbezirk: "Pasing", bundesland: "Bayern",
    lat: 48.1449, lng: 11.461,
    isVerified: false, isPartner: false,
    sprachen: "{de,en}", rating: null, reviews: null,
    profil: {
      beschreibung:
        "Standort der Fahrschule Meridian in Pasing mit Ausbildung in der Klasse B. " +
        "Das Büro liegt in der Nähe des Pasinger Bahnhofs. " +
        "Fahrstunden werden individuell mit dem Fahrlehrer abgestimmt.",
      klassen: "{B}",
      telefon: "089 21005130",
      email: "meridian-pasing@example.de",
      website: "https://www.fahrschule-meridian.example",
    },
    preise: [
      { klasse: "B", status: "recherchiert", grundbetrag: "440.00", fahrstunde: "64.00",
        ueberland: "73.00", autobahn: "75.00", daemmerung: "76.00",
        vorTheorie: "75.00", vorPraxis: "155.00", lehrmaterial: null,
        stand: "2026-05-28", quelle: "dev_seed" },
    ],
    zeiten: {
      buero: [
        ...tage(["Mo", "Mi", "Fr"], "09:30", "13:00"),
        ...tage(["Di", "Do"], "14:00", "18:00"),
      ],
      theorie: tage(["Mo", "Mi"], "19:00", "20:30"),
    },
    fahrzeuge: [
      { marke: "Seat", modell: "Leon", getriebe: "schaltung", klasse: "B", besonderheiten: "{}" },
    ],
    fahrlehrer: ["Robert Vogelsang", "Elif Sarikaya", "Tomasz Adamski"],
    faq: [
      { f: "Wie läuft die Anmeldung in Pasing?",
        a: "Zu den Büro-Öffnungszeiten vor Ort oder telefonisch. Ein Ausweisdokument reicht für den Start." },
      { f: "Wann ist Theorieunterricht?",
        a: "Montags und mittwochs von 19:00 bis 20:30 Uhr direkt am Standort Pasing." },
      { f: "Kann ich in Teilbeträgen zahlen?",
        a: "Ja, die Aufteilung in Teilbeträge wird bei der Anmeldung schriftlich festgehalten." },
      { f: "Wo starten die Fahrstunden?",
        a: "In der Regel am Büro in der Landsberger Straße; Abholung an einem vereinbarten Treffpunkt ist nach Absprache möglich." },
    ],
    jobs: [
      {
        // M5-Testfall: OHNE Gehaltsangabe (UI zeigt „Gehalt: auf Anfrage").
        titel: "Fahrlehrer/in Klasse B (Teilzeit)",
        slug: "fahrlehrer-klasse-b-teilzeit-meridian-pasing",
        art: "fahrlehrer", beschaeftigungsart: "teilzeit",
        verguetung: null, gueltigBis: null,
        klassen: "{B}", arbeitszeit: "teilzeit",
        modell: "nach_vereinbarung",
        geprueft: "2026-06-18", erstveroeffentlicht: "2026-05-20",
        beschreibung:
          "Für den Standort Pasing suchen wir Verstärkung in Teilzeit (Fahrlehrerlaubnis BE). " +
          "Der Stundenumfang wird gemeinsam festgelegt und kann später angepasst werden.",
      },
    ],
    bilder: [
      { kategorie: "gebaeude", url: "/seed/gebaeude.svg", alt: "Büro der Fahrschule Meridian Pasing" },
    ],
  },
  {
    kurz: "nordlicht",
    name: "Fahrschule Nordlicht",
    slug: "fahrschule-nordlicht",
    strasse: "Augustenstraße", hausnummer: "14", plz: "80333",
    ort: "München", stadtbezirk: "Maxvorstadt", bundesland: "Bayern",
    lat: 48.1508, lng: 11.5661,
    isVerified: true, isPartner: true,
    sprachen: "{de}", rating: "4.8", reviews: 205,
    profil: {
      beschreibung:
        "Fahrschule in der Maxvorstadt mit Ausbildung in den Klassen B und B197. " +
        "Das Büro ist werktags durchgehend besetzt. " +
        "Theorieunterricht findet zweimal pro Woche am Abend statt.",
      klassen: "{B,B197}",
      telefon: "089 27703315",
      email: "fahrschule-nordlicht@example.de",
      website: "https://www.fahrschule-nordlicht.example",
    },
    preise: [
      { klasse: "B", status: "bestaetigt", grundbetrag: "495.00", fahrstunde: "71.00",
        ueberland: "80.00", autobahn: "83.00", daemmerung: "82.00",
        vorTheorie: "85.00", vorPraxis: "175.00", lehrmaterial: "110.00", stand: "2026-06-20" },
    ],
    zeiten: {
      buero: tage(["Mo", "Di", "Mi", "Do", "Fr"], "09:00", "17:30"),
      theorie: tage(["Di", "Do"], "18:00", "19:30"),
    },
    fahrzeuge: [
      { marke: "BMW", modell: "118i", getriebe: "automatik", klasse: "B", besonderheiten: "{Rückfahrkamera}" },
      { marke: "VW", modell: "Golf", getriebe: "schaltung", klasse: "B", besonderheiten: "{}" },
    ],
    fahrlehrer: ["Katharina Nordmann", "Felix Brauneck"],
    faq: [
      { f: "Nehmt ihr aktuell neue Fahrschüler an?",
        a: "Ja. Die Wartezeit bis zur ersten Fahrstunde hängt von der Auslastung ab; den aktuellen Stand nennen wir bei der Anmeldung." },
      { f: "Wann kann ich mit der Theorie starten?",
        a: "Der Unterricht läuft fortlaufend dienstags und donnerstags von 18:00 bis 19:30 Uhr; ein Einstieg ist jederzeit möglich." },
      { f: "Wie wird abgerechnet?",
        a: "Nach dem ausgehängten Preisverzeichnis. Fahrstunden werden monatlich in Rechnung gestellt." },
      { f: "Was ist der Unterschied zwischen B und B197?",
        a: "Bei B197 findet die praktische Ausbildung überwiegend auf Automatik statt; der Führerschein gilt danach trotzdem für Schaltfahrzeuge." },
      { f: "Wie viele Fahrstunden brauche ich?",
        a: "Die zwölf Sonderfahrten sind gesetzlich vorgeschrieben, der übrige Umfang richtet sich nach dem Lernstand. Eine seriöse Zahl lässt sich erst nach den ersten Stunden nennen." },
    ],
    jobs: [
      {
        // Abgelaufen-Testfall: gueltig_bis liegt in der Vergangenheit.
        titel: "Fahrlehrer/in Klasse B (Vollzeit)",
        slug: "fahrlehrer-klasse-b-vollzeit-nordlicht",
        art: "fahrlehrer", beschaeftigungsart: "vollzeit",
        verguetung: null, gueltigBis: "2026-05-31",
        klassen: "{B}", arbeitszeit: "vollzeit",
        geprueft: "2026-04-15", erstveroeffentlicht: "2026-04-01",
        beschreibung:
          "Zur Verstärkung unseres Teams in der Maxvorstadt suchen wir eine Fahrlehrerin oder " +
          "einen Fahrlehrer (Fahrlehrerlaubnis BE) in Vollzeit.",
      },
    ],
    bilder: [
      { kategorie: "gebaeude", url: "/seed/gebaeude.svg", alt: "Büro der Fahrschule Nordlicht" },
      { kategorie: "theorie", url: "/seed/theorie.svg", alt: "Theorieraum der Fahrschule Nordlicht" },
    ],
  },
  {
    kurz: "stadtfuchs",
    name: "Fahrschule Stadtfuchs",
    slug: "fahrschule-stadtfuchs",
    strasse: "Weißenburger Straße", hausnummer: "22", plz: "81667",
    ort: "München", stadtbezirk: "Haidhausen", bundesland: "Bayern",
    lat: 48.13, lng: 11.5964,
    isVerified: false, isPartner: false,
    sprachen: "{de,tr,en}", rating: "4.4", reviews: 67,
    profil: {
      beschreibung:
        "Kleine Fahrschule in Haidhausen mit Ausbildung in der Klasse B. " +
        "Fragen können auch auf Türkisch und Englisch geklärt werden. " +
        "Termine für Fahrstunden werden direkt mit dem Fahrlehrer vereinbart.",
      klassen: "{B}",
      telefon: "089 44219087",
      email: "fahrschule-stadtfuchs@example.de",
      website: "https://www.fahrschule-stadtfuchs.example",
    },
    preise: [
      // Recherchiert MIT LÜCKEN: Sonderfahrten/Praxis-Vorstellung (noch) nicht erfasst.
      { klasse: "B", status: "recherchiert", grundbetrag: "415.00", fahrstunde: "61.00",
        ueberland: null, autobahn: null, daemmerung: null,
        vorTheorie: "70.00", vorPraxis: null, lehrmaterial: null,
        stand: "2026-05-15", quelle: "dev_seed" },
    ],
    zeiten: {
      buero: [
        ...tage(["Mo", "Di", "Do"], "09:30", "12:30"),
        ...tage(["Mo", "Di", "Do"], "14:30", "17:30"),
      ],
      theorie: tage(["Mo", "Do"], "18:30", "20:00"),
    },
    fahrzeuge: [
      { marke: "Skoda", modell: "Fabia", getriebe: "schaltung", klasse: "B", besonderheiten: "{}" },
    ],
    fahrlehrer: ["Cem Yildirim", "Irena Kovac"],
    faq: [
      { f: "In welchen Sprachen läuft der Unterricht?",
        a: "Der Theorieunterricht findet auf Deutsch statt; Rückfragen sind auch auf Türkisch und Englisch möglich. Die amtliche Theorieprüfung wird in mehreren Sprachen angeboten." },
      { f: "Was brauche ich zur Anmeldung?",
        a: "Ein gültiges Ausweisdokument. Sehtest und Erste-Hilfe-Kurs können nachgereicht werden." },
      { f: "Wann ist Theorie?",
        a: "Montags und donnerstags von 18:30 bis 20:00 Uhr im Unterrichtsraum in der Weißenburger Straße." },
      { f: "Kann ich bar bezahlen?",
        a: "Beträge werden per Überweisung nach Rechnung bezahlt; Barzahlung ist im Büro gegen Quittung möglich." },
      { f: "Wie schnell bekomme ich Fahrstunden?",
        a: "Das hängt von der aktuellen Nachfrage ab. Den realistischen Zeitrahmen besprechen wir offen bei der Anmeldung." },
    ],
    jobs: [
      {
        // M5-Testfall: Quereinstieg mit VOLLER Ausbildungsfinanzierung (Flag-Wording;
        // KEINE Bindungsdauer/Rückzahlungs-Zusagen in der Anzeige — Spec §5).
        titel: "Ausbildung zum Fahrlehrer/zur Fahrlehrerin",
        slug: "ausbildung-zum-fahrlehrer-finanziert-stadtfuchs",
        art: "anwaerter", beschaeftigungsart: "vollzeit",
        verguetung: null, gueltigBis: null,
        klassen: "{B}", arbeitszeit: "vollzeit",
        quereinsteiger: true, finanzierung: "voll",
        modell: "nach_vereinbarung",
        geprueft: "2026-06-22", erstveroeffentlicht: "2026-05-12",
        beschreibung:
          "Quereinsteiger:innen willkommen: Die Ausbildung an einer anerkannten " +
          "Fahrlehrerausbildungsstätte kann über uns finanziert werden — die Einzelheiten " +
          "besprechen wir im persönlichen Gespräch vor Ort.",
      },
    ],
    bilder: [
      { kategorie: "theorie", url: "/seed/theorie.svg", alt: "Unterrichtsraum der Fahrschule Stadtfuchs" },
    ],
  },
  {
    kurz: "klarkurs",
    name: "Fahrschule Klarkurs",
    slug: "fahrschule-klarkurs",
    strasse: "Nymphenburger Straße", hausnummer: "155", plz: "80634",
    ort: "München", stadtbezirk: "Neuhausen", bundesland: "Bayern",
    lat: 48.154, lng: 11.531,
    isVerified: true, isPartner: false,
    sprachen: "{de,en,it}", rating: "4.6", reviews: 143,
    profil: {
      beschreibung:
        "Fahrschule in Neuhausen mit Ausbildung in den Klassen B und BE. " +
        "Für die Anhänger-Ausbildung steht ein Zugfahrzeug mit Anhängerkupplung bereit. " +
        "Der Theorieunterricht läuft an drei Abenden pro Woche.",
      klassen: "{B,BE}",
      telefon: "089 13098842",
      email: "fahrschule-klarkurs@example.de",
      website: "https://www.fahrschule-klarkurs.example",
    },
    preise: [
      // Recherchiert MIT LÜCKEN: Fahrstunden-/Sonderfahrtsätze fehlen noch.
      { klasse: "B", status: "recherchiert", grundbetrag: "430.00", fahrstunde: null,
        ueberland: null, autobahn: null, daemmerung: null,
        vorTheorie: "72.00", vorPraxis: "148.00", lehrmaterial: "75.00",
        stand: "2026-06-05", quelle: "dev_seed" },
    ],
    zeiten: {
      buero: [
        ...tage(["Mo", "Di", "Mi", "Do", "Fr"], "10:00", "13:00"),
        ...tage(["Mo", "Di", "Mi", "Do", "Fr"], "14:30", "18:00"),
      ],
      theorie: tage(["Di", "Mi", "Do"], "18:00", "19:30"),
    },
    fahrzeuge: [
      { marke: "VW", modell: "Golf Variant", getriebe: "schaltung", klasse: "BE", besonderheiten: "{Anhängerkupplung}" },
      { marke: "VW", modell: "ID.3", getriebe: "automatik", klasse: "B", besonderheiten: "{}" },
    ],
    fahrlehrer: ["Martina Klarwein", "Paolo Ricci", "Stefan Huber"],
    faq: [
      { f: "Bietet ihr auch BE an?",
        a: "Ja, die Anhänger-Klasse BE wird mit eigenem Gespann ausgebildet. Voraussetzung ist ein vorhandener oder parallel erworbener B-Führerschein." },
      { f: "Wie oft findet Theorie statt?",
        a: "Dienstag bis Donnerstag jeweils von 18:00 bis 19:30 Uhr; die Themen wiederholen sich im Turnus." },
      { f: "Kann ich elektrisch fahren lernen?",
        a: "Ein ID.3 mit Automatik ist im Einsatz; die Prüfung darauf entspricht der Regelung für Automatikfahrzeuge bzw. B197." },
      { f: "Wie läuft die Bezahlung?",
        a: "Grundbetrag bei Anmeldung, Fahrstunden nach monatlicher Rechnung. Teilzahlungen sind nach Absprache möglich." },
      { f: "Kann ich die Fahrschule wechseln?",
        a: "Ja, ein Wechsel zu uns oder von uns weg ist jederzeit möglich. Bereits absolvierte Ausbildungsteile werden bescheinigt." },
    ],
    jobs: [],
    bilder: [
      { kategorie: "gebaeude", url: "/seed/gebaeude.svg", alt: "Büro der Fahrschule Klarkurs" },
      { kategorie: "fahrzeug", url: "/seed/fahrzeug.svg", alt: "Ausbildungsfahrzeug der Fahrschule Klarkurs" },
      { kategorie: "theorie", url: "/seed/theorie.svg", alt: "Theorieraum der Fahrschule Klarkurs" },
    ],
  },
  {
    kurz: "westwind",
    name: "Fahrschule Westwind",
    slug: "fahrschule-westwind",
    strasse: "Dachauer Straße", hausnummer: "420", plz: "80992",
    ort: "München", stadtbezirk: "Moosach", bundesland: "Bayern",
    lat: 48.18, lng: 11.506,
    isVerified: false, isPartner: false,
    sprachen: "{de,ru,en}", rating: null, reviews: null,
    profil: {
      beschreibung:
        "Fahrschule in Moosach mit Ausbildung in den Klassen B und B197. " +
        "Das Büro ist nachmittags geöffnet; Fahrstunden finden auch vormittags statt.",
      klassen: "{B,B197}",
      telefon: "089 14087723",
      email: "fahrschule-westwind@example.de",
      website: "https://www.fahrschule-westwind.example",
    },
    preise: [], // Leerzustand: (noch) keine Preisangaben erfasst.
    zeiten: {
      buero: tage(["Di", "Mi", "Do", "Fr"], "14:00", "18:00"),
      theorie: tage(["Di", "Fr"], "19:00", "20:30"),
    },
    fahrzeuge: [
      { marke: "Opel", modell: "Astra", getriebe: "schaltung", klasse: "B", besonderheiten: "{}" },
    ],
    fahrlehrer: ["Viktor Baumgart"],
    faq: [
      { f: "Wann erreiche ich das Büro?",
        a: "Dienstag bis Freitag von 14:00 bis 18:00 Uhr. Außerhalb dieser Zeiten am besten per E-Mail." },
      { f: "Gibt es Unterricht auf Russisch?",
        a: "Der Theorieunterricht ist auf Deutsch; Erklärungen auf Russisch oder Englisch sind in Fahrstunden und bei Rückfragen möglich." },
      { f: "Was kostet die Ausbildung?",
        a: "Das aktuelle Preisverzeichnis hängt im Büro aus und wird bei der Anmeldung ausgehändigt." },
      { f: "Wie viele Theoriestunden sind Pflicht?",
        a: "Beim Ersterwerb der Klasse B sind es 14 Doppelstunden (12 Grundstoff, 2 klassenspezifisch)." },
    ],
    jobs: [],
    bilder: [], // Leerzustand: keine Bilder hinterlegt.
  },
  {
    kurz: "suedspur",
    name: "Fahrschule Südspur",
    slug: "fahrschule-suedspur",
    strasse: "Tegernseer Landstraße", hausnummer: "89", plz: "81539",
    ort: "München", stadtbezirk: "Giesing", bundesland: "Bayern",
    lat: 48.1108, lng: 11.582,
    isVerified: false, isPartner: false,
    sprachen: "{de,hr}", rating: null, reviews: null,
    profil: {
      beschreibung:
        "Fahrschule in Giesing mit Ausbildung in der Klasse B. " +
        "Der Unterricht findet in kleinen Gruppen statt; Fahrstunden werden persönlich abgestimmt.",
      klassen: "{B}",
      telefon: "089 69377105",
      email: "fahrschule-suedspur@example.de",
      website: null, // Leerzustand: keine Website hinterlegt.
    },
    preise: [
      { klasse: "B", status: "recherchiert", grundbetrag: "395.00", fahrstunde: "58.00",
        ueberland: "66.00", autobahn: "68.00", daemmerung: "69.00",
        vorTheorie: "65.00", vorPraxis: "138.00", lehrmaterial: "65.00",
        stand: "2026-05-20", quelle: "dev_seed" },
    ],
    zeiten: {
      buero: [
        ...tage(["Mo", "Mi"], "09:00", "12:00"),
        ...tage(["Di", "Do"], "15:00", "18:00"),
      ],
      theorie: tage(["Mo", "Mi"], "19:00", "20:30"),
    },
    fahrzeuge: [
      { marke: "Ford", modell: "Focus", getriebe: "schaltung", klasse: "B", besonderheiten: "{}" },
      { marke: "Renault", modell: "Clio", getriebe: "schaltung", klasse: "B", besonderheiten: "{}" },
    ],
    fahrlehrer: ["Ivana Maric", "Georg Reitmayr"],
    faq: [
      { f: "Wie melde ich mich an?",
        a: "Persönlich im Büro an der Tegernseer Landstraße oder telefonisch zu den Öffnungszeiten." },
      { f: "Wann findet der Theorieunterricht statt?",
        a: "Montags und mittwochs von 19:00 bis 20:30 Uhr." },
      { f: "Kann ich in Raten zahlen?",
        a: "Eine Zahlung in Teilbeträgen ist nach Absprache möglich und wird schriftlich festgehalten." },
      { f: "Fahrt ihr auch am Wochenende?",
        a: "Samstags nach Vereinbarung, sonntags nicht." },
    ],
    jobs: [],
    bilder: [
      { kategorie: "fahrzeug", url: "/seed/fahrzeug.svg", alt: "Ausbildungsfahrzeug der Fahrschule Südspur" },
    ],
  },
  {
    kurz: "isarpilot",
    name: "Fahrschule Isarpilot",
    slug: "fahrschule-isarpilot",
    strasse: "Prinzregentenstraße", hausnummer: "140", plz: "81675",
    ort: "München", stadtbezirk: "Bogenhausen", bundesland: "Bayern",
    lat: 48.1526, lng: 11.6183,
    isVerified: true, isPartner: true,
    sprachen: "{de,en}", rating: "4.9", reviews: 389,
    profil: {
      beschreibung:
        "Fahrschule in Bogenhausen mit Ausbildung in den Klassen B, B197, A1 und A. " +
        "Für die Motorradausbildung stehen eigene Maschinen und Schutzausrüstung zum Ausleihen bereit. " +
        "Theorieunterricht findet an drei Abenden pro Woche statt.",
      klassen: "{B,B197,A1,A}",
      telefon: "089 98105562",
      email: "fahrschule-isarpilot@example.de",
      website: "https://www.fahrschule-isarpilot.example",
    },
    preise: [
      { klasse: "B", status: "bestaetigt", grundbetrag: "520.00", fahrstunde: "75.00",
        ueberland: "85.00", autobahn: "87.00", daemmerung: "86.00",
        vorTheorie: "90.00", vorPraxis: "180.00", lehrmaterial: "120.00", stand: "2026-06-15" },
      { klasse: "A1", status: "bestaetigt", grundbetrag: "470.00", fahrstunde: "70.00",
        ueberland: "79.00", autobahn: "81.00", daemmerung: "80.00",
        vorTheorie: "90.00", vorPraxis: "170.00", lehrmaterial: null, stand: "2026-06-15" },
    ],
    zeiten: {
      buero: [
        ...tage(["Mo", "Di", "Mi", "Do", "Fr"], "09:00", "13:00"),
        ...tage(["Mo", "Di", "Mi", "Do", "Fr"], "14:00", "18:00"),
      ],
      theorie: tage(["Mo", "Mi", "Do"], "18:30", "20:00"),
    },
    fahrzeuge: [
      { marke: "BMW", modell: "318i", getriebe: "schaltung", klasse: "B", besonderheiten: "{}" },
      { marke: "BMW", modell: "X1", getriebe: "automatik", klasse: "B", besonderheiten: "{Rückfahrkamera}" },
      { marke: "Honda", modell: "CB500F", getriebe: "schaltung", klasse: "A", besonderheiten: "{}" },
    ],
    fahrlehrer: ["Max Obermaier", "Lena Wittkopf", "Denis Novak", "Carla Steinbrecher"],
    faq: [
      { f: "Bildet ihr auch Motorrad aus?",
        a: "Ja, in den Klassen A1 und A. Helm und Schutzkleidung können für die Ausbildung ausgeliehen werden." },
      { f: "Wann findet der Theorieunterricht statt?",
        a: "Montags, mittwochs und donnerstags von 18:30 bis 20:00 Uhr; klassenspezifische Motorrad-Themen nach Aushang." },
      { f: "Wie läuft die Bezahlung?",
        a: "Grundbetrag zu Beginn, danach monatliche Abrechnung der gefahrenen Stunden per Rechnung." },
      { f: "Kann ich Auto und Motorrad kombinieren?",
        a: "Ja, eine parallele Ausbildung ist möglich. Der Theorie-Grundstoff wird dabei nur einmal besucht." },
      { f: "Gibt es Automatikfahrzeuge?",
        a: "Ein X1 mit Automatik ist im Einsatz; damit ist auch die Ausbildung nach B197 möglich." },
      { f: "Wie lange dauert die Motorradausbildung?",
        a: "Bei vorhandener Klasse B verkürzt sich die Theorie; die Praxis hängt vom Übungsstand ab. Einen festen Zeitraum können wir seriös nicht zusagen." },
    ],
    jobs: [
      {
        // M5-Testfall: zweite KOMPLETT bestätigte Gehaltsspanne (dev_seed-Testwerte)
        // + Samstagsdienst + gemischte Klassen.
        titel: "Fahrlehrer/in Klasse A und B (Vollzeit)",
        slug: "fahrlehrer-klasse-a-b-vollzeit-isarpilot",
        art: "fahrlehrer", beschaeftigungsart: "vollzeit",
        verguetung: null, gueltigBis: "2026-10-31",
        klassen: "{A,A1,B}", arbeitszeit: "vollzeit", samstag: true,
        gehaltVon: "3600.00", gehaltBis: "4300.00", gehaltZeitraum: "monat",
        gehaltBestaetigt: "2026-06-15", modell: "fix_plus_umsatz",
        geprueft: "2026-06-26", erstveroeffentlicht: "2026-06-05",
        beschreibung:
          "Wir suchen eine Fahrlehrerin oder einen Fahrlehrer mit Fahrlehrerlaubnis A und BE " +
          "in Vollzeit. Motorrad-Saisonarbeit und Theorieunterricht werden im Team aufgeteilt.",
      },
    ],
    bilder: [
      { kategorie: "gebaeude", url: "/seed/gebaeude.svg", alt: "Büro der Fahrschule Isarpilot" },
      { kategorie: "theorie", url: "/seed/theorie.svg", alt: "Theorieraum der Fahrschule Isarpilot" },
      { kategorie: "fahrzeug", url: "/seed/fahrzeug.svg", alt: "Ausbildungsfahrzeug der Fahrschule Isarpilot" },
    ],
  },
  {
    kurz: "drehmoment",
    name: "Fahrschule Drehmoment",
    slug: "fahrschule-drehmoment",
    strasse: "Fürstenrieder Straße", hausnummer: "61", plz: "80687",
    ort: "München", stadtbezirk: "Laim", bundesland: "Bayern",
    lat: 48.14, lng: 11.501,
    isVerified: false, isPartner: false,
    sprachen: "{de}", rating: null, reviews: null,
    profil: {
      beschreibung:
        "Einzelfahrschule in Laim mit Ausbildung in der Klasse B. " +
        "Der Inhaber unterrichtet selbst; dadurch bleibt die Betreuung durchgehend in einer Hand.",
      klassen: "{B}",
      telefon: "089 56004471",
      email: "fahrschule-drehmoment@example.de",
      website: "https://www.fahrschule-drehmoment.example",
    },
    preise: [], // Leerzustand: (noch) keine Preisangaben erfasst.
    zeiten: {
      buero: tage(["Mo", "Di", "Do", "Fr"], "15:00", "18:30"),
      theorie: tage(["Di", "Do"], "19:00", "20:30"),
    },
    fahrzeuge: [
      { marke: "VW", modell: "Golf", getriebe: "schaltung", klasse: "B", besonderheiten: "{}" },
    ],
    fahrlehrer: ["Andreas Zellmer"],
    faq: [
      { f: "Wer unterrichtet mich?",
        a: "Theorie und Praxis übernimmt der Inhaber persönlich; Vertretungen gibt es nur in Ausnahmefällen." },
      { f: "Wann ist das Büro besetzt?",
        a: "Montag, Dienstag, Donnerstag und Freitag von 15:00 bis 18:30 Uhr." },
      { f: "Wie bezahle ich?",
        a: "Per Überweisung nach Rechnung; der Grundbetrag wird bei der Anmeldung fällig." },
      { f: "Wie lange dauert es bis zur Prüfung?",
        a: "Als Einzelfahrschule vergeben wir Termine der Reihe nach; den aktuellen Vorlauf nennen wir ehrlich bei der Anmeldung." },
    ],
    jobs: [],
    bilder: [
      { kategorie: "gebaeude", url: "/seed/gebaeude.svg", alt: "Büro der Fahrschule Drehmoment" },
    ],
  },
  {
    kurz: "ostlicht",
    name: "Fahrschule Ostlicht",
    slug: "fahrschule-ostlicht",
    strasse: "Wasserburger Landstraße", hausnummer: "205", plz: "81825",
    ort: "München", stadtbezirk: "Trudering", bundesland: "Bayern",
    lat: 48.125, lng: 11.658,
    isVerified: true, isPartner: false,
    sprachen: "{de,pl,en}", rating: null, reviews: null,
    profil: {
      beschreibung:
        "Fahrschule in Trudering mit Ausbildung in den Klassen B und B197. " +
        "Das Büro ist vormittags geöffnet, Theorieabende finden zweimal pro Woche statt.",
      klassen: "{B,B197}",
      telefon: "089 42730916",
      email: "fahrschule-ostlicht@example.de",
      website: "https://www.fahrschule-ostlicht.example",
    },
    preise: [], // Leerzustand: (noch) keine Preisangaben erfasst.
    zeiten: {
      buero: tage(["Mo", "Di", "Mi", "Do", "Fr"], "09:00", "12:00"),
      theorie: tage(["Mi", "Fr"], "18:00", "19:30"),
    },
    fahrzeuge: [
      { marke: "Toyota", modell: "Corolla Hybrid", getriebe: "automatik", klasse: "B", besonderheiten: "{}" },
      { marke: "Kia", modell: "Ceed", getriebe: "schaltung", klasse: "B", besonderheiten: "{}" },
    ],
    fahrlehrer: ["Agnieszka Wozniak", "Daniel Osterrieder"],
    faq: [
      { f: "Kann ich vormittags Fahrstunden nehmen?",
        a: "Ja, Fahrstunden sind werktags ab 08:00 Uhr möglich; das Büro ist bis 12:00 Uhr besetzt." },
      { f: "Gibt es Hybrid- oder Automatikfahrzeuge?",
        a: "Ein Corolla Hybrid mit Automatik ist im Einsatz; damit ist auch die B197-Ausbildung möglich." },
      { f: "Sprecht ihr Polnisch?",
        a: "Rückfragen sind auf Polnisch und Englisch möglich; der Theorieunterricht selbst findet auf Deutsch statt." },
      { f: "Wie läuft die Bezahlung ab?",
        a: "Grundbetrag bei Anmeldung, danach Abrechnung der Fahrstunden per Rechnung. Teilzahlungen nach Absprache." },
    ],
    jobs: [],
    bilder: [
      { kategorie: "theorie", url: "/seed/theorie.svg", alt: "Theorieraum der Fahrschule Ostlicht" },
    ],
  },
  {
    kurz: "lechblick",
    name: "Fahrschule Lechblick",
    slug: "fahrschule-lechblick",
    strasse: "Maximilianstraße", hausnummer: "33", plz: "86150",
    ort: "Augsburg", stadtbezirk: "Innenstadt", bundesland: "Bayern",
    lat: 48.3668, lng: 10.8942,
    isVerified: true, isPartner: false,
    sprachen: "{de}", rating: "4.3", reviews: 28,
    profil: {
      beschreibung:
        "Fahrschule in der Augsburger Innenstadt mit Ausbildung in den Klassen B und B197. " +
        "Das Büro liegt zentral und ist werktags geöffnet.",
      klassen: "{B,B197}",
      telefon: "0821 5093318",
      email: "fahrschule-lechblick@example.de",
      website: "https://www.fahrschule-lechblick.example",
    },
    preise: [
      { klasse: "B", status: "recherchiert", grundbetrag: "380.00", fahrstunde: "55.00",
        ueberland: "63.00", autobahn: "65.00", daemmerung: "66.00",
        vorTheorie: "60.00", vorPraxis: "130.00", lehrmaterial: "60.00",
        stand: "2026-06-01", quelle: "dev_seed" },
    ],
    zeiten: {
      buero: [
        ...tage(["Mo", "Di", "Mi", "Do", "Fr"], "09:00", "12:30"),
        ...tage(["Mo", "Di", "Mi", "Do", "Fr"], "13:30", "17:00"),
      ],
      theorie: tage(["Di", "Do"], "18:30", "20:00"),
    },
    fahrzeuge: [
      { marke: "VW", modell: "Polo", getriebe: "schaltung", klasse: "B", besonderheiten: "{}" },
      { marke: "VW", modell: "Golf", getriebe: "automatik", klasse: "B", besonderheiten: "{}" },
    ],
    fahrlehrer: ["Susanne Lechner", "Ali Karaca"],
    faq: [
      { f: "Wo finden die Fahrstunden statt?",
        a: "Start ist am Büro in der Maximilianstraße; geübt wird im Augsburger Stadtgebiet und Umland." },
      { f: "Wann kann ich mit der Theorie beginnen?",
        a: "Jederzeit — der Unterricht läuft fortlaufend dienstags und donnerstags von 18:30 bis 20:00 Uhr." },
      { f: "Welche Zahlungsmöglichkeiten gibt es?",
        a: "Überweisung nach Rechnung; auf Wunsch Aufteilung in Teilbeträge nach schriftlicher Vereinbarung." },
      { f: "Habt ihr ein Automatikauto?",
        a: "Ja, ein Golf mit Automatik; damit ist auch die Ausbildung nach B197 möglich." },
      { f: "Wie viele Fahrstunden sind üblich?",
        a: "Vorgeschrieben sind die zwölf Sonderfahrten; der übrige Bedarf ist individuell und zeigt sich in den ersten Stunden." },
    ],
    jobs: [
      {
        // M5-Testfall: Teilzeit ohne Gehaltsangabe, ohne Samstagsdienst.
        titel: "Fahrlehrer/in Klasse B (Teilzeit)",
        slug: "fahrlehrer-klasse-b-teilzeit-lechblick",
        art: "fahrlehrer", beschaeftigungsart: "teilzeit",
        verguetung: null, gueltigBis: "2026-08-31",
        klassen: "{B}", arbeitszeit: "teilzeit", samstag: false,
        modell: "nach_vereinbarung",
        geprueft: "2026-06-20", erstveroeffentlicht: "2026-06-01",
        beschreibung:
          "Für Nachmittags- und Abendstunden suchen wir Unterstützung in Teilzeit " +
          "(Fahrlehrerlaubnis BE). Der Umfang ist flexibel und wird gemeinsam festgelegt.",
      },
    ],
    bilder: [
      { kategorie: "gebaeude", url: "/seed/gebaeude.svg", alt: "Büro der Fahrschule Lechblick" },
      { kategorie: "fahrzeug", url: "/seed/fahrzeug.svg", alt: "Ausbildungsfahrzeug der Fahrschule Lechblick" },
    ],
  },
  {
    kurz: "stadttor",
    name: "Fahrschule Stadttor Augsburg",
    slug: "fahrschule-stadttor-augsburg",
    strasse: "Neuburger Straße", hausnummer: "18", plz: "86167",
    ort: "Augsburg", stadtbezirk: "Lechhausen", bundesland: "Bayern",
    lat: 48.3785, lng: 10.933,
    isVerified: false, isPartner: false,
    sprachen: "{de,tr}", rating: null, reviews: null,
    profil: {
      beschreibung:
        "Fahrschule in Augsburg-Lechhausen mit Ausbildung in der Klasse B. " +
        "Anmeldung und Beratung sind nachmittags im Büro möglich.",
      klassen: "{B}",
      telefon: "0821 7204485",
      email: "fahrschule-stadttor@example.de",
      website: null, // Leerzustand: keine Website hinterlegt.
    },
    preise: [], // Leerzustand: (noch) keine Preisangaben erfasst.
    zeiten: {
      buero: tage(["Di", "Mi", "Do"], "14:30", "18:00"),
      theorie: tage(["Mo", "Do"], "19:00", "20:30"),
    },
    fahrzeuge: [
      { marke: "Hyundai", modell: "i30", getriebe: "schaltung", klasse: "B", besonderheiten: "{}" },
    ],
    fahrlehrer: ["Emre Bostanci"],
    faq: [
      { f: "Wann hat das Büro geöffnet?",
        a: "Dienstag bis Donnerstag von 14:30 bis 18:00 Uhr; Theorieabende montags und donnerstags." },
      { f: "Kann ich auf Türkisch Fragen stellen?",
        a: "Ja, Rückfragen sind auf Türkisch möglich. Der Theorieunterricht findet auf Deutsch statt." },
      { f: "Was kostet der Führerschein?",
        a: "Die aktuellen Preise hängen im Büro aus und werden bei der Anmeldung erklärt; die Gesamtkosten hängen vom Übungsbedarf ab." },
      { f: "Wie melde ich mich an?",
        a: "Persönlich im Büro in der Neuburger Straße mit einem gültigen Ausweisdokument." },
    ],
    jobs: [],
    bilder: [], // Leerzustand: keine Bilder hinterlegt.
  },
  {
    kurz: "frankenrad",
    name: "Fahrschule Frankenrad",
    slug: "fahrschule-frankenrad",
    strasse: "Allersberger Straße", hausnummer: "96", plz: "90461",
    ort: "Nürnberg", stadtbezirk: "Südstadt", bundesland: "Bayern",
    lat: 49.44, lng: 11.078,
    isVerified: true, isPartner: false,
    sprachen: "{de,en}", rating: "4.6", reviews: 174,
    profil: {
      beschreibung:
        "Fahrschule in der Nürnberger Südstadt mit Ausbildung in den Klassen B, A1 und A. " +
        "Motorrad-Praxis findet von Frühjahr bis Herbst statt. " +
        "Der Theorieunterricht läuft ganzjährig an zwei Abenden pro Woche.",
      klassen: "{B,A1,A}",
      telefon: "0911 4408212",
      email: "fahrschule-frankenrad@example.de",
      website: "https://www.fahrschule-frankenrad.example",
    },
    preise: [
      { klasse: "B", status: "recherchiert", grundbetrag: "405.00", fahrstunde: "59.00",
        ueberland: "68.00", autobahn: "70.00", daemmerung: "71.00",
        vorTheorie: "68.00", vorPraxis: "142.00", lehrmaterial: "70.00",
        stand: "2026-06-18", quelle: "dev_seed" },
      { klasse: "A1", status: "recherchiert", grundbetrag: "385.00", fahrstunde: "62.00",
        ueberland: "71.00", autobahn: "73.00", daemmerung: "72.00",
        vorTheorie: "68.00", vorPraxis: "140.00", lehrmaterial: null,
        stand: "2026-06-18", quelle: "dev_seed" },
    ],
    zeiten: {
      buero: [
        ...tage(["Mo", "Di", "Mi", "Do", "Fr"], "10:00", "13:00"),
        ...tage(["Mo", "Di", "Mi", "Do", "Fr"], "14:00", "17:30"),
      ],
      theorie: tage(["Mo", "Mi"], "18:30", "20:00"),
    },
    fahrzeuge: [
      { marke: "VW", modell: "Golf", getriebe: "schaltung", klasse: "B", besonderheiten: "{}" },
      { marke: "Honda", modell: "CB125R", getriebe: "schaltung", klasse: "A1", besonderheiten: "{}" },
    ],
    fahrlehrer: ["Jürgen Frankenberger", "Nadja Simon", "Peter Wallner"],
    faq: [
      { f: "Wann startet die Motorrad-Saison?",
        a: "Praktische Motorradstunden fahren wir witterungsabhängig etwa von März bis Oktober; Theorie ist ganzjährig möglich." },
      { f: "Kann ich mit A1 anfangen und später auf A erweitern?",
        a: "Ja, die Erweiterung ist möglich; bereits absolvierte Ausbildungsteile werden berücksichtigt." },
      { f: "Wie läuft die Anmeldung?",
        a: "Telefonisch, per E-Mail oder direkt im Büro in der Allersberger Straße." },
      { f: "Wie wird bezahlt?",
        a: "Grundbetrag zu Beginn, Fahrstunden per monatlicher Rechnung. Teilzahlungen sind nach Absprache möglich." },
      { f: "Stellt ihr Schutzkleidung?",
        a: "Helme und Protektorenjacken können für die Ausbildung ausgeliehen werden; eigene Ausrüstung ist willkommen." },
    ],
    jobs: [
      {
        // M5-Testfall: Quereinstieg mit ANTEILIGER Finanzierung + flexiblem
        // Arbeitszeitmodell ohne Beschäftigungsart (gemischter Datenstand).
        titel: "Ausbildung zum Fahrlehrer/zur Fahrlehrerin",
        slug: "ausbildung-zum-fahrlehrer-finanziert-frankenrad",
        art: "anwaerter", beschaeftigungsart: null,
        verguetung: null, gueltigBis: null,
        klassen: "{B}", arbeitszeit: "flexibel",
        quereinsteiger: true, finanzierung: "anteilig",
        geprueft: "2026-06-25", erstveroeffentlicht: "2026-05-30",
        beschreibung:
          "Quereinsteiger:innen willkommen: Die Ausbildung an einer anerkannten " +
          "Fahrlehrerausbildungsstätte kann anteilig über uns finanziert werden — " +
          "Einzelheiten klären wir im Gespräch vor Ort.",
      },
    ],
    bilder: [
      { kategorie: "gebaeude", url: "/seed/gebaeude.svg", alt: "Büro der Fahrschule Frankenrad" },
      { kategorie: "theorie", url: "/seed/theorie.svg", alt: "Theorieraum der Fahrschule Frankenrad" },
    ],
  },
];

// ----------------------------------------------------------------------------
// Entfernen (auch Idempotenz-Vorlauf des Seeds): FK-sichere Reihenfolge —
// job_applications/leads (RESTRICT!) → Subressourcen → Schulen → verwaiste Brands.
// ----------------------------------------------------------------------------
const uuidArr = (ids) => `{${ids.join(",")}}`;

async function removeSeed(sql) {
  const counts = {};
  const rows = await sql.unsafe(
    "select id, brand_id from public.driving_schools where source = 'dev_seed'",
  );
  const ids = rows.map((r) => r.id);
  const brandIds = [...new Set(rows.map((r) => r.brand_id).filter(Boolean))];

  if (ids.length > 0) {
    counts.job_applications = (await sql.unsafe(
      `delete from public.job_applications
        where job_id in (select id from public.school_jobs where school_id = any($1::uuid[]))`,
      [uuidArr(ids)],
    )).count;
    counts.leads = (await sql.unsafe(
      "delete from public.leads where school_id = any($1::uuid[])",
      [uuidArr(ids)],
    )).count;

    // Subressourcen (CASCADE würde greifen — explizit für den Count-Report).
    const subTables = [
      "school_prices", "school_opening_hours", "school_vehicles", "instructors",
      "school_faq_items", "school_jobs", "school_images", "school_profiles", "school_billing",
    ];
    for (const table of subTables) {
      counts[table] = (await sql.unsafe(
        `delete from public.${table} where school_id = any($1::uuid[])`,
        [uuidArr(ids)],
      )).count;
    }

    counts.driving_schools = (await sql.unsafe(
      "delete from public.driving_schools where source = 'dev_seed'",
    )).count;
  }

  // Verwaiste Seed-Brands: nur löschen, wenn KEINE (auch keine fremde) Schule mehr dranhängt.
  if (brandIds.length > 0) {
    counts.school_brands = (await sql.unsafe(
      `delete from public.school_brands b
        where b.id = any($1::uuid[])
          and not exists (select 1 from public.driving_schools s where s.brand_id = b.id)`,
      [uuidArr(brandIds)],
    )).count;
  }
  return counts;
}

// ----------------------------------------------------------------------------
// Seeden
// ----------------------------------------------------------------------------
async function seedAll(sql) {
  // Marke/Gruppe: portal-verwaltet (kein Owner), eigene Kundennummer (0009-Modell).
  const [brand] = await sql.unsafe(
    `insert into public.school_brands (name, is_portal_managed, kundennummer)
     values ($1, true, nextval('public.driving_schools_kundennummer_seq'))
     returning id`,
    [BRAND.name],
  );

  for (const s of SCHULEN) {
    const [school] = await sql.unsafe(
      `insert into public.driving_schools
         (brand_id, name, slug, strasse, hausnummer, plz, ort, stadtbezirk, bundesland, land,
          latitude, longitude, google_rating, google_reviews_count, sprachen,
          is_partner, is_verified, is_listed, is_main_location,
          kundennummer, source, source_ref)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'DE',
               $10,$11,$12,$13,$14::text[],
               $15,$16,true,$17,
               -- Kundennummer gehört dem KUNDEN (0009): Gruppen-Standorte nutzen die der Brand.
               case when $18 then null else nextval('public.driving_schools_kundennummer_seq') end,
               'dev_seed',$19)
       returning id`,
      [
        s.brand ? brand.id : null, s.name, s.slug, s.strasse, s.hausnummer, s.plz, s.ort,
        s.stadtbezirk, s.bundesland, s.lat, s.lng, s.rating, s.reviews, s.sprachen,
        s.isPartner, s.isVerified, s.isMainLocation === true, s.brand === true, ref(s.kurz),
      ],
    );
    const sid = school.id;

    await sql.unsafe(
      `insert into public.school_profiles
         (school_id, beschreibung, fuehrerscheinklassen, telefon, email, website)
       values ($1,$2,$3::text[],$4,$5,$6)`,
      [sid, s.profil.beschreibung, s.profil.klassen, s.profil.telefon, s.profil.email, s.profil.website],
    );

    for (const p of s.preise) {
      await sql.unsafe(
        `insert into public.school_prices
           (school_id, klasse, grundbetrag, fahrstunde_45,
            sonderfahrt_ueberland_45, sonderfahrt_autobahn_45, sonderfahrt_daemmerung_45,
            vorstellung_theorie, vorstellung_praxis, lehrmaterial, status, stand, quelle)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [
          sid, p.klasse, p.grundbetrag, p.fahrstunde, p.ueberland, p.autobahn, p.daemmerung,
          p.vorTheorie, p.vorPraxis, p.lehrmaterial, p.status, p.stand, p.quelle ?? null,
        ],
      );
    }

    for (const [art, zeilen] of [["buero", s.zeiten.buero], ["theorie", s.zeiten.theorie]]) {
      for (const [tag, von, bis] of zeilen) {
        await sql.unsafe(
          `insert into public.school_opening_hours (school_id, art, wochentag, von, bis)
           values ($1,$2,$3,$4,$5)`,
          [sid, art, WT[tag], von, bis],
        );
      }
    }

    for (const [i, f] of s.fahrzeuge.entries()) {
      await sql.unsafe(
        `insert into public.school_vehicles
           (school_id, marke, modell, getriebe, klasse, besonderheiten, position)
         values ($1,$2,$3,$4,$5,$6::text[],$7)`,
        [sid, f.marke, f.modell, f.getriebe, f.klasse, f.besonderheiten, i],
      );
    }

    for (const name of s.fahrlehrer) {
      // Slug nur je Schule eindeutig (UNIQUE (school_id, slug), 0000) — einfache
      // Dev-Transliteration; kanonische Slugs macht src/lib/slug.ts in der App.
      const slug = name
        .toLowerCase()
        .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
        .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
      await sql.unsafe(
        "insert into public.instructors (school_id, name, slug, aktiv) values ($1,$2,$3,true)",
        [sid, name, slug],
      );
    }

    for (const [i, item] of s.faq.entries()) {
      await sql.unsafe(
        "insert into public.school_faq_items (school_id, frage, antwort, position) values ($1,$2,$3,$4)",
        [sid, item.f, item.a, i],
      );
    }

    for (const [i, job] of s.jobs.entries()) {
      // M5 (Migration 0025): strukturierte Felder. Gehalts-Testwerte sind erfunden
      // (dev_seed) und nur als KOMPLETT „bestätigte" Spanne einspielbar — der
      // DB-CHECK chk_school_jobs_gehalt lehnt Teilangaben hart ab.
      await sql.unsafe(
        `insert into public.school_jobs
           (school_id, titel, beschreibung, art, slug, beschaeftigungsart,
            verguetung_text, gueltig_bis, position,
            gehalt_von_euro, gehalt_bis_euro, gehalt_zeitraum, gehalt_bestaetigt_am,
            verguetungsmodell, tarif_hinweis, klassen, quereinsteiger_willkommen,
            quereinsteiger_finanzierung, arbeitszeit_modell, samstag_dienst,
            geprueft_am, erstveroeffentlicht_am)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,
                 $10,$11,$12,$13,$14,$15,$16::text[],$17,$18,$19,$20,$21,$22)`,
        [sid, job.titel, job.beschreibung, job.art, job.slug, job.beschaeftigungsart,
         job.verguetung, job.gueltigBis, i,
         job.gehaltVon ?? null, job.gehaltBis ?? null, job.gehaltZeitraum ?? null,
         job.gehaltBestaetigt ?? null, job.modell ?? null, job.tarifHinweis ?? null,
         job.klassen ?? "{}", job.quereinsteiger === true,
         job.finanzierung ?? "keine", job.arbeitszeit ?? null, job.samstag ?? null,
         job.geprueft ?? null, job.erstveroeffentlicht ?? null],
      );
    }

    for (const [i, bild] of s.bilder.entries()) {
      await sql.unsafe(
        "insert into public.school_images (school_id, kategorie, url, alt, position) values ($1,$2,$3,$4,$5)",
        [sid, bild.kategorie, bild.url, bild.alt, i],
      );
    }
  }
}

// ----------------------------------------------------------------------------
// Count-Report über den aktuellen dev_seed-Bestand.
// ----------------------------------------------------------------------------
async function countSeed(sql) {
  const rows = await sql.unsafe(
    "select id from public.driving_schools where source = 'dev_seed'",
  );
  const ids = rows.map((r) => r.id);
  const counts = { driving_schools: ids.length };
  const [brands] = await sql.unsafe(
    `select count(*)::int as n from public.school_brands b
      where exists (select 1 from public.driving_schools s
                     where s.brand_id = b.id and s.source = 'dev_seed')`,
  );
  counts.school_brands = brands.n;
  if (ids.length === 0) return counts;
  for (const table of [
    "school_profiles", "school_prices", "school_opening_hours", "school_vehicles",
    "instructors", "school_faq_items", "school_jobs", "school_images",
  ]) {
    const [r] = await sql.unsafe(
      `select count(*)::int as n from public.${table} where school_id = any($1::uuid[])`,
      [uuidArr(ids)],
    );
    counts[table] = r.n;
  }
  return counts;
}

function printCounts(titel, counts) {
  console.log(`\n${titel}:`);
  const entries = Object.entries(counts);
  if (entries.length === 0) {
    console.log("  (kein dev_seed-Bestand vorhanden)");
    return;
  }
  for (const [k, v] of entries) console.log(`  ${k.padEnd(22)} ${v}`);
}

const sql = postgres(tooling, { max: 1, ssl: getDbSslOption(tooling), onnotice: () => {} });
try {
  await sql.begin(async (tx) => {
    const removed = await removeSeed(tx);
    printCounts("Entfernt (dev_seed)", removed);
    if (removeOnly) return;
    await seedAll(tx);
    printCounts("Geseedet (dev_seed)", await countSeed(tx));
  });
  console.log(
    removeOnly
      ? "\nFertig ✓ — alle Demo-Daten rückstandsfrei entfernt."
      : "\nFertig ✓ — Demo-Daten eingespielt (löschen: npm run db:seed:demo:remove).",
  );
} catch (err) {
  console.error("seed-demo fehlgeschlagen:", err?.message ?? err);
  process.exitCode = 1;
} finally {
  await sql.end();
}
