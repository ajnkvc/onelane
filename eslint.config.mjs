import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * ESLint — Next-Defaults + harte Durchsetzung unserer Architekturregeln
 * (Doku reicht nicht; Regeln als Code verhindern versehentliche Verstöße).
 *
 * WICHTIG (Flat-Config-Semantik): pro Regel-Key gewinnt der LETZTE zutreffende Block.
 * Ein späterer Block, der `no-restricted-imports`/`no-restricted-syntax` NEU setzt,
 * ERSETZT den früheren Wert (er merged NICHT). Darum werden die Bausteine unten als
 * gemeinsame Konstanten definiert und pro Layer bewusst zur vollen Menge zusammengesetzt
 * (F-029/F-030/F-091: kein stilles Verlieren einer Verbotsklasse durch Überschreiben).
 */

const ENV_MSG =
  "process.env nur in src/server/config/* bzw. src/lib/public-config.ts lesen (Config-Schicht).";
const ELEVATED_DYN_MSG =
  "Dynamischer import() von server/dal/elevated ist verboten — withElevatedAudit statisch importieren.";
const DYN_IMPORT_MSG =
  "Dynamischer import() muss ein statisches String-Literal sein (kein Template/Konkatenation/Variable) — " +
  "sonst lässt sich der erhöhte Pfad (server/dal/elevated) an der statischen Importkontrolle vorbeischmuggeln.";
const FETCH_MSG =
  "Server-Egress nur über safeFetch (@/server/egress/safe-fetch) — roher fetch()/Netzwerk-Client ist SSRF-ungehärtet.";

// --- no-restricted-syntax Bausteine ----------------------------------------
// F-070: process.env auch computed (process["env"]) und über globalThis/window/self/global.
const ENV_SELECTORS = [
  { selector: "MemberExpression[object.name='process'][property.name='env']", message: ENV_MSG },
  { selector: "MemberExpression[object.name='process'][property.value='env']", message: ENV_MSG },
  { selector: "MemberExpression[object.property.name='process'][property.name='env']", message: ENV_MSG },
  { selector: "MemberExpression[object.property.name='process'][property.value='env']", message: ENV_MSG },
];
// F-067: dynamischer elevated-Import. String-Literal wird gezielt gemeldet; JEDE nicht-literale
// import()-Quelle (Template-Literal, Konkatenation `"@/server/"+x`, Variable) wird generell verboten,
// weil ihr Ziel statisch nicht prüfbar ist (und so den elevated-Pfad einschmuggeln könnte).
const ELEVATED_DYN_SELECTORS = [
  { selector: "ImportExpression[source.value=/server\\/dal\\/elevated/]", message: ELEVATED_DYN_MSG },
  { selector: "ImportExpression:not([source.type='Literal'])", message: DYN_IMPORT_MSG },
];
const DANGEROUS_HTML_BLANKET = {
  selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
  message: "dangerouslySetInnerHTML ist gesperrt — JSON-LD ausschließlich über safeJsonLd() rendern.",
};
// F-069: in der einzigen erlaubten Komponente MUSS __html exakt safeJsonLd(...) sein.
const DANGEROUS_HTML_MUST_SAFEJSONLD = {
  selector:
    "JSXAttribute[name.name='dangerouslySetInnerHTML'] Property[key.name='__html'][value.callee.name!='safeJsonLd']",
  message: "dangerouslySetInnerHTML.__html darf ausschließlich safeJsonLd(...) sein.",
};
// OS-P1: das nonce-feste Theme-Inline-Script (statische Konstante ohne Nutzereingabe)
// ist die ZWEITE eng umzäunte __html-Stelle — __html MUSS exakt themeInitScript() sein.
const DANGEROUS_HTML_MUST_THEMESCRIPT = {
  selector:
    "JSXAttribute[name.name='dangerouslySetInnerHTML'] Property[key.name='__html'][value.callee.name!='themeInitScript']",
  message: "dangerouslySetInnerHTML.__html darf hier ausschließlich themeInitScript() sein.",
};
// F-068: computed fetch (globalThis['fetch'] etc.) — die no-restricted-properties-Regel greift nur bei Dot-Zugriff.
const FETCH_COMPUTED_SELECTOR = {
  selector:
    "MemberExpression[computed=true][object.name=/^(globalThis|window|self|global)$/][property.value='fetch']",
  message: FETCH_MSG,
};
const BASE_SYNTAX = [...ENV_SELECTORS, DANGEROUS_HTML_BLANKET, ...ELEVATED_DYN_SELECTORS];
// Migration 0022/0023: withPublicSubmissionContext ist der EINZIGE anonyme Schreibpfad
// und darf ausschließlich in den Submission-Modulen (src/modules/leads, src/modules/jobs)
// importiert werden — überall sonst gesperrt (Block 5b hebt die Sperre dort gezielt auf).
// Erfasst den ImportSpecifier; das Barrel-Re-Export in dal/index.ts ist ein ExportSpecifier
// und bleibt unberührt.
const PUBLIC_SUBMISSION_IMPORT_SELECTOR = {
  selector: "ImportSpecifier[imported.name='withPublicSubmissionContext']",
  message:
    "withPublicSubmissionContext (anonymer Schreibpfad) darf nur in src/modules/leads/**, " +
    "src/modules/jobs/** bzw. src/modules/ereignisse/** verwendet werden " +
    "(Submission-Tabellen leads/job_applications + Zähler-Funktion app.zaehle_ereignis).",
};

// Migration 0031: apiKeyAuthLookup ist der GESCHLOSSENE Maschinen-Auth-Pfad des
// API-/MCP-Zugangs (GUC-gated Definer-Lookup + last_used_at). EINZIGER erlaubter
// Importeur ist der Key-Auth-Adapter src/modules/api/db-key.ts (Block 5c hebt die
// Sperre dort gezielt auf) — identisches Muster wie withPublicSubmissionContext.
const API_KEY_AUTH_IMPORT_SELECTOR = {
  // Fängt BEIDE Umgehungswege (Sicherheits-Abnahme 2026-07-03): den benannten
  // Import `{ apiKeyAuthLookup }` UND den Namespace-Zugriff `dal.apiKeyAuthLookup`
  // (via `import * as dal`). Der Aufruf-Selektor greift auch am Verwendungsort,
  // nicht nur am Import — schließt die zuvor offene ImportSpecifier-only-Lücke.
  selector:
    "ImportSpecifier[imported.name='apiKeyAuthLookup'], MemberExpression[property.name='apiKeyAuthLookup']",
  message:
    "apiKeyAuthLookup (Maschinen-Auth-Pfad des API-/MCP-Zugangs, Migration 0031) darf nur " +
    "in src/modules/api/db-key.ts verwendet werden (Key-Auth-Adapter).",
};

// --- no-restricted-imports Bausteine ---------------------------------------
const ELEVATED_PATHS = [
  {
    name: "@/server/dal/elevated",
    importNames: ["getElevatedDb"],
    message:
      "Roher getElevatedDb() umgeht RLS — im App-/Request-Pfad verboten. Nutze den auditierten " +
      "Wrapper withElevatedAudit (schreibt zwingend security_events). getElevatedDb nur in " +
      "src/server/dal/ + tsx-Tooling-Scripts.",
  },
];
const CLIENT_PATHS = [
  {
    name: "@/server/dal/client",
    message:
      "Rohe DB-Verbindung — NUR innerhalb von src/server/dal/. Außerhalb immer über @/server/dal (withUserContext/withAnonContext), damit RLS-Kontext gesetzt ist.",
  },
];
// F-030: elevated UND client auch per RELATIVEM Pfad (nicht nur @/-Alias). Groups matchen
// `dal/elevated` mit beliebigem Präfix — inkl. `../dal/elevated`, `./dal/client` (ohne `server/`-Segment,
// z. B. aus einer NICHT-dal-Datei unter src/server) sowie den @/-Alias.
const ELEVATED_PATTERNS = [
  {
    group: ["**/dal/elevated", "**/dal/elevated.*", "**/dal/elevated/**"],
    importNames: ["getElevatedDb"],
    message: "Roher getElevatedDb() — auch per relativem Pfad verboten. Nutze withElevatedAudit.",
  },
];
const CLIENT_PATTERNS = [
  {
    group: ["**/dal/client", "**/dal/client.*", "**/dal/client/**"],
    message: "Rohe DB-Verbindung — auch per relativem Pfad nur in src/server/dal/.",
  },
];
// F-053: getDb (rohe Verbindung) NUR in rls-context.ts. Der generische **/dal/client-Pattern fängt
// den Geschwister-Import `./client` innerhalb von src/server/dal NICHT (kein `dal/`-Segment im Specifier)
// → gezielt ergänzen, damit ein KÜNFTIGES DAL-Modul nicht an rls-context vorbei getDb() zieht.
const CLIENT_SIBLING_PATTERNS = [
  {
    group: ["./client", "./client.*"],
    message: "Rohe DB-Verbindung (getDb) NUR in rls-context.ts — neue DAL-Module dürfen client.ts nicht direkt importieren (F-053).",
  },
];
// F-068: Netzwerk-Clients außerhalb src/server/egress verboten (nur safeFetch).
const NETWORK_PATTERNS = [
  {
    group: [
      "undici", "got", "axios", "node-fetch", "cross-fetch",
      "http", "https", "node:http", "node:https",
      "net", "node:net", "tls", "node:tls", "dns", "node:dns", "node:dns/promises",
    ],
    message: FETCH_MSG,
  },
];
// F-029: Präsentation darf src/server GAR NICHT importieren — Alias UND relativ.
const PRESENTATION_PATTERNS = [
  {
    group: ["@/server", "@/server/*", "@/server/**"],
    message:
      "Präsentationsschicht darf src/server nicht importieren — Zugriff über src/modules (Server Actions/Use-Cases).",
  },
  {
    group: ["**/server/**"],
    message:
      "Präsentationsschicht darf src/server nicht importieren (auch nicht per relativem Pfad) — Zugriff über src/modules.",
  },
];
// F-012: src/modules dürfen den erhöhten Pfad NICHT direkt importieren (Audit ≠ AuthZ).
const MODULES_ELEVATED_PATHS = [
  {
    name: "@/server/dal/elevated",
    message:
      "Erhöhter Pfad (withElevatedAudit/getElevatedDb) nicht direkt aus src/modules — in eine " +
      "domänenspezifische Server-Funktion mit AuthZ/Signaturprüfung kapseln (F-012).",
  },
];
const MODULES_ELEVATED_PATTERNS = [
  {
    group: ["**/dal/elevated", "**/dal/elevated.*", "**/dal/elevated/**"],
    message: "Erhöhter Pfad nicht direkt aus src/modules — über eine domänenspezifische Server-Funktion kapseln (F-012).",
  },
];

// --- no-restricted-globals/-properties (roher fetch) -----------------------
const FETCH_GLOBALS = [{ name: "fetch", message: FETCH_MSG }];
const FETCH_PROPERTIES = [
  { object: "globalThis", property: "fetch", message: FETCH_MSG },
  { object: "window", property: "fetch", message: FETCH_MSG },
  { object: "self", property: "fetch", message: FETCH_MSG },
  { object: "global", property: "fetch", message: FETCH_MSG },
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // (1) Basis für den gesamten src/-Baum.
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": ["error", ...BASE_SYNTAX, PUBLIC_SUBMISSION_IMPORT_SELECTOR, API_KEY_AUTH_IMPORT_SELECTOR],
      "no-restricted-imports": [
        "error",
        { paths: [...ELEVATED_PATHS, ...CLIENT_PATHS], patterns: [...ELEVATED_PATTERNS, ...CLIENT_PATTERNS] },
      ],
    },
  },

  // (3) Präsentation (app/components): darf src/server NICHT importieren (Alias + relativ, F-029).
  {
    files: ["src/app/**/*.{ts,tsx}", "src/components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", { patterns: PRESENTATION_PATTERNS }],
    },
  },

  // (4) Einzige erlaubte JSON-LD-Komponente: __html MUSS safeJsonLd(...) sein (F-069).
  // env- und dyn-elevated-Verbote bleiben; nur das pauschale dangerouslySetInnerHTML-Verbot
  // wird durch die enge safeJsonLd-Pflicht ersetzt.
  {
    files: ["src/components/seo/json-ld.tsx"],
    rules: {
      "no-restricted-syntax": ["error", ...ENV_SELECTORS, ...ELEVATED_DYN_SELECTORS, DANGEROUS_HTML_MUST_SAFEJSONLD],
    },
  },

  // (4b) OS-P1 Theme-Inline-Script (nonce-fest, statische Konstante): einzige weitere
  // __html-Stelle — MUSS exakt themeInitScript() sein; alle übrigen Verbote bleiben.
  {
    files: ["src/components/portal/theme-script.tsx"],
    rules: {
      "no-restricted-syntax": ["error", ...ENV_SELECTORS, ...ELEVATED_DYN_SELECTORS, DANGEROUS_HTML_MUST_THEMESCRIPT],
    },
  },

  // (5) src/modules: kein erhöhter Pfad, keine rohe DB-Verbindung, kein roher Egress (F-012/F-031/F-068).
  {
    files: ["src/modules/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": ["error", ...BASE_SYNTAX, FETCH_COMPUTED_SELECTOR, PUBLIC_SUBMISSION_IMPORT_SELECTOR, API_KEY_AUTH_IMPORT_SELECTOR],
      "no-restricted-imports": [
        "error",
        {
          paths: [...MODULES_ELEVATED_PATHS, ...CLIENT_PATHS],
          patterns: [...MODULES_ELEVATED_PATTERNS, ...CLIENT_PATTERNS, ...NETWORK_PATTERNS],
        },
      ],
      "no-restricted-globals": ["error", ...FETCH_GLOBALS],
      "no-restricted-properties": ["error", ...FETCH_PROPERTIES],
    },
  },

  // (5b) Submission-Module: EINZIGER erlaubter Nutzungsort von withPublicSubmissionContext
  // (anonymer Schreibpfad für leads/job_applications + Ereignis-Zähler-Funktion, Migrationen
  // 0022/0023/0024). Identisch zu (5), nur ohne den PUBLIC_SUBMISSION-Selector — alle übrigen
  // Modul-Sperren bleiben aktiv.
  {
    files: ["src/modules/leads/**/*.{ts,tsx}", "src/modules/jobs/**/*.{ts,tsx}", "src/modules/ereignisse/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": ["error", ...BASE_SYNTAX, FETCH_COMPUTED_SELECTOR, API_KEY_AUTH_IMPORT_SELECTOR],
      "no-restricted-imports": [
        "error",
        {
          paths: [...MODULES_ELEVATED_PATHS, ...CLIENT_PATHS],
          patterns: [...MODULES_ELEVATED_PATTERNS, ...CLIENT_PATTERNS, ...NETWORK_PATTERNS],
        },
      ],
      "no-restricted-globals": ["error", ...FETCH_GLOBALS],
      "no-restricted-properties": ["error", ...FETCH_PROPERTIES],
    },
  },

  // (5c) Key-Auth-Adapter (Migration 0031): EINZIGER erlaubter Nutzungsort von
  // apiKeyAuthLookup (geschlossener Maschinen-Auth-Pfad des API-/MCP-Zugangs).
  // Identisch zu (5), nur ohne den API_KEY_AUTH-Selector — alle übrigen
  // Modul-Sperren (inkl. PUBLIC_SUBMISSION) bleiben aktiv.
  {
    files: ["src/modules/api/db-key.ts"],
    rules: {
      "no-restricted-syntax": ["error", ...BASE_SYNTAX, FETCH_COMPUTED_SELECTOR, PUBLIC_SUBMISSION_IMPORT_SELECTOR],
      "no-restricted-imports": [
        "error",
        {
          paths: [...MODULES_ELEVATED_PATHS, ...CLIENT_PATHS],
          patterns: [...MODULES_ELEVATED_PATTERNS, ...CLIENT_PATTERNS, ...NETWORK_PATTERNS],
        },
      ],
      "no-restricted-globals": ["error", ...FETCH_GLOBALS],
      "no-restricted-properties": ["error", ...FETCH_PROPERTIES],
    },
  },

  // (6) src/server: roher Egress verboten; erhöhter Pfad/Client nur in dal (siehe 8); Netzwerk-Clients bannen.
  {
    files: ["src/server/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": ["error", ...BASE_SYNTAX, FETCH_COMPUTED_SELECTOR, PUBLIC_SUBMISSION_IMPORT_SELECTOR, API_KEY_AUTH_IMPORT_SELECTOR],
      "no-restricted-imports": [
        "error",
        { paths: [...ELEVATED_PATHS, ...CLIENT_PATHS], patterns: [...ELEVATED_PATTERNS, ...CLIENT_PATTERNS, ...NETWORK_PATTERNS] },
      ],
      "no-restricted-globals": ["error", ...FETCH_GLOBALS],
      "no-restricted-properties": ["error", ...FETCH_PROPERTIES],
    },
  },

  // (7) API-Route-Handler (server-seitig, unter src/app): Server-Barriere (aus 3) + Netzwerk-Ban + roher Egress verboten (F-031).
  {
    files: ["src/app/api/**/*.ts"],
    rules: {
      "no-restricted-syntax": ["error", ...BASE_SYNTAX, FETCH_COMPUTED_SELECTOR, PUBLIC_SUBMISSION_IMPORT_SELECTOR, API_KEY_AUTH_IMPORT_SELECTOR],
      "no-restricted-imports": ["error", { patterns: [...PRESENTATION_PATTERNS, ...NETWORK_PATTERNS] }],
      "no-restricted-globals": ["error", ...FETCH_GLOBALS],
      "no-restricted-properties": ["error", ...FETCH_PROPERTIES],
    },
  },

  // (8a) Config-Schicht darf process.env lesen — NUR der env-Selektor entfällt (F-091): dangerouslySetInnerHTML-,
  // dyn-elevated-Import- und computed-fetch-Verbote bleiben aktiv. MUSS NACH (6) stehen (sonst reaktiviert der
  // src/server-Block das env-Verbot für src/server/config/*). Deckt auch src/lib/public-config.ts ab.
  {
    files: ["src/server/config/**/*.ts", "src/lib/public-config.ts"],
    rules: {
      "no-restricted-syntax": ["error", DANGEROUS_HTML_BLANKET, ...ELEVATED_DYN_SELECTORS, FETCH_COMPUTED_SELECTOR],
    },
  },

  // (8) Der DAL-Ordner darf elevated referenzieren, aber KEINE Netzwerk-Clients UND — F-053 — auch NICHT
  // die rohe Verbindung `./client` (getDb): die ist ausschließlich rls-context.ts vorbehalten (siehe 8b).
  // Nicht pauschal "off". Muss NACH (6) stehen.
  {
    files: ["src/server/dal/**/*.ts"],
    rules: { "no-restricted-imports": ["error", { patterns: [...NETWORK_PATTERNS, ...CLIENT_SIBLING_PATTERNS] }] },
  },

  // (8b) NUR rls-context.ts darf die rohe Verbindung (`./client` → getDb) importieren (F-053). Muss NACH (8)
  // stehen. Netzwerk-Clients bleiben auch hier verboten.
  {
    files: ["src/server/dal/rls-context.ts"],
    rules: { "no-restricted-imports": ["error", { patterns: [...NETWORK_PATTERNS] }] },
  },

  // (9) Das Egress-Modul darf Netzwerk-Clients (undici/node:dns) + fetch nutzen — aber NICHT den DB-Pfad.
  // GANZEN elevated-/client-Pfad bannen (ohne importNames-Einschränkung: auch withElevatedAudit/Default-Import/
  // andere named exports sind hier verboten — Egress hat keinerlei DB-Zugriff). Nicht "off". NACH (6).
  {
    files: ["src/server/egress/**/*.ts"],
    rules: {
      "no-restricted-globals": "off",
      "no-restricted-properties": "off",
      "no-restricted-imports": ["error", { paths: [...MODULES_ELEVATED_PATHS, ...CLIENT_PATHS], patterns: [...MODULES_ELEVATED_PATTERNS, ...CLIENT_PATTERNS] }],
    },
  },

  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
