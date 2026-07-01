import Image from "next/image";
import type { SchoolProfileDetail, ProfileVehicle, ProfileInstructor } from "@/modules/schools/profile";

/**
 * bento.tsx — Profil-„auf einen Blick" (Bento), Sub-Bewertungen, Fahrlehrer-
 * Kacheln (Bild/Bewertung/Motto) und Fahrzeug-Kacheln (mit Bild). Server-
 * Komponenten. Werte ohne DB-Feld (Quote, Ø-Preis, Fahrlehrer-Rating/Motto) sind
 * stabile BEISPIELE je Schule/Person — echte Daten folgen (Mobilithek/Uploads).
 */
function h(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i++) n = (n * 31 + s.charCodeAt(i)) >>> 0;
  return n;
}
const AVATARS = ["/seed/avatar-1.svg", "/seed/avatar-2.svg", "/seed/avatar-3.svg"];
const MOTTOS = [
  "Geduldig ans Ziel.",
  "Sicher fahren, entspannt bestehen.",
  "Dein Tempo, deine Strecke.",
  "Aus der Praxis, für die Praxis.",
  "Locker bleiben — los geht's.",
  "Vom ersten Meter an sicher.",
];
function instructorRating(id: string): number {
  return (41 + (h(id + "r") % 9)) / 10; // 4.1–4.9
}
function passRate(school: SchoolProfileDetail): number {
  if (school.failRate != null) {
    const q = Number(school.failRate);
    if (Number.isFinite(q)) return Math.max(40, Math.min(95, 100 - (q <= 1 ? Math.round(q * 100) : Math.round(q))));
  }
  return 60 + (h(school.id) % 25); // 60–84 % Beispiel
}
function examplePrice(id: string): number {
  return 1800 + (h(id) % 1100);
}

function Stars({ value }: { value: number }) {
  const full = Math.round(value);
  return (
    <span className="text-amber-500" aria-label={`${value.toFixed(1)} von 5`}>
      {"★".repeat(full)}<span className="text-muted-foreground">{"★".repeat(5 - full)}</span>
    </span>
  );
}

/* ----------------------------- Bento „auf einen Blick" ----------------------------- */
export function ProfileBento({ school }: { school: SchoolProfileDetail }) {
  const quote = passRate(school);
  const tile = "rounded-2xl border border-border bg-card p-5";
  return (
    <section className="reveal-stagger grid grid-cols-2 gap-4 md:grid-cols-4">
      {/* Quote-Gauge (großes Tile) */}
      <div className={`${tile} col-span-2 flex items-center gap-5`}>
        <div className="grid size-24 shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(#0ea5e9 0 ${quote}%, #e2e8f0 ${quote}% 100%)` }}>
          <span className="grid size-[4.2rem] place-items-center rounded-full bg-card text-xl font-bold text-[#0369a1]">{quote}%</span>
        </div>
        <div>
          <p className="font-semibold">Bestehensquote (Praxis)</p>
          <p className="text-sm text-muted-foreground">{school.failRate != null ? "Angabe der Fahrschule / TÜV-Daten" : "Beispielwert — echte Quote folgt"}</p>
        </div>
      </div>

      <div className={tile}>
        <p className="text-xs text-muted-foreground">Ø-Preis Klasse B</p>
        <p className="mt-1 text-2xl font-bold text-gradient-brand">ca. {examplePrice(school.id).toLocaleString("de-DE")} €</p>
      </div>

      <div className={tile}>
        <p className="text-xs text-muted-foreground">Bewertung</p>
        <p className="mt-1 text-2xl font-bold">{school.googleRating ? `★ ${school.googleRating}` : "—"}</p>
        {school.googleReviewsCount ? <p className="text-xs text-muted-foreground">{school.googleReviewsCount} Bewertungen</p> : null}
      </div>

      <div className={tile}>
        <p className="text-xs text-muted-foreground">Fuhrpark</p>
        <p className="mt-1 text-2xl font-bold">{school.vehicles.length || "—"}</p>
        <p className="text-xs text-muted-foreground">Fahrzeuge</p>
      </div>

      <div className={tile}>
        <p className="text-xs text-muted-foreground">Klassen</p>
        <p className="mt-1 text-2xl font-bold">{school.klassen.length || "—"}</p>
        <p className="text-xs text-muted-foreground">{school.klassen.slice(0, 4).join(" · ")}</p>
      </div>
    </section>
  );
}

/* ----------------------------- Sub-Bewertungen ----------------------------- */
const ASPECTS = ["Geduld", "Theorie-Qualität", "Fahrzeuge", "Wartezeit", "Freundlichkeit"];
export function AspectRatings({ school }: { school: SchoolProfileDetail }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <h2 className="mb-4 text-lg font-semibold">Bewertung im Detail</h2>
      <div className="flex flex-col gap-3">
        {ASPECTS.map((a) => {
          const v = (38 + (h(school.id + a) % 12)) / 10; // 3.8–4.9
          return (
            <div key={a} className="grid grid-cols-[9rem_1fr_2.5rem] items-center gap-3 text-sm">
              <span className="text-muted-foreground">{a}</span>
              <span className="h-2 overflow-hidden rounded-full bg-secondary">
                <span className="block h-full rounded-full" style={{ width: `${(v / 5) * 100}%`, background: "linear-gradient(90deg,#0ea5e9,#22d3ee)" }} />
              </span>
              <span className="text-right font-semibold tabular-nums">{v.toFixed(1)}</span>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Beispielwerte — Pro-Fahrlehrer-Bewertungen folgen.</p>
    </section>
  );
}

/* ----------------------------- Fahrlehrer-Kacheln ----------------------------- */
export function InstructorTiles({ instructors }: { instructors: ProfileInstructor[] }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <h2 className="mb-4 text-lg font-semibold">Fahrlehrer:innen</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {instructors.map((ins, i) => {
          const rating = instructorRating(ins.slug);
          return (
            <div key={ins.slug} className="hover-lift flex items-center gap-4 rounded-2xl border border-border p-4">
              <span className="relative size-16 shrink-0 overflow-hidden rounded-full ring-2 ring-brand-sky/20">
                <Image src={AVATARS[(h(ins.slug) + i) % AVATARS.length]} alt={`Foto von ${ins.name}`} fill unoptimized sizes="64px" className="object-cover" />
              </span>
              <div className="min-w-0">
                <p className="font-semibold">{ins.name}</p>
                <div className="mt-0.5 flex items-center gap-2 text-sm">
                  <Stars value={rating} />
                  <span className="text-muted-foreground">{rating.toFixed(1)}</span>
                </div>
                <p className="mt-1 truncate text-sm italic text-muted-foreground">„{MOTTOS[h(ins.slug) % MOTTOS.length]}“</p>
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Fotos &amp; Mottos sind Platzhalter — echte folgen mit dem Fahrlehrer-Profil.</p>
    </section>
  );
}

/* ----------------------------- Fahrzeug-Kacheln (mit Bild) ----------------------------- */
export function VehicleTiles({ vehicles }: { vehicles: ProfileVehicle[] }) {
  const getriebe = (g: string | null) => (g === "automatik" ? "Automatik" : g === "schaltung" ? "Schaltung" : null);
  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <h2 className="mb-4 text-lg font-semibold">Fahrzeuge</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {vehicles.map((v, i) => {
          const label = [v.marke, v.modell].filter(Boolean).join(" ") || "Fahrzeug";
          const meta = [v.klasse ? `Klasse ${v.klasse}` : null, getriebe(v.getriebe)].filter(Boolean).join(" · ");
          return (
            <div key={i} className="hover-lift overflow-hidden rounded-2xl border border-border">
              <div className="relative aspect-[16/10] w-full bg-secondary">
                <Image src="/seed/fahrzeug.svg" alt={`Fahrzeug: ${label}`} fill unoptimized sizes="(max-width:1024px) 50vw, 280px" className="object-cover" />
              </div>
              <div className="p-4">
                <p className="font-medium">{label}</p>
                {meta && <p className="text-sm text-muted-foreground">{meta}</p>}
                {v.besonderheiten.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {v.besonderheiten.map((b, bi) => (
                      <span key={bi} className="rounded-md bg-secondary px-1.5 py-0.5 text-xs text-secondary-foreground">{b}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Fahrzeug-Bilder sind Platzhalter — echte Fotos folgen per Upload.</p>
    </section>
  );
}
