/**
 * Ratgeber-Registry — EINE Quelle aller Guides.
 * ----------------------------------------------------------------------------
 * Hub (/ratgeber), Startseiten-Feed („Aus dem Ratgeber"), Artikel-Shell
 * (components/ratgeber/artikel.tsx), Sitemap und llms.txt lesen ausschließlich
 * von hier — Reihenfolge des Arrays = Reihenfolge auf dem Hub.
 *
 * EHRLICHKEIT (§ 32 FahrlG, UWG): Teaser sind zahlenlos (keine Preise, keine
 * Quoten, keine Fristen) und versprechen nichts, was wir nicht halten können.
 * Neue Guides IMMER hier registrieren; die Artikel-Seite unter
 * src/app/ratgeber/<slug>/page.tsx nutzt dann Shell + Metadata-Helfer.
 */

/** Cover-Motive (Inline-SVG-Szenen in components/ratgeber/cover.tsx). */
export type RatgeberCoverId =
  | "kosten"
  | "auswahl"
  | "wechsel"
  | "bf17"
  | "theorie"
  | "praxis"
  | "klassen"
  | "karriere";

export type RatgeberGuide = {
  /** URL-Segment unter /ratgeber/<slug> */
  slug: string;
  titel: string;
  /** 1–2 ehrliche Sätze — zahlenlos, ohne Erfolgsversprechen. */
  teaser: string;
  kategorie: string;
  cover: RatgeberCoverId;
  /** Redaktionsstand (YYYY-MM) — sichtbar als „Stand: Juli 2026". */
  stand: "2026-07";
  /** realistische Lesezeit in Minuten */
  lesezeit: number;
  /** true = erscheint im Startseiten-Feed (genau 3 Guides). */
  featured: boolean;
};

/** Sichtbares Label zum Redaktionsstand „2026-07". */
export const RATGEBER_STAND_LABEL = "Juli 2026";

export const RATGEBER_GUIDES: ReadonlyArray<RatgeberGuide> = [
  {
    slug: "was-der-fuehrerschein-kostet",
    titel: "Was der Führerschein wirklich kostet — die fünf Bausteine erklärt",
    teaser:
      "Einen seriösen Gesamtpreis gibt es vorab nicht — aber fünf Bausteine, aus denen sich jeder Preisaushang zusammensetzt. Wer sie kennt, vergleicht besser.",
    kategorie: "Kosten",
    cover: "kosten",
    stand: "2026-07",
    lesezeit: 7,
    featured: true,
  },
  {
    slug: "gute-fahrschule-erkennen",
    titel: "Woran du eine gute Fahrschule erkennst",
    teaser:
      "Nähe und Bauchgefühl allein reichen nicht. Woran du Qualität wirklich erkennst — vom ersten Kontakt bis zum Blick in den Vertrag.",
    kategorie: "Auswahl",
    cover: "auswahl",
    stand: "2026-07",
    lesezeit: 6,
    featured: true,
  },
  {
    slug: "fahrschule-wechseln",
    titel: "Fahrschule wechseln: So gehst du es ruhig an",
    teaser:
      "Wenn es nicht passt, darfst du gehen — ohne Drama und ohne bei null anzufangen. Was du vorher klären solltest und wie der Übergang gelingt.",
    kategorie: "Wechsel",
    cover: "wechsel",
    stand: "2026-07",
    lesezeit: 5,
    featured: true,
  },
  {
    slug: "bf17-begleitetes-fahren",
    titel: "BF17: Mit 17 hinters Steuer — so funktioniert begleitetes Fahren",
    teaser:
      "Den Führerschein mit 17 machen und Fahrpraxis sammeln, bevor es allein losgeht: wie Begleitetes Fahren funktioniert und wer als Begleitung infrage kommt.",
    kategorie: "BF17",
    cover: "bf17",
    stand: "2026-07",
    lesezeit: 6,
    featured: false,
  },
  {
    slug: "theoriepruefung-bestehen",
    titel: "Theorieprüfung: Verstehen schlägt Auswendiglernen",
    teaser:
      "Auswendiglernen bringt dich durch die Fragen, Verstehen durch den Verkehr. Wie du die Theorie so angehst, dass sie in der Prüfung und danach trägt.",
    kategorie: "Prüfung",
    cover: "theorie",
    stand: "2026-07",
    lesezeit: 6,
    featured: false,
  },
  {
    slug: "praktische-pruefung-ablauf",
    titel: "Die praktische Prüfung: Ablauf, Nerven, Plan B",
    teaser:
      "Was am Prüfungstag wirklich passiert, wie du mit Nervosität umgehst — und warum ein nicht bestandener erster Versuch kein Beinbruch ist.",
    kategorie: "Prüfung",
    cover: "praxis",
    stand: "2026-07",
    lesezeit: 7,
    featured: false,
  },
  {
    slug: "fuehrerscheinklassen-ueberblick",
    titel: "B, B197, BE & Co.: Welche Klasse brauchst du wirklich?",
    teaser:
      "B, B197, BE oder doch etwas ganz anderes? Die wichtigsten Führerscheinklassen im Überblick — und wie du herausfindest, was zu deinen Plänen passt.",
    kategorie: "Klassen",
    cover: "klassen",
    stand: "2026-07",
    lesezeit: 8,
    featured: false,
  },
  {
    slug: "fahrlehrer-werden",
    titel: "Fahrlehrer:in werden: Der Quereinstieg, der sich lohnen kann",
    teaser:
      "Fahrlehrer:innen werden vielerorts gesucht — und der Weg in den Beruf steht auch Quereinsteiger:innen offen. Welche Voraussetzungen gelten und wie die Ausbildung abläuft.",
    kategorie: "Karriere",
    cover: "karriere",
    stand: "2026-07",
    lesezeit: 6,
    featured: false,
  },
];

/** Guide per Slug (Artikel-Shell/Metadata) — undefined bei unbekanntem Slug. */
export function getGuide(slug: string): RatgeberGuide | undefined {
  return RATGEBER_GUIDES.find((g) => g.slug === slug);
}

/** Die Featured-Guides (featured=true) — Startseiten-Feed, Reihenfolge = Registry. */
export const FEATURED_GUIDES: ReadonlyArray<RatgeberGuide> = RATGEBER_GUIDES.filter(
  (g) => g.featured,
);
