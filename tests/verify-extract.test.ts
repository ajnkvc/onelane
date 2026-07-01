import { describe, it, expect } from "vitest";
import {
  extractFromHtml, findContactLinks, normalizePhone,
} from "../db/ingest/extract.mjs";
import {
  registrableDomain, isSafeFetchUrl, isSameSite, checkFetchTarget, isUsableContact,
} from "../db/ingest/siteguard.mjs";

/**
 * 008c — reine Extraktion + SSRF-/Domain-Guard, offline (kein Netz/DB).
 * No-Halluzination: nur sichtbarer Text + mailto/tel; script/JSON-LD/alt ignoriert;
 * Fax/Datenschutz/no-reply ausgeschlossen.
 */

describe("extractFromHtml — Impressum", () => {
  it("extrahiert Adresse, Telefon (tel:), E-Mail (mailto:)", () => {
    const html = `<html><body><h1>Impressum</h1>
      <p>Fahrschule Müller<br>Musterstraße 12, 80331 München</p>
      <p>Tel: <a href="tel:+498912345678">089 12345678</a></p>
      <p>E-Mail: <a href="mailto:info@fahrschule-mueller.de?subject=Hi">info@…</a></p>
    </body></html>`;
    const r = extractFromHtml(html);
    expect(r.emails).toContain("info@fahrschule-mueller.de");
    expect(r.phones).toContain("+498912345678");
    expect(r.addresses[0]).toMatchObject({ plz: "80331", ort: "München" });
    expect(r.addresses[0].strasse).toContain("Musterstraße 12");
  });
});

describe("extractFromHtml — Ausschlüsse / keine Halluzination", () => {
  it("schließt datenschutz/webmaster/no-reply-Mails aus", () => {
    const html = `<a href="mailto:datenschutz@x.de">DS</a>
      <a href="mailto:no-reply@x.de">nr</a> webmaster@x.de info@x.de`;
    const r = extractFromHtml(html);
    expect(r.emails).toContain("info@x.de");
    expect(r.emails).not.toContain("datenschutz@x.de");
    expect(r.emails).not.toContain("no-reply@x.de");
    expect(r.emails).not.toContain("webmaster@x.de");
  });

  it("schließt Fax aus den Telefonnummern aus", () => {
    const html = `<p>Tel. 030 1112223<br>Fax: 030 9998887</p>`;
    const r = extractFromHtml(html);
    expect(r.phones).toContain(normalizePhone("030 1112223"));
    expect(r.phones).not.toContain(normalizePhone("030 9998887"));
    expect(r.faxes).toContain(normalizePhone("030 9998887"));
  });

  it("ignoriert Kontaktdaten in script/JSON-LD/alt-Text", () => {
    const html = `<html><head>
      <script type="application/ld+json">{"telephone":"+49 30 0000000","email":"ld@x.de"}</script>
      <script>var e="script@x.de"; var t="030 4445556";</script>
      </head><body>
      <img alt="alt@x.de 030 7778889">
      <p>Kein sichtbarer Kontakt hier.</p>
    </body></html>`;
    const r = extractFromHtml(html);
    expect(r.emails).toHaveLength(0);
    expect(r.phones).toHaveLength(0);
  });
});

describe("findContactLinks", () => {
  it("findet Impressum/Kontakt-Links, ignoriert mailto/#", () => {
    const html = `<a href="/impressum">Impressum</a>
      <a href="/kontakt/">Kontakt</a>
      <a href="mailto:x@y.de">Mail</a>
      <a href="#top">Top</a>
      <a href="/datenschutz">Datenschutz</a>`;
    const { links } = extractFromHtml(html);
    const found = findContactLinks(links, "https://www.schule.de/");
    expect(found).toContain("https://www.schule.de/impressum");
    expect(found).toContain("https://www.schule.de/kontakt/");
    expect(found.some((u) => u.includes("mailto"))).toBe(false);
  });
});

describe("siteguard — registrableDomain", () => {
  it("liefert eTLD+1", () => {
    expect(registrableDomain("www.fahrschule-x.de")).toBe("fahrschule-x.de");
    expect(registrableDomain("sub.a.fahrschule.de")).toBe("fahrschule.de");
    expect(registrableDomain("foo.co.uk")).toBe("foo.co.uk");
    expect(registrableDomain("localhost")).toBeNull();
  });
  it("F-051: mandantenfähige Plattform-Hosts → Subdomain ist die registrierbare Einheit", () => {
    // Ohne Sonderbehandlung wäre die registrierbare Domain „jimdosite.com" und ALLE Mandanten
    // würden als „gleiche Site" gelten. Der Mandant (Subdomain) muss die Grenze sein.
    expect(registrableDomain("schule-x.jimdosite.com")).toBe("schule-x.jimdosite.com");
    expect(registrableDomain("meine-fahrschule.wixsite.com")).toBe("meine-fahrschule.wixsite.com");
    expect(registrableDomain("foo.github.io")).toBe("foo.github.io");
    // → Fremd-Mandant desselben Plattform-Hosts ist NICHT same-site.
    expect(isSameSite("https://schule-y.jimdosite.com/", "schule-x.jimdosite.com")).toBe(false);
    expect(checkFetchTarget("https://schule-y.jimdosite.com/x", "schule-x.jimdosite.com").reason).toBe("off_site");
  });
});

describe("siteguard — SSRF/Safe-URL", () => {
  it("erlaubt http(s), blockt private/lokale/IP/non-http", () => {
    expect(isSafeFetchUrl("https://fahrschule-x.de/impressum").ok).toBe(true);
    expect(isSafeFetchUrl("ftp://fahrschule-x.de").ok).toBe(false);
    expect(isSafeFetchUrl("http://localhost/").ok).toBe(false);
    expect(isSafeFetchUrl("http://127.0.0.1/").ok).toBe(false);
    expect(isSafeFetchUrl("http://192.168.1.10/").ok).toBe(false);
    expect(isSafeFetchUrl("http://169.254.169.254/").ok).toBe(false);
    expect(isSafeFetchUrl("http://10.0.0.5/").ok).toBe(false);
  });
});

describe("siteguard — same-site + Redirect-Grenze", () => {
  it("erlaubt www/Subdomain derselben Domain, blockt fremde", () => {
    expect(isSameSite("https://www.x.de/impressum", "x.de")).toBe(true);
    expect(checkFetchTarget("https://x.de/kontakt", "x.de").ok).toBe(true);
    expect(checkFetchTarget("https://evil.com/x", "x.de").reason).toBe("off_site");
    expect(checkFetchTarget("http://127.0.0.1/", "x.de").reason).toBe("private_or_local");
  });
});

describe("siteguard — Live-Fetch-Gate (UA/Kontakt)", () => {
  it("lehnt Platzhalter/Beispiel-UA ab, akzeptiert echten Kontakt", () => {
    expect(isUsableContact("Bot/1.0 (+https://example.com)", "https://example.com")).toBe(false);
    expect(isUsableContact("Bot/1.0", "")).toBe(false);
    // Eigene Marke im Bot-UA nach außen verboten (neutraler Bot) — alt + neu
    expect(isUsableContact("RoadinoBot/1.0 (+mailto:x@projekt.de)", "mailto:x@projekt.de")).toBe(false);
    expect(isUsableContact("onelaneBot/1.0 (+mailto:x@projekt.de)", "mailto:x@projekt.de")).toBe(false);
    // mailto:-Kontakt genügt (keine Domain nötig); neutraler UA
    expect(isUsableContact("FahrschulDatenBot/0.1 (+mailto:kontakt@projekt.de)", "mailto:kontakt@projekt.de")).toBe(true);
    // URL-Kontakt weiterhin ok
    expect(isUsableContact("FahrschulDatenBot/0.1 (+https://projekt.de/bot)", "https://projekt.de/bot")).toBe(true);
  });
});
