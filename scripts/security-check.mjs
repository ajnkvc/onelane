/**
 * security-check.mjs — maschinelles Auto-Audit-Gate (Phase-0 #9).
 * ============================================================================
 * Blockierende Sicherheits-Invarianten, die weder Typecheck/Lint/Tests noch
 * gitleaks direkt abdecken. Läuft in CI (hart) UND lokal (`npm run security-check`).
 * Ergänzt — nicht ersetzt — die übrigen CI-Gates (RLS-Testsuite, ESLint-Import-Gates,
 * Secret-Scan, npm audit). Reines Node, keine Abhängigkeiten.
 *
 * Checks:
 *  1) Migration-Policy: JEDE in den Migrationen erstellte `public`-Tabelle MUSS RLS
 *     aktiviert haben (`enable row level security`). deny-by-default genügt (RLS an +
 *     keine Policy = alles verboten); die Policy-Granularität prüft die RLS-Testsuite.
 *  2) App-Pfad-Secrets: erhöhte Tooling-Secrets (TOOLING_DATABASE_URL / Supabase-Secret)
 *     dürfen im Request-/Präsentations-Pfad (src/app, src/components, src/modules) NICHT
 *     vorkommen — auch nicht als Text (Deployment-Trennung, vgl. SECURITY-KONZEPT §13.4).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const problems = [];

// ---- Check 1: RLS auf allen public-Tabellen ------------------------------------------
// Dokumentierte, bewusst begründete Ausnahmen (Tabellenname → Grund). Aktuell keine.
const RLS_EXEMPT = new Map();
{
  const migDir = join(root, "db", "migrations");
  const sql = readdirSync(migDir)
    .filter((f) => f.endsWith(".sql"))
    .map((f) => readFileSync(join(migDir, f), "utf8"))
    .join("\n");
  // Schema/Tabelle optional in "…" (quoted identifiers), optionaler Whitespace um den Punkt.
  // Namen case-insensitiv erfassen + lowercase-normalisieren — breiteres Erfassen macht den Guard nur
  // STRENGER (mehr „created"-Tabellen, die RLS brauchen), nie schwächer.
  const TBL = `"?public"?\\s*\\.\\s*"?([a-zA-Z_][a-zA-Z0-9_]*)"?`;
  const created = new Set();
  for (const m of sql.matchAll(new RegExp(`create\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?${TBL}`, "gi"))) {
    created.add(m[1].toLowerCase());
  }
  const rlsEnabled = new Set();
  for (const m of sql.matchAll(new RegExp(`alter\\s+table\\s+${TBL}\\s+enable\\s+row\\s+level\\s+security`, "gi"))) {
    rlsEnabled.add(m[1].toLowerCase());
  }
  for (const t of [...created].sort()) {
    if (!rlsEnabled.has(t) && !RLS_EXEMPT.has(t)) {
      problems.push(`RLS fehlt: public.${t} wird erstellt, aber nie 'enable row level security' (Migration-Policy §13/§12).`);
    }
  }
}

// ---- Check 2: keine erhöhten Secrets im App-/Request-Pfad ----------------------------
const APP_DIRS = ["src/app", "src/components", "src/modules"];
const FORBIDDEN = /\b(TOOLING_DATABASE_URL|SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY)\b/;
function walk(dir) {
  let out = [];
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const e of entries) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out = out.concat(walk(p));
    else if (/\.(ts|tsx|mjs|cjs|js|jsx|md|mdx|json|css)$/.test(e)) out.push(p);
  }
  return out;
}
for (const d of APP_DIRS) {
  for (const f of walk(join(root, d))) {
    const rel = f.slice(root.length + 1);
    readFileSync(f, "utf8").split(/\r?\n/).forEach((line, i) => {
      if (FORBIDDEN.test(line)) {
        problems.push(`Erhöhtes Secret im App-Pfad: ${rel}:${i + 1} — Tooling-Secrets gehören NICHT in src/app|components|modules.`);
      }
    });
  }
}

// ---- Ergebnis --------------------------------------------------------------------------
if (problems.length) {
  console.error(`✖ Security-Check FEHLGESCHLAGEN (${problems.length}):`);
  for (const p of problems) console.error("  - " + p);
  process.exit(1);
}
console.log("✓ Security-Check bestanden (Migration-RLS-Policy · keine App-Pfad-Secrets).");
