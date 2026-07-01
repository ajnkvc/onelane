import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/public-config";
import { slugify } from "@/lib/slug";
import { listPublishedForSitemap } from "@/modules/schools/queries";

/**
 * sitemap.xml (dynamisch) — F-102: konsistent mit den indexierbaren Profilseiten.
 * Enthält Startseite + Suche + JEDE veröffentlichte (is_listed, via RLS) Fahrschule als
 * /fahrschulen/{stadt}/{schule}. Ist die DB nicht erreichbar, fällt die Sitemap auf die
 * statische Basis zurück (kein 500). Skalierung (>50k URLs) via Sitemap-Index = Folgeschritt.
 */
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl();
  const entries: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: "daily", priority: 1 },
    { url: `${base}/fahrschulen`, changeFrequency: "daily", priority: 0.9 },
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
  return entries;
}
