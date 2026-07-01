import type { Metadata } from "next";
import Link from "next/link";

/**
 * VORSCHAU-Übersicht — Einstieg zu den Design-Tests. `noindex`, nicht im Footer.
 * Die echte Startseite (/) bleibt unverändert.
 */
export const metadata: Metadata = {
  title: "Design-Vorschauen",
  robots: { index: false, follow: false },
};

const PREMIUM = [
  { href: "/vorschau/premium-1", t: "Premium 1 · Route", d: "Original-Hero + Karten-/Routen-Grafik hinter der Suche.", grad: "linear-gradient(120deg,#0f2235,#0e7490 55%,#0ea5e9)" },
  { href: "/vorschau/premium-2", t: "Premium 2 · Mesh + Bento", d: "Feines Mesh + schwebende Ergebnis-Vorschau (Bento).", grad: "linear-gradient(120deg,#0ea5e9,#6366f1 60%,#22d3ee)" },
  { href: "/vorschau/premium-3", t: "Premium 3 · Spotlight", d: "Dunkler Spotlight + dezentes Lenkrad-Motiv, glasige Suche.", grad: "radial-gradient(circle at 50% 0%,#0ea5e9,#071a2c 70%)" },
  { href: "/vorschau/premium-4", t: "Premium 4 · Topografie", d: "Feine Höhenlinien wie eine abstrakte Landkarte hinter der Suche.", grad: "linear-gradient(120deg,#eef9ff,#0ea5e9)" },
  { href: "/vorschau/premium-5", t: "Premium 5 · Wegweiser", d: "Claymorphe Straßenschild-Illustration neben der Suche.", grad: "linear-gradient(120deg,#0e7490,#22d3ee 60%,#a3e635)" },
  { href: "/vorschau/premium-6", t: "Premium 6 · Aurora Route", d: "Aurora + Punkt-Route mit Pins, glasige Suche (dunkel).", grad: "radial-gradient(circle at 50% 0%,#22d3ee,#071a2c 70%)" },
  { href: "/vorschau/premium-7", t: "Premium 7 · Fahrstunde ▶", d: "Animierte SVG-Szene: Auto mit Lehrer + Schüler, fahrende Straße.", grad: "linear-gradient(120deg,#e9f6ff,#0ea5e9 60%,#a3e635)" },
  { href: "/vorschau/premium-8", t: "Premium 8 · Interaktiv ✦", d: "Hintergrund-Blobs folgen der Maus (Parallax), glasige Suche.", grad: "radial-gradient(circle at 30% 20%,#6366f1,#071a2c 70%)" },
  { href: "/vorschau/premium-9", t: "Premium 9 · Live-Widgets", d: "Schwebende Beispiel-Karten, pulsierender Pin, Quoten-Ring.", grad: "linear-gradient(120deg,#0ea5e9,#a3e635)" },
  { href: "/vorschau/premium-10", t: "Premium 10 · Diagonal Split", d: "Mutiges diagonales Layout, dunkle Schrägfläche + Widget.", grad: "linear-gradient(120deg,#fff 50%,#0f2235 50%)" },
  { href: "/vorschau/premium-11", t: "Premium 11 · Clay Stack", d: "Claymorpher Karten-Stapel mit Tiefe, sanft schwebend.", grad: "linear-gradient(120deg,#dbeafe,#0ea5e9 60%,#a3e635)" },
  { href: "/vorschau/premium-12", t: "Premium 12 · Map-first", d: "Abstrakte SVG-Stadtkarte + pulsierende Pins, glasige Suche.", grad: "linear-gradient(120deg,#eef2f7,#0ea5e9)" },
  { href: "/vorschau/premium", t: "Premium (Erstentwurf)", d: "Die ruhige Fintech/Apple-Basis zum Vergleich.", grad: "linear-gradient(120deg,#0f2235,#0e7490)" },
];

const LAUT = [
  { href: "/vorschau/laut-1", t: "Laut 1 · Refined Brutalism", d: "Begrenzte Palette, harte Schatten, klar lesbar — mutig & seriös.", grad: "linear-gradient(120deg,#ffd23f,#2f5bff)" },
  { href: "/vorschau/laut-2", t: "Laut 2 · Bold Editorial", d: "Riesige Typo, kinetische Headline, viel Schwarz + ein lauter Akzent.", grad: "linear-gradient(120deg,#0c0c0d,#c6ff3a)" },
  { href: "/vorschau/laut-3", t: "Laut 3 · Mesh Pop", d: "Warmer 2026-Mesh-Gradient, freundlich, rund, poliert.", grad: "linear-gradient(120deg,#ff7a18,#ff5c8a 55%,#7c5cff)" },
  { href: "/vorschau/laut-4", t: "Laut 4 · Neon Night", d: "Dunkel & edel, ein Neon-Akzent mit Glow.", grad: "linear-gradient(120deg,#0d0f12,#c6ff3a)" },
  { href: "/vorschau/laut-5", t: "Laut 5 · Color-Block", d: "Bauhaus-Farbblöcke, riesige Typo, strenges Raster.", grad: "linear-gradient(120deg,#2f5bff,#ffd23f 55%,#ff5c8a)" },
  { href: "/vorschau/laut-6", t: "Laut 6 · Marker", d: "Saubere Basis + handgezeichnete Marker-Akzente.", grad: "linear-gradient(120deg,#fff,#ff7a18)" },
  { href: "/vorschau/laut-7", t: "Laut 7 · Comic Pop-Art", d: "Comic-Fahrlehrer + Sprechblase + Halbton, knallig.", grad: "linear-gradient(120deg,#ffd23f,#2f5bff 60%,#dc2626)" },
  { href: "/vorschau/laut-8", t: "Laut 8 · Retro Arcade", d: "Neon-Grid-Horizont, Scanlines, 80s-Vibe.", grad: "linear-gradient(120deg,#0a0420,#ff2e97 55%,#22d3ee)" },
  { href: "/vorschau/laut-9", t: "Laut 9 · Risograph", d: "Duotone-Druck-Look mit Korn & Versatz (Orange/Tiefblau).", grad: "linear-gradient(120deg,#fff4ec,#ff5c1a 55%,#1d3a8a)" },
  { href: "/vorschau/laut-10", t: "Laut 10 · Sticker Collage", d: "Geschmackvolle Sticker/Badges auf klarem Raster.", grad: "linear-gradient(120deg,#a3e635,#ffd23f 55%,#f472b6)" },
  { href: "/vorschau/laut-11", t: "Laut 11 · Kinetic Type Wall", d: "Wand aus laufenden Wörtern in Gegenrichtungen.", grad: "linear-gradient(120deg,#111,#a3e635)" },
  { href: "/vorschau/frech", t: "Frech (Erstentwurf)", d: "Der erste Sticker-/Brutalismus-Versuch zum Vergleich.", grad: "linear-gradient(120deg,#a3e635,#38bdf8 55%,#f472b6)" },
];

function Card({ href, t, d, grad }: { href: string; t: string; d: string; grad: string }) {
  return (
    <Link href={href} className="group rounded-2xl border border-border bg-card p-6 transition hover:-translate-y-1 hover:shadow-lg">
      <div className="h-20 rounded-xl" style={{ background: grad }} />
      <h3 className="mt-4 text-base font-semibold">{t}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{d}</p>
      <span className="mt-2 inline-block text-sm font-medium text-brand-sky">Ansehen →</span>
    </Link>
  );
}

export default function VorschauIndex() {
  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-14">
      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Design-Test (nicht final)</span>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">Design-Varianten zum Vergleich</h1>
      <p className="mt-3 max-w-2xl text-sm text-muted-foreground">Die echte Startseite (<Link href="/" className="underline underline-offset-2">/</Link>) bleibt unverändert. Klick dich durch — sag mir, welche Richtung (oder Mix) dir gefällt.</p>

      <h2 className="mt-10 text-lg font-semibold">Premium · ruhig &amp; hochwertig</h2>
      <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{PREMIUM.map((c) => <Card key={c.href} {...c} />)}</div>

      <h2 className="mt-12 text-lg font-semibold">Laut · mutig &amp; vertrauenswürdig</h2>
      <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{LAUT.map((c) => <Card key={c.href} {...c} />)}</div>
    </div>
  );
}
