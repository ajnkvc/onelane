/**
 * shoot-website.mjs — Screenshots der EIGENEN Schul-Website für die ASSISTIERTE
 * manuelle Prüfung (Startseite + Impressum + Kontakt).
 * ============================================================================
 * KEIN Daten-Crawl: es werden nur BILDER erzeugt, die der Mensch NEBEN dem
 * Datensatz abgleicht und dann SELBST als geprüfte Werte einträgt. On-demand,
 * ein Datensatz, niedrige Last, robots.txt-Beachtung, neutraler Browser. Bilder
 * landen unter data/untracked/ (git-ignoriert) und werden NIE veröffentlicht.
 *
 * CLI:  node scripts/shoot-website.mjs <url> [outDir]
 */
import fs from "node:fs";
import path from "node:path";
import { assertPublicUrl } from "./lib/ssrf-check.mjs";

const VIEWPORT = { width: 1280, height: 900 };
const NAV_TIMEOUT = 20000;

/**
 * robots.txt-Auswertung für User-agent: * — mit korrekten HTTP-Status-Semantiken statt
 * pauschalem Fail-open (F-082):
 *   - 2xx  → parsen und befolgen.
 *   - 4xx  → keine robots.txt (v. a. 404) ⇒ erlaubt (Standard-Konvention).
 *   - 3xx/5xx/Netzfehler/Timeout ⇒ unerreichbar ⇒ KONSERVATIV blocken (nicht crawlen),
 *     wie es zurückhaltende Crawler bei anhaltenden Serverfehlern tun.
 * F-020/F-021: auch der robots-Fetch ist SSRF-geprüft (DNS-Auflösung) + redirect:"manual".
 */
async function robotsAllows(origin, pathname) {
  let res;
  try {
    const robotsUrl = new URL("/robots.txt", origin).href;
    await assertPublicUrl(robotsUrl);
    res = await fetch(robotsUrl, { signal: AbortSignal.timeout(6000), redirect: "manual" });
  } catch { return false; } // unerreichbar/Netzfehler → konservativ blocken (kein Fail-open mehr)
  if (res.status >= 400 && res.status < 500) return true; // keine/entfernte robots.txt → erlaubt
  if (res.status < 200 || res.status >= 300) return false; // 3xx/5xx → konservativ blocken
  let txt;
  try { txt = await res.text(); } catch { return false; }
  let active = false; const dis = [];
  for (const line of txt.split(/\r?\n/)) {
    const l = line.replace(/#.*/, "").trim(); if (!l) continue;
    const m = l.match(/^([a-z-]+)\s*:\s*(.*)$/i); if (!m) continue;
    const key = m[1].toLowerCase(), val = m[2].trim();
    if (key === "user-agent") active = val === "*";
    else if (active && key === "disallow" && val) dis.push(val);
  }
  return !dis.some((d) => pathname.startsWith(d));
}

function pick(links, words) {
  for (const w of words) {
    const hit = links.find((l) => l.text.includes(w) || l.href.toLowerCase().includes(w));
    if (hit) return hit.href;
  }
  return null;
}

/**
 * Best-Effort: Cookie-Banner wegklicken, damit sie keine Daten im Screenshot verdecken.
 * Bevorzugt datensparsam („nur erforderliche"/„ablehnen"), sonst „akzeptieren". Sucht auch
 * in Consent-iFrames. Hängt nie (kurze Timeouts, alles in try/catch).
 */
async function dismissCookies(page) {
  // Bekannte Consent-Tools: erst datensparsam (ablehnen/nur nötig), dann akzeptieren.
  const sels = [
    "#CybotCookiebotDialogBodyButtonDecline", "#onetrust-reject-all-handler", ".cky-btn-reject",
    ".cmpboxbtnno", ".brlbs-btn-accept-only-essential", "[data-testid='uc-deny-all-button']",
    "#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll", "#CybotCookiebotDialogBodyButtonAccept",
    "#onetrust-accept-btn-handler", ".cky-btn-accept", ".cmpboxbtnyes", "#CookieBoxSaveButton",
    "[data-testid='uc-accept-all-button']",
  ];
  const rej = "nur (erforderlich|notwendig|essenziell)|nur notwendige|notwendige cookies|essenzielle? cookies|alle ablehnen|ablehnen|auswahl (erlauben|speichern|bestätigen)|reject|decline|deny|weiter ohne";
  const acc = "alle akzeptieren|akzeptieren|alle zulassen|alles zulassen|zulassen|alle annehmen|annehmen|zustimmen|einverstanden|verstanden|accept all|accept|allow all|agree|got it|ok";
  // Container bekannter Consent-Tools (Sicherheitsnetz: entfernen, damit nichts den Screenshot verdeckt).
  const kill = [
    "#CybotCookiebotDialog", "#CybotCookiebotDialogBodyUnderlay", "#onetrust-consent-sdk", ".onetrust-pc-dark-filter",
    "#usercentrics-root", "#uc-center-container", ".borlabs-cookie-box", "#BorlabsCookieBox", "#BorlabsCookieBoxWrap",
    ".cky-consent-container", ".cky-overlay", "#cmpbox", "#cmpwrapper", ".cmplz-cookiebanner", "#cookie-law-info-bar", ".cc-window",
  ];
  let acted = null;
  for (const frame of page.frames()) {
    try {
      const r = await frame.evaluate(({ sels, rej, acc, kill }) => {
        let clicked = null;
        for (const s of sels) { const el = document.querySelector(s); if (el) { el.click(); clicked = s; break; } }
        if (!clicked) {
          const R = new RegExp(rej, "i"), A = new RegExp(acc, "i");
          const els = Array.from(document.querySelectorAll('button,a,[role="button"],input[type="button"],input[type="submit"]'));
          const t = (e) => (e.innerText || e.value || e.getAttribute("aria-label") || "").trim();
          const x = els.find((e) => R.test(t(e))) || els.find((e) => A.test(t(e)));
          if (x) { x.click(); clicked = t(x).slice(0, 40); }
        }
        // Sicherheitsnetz: bekannte Container + große fixierte Cookie-/Consent-Overlays ausblenden.
        for (const s of kill) document.querySelectorAll(s).forEach((e) => e.remove());
        document.querySelectorAll('[id*="cookie" i],[class*="cookie" i],[id*="consent" i],[class*="consent" i]').forEach((e) => {
          try { const cs = getComputedStyle(e); if ((cs.position === "fixed" || cs.position === "sticky") && e.offsetHeight > 60) e.style.display = "none"; } catch { /* egal */ }
        });
        document.documentElement.style.overflow = ""; if (document.body) document.body.style.overflow = "";
        return clicked;
      }, { sels, rej, acc, kill });
      if (r && !acted) acted = r;
    } catch { /* Frame nicht zugänglich → nächster */ }
  }
  await page.waitForTimeout(500);
  return acted;
}

const pad2 = (h) => { const n = parseInt(h, 10); return (n < 10 ? "0" : "") + n; };
const DAYMAP = { mo: "Mo", di: "Di", mi: "Mi", do: "Do", fr: "Fr", sa: "Sa", so: "So", montag: "Mo", dienstag: "Di", mittwoch: "Mi", donnerstag: "Do", freitag: "Fr", samstag: "Sa", sonntag: "So" };
const DAYORDER = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

/** Strukturierter Öffnungszeiten-VORSCHLAG (Wochentag → [{von,bis}] in hh:mm), Tagesbereiche aufgelöst. Niedrige Konfidenz. */
function parseHours(text) {
  const t = text.replace(/[–—]/g, "-");
  const dp = "(montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag|mo|di|mi|do|fr|sa|so)";
  const re = new RegExp(dp + "\\.?\\s*(?:(?:-|bis)\\s*" + dp + "\\.?)?\\s*[:\\s]*((?:\\d{1,2}(?::|\\.)?\\d{0,2}\\s*-\\s*\\d{1,2}(?::|\\.)?\\d{0,2}[,;\\s]*(?:und\\s*)?)+)", "gi");
  const res = {}; let m, n = 0;
  while ((m = re.exec(t)) && n < 60) {
    n++;
    const d1 = DAYMAP[m[1].toLowerCase()], d2 = m[2] ? DAYMAP[m[2].toLowerCase()] : null;
    let days = [d1];
    if (d2) { const i = DAYORDER.indexOf(d1), j = DAYORDER.indexOf(d2); if (i >= 0 && j >= i) days = DAYORDER.slice(i, j + 1); }
    const times = []; const tr = /(\d{1,2})(?::|\.)?(\d{2})?\s*-\s*(\d{1,2})(?::|\.)?(\d{2})?/g; let tm;
    while ((tm = tr.exec(m[3]))) { const a = parseInt(tm[1], 10), b = parseInt(tm[3], 10); if (a > 23 || b > 24) continue; times.push({ von: pad2(tm[1]) + ":" + (tm[2] || "00"), bis: pad2(tm[3]) + ":" + (tm[4] || "00") }); }
    if (times.length) for (const d of days) { if (!res[d]) res[d] = []; for (const x of times) if (!res[d].some((y) => y.von === x.von && y.bis === x.bis)) res[d].push(x); }
  }
  return Object.keys(res).length ? res : null;
}
/** Rohe Öffnungszeiten-Zeilen (verbatim) zum schnellen Ablesen. */
function hoursSnippet(text) {
  const out = [];
  for (const l of text.split(/\n+/).map((x) => x.trim()).filter(Boolean)) {
    if (l.length > 90) continue;
    if (/\b(mo|di|mi|do|fr|sa|so|montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)\b/i.test(l) && /\d{1,2}\s*[:.\-]\s*\d/.test(l) && !out.includes(l)) out.push(l);
    if (out.length >= 8) break;
  }
  return out;
}
/** Angebotene Führerscheinklassen (Token-Treffer im „Klasse/Führerschein"-Kontext). */
function extractClasses(text) {
  if (!/klasse|f(ü|ue)hrerschein/i.test(text)) return [];
  const found = new Set();
  for (const k of ["AM", "A1", "A2", "BF17", "B196", "B197", "B96", "B78", "BE", "C1E", "C1", "CE", "D1E", "D1", "DE", "Mofa"]) if (new RegExp("\\b" + k + "\\b").test(text)) found.add(k);
  for (const seg of text.match(/klasse[n]?\s*:?\s*[A-D0-9ELT,/ .&+\-]{1,50}/gi) || []) for (const k of ["A", "B", "C", "D", "L", "T"]) if (new RegExp("\\b" + k + "\\b").test(seg)) found.add(k);
  return [...found];
}

/** Kandidaten aus dem SICHTBAREN Seitentext (belegpflichtig: nur, was wörtlich vorkommt). */
function extractCandidates(pages) {
  const acc = { telefon: new Map(), email: new Map(), plz_ort: new Map(), strasse: new Map() };
  const add = (map, val, kind) => { const v = (val || "").trim(); if (!v) return; if (!map.has(v)) map.set(v, new Set()); map.get(v).add(kind); };
  for (const p of pages) {
    const text = p.text || "";
    for (const e of p.mailtos || []) add(acc.email, e.toLowerCase(), p.kind);
    for (const m of text.matchAll(/[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}/gi)) add(acc.email, m[0].toLowerCase(), p.kind);
    for (const t of p.tels || []) add(acc.telefon, t.trim(), p.kind);
    for (const m of text.matchAll(/(?:\+49|0)[\d][\d \/().\-]{5,}\d/g)) {
      const v = m[0].replace(/\s+/g, " ").trim();
      if (/\d[.\-/]\d{1,2}[.\-/]\d{2,4}/.test(v)) continue; // Datum (z. B. 05.08.2026) ausschließen
      const d = v.replace(/\D/g, "");
      if (d.length >= 7 && d.length <= 14) add(acc.telefon, v, p.kind);
    }
    for (const m of text.matchAll(/\b([1-9]\d{4})\s+([A-ZÄÖÜ][A-Za-zÄÖÜäöüß.\-]+(?:\s[A-ZÄÖÜ][A-Za-zÄÖÜäöüß.\-]+)?)/g)) add(acc.plz_ort, m[1] + " " + m[2], p.kind);
    for (const m of text.matchAll(/([A-ZÄÖÜ][A-Za-zÄÖÜäöüß.\-]+(?:straße|strasse|str\.|weg|allee|platz|gasse|ring|damm)\s+\d+[a-z]?)\b/g)) add(acc.strasse, m[1].replace(/\s+/g, " ").trim(), p.kind);
  }
  const allText = pages.map((p) => p.text || "").join("\n");
  const plzNums = new Set([...acc.plz_ort.keys()].map((s) => s.slice(0, 5)));
  const kw = /weitere standorte|unsere standorte|\bfiliale|zweigstelle/i.test(allText);
  const top = (map) => [...map.entries()].slice(0, 6).map(([val, src]) => ({ val, src: [...src].join("/") }));
  return {
    telefon: top(acc.telefon), email: top(acc.email), plz_ort: top(acc.plz_ort), strasse: top(acc.strasse),
    classes: extractClasses(allText),
    hoursText: hoursSnippet(allText),
    hours: parseHours(allText),
    multiLoc: { flag: plzNums.size > 1 || kw, distinctPlz: plzNums.size, keyword: kw },
  };
}

/**
 * Erstellt bis zu drei Screenshots (start/impressum/kontakt) ins outDir.
 * Gibt eine Liste {kind, url, file|skipped|error} zurück.
 */
export async function shootSite(rawUrl, outDir) {
  const { chromium } = await import("playwright");
  fs.mkdirSync(outDir, { recursive: true });
  let start = (rawUrl || "").trim();
  if (!start) throw new Error("Keine URL");
  if (!/^https?:\/\//i.test(start)) start = "https://" + start.replace(/^\/+/, "");
  const origin = new URL(start).origin;
  const shots = [], pages = [];
  const browser = await chromium.launch({ headless: true });
  try {
    // F-020: KEIN ignoreHTTPSErrors — nach dem SSRF-Check ist das Ziel öffentlich; TLS-Fehler
    // sollen nicht stillschweigend übergangen werden (MITM-/Fehlkonfig-Schutz).
    const ctx = await browser.newContext({ viewport: VIEWPORT, locale: "de-DE" });
    const page = await ctx.newPage();
    page.setDefaultNavigationTimeout(NAV_TIMEOUT);

    async function shoot(targetUrl, kind) {
      const u = new URL(targetUrl, origin);
      // F-020: SSRF-Vorprüfung VOR jeder Navigation — Ziel muss auf eine öffentliche IP auflösen
      // (blockt localhost/privat/link-local/Metadata-Endpunkte, auch bei fremd-bestimmten imp/kon-Links).
      try {
        await assertPublicUrl(u.href);
      } catch (e) {
        shots.push({ kind, url: u.href, skipped: "ssrf: " + String(e?.message ?? e) });
        return;
      }
      if (!(await robotsAllows(u.origin, u.pathname))) { shots.push({ kind, url: u.href, skipped: "robots" }); return; }
      try {
        await page.goto(u.href, { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(1800); // warten bis Inhalte + (oft verzögerte) Consent-Banner geladen sind
        await dismissCookies(page).catch(() => {}); // Cookie-Banner wegklicken/entfernen (verdecken sonst Daten)
        await dismissCookies(page).catch(() => {}); // zweiter Versuch für spät eingeblendete Banner
        const file = path.join(outDir, kind + ".png");
        await page.screenshot({ path: file, fullPage: true });
        shots.push({ kind, url: u.href, file });
        // Text + Kontakt-Links der besuchten Seite einsammeln (für belegbare Vorschläge)
        try {
          const text = await page.evaluate(() => (document.body ? document.body.innerText : "")).catch(() => "");
          const hrefs = await page.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href") || "")).catch(() => []);
          const mailtos = hrefs.filter((h) => /^mailto:/i.test(h)).map((h) => h.replace(/^mailto:/i, "").split("?")[0]);
          const tels = hrefs.filter((h) => /^tel:/i.test(h)).map((h) => h.replace(/^tel:/i, ""));
          pages.push({ kind, url: u.href, text, mailtos, tels });
        } catch { /* Text optional */ }
      } catch (e) { shots.push({ kind, url: u.href, error: String(e?.message ?? e).slice(0, 140) }); }
    }

    await shoot(start, "start");
    let links = [];
    try {
      links = await page.$$eval("a[href]", (as) => as.map((a) => ({ href: a.href, text: (a.textContent || "").trim().toLowerCase() })));
    } catch { /* Startseite evtl. nicht geladen */ }
    const imp = pick(links, ["impressum", "imprint"]);
    const kon = pick(links, ["kontakt", "contact"]);
    if (imp) await shoot(imp, "impressum"); else shots.push({ kind: "impressum", skipped: "kein Link gefunden" });
    if (kon) await shoot(kon, "kontakt"); else shots.push({ kind: "kontakt", skipped: "kein Link gefunden" });

    const candidates = extractCandidates(pages);
    fs.writeFileSync(path.join(outDir, "meta.json"), JSON.stringify({ start, origin, shots, candidates, at: new Date().toISOString() }, null, 2));
    return { shots, candidates };
  } finally {
    await browser.close();
  }
}

// CLI
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const u = process.argv[2], out = process.argv[3] || "data/untracked/screenshots/_cli";
  if (!u) { console.error("Nutzung: node scripts/shoot-website.mjs <url> [outDir]"); process.exit(1); }
  shootSite(u, out).then((s) => { console.log(JSON.stringify(s, null, 2)); process.exit(0); }).catch((e) => { console.error("FEHLER:", e); process.exit(1); });
}
