import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/public-config";
import { RATGEBER_GUIDES } from "@/lib/ratgeber";
import { slugify } from "@/lib/slug";
import { listPublishedForSitemap } from "@/modules/schools/queries";
import { listJobs } from "@/modules/jobs/queries";

/**
 * sitemap.xml (dynamisch) — F-102: konsistent mit den indexierbaren Profilseiten.
 * Enthält Startseite + Suche + JEDE veröffentlichte (is_listed, via RLS) Fahrschule als
 * /fahrschulen/{stadt}/{schule} sowie die Jobbörse (/jobs, /jobs/fahrlehrer-werden und
 * jede AKTIVE Stellenanzeige als /jobs/{slug} — abgelaufene verbirgt die RLS-Policy,
 * M5). Ist die DB nicht erreichbar, fällt die Sitemap auf die statische Basis zurück
 * (kein 500). Skalierung (>50k URLs) via Sitemap-Index = Folgeschritt.
 */
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl();
  const entries: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: "daily", priority: 1 },
    { url: `${base}/fahrschulen`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/trust`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/eltern`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/so-sortieren-wir`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${base}/fuer-fahrschulen`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/os`, changeFrequency: "monthly", priority: 0.5 },
    // Ratgeber: Hub + alle Artikel aus der Registry (EINE Quelle, kein Drift).
    { url: `${base}/ratgeber`, changeFrequency: "weekly", priority: 0.6 },
    ...RATGEBER_GUIDES.map((g) => ({
      url: `${base}/ratgeber/${g.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    // Jobbörse: Hub + Quereinstiegs-Seite (Detail-Slugs dynamisch, s. u.).
    { url: `${base}/jobs`, changeFrequency: "daily", priority: 0.7 },
    { url: `${base}/jobs/fahrlehrer-werden`, changeFrequency: "monthly", priority: 0.6 },
  ];
  try {
    for (const s of await listPublishedForSitemap()) {
      if (!s.ort || !s.slug) continue; // ohne ort kein gültiger Stadt-Slug → auslassen
      entries.push({
        url: `${base}/fahrschulen/${slugify(s.ort)}/${s.slug}`,
        changeFrequency: "weekly",
        priority: 0.7,
      });
    }
  } catch {
    // DB nicht erreichbar → statische Basis genügt; die Sitemap darf nie den Build/Request brechen.
  }
  try {
    // NUR aktive Anzeigen (RLS-Gültigkeitsfenster) — abgelaufene fallen automatisch raus.
    for (const j of await listJobs({})) {
      entries.push({
        url: `${base}/jobs/${j.slug}`,
        changeFrequency: "weekly",
        priority: 0.6,
      });
    }
  } catch {
    // DB nicht erreichbar → statische Basis genügt (nie den Request brechen).
  }
  return entries;
}
