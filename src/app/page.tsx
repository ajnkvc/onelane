import Image from "next/image";
import { SearchBar } from "@/components/search/search-bar";
import { Typewriter } from "@/components/home/typewriter";
import { RevealOnScroll } from "@/components/home/reveal";
import { StickySearch } from "@/components/home/sticky-search";
import { PartnerMarquee } from "@/components/home/partner-marquee";
import { LocateCta } from "@/components/home/locate-cta";

/**
 * Startseite — modernes, rundes 2026-Design (Fundament: ruhig & schnell, Bento,
 * dezente Motion, runde Formen). SSR; alle Bewegungen reduced-motion-sicher.
 * Ehrliche Kennzahlen (keine erfundenen Bewertungs-/Listing-Zahlen).
 */
export const dynamic = "force-dynamic";

const SLOGAN_WORDS = ["günstigste", "nächste", "bestbewertete", "passende"];

const STEPS = [
  { n: "1", t: "Standort wählen", d: "Adresse oder PLZ eingeben — und wir zeigen dir die besten Fahrschulen direkt in deiner Nähe.", tone: ["#0ea5e9", "#22d3ee"] },
  { n: "2", t: "In Ruhe vergleichen", d: "Preise, Klassen & echte Bestehensquoten transparent nebeneinander — ganz ohne Druck.", tone: ["#f59e0b", "#fbbf24"] },
  { n: "3", t: "Online anmelden & sparen", d: "Unverbindlich anfragen und direkt anmelden — in Minuten, kostenlos.", tone: ["#65a30d", "#a3e635"], goal: true },
];

const TESTIMONIALS = [
  { name: "Lena M.", city: "München", klasse: "B", rating: 5, img: "/seed/avatar-1.svg", quote: "In 6 Wochen zum Lappen — perfekt erklärt und super geduldig." },
  { name: "Jonas K.", city: "Schwabing", klasse: "B197", rating: 5, img: "/seed/avatar-2.svg", quote: "Automatik gefunden, beim ersten Mal bestanden. Wochen gespart." },
  { name: "Aylin T.", city: "Haidhausen", klasse: "A2", rating: 4, img: "/seed/avatar-3.svg", quote: "Faire Preise und ehrliche Bewertungen — kein Googeln mehr." },
];

const PILLS = ["100 % kostenlos", "unabhängig", "echte Bestehensquoten"];

export default function HomePage() {
  return (
    <>
      <RevealOnScroll />
      <StickySearch />

      {/* ======================= HERO ======================= */}
      <section className="relative z-20">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div
            className="aurora absolute inset-0"
            style={{
              backgroundImage:
                "radial-gradient(42% 55% at 16% 18%, rgba(14,165,233,0.32), transparent 62%), radial-gradient(46% 58% at 84% 10%, rgba(34,211,238,0.30), transparent 62%), radial-gradient(55% 55% at 50% 112%, rgba(163,230,53,0.26), transparent 60%), linear-gradient(180deg, #eef9ff, var(--background) 72%)",
              backgroundSize: "200% 200%",
            }}
          />
          <div className="float-slow absolute -left-24 top-24 size-80 rounded-full bg-brand-sky/20 blur-3xl" />
          <div className="float-slower absolute -right-20 top-8 size-96 rounded-full bg-accent/15 blur-3xl" />
          {/* Driftende Blobs für lebendige, dezente Bewegung (reduced-motion-sicher). */}
          <div className="mbg-1 absolute left-[8%] top-[34%] size-72 rounded-full bg-brand-cyan/20 blur-3xl" />
          <div className="mbg-2 absolute right-[6%] top-[46%] size-80 rounded-full bg-accent/15 blur-3xl" />
          <div className="mbg-3 absolute left-[42%] top-[4%] size-72 rounded-full bg-brand-sky/15 blur-3xl" />
        </div>

        <div className="relative mx-auto flex w-full max-w-3xl flex-col items-center gap-6 px-6 pb-20 pt-20 text-center sm:pt-28">
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-sky/25 bg-card/70 px-4 py-1.5 text-sm font-medium text-[#0369a1] shadow-sm backdrop-blur">
            <span className="relative flex size-2">
              <span className="pulse-ring absolute inline-flex size-2 rounded-full bg-brand-cyan" />
              <span className="relative inline-flex size-2 rounded-full bg-brand-sky" />
            </span>
            Deutschlands transparenter Fahrschul-Vergleich
          </span>

          <h1 className="text-4xl font-bold leading-[1.05] tracking-tight text-[#1b3a5c] sm:text-6xl">
            Finde die{" "}
            <Typewriter words={SLOGAN_WORDS} className="text-gradient-brand" />
            <br /> Fahrschule deiner Stadt.
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            Vergleiche Fahrschulen nach Preis, Klassen und <strong className="text-foreground">echten Bestehensquoten</strong> — und melde dich direkt an.
          </p>
          <div className="mt-2 flex w-full justify-center">
            <SearchBar />
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {PILLS.map((p) => (
              <span key={p} className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-sm text-muted-foreground">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-brand-lime" aria-hidden="true"><path d="m5 13 4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                {p}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ======================= PARTNER/QUELLEN-MARQUEE ======================= */}
      <PartnerMarquee />

      {/* ======================= STAT-STAR (dunkler Bento) ======================= */}
      <section className="mx-auto w-full max-w-6xl px-6 py-10">
        <div
          className="reveal relative overflow-hidden rounded-[2.25rem] p-8 text-white shadow-2xl shadow-brand-ink/20 sm:p-12"
          style={{ background: "radial-gradient(120% 120% at 0% 0%, #15406b 0%, #0c2c4d 45%, #08203a 100%)" }}
        >
          {/* Neon-Glows */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <div className="float-slow absolute -right-10 -top-16 size-72 rounded-full bg-brand-cyan/20 blur-3xl" />
            <div className="float-slower absolute -bottom-24 left-10 size-80 rounded-full bg-brand-lime/10 blur-3xl" />
          </div>

          <div className="relative grid items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
            <div className="flex flex-col gap-4">
              <span className="w-fit rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-brand-cyan ring-1 ring-white/15">
                Die harte Wahrheit
              </span>
              <h2 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
                Jede <span className="text-gradient-brand">3.&nbsp;Praxisprüfung</span> fällt durch.
                <br />Wir zeigen dir, wo du bestehst.
              </h2>
              <p className="max-w-md text-white/70">
                Bundesweit fällt rund jede dritte praktische Prüfung (Klasse B) durch. Wir machen die
                <strong className="text-white"> Bestehensquote je Fahrschule</strong> sichtbar — datenbasiert.
              </p>
              <LocateCta className="mt-2 inline-flex w-fit items-center gap-2 rounded-full bg-accent px-6 py-3 text-base font-semibold text-accent-foreground transition-transform duration-200 hover:scale-[1.03] active:scale-[0.97]">
                Schulen mit hoher Quote finden
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </LocateCta>
              <p className="text-xs text-white/45">Quelle: TÜV-Verband, Fahrerlaubnisprüfungen 2024/25.</p>
            </div>

            {/* Gauge + Stat-Pills */}
            <div className="flex flex-col items-center gap-5">
              <div className="grid size-44 shrink-0 place-items-center rounded-full" style={{ background: "conic-gradient(from 0deg, #22d3ee 0 63%, rgba(255,255,255,0.12) 63% 100%)" }}>
                <div className="grid size-32 place-items-center rounded-full bg-[#0c2c4d]">
                  <span className="text-4xl font-bold leading-none text-white">63&nbsp;%</span>
                </div>
              </div>
              <p className="-mt-1 text-center text-sm text-white/65">bestehen die Praxis im 1.&nbsp;Anlauf</p>
              <div className="grid w-full grid-cols-3 gap-3">
                {[
                  { k: "37 %", v: "Durchfall Praxis", c: "#f59e0b" },
                  { k: "45 %", v: "Durchfall Theorie", c: "#fb7185" },
                  { k: "2,04 Mio.", v: "Prüfungen / Jahr", c: "#a3e635" },
                ].map((x) => (
                  <div key={x.v} className="rounded-2xl bg-white/[0.07] p-3 text-center ring-1 ring-white/10 backdrop-blur">
                    <p className="text-lg font-bold" style={{ color: x.c }}>{x.k}</p>
                    <p className="mt-0.5 text-[11px] leading-tight text-white/60">{x.v}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ======================= WARUM HIER VERGLEICHEN (Feature-Zeilen) ======================= */}
      <section className="mx-auto w-full max-w-6xl px-6 py-16">
        <div className="reveal mb-14 flex flex-col gap-2 text-center">
          <span className="mx-auto w-fit text-sm font-semibold uppercase tracking-wide text-[#0369a1]">Warum hier vergleichen</span>
          <h2 className="text-3xl font-bold tracking-tight text-[#1b3a5c] sm:text-4xl">Alles, was die Entscheidung leicht macht</h2>
        </div>

        <div className="flex flex-col gap-14 md:gap-20">
          {/* — Zeile 1: Bestehensquoten (Text links, Balken rechts) — */}
          <div className="reveal grid items-center gap-8 md:grid-cols-2">
            <div className="flex flex-col gap-4">
              <span className="w-fit rounded-full bg-brand-sky/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[#0369a1]">Transparenz</span>
              <h3 className="text-2xl font-bold tracking-tight text-[#1b3a5c]">Bestehensquoten, die sonst niemand zeigt</h3>
              <p className="text-muted-foreground">Andere zeigen nur Sterne. Wir machen die <strong className="text-foreground">Praxis-Bestehensquote je Fahrschule</strong> sichtbar — damit du nicht zufällig bei der landest, bei der die Hälfte durchfällt.</p>
              <ul className="flex flex-col gap-2.5">
                {["Praxis-Quote pro Fahrschule statt Bauchgefühl", "Datenbasis: TÜV/DEKRA", "Such gezielt nach hoher Bestehensquote"].map((li) => (
                  <li key={li} className="flex items-start gap-2.5 text-sm">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="mt-0.5 shrink-0 text-brand-lime" aria-hidden="true"><circle cx="12" cy="12" r="10" className="text-brand-lime/15" fill="currentColor" /><path d="m8 12 3 3 5-6" stroke="#65a30d" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    <span className="text-muted-foreground">{li}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="hover-lift rounded-[1.75rem] border border-border bg-card p-7" style={{ backgroundImage: "linear-gradient(180deg, rgba(14,165,233,0.06), transparent)" }}>
              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">Ø Bestehen je Schule</span>
                <span className="rounded-full bg-brand-sky/10 px-2.5 py-0.5 text-xs font-semibold text-[#0369a1]">steigend ↑</span>
              </div>
              <svg viewBox="0 0 320 130" className="w-full" role="img" aria-label="Bestehensquote steigt mit der richtigen Schule">
                <defs><linearGradient id="bq-bar" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#0ea5e9" /><stop offset="1" stopColor="#22d3ee" /></linearGradient></defs>
                {[46, 62, 54, 84, 108].map((h, i) => (
                  <rect key={i} x={10 + i * 62} y={120 - h} width="44" height={h} rx="10" fill="url(#bq-bar)" opacity={0.5 + i * 0.12} />
                ))}
                <line x1="0" y1="121" x2="320" y2="121" className="text-border" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </div>
          </div>

          {/* — Zeile 2: Preise (Visual links, Text rechts) — */}
          <div className="reveal grid items-center gap-8 md:grid-cols-2">
            <div className="hover-lift order-2 rounded-[1.75rem] border border-border bg-card p-7 md:order-1">
              <div className="flex flex-col gap-3.5">
                {[["Grundgebühr", "350 €", 0.42, "#0ea5e9"], ["Fahrstunde (45 Min.)", "65 €", 0.7, "#22d3ee"], ["Sonderfahrt", "85 €", 0.85, "#65a30d"], ["Vorstellung Prüfung", "120 €", 0.55, "#f59e0b"]].map(([label, price, pct, c]) => (
                  <div key={label as string} className="flex items-center gap-3">
                    <span className="w-36 shrink-0 text-sm text-muted-foreground">{label}</span>
                    <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-secondary">
                      <span className="block h-full rounded-full" style={{ width: `${(pct as number) * 100}%`, background: c as string }} />
                    </span>
                    <span className="w-14 shrink-0 text-right text-sm font-semibold text-foreground">{price}</span>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-[11px] text-muted-foreground">Beispielwerte · recherchiert, ohne Gewähr bis zur Bestätigung durch die Fahrschule.</p>
            </div>
            <div className="order-1 flex flex-col gap-4 md:order-2">
              <span className="w-fit rounded-full bg-brand-lime/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[#4d7c0f]">Fairness</span>
              <h3 className="text-2xl font-bold tracking-tight text-[#1b3a5c]">Alle Kosten — ehrlich aufgeschlüsselt</h3>
              <p className="text-muted-foreground">Kein „ab 0 €“. Du siehst <strong className="text-foreground">jede Position</strong>: Grundgebühr, Fahrstunde, Sonderfahrten, Prüfungsentgelte — und Pauschalpreise je Klasse. So vergleichst du, was wirklich zählt.</p>
              <ul className="flex flex-col gap-2.5">
                {["Alle Posten einzeln statt Lockpreis", "Pauschalpreise je Führerscheinklasse", "Klar gekennzeichnet bis zur Bestätigung"].map((li) => (
                  <li key={li} className="flex items-start gap-2.5 text-sm">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="mt-0.5 shrink-0" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="rgba(101,163,13,0.14)" /><path d="m8 12 3 3 5-6" stroke="#65a30d" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    <span className="text-muted-foreground">{li}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* — Zeile 3: In deiner Nähe (Text links, Karte rechts) — */}
          <div className="reveal grid items-center gap-8 md:grid-cols-2">
            <div className="flex flex-col gap-4">
              <span className="w-fit rounded-full bg-brand-cyan/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[#0e7490]">Schnell zum Ziel</span>
              <h3 className="text-2xl font-bold tracking-tight text-[#1b3a5c]">Die nächsten Fahrschulen — in Sekunden</h3>
              <p className="text-muted-foreground">Standort freigeben und sofort die <strong className="text-foreground">nächstgelegenen Fahrschulen</strong> auf der Karte sehen — dann <strong className="text-foreground">unverbindlich anfragen</strong>. Kostenlos, unabhängig, ohne Konto.</p>
              <ul className="flex flex-col gap-2.5">
                {['„In deiner Nähe" per Standort', "Direkt & unverbindlich anfragen", "Kostenlos und unabhängig"].map((li) => (
                  <li key={li} className="flex items-start gap-2.5 text-sm">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="mt-0.5 shrink-0" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="rgba(34,211,238,0.16)" /><path d="m8 12 3 3 5-6" stroke="#0e7490" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    <span className="text-muted-foreground">{li}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="hover-lift relative aspect-[4/3] overflow-hidden rounded-[1.75rem] border border-border" style={{ background: "radial-gradient(120% 120% at 30% 20%, #e6f6ff, #eef9ff 60%, #f1f5f9)" }}>
              {/* stilisierte „Straßen" */}
              <div aria-hidden="true" className="absolute inset-0 opacity-60" style={{ backgroundImage: "linear-gradient(90deg, transparent 49%, rgba(14,165,233,0.12) 50%, transparent 51%), linear-gradient(0deg, transparent 49%, rgba(14,165,233,0.10) 50%, transparent 51%)", backgroundSize: "64px 64px" }} />
              {/* pulsierende Marker */}
              {[["28%", "32%", "#0ea5e9"], ["62%", "54%", "#65a30d"], ["44%", "72%", "#22d3ee"]].map(([l, t, c], i) => (
                <span key={i} className="absolute grid size-7 place-items-center rounded-full text-white shadow-md" style={{ left: l, top: t, background: c as string }}>
                  <span className="pulse-ring absolute inset-0 rounded-full" />
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5Z" /></svg>
                </span>
              ))}
              <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-card/90 px-3 py-1 text-xs font-semibold text-foreground shadow-sm backdrop-blur">
                <span className="size-2 rounded-full bg-brand-lime" /> 3 Fahrschulen in der Nähe
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ======================= IN 3 SCHRITTEN ZUR ANMELDUNG (lead-orientiert) ======================= */}
      <section className="bg-secondary/40">
        <div className="mx-auto w-full max-w-6xl px-6 py-16">
          <div className="reveal mx-auto mb-12 max-w-2xl text-center">
            <span className="text-sm font-semibold uppercase tracking-wide text-[#0369a1]">So funktioniert&rsquo;s</span>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-[#1b3a5c] sm:text-4xl">In 3 Schritten zur Anmeldung</h2>
            <p className="mx-auto mt-3 text-muted-foreground">Vom Wohnort zur passenden Fahrschule — schnell, transparent und kostenlos.</p>
          </div>

          {/* Hybrid: helle Schritt-Karten 1 & 2 + dunkle Ziel-Karte 3 mit Glow & markantem CTA */}
          <div className="reveal-stagger grid items-stretch gap-5 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <div key={s.n} className="relative">
                {s.goal ? (
                  /* ---- DUNKLE ZIEL-KARTE ---- */
                  <div className="hover-lift relative flex h-full flex-col gap-4 overflow-hidden rounded-[1.75rem] border border-transparent p-7 text-white shadow-xl shadow-brand-ink/25" style={{ background: "linear-gradient(135deg, #0c2c4d, #15406b)" }}>
                    <div aria-hidden="true" className="float-slow pointer-events-none absolute -right-10 -top-12 size-44 rounded-full bg-brand-cyan/25 blur-3xl" />
                    <div aria-hidden="true" className="float-slower pointer-events-none absolute -bottom-16 -left-10 size-48 rounded-full bg-brand-lime/10 blur-3xl" />
                    {/* Partner-Vorteil dezent oben rechts (PLATZHALTER — nur live mit echtem Vertrag, UWG) */}
                    <span className="absolute right-5 top-5 inline-flex items-center gap-1 rounded-full bg-accent/15 px-2.5 py-1 text-[11px] font-semibold text-brand-lime ring-1 ring-accent/25">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 18.8 6.1 22l1.2-6.5L2.5 9.9 9.1 9z" /></svg>
                      bis zu 15 %*
                    </span>
                    <span className="relative grid size-14 place-items-center rounded-2xl text-2xl font-black text-white" style={{ background: "linear-gradient(135deg, #65a30d, #a3e635)", boxShadow: "0 14px 28px -10px #65a30d" }}>{s.n}</span>
                    <div className="relative">
                      <span className="text-xs font-bold uppercase tracking-wider text-brand-cyan">Schritt {s.n}</span>
                      <h3 className="mt-1 text-xl font-semibold">{s.t}</h3>
                      <p className="mt-1.5 text-sm text-white/70">{s.d}</p>
                    </div>
                    <div className="relative mt-auto flex flex-col gap-2 pt-3">
                      <LocateCta className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-6 py-4 text-base font-bold text-accent-foreground shadow-lg shadow-accent/30 transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98]">
                        Jetzt Fahrschule finden &amp; sparen
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      </LocateCta>
                      <span className="text-center text-[11px] text-white/45">*Partner-Vorteil nur bei teilnehmenden Schulen · Vorschau, noch nicht aktiv.</span>
                    </div>
                  </div>
                ) : (
                  /* ---- HELLE SCHRITT-KARTE ---- */
                  <div className="hover-lift relative flex h-full flex-col gap-3 overflow-hidden rounded-[1.75rem] border border-border bg-card p-7">
                    <span aria-hidden="true" className="pointer-events-none absolute -bottom-9 right-1 select-none text-[8.5rem] font-black leading-none text-[#1b3a5c]/[0.05]">{s.n}</span>
                    <span className="relative grid size-14 place-items-center rounded-2xl text-2xl font-black text-white" style={{ background: `linear-gradient(135deg, ${s.tone[0]}, ${s.tone[1]})`, boxShadow: `0 14px 28px -10px ${s.tone[0]}` }}>{s.n}</span>
                    <div className="relative">
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Schritt {s.n}</span>
                      <h3 className="mt-1 text-xl font-semibold text-[#1b3a5c]">{s.t}</h3>
                      <p className="mt-1.5 text-sm text-muted-foreground">{s.d}</p>
                    </div>
                  </div>
                )}
                {i < STEPS.length - 1 && (
                  <span aria-hidden="true" className="absolute -right-[1.05rem] top-14 z-10 hidden size-8 place-items-center rounded-full border border-border bg-card text-brand-sky shadow-sm md:grid">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ======================= ABSOLVENT:INNEN ======================= */}
      <section className="mx-auto w-full max-w-6xl px-6 py-16">
        <h2 className="reveal text-center text-3xl font-bold tracking-tight text-[#1b3a5c]">Glückliche Absolvent:innen</h2>
        <p className="reveal mx-auto mt-2 max-w-xl text-center text-muted-foreground">
          Fahr mit der Maus über eine Karte — Vorschau zoomt heran. (Beispiel-Clips; echte Videos folgen.)
        </p>
        <div className="reveal-stagger mt-10 grid gap-6 md:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <figure key={t.name} className="group hover-lift overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
              <div className="relative aspect-[4/3] w-full overflow-hidden">
                <div className="absolute inset-0 transition-transform duration-500 group-hover:scale-105">
                  <div className="kenburns absolute inset-0">
                    <Image src={t.img} alt={`Porträt von ${t.name}`} fill unoptimized sizes="(max-width:768px) 100vw, 380px" className="object-cover" />
                  </div>
                </div>
                <div className="absolute inset-0 flex flex-col items-center justify-end gap-2 bg-black/20 pb-4 opacity-0 backdrop-blur-[1px] transition duration-300 group-hover:opacity-100">
                  <div className="flex items-end gap-1" aria-hidden="true">
                    {[0, 1, 2, 3, 4, 5, 6].map((b) => (
                      <span key={b} className="wave-bar w-1.5 rounded-full bg-white" style={{ height: "28px", animationDelay: `${b * 0.1}s` }} />
                    ))}
                  </div>
                  <span className="text-xs font-medium text-white">spielt ab…</span>
                </div>
                <span className="pulse-ring absolute bottom-3 left-3 grid size-9 place-items-center rounded-full bg-white/90 text-brand-ink">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
                </span>
                <span className="absolute right-3 top-3 rounded-full bg-black/45 px-2 py-0.5 text-xs font-medium text-white backdrop-blur">Beispiel-Clip</span>
              </div>
              <figcaption className="flex flex-col gap-2 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.city} · Klasse {t.klasse}</p>
                  </div>
                  <span className="text-amber-500" aria-label={`${t.rating} von 5 Sternen`}>
                    {"★".repeat(t.rating)}<span className="text-muted-foreground">{"★".repeat(5 - t.rating)}</span>
                  </span>
                </div>
                <blockquote className="text-sm leading-relaxed text-muted-foreground">„{t.quote}“</blockquote>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* ======================= ABSCHLUSS-CTA ======================= */}
      <section className="mx-auto w-full max-w-6xl px-6 pb-20">
        <div
          className="reveal relative overflow-hidden rounded-[2.25rem] border border-border px-6 py-14 text-center"
          style={{ background: "linear-gradient(135deg, rgba(14,165,233,0.12), rgba(34,211,238,0.10) 50%, rgba(163,230,53,0.14))" }}
        >
          <h2 className="text-3xl font-bold tracking-tight text-[#1b3a5c]">Bereit, deine Fahrschule zu finden?</h2>
          <p className="mx-auto mt-2 max-w-md text-muted-foreground">Gib deine Adresse ein — kostenlos, unabhängig, in Sekunden.</p>
          <div className="mt-6 flex justify-center">
            <SearchBar />
          </div>
        </div>
      </section>
    </>
  );
}
