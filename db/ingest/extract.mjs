/**
 * db/ingest/extract.mjs — REINE HTML-Extraktion für die Website-Verifikation (008c).
 * ============================================================================
 * Nutzt htmlparser2 NUR auf bereits geladene HTML-Strings (kein Netz/DB/eval).
 * Extrahiert Kontaktdaten ausschließlich aus SICHTBAREM Text + `mailto:`/`tel:`-
 * Links. IGNORIERT script/style/JSON-LD/Kommentare/Alt-Text. Schließt
 * Fax/Datenschutz/Webmaster/no-reply aus. NICHTS raten (kein `info@domain`).
 */
import { parseDocument } from "htmlparser2";

const SKIP_TYPES = new Set(["script", "style", "comment", "directive", "cdata"]);
const SKIP_TAGS = new Set(["script", "style", "noscript", "template", "svg"]);
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const EXCLUDED_LOCAL = /^(webmaster|datenschutz|privacy|abuse|postmaster|hostmaster|mailer-daemon|no-?reply|do-?not-?reply|noreply)$/i;
const PHONE_RE = /(?:\+49|0)[\d\s/().-]{4,}\d/g;
const FAX_RE = /fax[^0-9+]{0,12}((?:\+49|0)[\d\s/().-]{4,}\d)/gi;
const PLZ_ORT_RE = /\b(\d{5})\s+([A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß.\-/ ]{1,40})/g;

/**
 * Ort aus „PLZ Ort …"-Treffer säubern: nur der eigentliche Ortsname, ohne
 * angehängten Text (z. B. „Aichach Social-Media" → „Aichach"). Mehrwort-Orte
 * („Bad Homburg", „Frankfurt am Main", „Halle an der Saale") werden erhalten.
 */
function cleanCity(raw) {
  const toks = String(raw).trim().split(/\s+/).filter(Boolean).map((w) => w.replace(/[.,;:]+$/, ""));
  if (!toks.length || /[\d@]/.test(toks[0])) return "";
  const out = [toks[0]];
  if (/^(bad|sankt|st)$/i.test(toks[0]) && toks[1] && /^[A-ZÄÖÜ]/.test(toks[1])) {
    out.push(toks[1]);
  } else if (toks[1] && /^(am|an|ob|im|vor|unter|ober)$/i.test(toks[1]) && toks[2]) {
    out.push(toks[1], toks[2]);
    if (toks[3] && /^(main|saale|ruhr|rhein|inn|lech|elbe|oder|werra|donau|mosel|nahe)$/i.test(toks[3])) out.push(toks[3]);
  }
  return out.join(" ");
}
// Straße = entweder EIN Wort mit angehängtem Suffix (Hauptstraße, Gerhauserstr.,
// Kirchhofsallee) ODER „Adjektivwort + getrenntes Suffix" (Eckernförder Str., Berliner
// Allee). KEINE beliebigen führenden Wörter (Firmenname/Ort werden nicht mitgenommen).
const STREET_RE = /\b([A-ZÄÖÜ][a-zäöüß]+?(?:straße|strasse|str\.|weg|platz|allee|ring|gasse|damm|ufer|chaussee|wall)|[A-ZÄÖÜ][a-zäöüß]+(?:er)?\s(?:Str\.?|Straße|Strasse|Allee|Weg|Platz|Ring|Damm))\s+(\d{1,4}\s?[a-z]?)\b/g;
const CONTACT_LINK_RE = /(impressum|kontakt|contact|ueber-?uns|uber-?uns|about|standorte|filialen)/i;

/** Telefon/Fax → nur führendes + plus Ziffern; null wenn unplausibel (6–15 Ziffern). */
export function normalizePhone(raw) {
  if (!raw) return null;
  let s = String(raw).trim().replace(/[^\d+]/g, "");
  if (s.startsWith("00")) s = "+" + s.slice(2);
  const digits = s.replace(/\D/g, "");
  if (digits.length < 6 || digits.length > 15) return null;
  if (s.startsWith("+")) return "+" + digits;
  return digits; // führende 0 etc. bleibt erhalten
}

export function isExcludedEmail(email) {
  const local = String(email).split("@")[0] ?? "";
  return EXCLUDED_LOCAL.test(local);
}

function uniq(arr) {
  return [...new Set(arr)];
}

/** Rekursiver Walk: sichtbarer Text + a-Links; script/style/etc. werden übersprungen. */
function walk(node, acc) {
  if (!node) return;
  const nodes = Array.isArray(node) ? node : [node];
  for (const n of nodes) {
    if (SKIP_TYPES.has(n.type)) continue;
    if (n.type === "text") {
      if (n.data) acc.textParts.push(n.data);
      continue;
    }
    if (n.type === "tag" || n.type === "root") {
      const name = (n.name ?? "").toLowerCase();
      if (SKIP_TAGS.has(name)) continue;
      if (name === "a" && n.attribs && n.attribs.href) {
        const href = n.attribs.href.trim();
        const text = textOf(n).trim();
        acc.links.push({ href, text });
        if (/^mailto:/i.test(href)) acc.mailtos.push(href.replace(/^mailto:/i, "").split("?")[0]);
        if (/^tel:/i.test(href)) acc.tels.push(href.replace(/^tel:/i, ""));
      }
      if (name === "br") acc.textParts.push("\n");
      if (n.children) walk(n.children, acc);
    }
  }
}

function textOf(node) {
  const acc = { textParts: [], links: [], mailtos: [], tels: [] };
  if (node.children) walk(node.children, acc);
  return acc.textParts.join(" ");
}

/**
 * Extrahiert Kontakt-Evidenz aus einem HTML-String.
 * @param {string} html
 * @returns {{emails: string[], phones: string[], faxes: string[], addresses: {strasse: string|null, plz: string, ort: string}[], links: {href: string, text: string}[], text: string}}
 */
export function extractFromHtml(html) {
  const doc = parseDocument(String(html ?? ""), { decodeEntities: true });
  const acc = { textParts: [], links: [], mailtos: [], tels: [] };
  walk(doc.children, acc);
  const text = acc.textParts.join(" ").replace(/\s+/g, " ").trim();

  // Fax-Nummern zuerst (zum Ausschluss aus Telefon).
  const faxes = uniq([...text.matchAll(FAX_RE)].map((m) => normalizePhone(m[1])).filter(Boolean));
  const faxSet = new Set(faxes);

  const telPhones = acc.tels.map(normalizePhone).filter(Boolean);
  const textPhones = [...text.matchAll(PHONE_RE)].map((m) => normalizePhone(m[0])).filter(Boolean);
  const phones = uniq([...telPhones, ...textPhones]).filter((p) => !faxSet.has(p));

  // TMG-Filter: E-Mails im Umfeld von Web-Agentur-Hinweisen verwerfen (Impressum nennt oft
  // die Agentur, die die Seite erstellt hat — das ist NICHT der §5-verantwortliche Kontakt).
  const AGENCY_CTX = /(webdesign|webentwicklung|web-?agentur|agentur|realisier|umsetzung|umgesetzt|erstellt von|gestaltung|programmier|konzeption|powered by)/i;
  const textEmails = [...text.matchAll(EMAIL_RE)]
    .filter((m) => !AGENCY_CTX.test(text.slice(Math.max(0, (m.index ?? 0) - 60), (m.index ?? 0) + m[0].length + 20)))
    .map((m) => m[0].toLowerCase());
  const emails = uniq([...acc.mailtos.map((e) => e.toLowerCase()), ...textEmails])
    .filter((e) => !isExcludedEmail(e));

  // Adressen: jede „PLZ Ort" mit der NÄCHSTGELEGENEN Straße davor paaren
  // (typische Reihenfolge „Straße Nr, PLZ Ort"); danach pro (PLZ, Hausnummer)
  // deduplizieren (gleiche Adresse taucht oft mehrfach/leicht verschmutzt auf).
  const streetMatches = [...text.matchAll(STREET_RE)].map((m) => ({
    idx: m.index ?? 0, val: `${m[1]} ${m[2]}`.replace(/\s+/g, " ").trim(),
  }));
  const seenAddr = new Set();
  const addresses = [];
  for (const m of text.matchAll(PLZ_ORT_RE)) {
    const ort = cleanCity(m[2]);
    if (!ort) continue;
    const plz = m[1];
    let strasse = null, best = -1;
    for (const s of streetMatches) {
      if (s.idx < (m.index ?? 0) && s.idx > best) { best = s.idx; strasse = s.val; }
    }
    const num = (strasse ?? "").match(/\d{1,4}/)?.[0] ?? "";
    const key = `${plz}|${num}`;
    if (seenAddr.has(key)) continue;
    seenAddr.add(key);
    addresses.push({ strasse, plz, ort });
  }

  return { emails, phones, faxes, addresses, links: acc.links, text };
}

/** Same-/Sub-Seiten-Kandidaten aus Links (Impressum/Kontakt/…), absolut aufgelöst. */
export function findContactLinks(links, baseUrl) {
  const out = [];
  for (const { href, text } of links ?? []) {
    if (!href || /^(mailto:|tel:|javascript:|#)/i.test(href)) continue;
    if (!CONTACT_LINK_RE.test(href) && !CONTACT_LINK_RE.test(text ?? "")) continue;
    try {
      out.push(new URL(href, baseUrl).toString());
    } catch {
      /* ungültige URL ignorieren */
    }
  }
  return uniq(out);
}
