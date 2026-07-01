"use client";

import { useRouter, useSearchParams } from "next/navigation";

/**
 * FilterBar — Sofort-Filter (Client). Jede Änderung (Klasse/Sprache/Sortierung/
 * Partner) aktualisiert die URL-Query SOFORT (router.push) — kein „Filtern"-Klick.
 * Ort/Koordinaten/Umkreis bleiben erhalten; `seite` wird zurückgesetzt. Ohne JS
 * funktioniert die Suche weiterhin über die Suchleiste (SSR).
 */
const KLASSEN = ["B", "B197", "BE", "B96", "A", "A2", "A1", "AM"];
const SPRACHEN = [
  { v: "de", l: "Deutsch" }, { v: "en", l: "Englisch" }, { v: "tr", l: "Türkisch" },
  { v: "it", l: "Italienisch" }, { v: "es", l: "Spanisch" }, { v: "fr", l: "Französisch" },
  { v: "ru", l: "Russisch" }, { v: "el", l: "Griechisch" },
];
const SORT = [
  { v: "relevanz", l: "Relevanz" }, { v: "distanz", l: "Entfernung" }, { v: "bewertung", l: "Bewertung" },
];

export function FilterBar() {
  const router = useRouter();
  const sp = useSearchParams();
  const cur = (k: string) => sp.get(k) ?? "";

  const apply = (mut: (p: URLSearchParams) => void) => {
    const p = new URLSearchParams(sp.toString());
    mut(p);
    p.delete("seite");
    router.push(`/fahrschulen?${p.toString()}`);
  };
  const setParam = (k: string, v: string) => apply((p) => (v ? p.set(k, v) : p.delete(k)));

  const sel = "rounded-full border border-border bg-transparent px-3 py-1.5";
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3 text-sm shadow-sm">
      <select value={cur("klasse")} onChange={(e) => setParam("klasse", e.target.value)} aria-label="Klasse" className={sel}>
        <option value="">Alle Klassen</option>
        {KLASSEN.map((k) => <option key={k} value={k}>Klasse {k}</option>)}
      </select>
      <select value={cur("sprache")} onChange={(e) => setParam("sprache", e.target.value)} aria-label="Sprache" className={sel}>
        <option value="">Alle Sprachen</option>
        {SPRACHEN.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
      </select>
      <select value={cur("sort")} onChange={(e) => setParam("sort", e.target.value)} aria-label="Sortierung" className={sel}>
        {SORT.map((s) => <option key={s.v} value={s.v}>Sortieren: {s.l}</option>)}
      </select>
      <label className="flex items-center gap-2 rounded-full border border-border px-3 py-1.5">
        <input type="checkbox" checked={cur("partner") === "true"} onChange={(e) => setParam("partner", e.target.checked ? "true" : "")} />
        <span>nur Partner</span>
      </label>
      <span className="ml-auto text-xs text-muted-foreground">Filter wirken sofort</span>
    </div>
  );
}
