import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/public-config";

/**
 * robots.txt (dynamisch). Liegt an der Domain-Wurzel.
 * ----------------------------------------------------------------------------
 * STRATEGIE: „Suche JA, Training/Daten-Extraktion NEIN".
 * - Klassische Suchmaschinen (Googlebot/Bingbot via `*`) und KI-*Such*-/Retrieval-
 *   Bots dürfen alles crawlen → maximale Auffindbarkeit + Zitate in KI-Antworten.
 * - KI-*Trainings*-Bots, Massendatensatz-Sammler (Common Crawl) und kommerzielle
 *   Daten-Extraktoren (Diffbot etc.) werden GEBLOCKT → unsere verifizierte
 *   Datenbank soll nicht für Training, Direktmarketing oder konkurrierende
 *   Verzeichnisse abgegriffen werden.
 *
 * WICHTIG: robots.txt ist nur ein freiwilliges Signal (brave Bots halten sich
 * dran, Scraper nicht). Rechtlich verbindlich sind der maschinenlesbare
 * TDM-Vorbehalt (`/.well-known/tdmrep.json`, § 44b UrhG) und die
 * Nutzungsbedingungen (`/nutzungsbedingungen`, Datenbankherstellerrecht
 * §§ 87a–e UrhG). `Google-Extended` zu blocken beeinflusst das normale
 * Google-Ranking NICHT (eigenes Token nur für Gemini-Training).
 *
 * Stand der User-Agent-Namen: Juni 2026 — bei Anbieter-Doku-Änderungen pflegen.
 */

// ERLAUBT: Such-/Retrieval-Bots (treiben SEO + Sichtbarkeit in KI-Antworten).
const searchAiCrawlers: string[] = [
  "OAI-SearchBot", // OpenAI ChatGPT-Suche
  "ChatGPT-User", // OpenAI, nutzerausgelöster Abruf
  "Claude-SearchBot", // Anthropic Suche
  "Claude-User", // Anthropic, nutzerausgelöster Abruf
  "Bingbot", // Bing/Copilot-Index
  "PerplexityBot", // Perplexity-Suche
  "Perplexity-User",
  "Applebot", // Siri/Spotlight-Suche
  "DuckAssistBot", // DuckDuckGo AI-Antworten
  "MistralAI-User", // nutzerausgelöster Abruf
  "YouBot", // You.com-Suche
  "Amazonbot", // Alexa-Antworten (Retrieval)
  "FacebookBot", // Link-Vorschauen (kein Daten-Harvesting)
  "Meta-ExternalFetcher", // nutzerausgelöster Link-Abruf
];

// GEBLOCKT: Trainings-Bots, Massendatensatz-Sammler, Daten-Extraktoren.
const blockedCrawlers: string[] = [
  "GPTBot", // OpenAI-Training
  "Google-Extended", // Gemini-/Vertex-Training (NICHT das Such-Ranking)
  "GoogleOther", // Googles sonstige (R&D-)Crawls, nicht Search
  "Applebot-Extended", // Apple-Intelligence-Training
  "ClaudeBot", // Anthropic genereller Crawler
  "Claude-Web", // Anthropic (älterer genereller)
  "anthropic-ai", // Anthropic (älteres Training)
  "CCBot", // Common Crawl (Datenbasis vieler LLMs)
  "Bytespider", // ByteDance, aggressiver Scraper
  "Diffbot", // kommerzieller Datenbank-Builder
  "AI2Bot", // Allen Institute, Forschungsdatensätze
  "cohere-ai", // Cohere-Training
  "Meta-ExternalAgent", // Meta-AI-Training
];

export default function robots(): MetadataRoute.Robots {
  const base = getSiteUrl();
  return {
    rules: [
      // Alle übrigen Bots (inkl. klassische Suchmaschinen): voller Zugriff.
      { userAgent: "*", allow: "/" },
      // KI-Such-/Retrieval-Bots: ausdrücklich erlaubt.
      { userAgent: searchAiCrawlers, allow: "/" },
      // KI-Trainings-/Extraktions-Bots: ausdrücklich verboten.
      { userAgent: blockedCrawlers, disallow: "/" },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
