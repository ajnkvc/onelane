import type { RatgeberCoverId } from "@/lib/ratgeber";

/**
 * RatgeberCover — Illustrations-Cover der Ratgeber-Guides (Server-Komponente).
 * ----------------------------------------------------------------------------
 * Inline-SVG statt Bild-Asset (CSP-fest, kein Request, kein CLS): je Cover-Id
 * eine EIGENE stilisierte Szene im Markenstil — flächig-minimalistisch,
 * Petrol-Palette ausschließlich über Token-Utilities (fill-/stroke-Klassen
 * auf CSS-Variablen, NIE Hex), Menschen nur als einfache Figuren. Wiederkehrende
 * Signatur: das „lane"-Motiv (gestrichelte Fahrbahn-Mittellinie).
 *
 * Format 16:10 (viewBox 640×400), `preserveAspectRatio="xMidYMid slice"` —
 * die Grafik füllt ihren Container wie ein Foto. Runde Ecken macht der
 * KARTEN-Container (rounded-2xl/3xl + overflow-hidden — Bilder sind bei uns
 * rund, Daten kantig); das SVG selbst bleibt eckig. Rein dekorativ
 * (aria-hidden), Text-Glyphen in den Szenen sind Bildbestandteil.
 */

/** Marken-Signatur: breite Fahrbahn + gestrichelte Mittellinie auf einem Pfad. */
function Lane({ d, band = 60 }: { d: string; band?: number }) {
  return (
    <g>
      <path d={d} className="stroke-brand-sky/15" strokeWidth={band} strokeLinecap="round" />
      <path
        d={d}
        className="stroke-brand-sky/50"
        strokeWidth={3}
        strokeDasharray="16 22"
        strokeLinecap="round"
      />
    </g>
  );
}

/** Kosten — fünf Bausteine wachsen entlang der Fahrbahn (zahlenlos). */
function SzeneKosten() {
  return (
    <g>
      <rect width="640" height="400" className="fill-secondary" />
      <circle cx="490" cy="110" r="150" className="fill-brand-sky/10" />
      <Lane d="M-30 352 C 180 316, 420 386, 670 330" />
      {/* fünf Preis-Bausteine — aufsteigend, jeder ein eigener Ton */}
      <rect x="112" y="252" width="62" height="76" rx="10" className="fill-brand-sky/60" />
      <rect x="192" y="224" width="62" height="104" rx="10" className="fill-brand-cyan/60" />
      <rect x="272" y="192" width="62" height="136" rx="10" className="fill-primary" />
      <rect x="352" y="158" width="62" height="170" rx="10" className="fill-brand-sky/35" />
      <rect x="432" y="118" width="62" height="210" rx="10" className="fill-accent" />
      {/* Preisschild-Anhänger — bewusst OHNE Zahl (§ 32 FahrlG) */}
      <g transform="rotate(-14 540 96)">
        <rect x="500" y="76" width="80" height="44" rx="10" className="fill-card stroke-border" strokeWidth="2" />
        <circle cx="514" cy="98" r="5" className="fill-none stroke-brand-sky" strokeWidth="2.5" />
        <path d="M530 90 h36 M530 106 h24" className="stroke-brand-sky/50" strokeWidth="4" strokeLinecap="round" />
      </g>
      <path d="M508 84 C 496 60, 480 52, 466 56" className="stroke-brand-sky/40" strokeWidth="2.5" fill="none" strokeDasharray="1 7" strokeLinecap="round" />
    </g>
  );
}

/** Auswahl — drei Schul-Karten, die Lupe hebt die passende hervor. */
function SzeneAuswahl() {
  return (
    <g>
      <rect width="640" height="400" className="fill-secondary" />
      <circle cx="150" cy="110" r="130" className="fill-brand-cyan/10" />
      <Lane d="M-30 356 C 200 318, 440 392, 670 336" />
      {/* linke + rechte Karte: ruhig, zurückgenommen */}
      <g>
        <rect x="96" y="158" width="112" height="140" rx="14" className="fill-card stroke-border" strokeWidth="2" />
        <rect x="118" y="182" width="68" height="10" rx="5" className="fill-muted-foreground/25" />
        <rect x="118" y="204" width="48" height="8" rx="4" className="fill-muted-foreground/20" />
        <rect x="130" y="244" width="44" height="54" rx="6" className="fill-brand-sky/25" />
      </g>
      <g>
        <rect x="432" y="158" width="112" height="140" rx="14" className="fill-card stroke-border" strokeWidth="2" />
        <rect x="454" y="182" width="68" height="10" rx="5" className="fill-muted-foreground/25" />
        <rect x="454" y="204" width="48" height="8" rx="4" className="fill-muted-foreground/20" />
        <rect x="466" y="244" width="44" height="54" rx="6" className="fill-brand-sky/25" />
      </g>
      {/* Mitte: die passende Karte, leicht größer + markiert */}
      <g>
        <rect x="248" y="132" width="144" height="166" rx="16" className="fill-card stroke-brand-sky/60" strokeWidth="3" />
        <rect x="274" y="160" width="92" height="12" rx="6" className="fill-brand-ink/70" />
        <rect x="274" y="186" width="64" height="9" rx="4.5" className="fill-muted-foreground/30" />
        <rect x="288" y="228" width="64" height="70" rx="8" className="fill-brand-sky/50" />
        <circle cx="382" cy="142" r="12" className="fill-accent" />
      </g>
      {/* Lupe — Auswahl-Geste */}
      <circle cx="352" cy="220" r="58" className="fill-brand-sky/10 stroke-primary" strokeWidth="9" />
      <path d="M394 262 L 452 322" className="stroke-primary" strokeWidth="13" strokeLinecap="round" />
    </g>
  );
}

/** Wechsel — die markierte Spur zweigt ruhig von der alten Route ab. */
function SzeneWechsel() {
  return (
    <g>
      <rect width="640" height="400" className="fill-secondary" />
      <circle cx="520" cy="120" r="140" className="fill-brand-sky/10" />
      {/* alte Route: läuft blass weiter */}
      <path d="M-30 300 C 180 282, 380 306, 670 292" className="stroke-foreground/10" strokeWidth={56} strokeLinecap="round" />
      <path d="M-30 300 C 180 282, 380 306, 670 292" className="stroke-foreground/20" strokeWidth={3} strokeDasharray="16 22" strokeLinecap="round" />
      {/* neue Route: zweigt ab und führt nach oben — die Marken-Spur */}
      <Lane d="M240 296 C 340 288, 420 220, 480 168 S 580 92, 640 76" band={52} />
      {/* Auto (Draufsicht) auf der neuen Spur */}
      <g transform="rotate(-42 452 190)">
        <rect x="436" y="158" width="32" height="62" rx="11" className="fill-primary" />
        <rect x="441" y="170" width="22" height="13" rx="4" className="fill-secondary" />
        <rect x="441" y="196" width="22" height="10" rx="4" className="fill-secondary/70" />
      </g>
      {/* Richtungspfeil am Ende der neuen Spur */}
      <path d="M596 104 L 632 82 L 620 122 Z" className="fill-accent" />
      {/* Start-Markierung auf der alten Route */}
      <circle cx="240" cy="296" r="10" className="fill-none stroke-brand-sky/60" strokeWidth="3" />
    </g>
  );
}

/** BF17 — Auto mit zwei Personen: fahren + begleiten. */
function SzeneBf17() {
  return (
    <g>
      <rect width="640" height="400" className="fill-secondary" />
      <circle cx="140" cy="120" r="120" className="fill-brand-cyan/10" />
      <Lane d="M-30 340 C 200 310, 440 366, 670 326" />
      {/* Auto (Seitenansicht) */}
      <rect x="160" y="206" width="300" height="76" rx="26" className="fill-primary" />
      <path d="M212 210 C 224 168, 262 152 310 152 H 360 C 404 152, 424 178, 432 210 Z" className="fill-primary" />
      {/* Fenster mit zwei Köpfen: vorn fährt, daneben begleitet */}
      <path d="M236 204 C 244 178, 268 166 300 166 H 306 V 204 Z" className="fill-secondary" />
      <path d="M320 166 H 356 C 388 166, 404 184 410 204 H 320 Z" className="fill-secondary" />
      <circle cx="286" cy="188" r="13" className="fill-brand-sky" />
      <circle cx="356" cy="188" r="13" className="fill-brand-cyan" />
      {/* Räder */}
      <circle cx="238" cy="288" r="30" className="fill-brand-ink" />
      <circle cx="238" cy="288" r="12" className="fill-secondary" />
      <circle cx="392" cy="288" r="30" className="fill-brand-ink" />
      <circle cx="392" cy="288" r="12" className="fill-secondary" />
      {/* „17"-Plakette — dekorativer Bildbestandteil */}
      <circle cx="502" cy="140" r="38" className="fill-accent" />
      <text
        x="502"
        y="152"
        textAnchor="middle"
        fontSize="34"
        fontWeight="700"
        className="fill-accent-foreground"
      >
        17
      </text>
    </g>
  );
}

/** Theorie — Fragebogen mit markierter Antwort: verstehen, nicht raten. */
function SzeneTheorie() {
  return (
    <g>
      <rect width="640" height="400" className="fill-secondary" />
      <circle cx="510" cy="100" r="120" className="fill-brand-sky/10" />
      <Lane d="M-30 366 C 200 336, 440 396, 670 350" band={48} />
      {/* Fragebogen */}
      <rect x="188" y="56" width="264" height="252" rx="18" className="fill-card stroke-border" strokeWidth="2" />
      <rect x="216" y="86" width="150" height="13" rx="6.5" className="fill-brand-ink/70" />
      <rect x="216" y="108" width="102" height="9" rx="4.5" className="fill-muted-foreground/30" />
      {/* drei Antwort-Zeilen — die mittlere sitzt */}
      <rect x="216" y="142" width="208" height="36" rx="18" className="fill-muted" />
      <circle cx="234" cy="160" r="9" className="fill-none stroke-muted-foreground/40" strokeWidth="2.5" />
      <rect x="216" y="192" width="208" height="36" rx="18" className="fill-brand-sky/15 stroke-brand-sky/50" strokeWidth="2" />
      <circle cx="234" cy="210" r="10" className="fill-accent" />
      <path d="M229 210 l4 4 7 -8" className="stroke-accent-foreground" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <rect x="216" y="242" width="208" height="36" rx="18" className="fill-muted" />
      <circle cx="234" cy="260" r="9" className="fill-none stroke-muted-foreground/40" strokeWidth="2.5" />
      {/* Verstehens-Funke */}
      <circle cx="486" cy="86" r="26" className="fill-brand-cyan/20" />
      <text x="486" y="97" textAnchor="middle" fontSize="30" fontWeight="700" className="fill-primary">
        ?
      </text>
    </g>
  );
}

/** Praxis — die Route zum Prüfungstag, Ziel in Sicht. */
function SzenePraxis() {
  return (
    <g>
      <rect width="640" height="400" className="fill-secondary" />
      <circle cx="160" cy="120" r="130" className="fill-brand-sky/10" />
      {/* Route windet sich zum Ziel */}
      <Lane d="M60 396 C 130 320, 300 344, 366 258 S 470 128, 548 96" band={54} />
      {/* Auto (Draufsicht) unterwegs */}
      <g transform="rotate(-38 360 268)">
        <rect x="342" y="234" width="36" height="68" rx="12" className="fill-primary" />
        <rect x="348" y="248" width="24" height="14" rx="5" className="fill-secondary" />
        <rect x="348" y="276" width="24" height="11" rx="5" className="fill-secondary/70" />
      </g>
      {/* Zielflagge */}
      <path d="M548 96 V 30" className="stroke-brand-ink/70" strokeWidth="5" strokeLinecap="round" />
      <rect x="548" y="30" width="56" height="36" className="fill-card stroke-border" strokeWidth="1.5" />
      <rect x="548" y="30" width="14" height="18" className="fill-brand-ink/80" />
      <rect x="576" y="30" width="14" height="18" className="fill-brand-ink/80" />
      <rect x="562" y="48" width="14" height="18" className="fill-brand-ink/80" />
      <rect x="590" y="48" width="14" height="18" className="fill-brand-ink/80" />
      {/* Start-Punkt */}
      <circle cx="72" cy="384" r="10" className="fill-none stroke-brand-sky/60" strokeWidth="3" />
      <circle cx="548" cy="96" r="8" className="fill-accent" />
    </g>
  );
}

/** Klassen — Zweirad, Auto, Gespann: eine Spur, drei Wege. */
function SzeneKlassen() {
  return (
    <g>
      <rect width="640" height="400" className="fill-secondary" />
      <circle cx="320" cy="90" r="120" className="fill-brand-cyan/10" />
      <Lane d="M-30 344 C 200 316, 440 368, 670 330" />
      {/* Motorrad (links) */}
      <g>
        <circle cx="102" cy="286" r="26" className="fill-none stroke-brand-ink/80" strokeWidth="7" />
        <circle cx="196" cy="286" r="26" className="fill-none stroke-brand-ink/80" strokeWidth="7" />
        <path d="M102 286 L 138 236 L 176 236 L 196 286 M 138 236 L 150 286" className="stroke-brand-sky" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M128 222 h24" className="stroke-brand-sky" strokeWidth="7" strokeLinecap="round" />
      </g>
      {/* Auto (Mitte) */}
      <g>
        <rect x="258" y="238" width="150" height="48" rx="16" className="fill-primary" />
        <path d="M282 240 C 290 214, 312 204 336 204 H 356 C 380 204, 392 222 396 240 Z" className="fill-primary" />
        <path d="M296 238 C 302 222, 316 214 334 214 H 340 V 238 Z" className="fill-secondary" />
        <path d="M352 214 H 358 C 374 214, 382 226 386 238 H 352 Z" className="fill-secondary" />
        <circle cx="294" cy="290" r="20" className="fill-brand-ink" />
        <circle cx="294" cy="290" r="8" className="fill-secondary" />
        <circle cx="374" cy="290" r="20" className="fill-brand-ink" />
        <circle cx="374" cy="290" r="8" className="fill-secondary" />
      </g>
      {/* Anhänger (rechts) — BE-Gespann angedeutet */}
      <g>
        <path d="M408 264 H 452" className="stroke-brand-ink/60" strokeWidth="5" strokeLinecap="round" />
        <rect x="452" y="228" width="110" height="52" rx="10" className="fill-brand-cyan/50 stroke-brand-cyan" strokeWidth="2.5" />
        <circle cx="507" cy="292" r="18" className="fill-brand-ink" />
        <circle cx="507" cy="292" r="7" className="fill-secondary" />
      </g>
      {/* Klassen-Schilder über den Fahrzeugen */}
      <g>
        <rect x="120" y="150" width="58" height="34" rx="17" className="fill-card stroke-border" strokeWidth="2" />
        <text x="149" y="173" textAnchor="middle" fontSize="19" fontWeight="700" className="fill-primary">
          A1
        </text>
        <rect x="304" y="150" width="52" height="34" rx="17" className="fill-card stroke-brand-sky/60" strokeWidth="2" />
        <text x="330" y="173" textAnchor="middle" fontSize="19" fontWeight="700" className="fill-primary">
          B
        </text>
        <rect x="478" y="150" width="58" height="34" rx="17" className="fill-card stroke-border" strokeWidth="2" />
        <text x="507" y="173" textAnchor="middle" fontSize="19" fontWeight="700" className="fill-primary">
          BE
        </text>
      </g>
    </g>
  );
}

/** Karriere — eine Person erklärt die Fahrbahn: der Weg nach vorn. */
function SzeneKarriere() {
  return (
    <g>
      <rect width="640" height="400" className="fill-secondary" />
      <circle cx="150" cy="110" r="120" className="fill-brand-sky/10" />
      <Lane d="M-30 362 C 200 330, 440 388, 670 342" band={48} />
      {/* Tafel mit Mini-Fahrbahn: das Unterrichts-Motiv */}
      <rect x="128" y="76" width="252" height="168" rx="14" className="fill-card stroke-border" strokeWidth="2" />
      <path d="M156 214 C 210 202, 250 150, 350 116" className="stroke-brand-sky/20" strokeWidth={26} strokeLinecap="round" fill="none" />
      <path d="M156 214 C 210 202, 250 150, 350 116" className="stroke-brand-sky/60" strokeWidth={2.5} strokeDasharray="10 14" strokeLinecap="round" fill="none" />
      <circle cx="350" cy="116" r="8" className="fill-accent" />
      {/* Tafel-Beine */}
      <path d="M170 244 L 148 320 M 338 244 L 360 320" className="stroke-brand-ink/40" strokeWidth="6" strokeLinecap="round" />
      {/* Figur: erklärt mit ausgestrecktem Arm */}
      <circle cx="472" cy="128" r="24" className="fill-primary" />
      <rect x="440" y="158" width="64" height="104" rx="28" className="fill-brand-sky/70" />
      <path d="M448 184 Q 416 168 396 150" className="stroke-brand-sky/70" strokeWidth="13" strokeLinecap="round" fill="none" />
      <rect x="450" y="258" width="13" height="62" rx="6.5" className="fill-brand-ink/70" />
      <rect x="480" y="258" width="13" height="62" rx="6.5" className="fill-brand-ink/70" />
    </g>
  );
}

const SZENEN: Record<RatgeberCoverId, () => React.JSX.Element> = {
  kosten: SzeneKosten,
  auswahl: SzeneAuswahl,
  wechsel: SzeneWechsel,
  bf17: SzeneBf17,
  theorie: SzeneTheorie,
  praxis: SzenePraxis,
  klassen: SzeneKlassen,
  karriere: SzeneKarriere,
};

export function RatgeberCover({
  id,
  className = "",
}: {
  id: RatgeberCoverId;
  className?: string;
}) {
  const Szene = SZENEN[id];
  return (
    <svg
      viewBox="0 0 640 400"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
      fill="none"
      className={`block h-auto w-full ${className}`}
    >
      <Szene />
    </svg>
  );
}
