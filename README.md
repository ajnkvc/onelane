# Fahrschul-Plattform

Vergleichsportal für Fahrschulen.

## Stack

Next.js 16 (App Router, SSR) · TypeScript (strict) · Tailwind CSS v4 · shadcn/ui ·
Drizzle ORM + PostgreSQL · Supabase (Auth/Storage) · Zod.

## Lokale Entwicklung

Die App läuft vollständig lokal gegen ein echtes Postgres 16 — ohne gehostetes
Supabase. Der spätere Wechsel ist im Wesentlichen ein Connection-String-Wechsel
(+ Auth/Storage), siehe [db/RUNBOOK.md](db/RUNBOOK.md).

```bash
npm install

# 1) Lokales Postgres 16 bereitstellen — EINE Variante:
#    A) nativ:  brew install postgresql@16 && brew services start postgresql@16 && createdb fahrschul_dev
#    B) Docker: npm run db:up
# 2) .env.development.local anlegen (gitignored) — Vorlage/Hinweise in .env.example:
#    DATABASE_URL=postgres://app_user:<lokales-dev-passwort>@localhost:5432/fahrschul_dev
#    TOOLING_DATABASE_URL=postgres://<lokaler-migrator>@localhost:5432/fahrschul_dev
#    NEXT_PUBLIC_SITE_URL=http://localhost:3000

npm run db:setup             # Migration + app_user-Login + Demo-Seed (idempotent)
npm run db:smoke             # RLS-Smoke-Test (anonym: nur gelistete Schulen sichtbar)
npm run dev                  # http://localhost:3000
```

Weitere Skripte: `npm run build`, `npm run lint`, `npm run typecheck`, `npm test`,
`npm run db:seed`, `npm run db:up`/`db:down` (Docker-DB).

> Hinweis: `npm run build` setzt `NEXT_PRIVATE_BUILD_WORKER=0` (via `cross-env`) — ein
> bewusster Workaround für einen Next.js-16-Build-Worker-Fehler (`ENOENT pages-manifest.json`)
> in manchen Umgebungen.

## Secret-Scan (empfohlen)

```bash
npm install            # aktiviert den Pre-Commit-Hook automatisch (prepare-Script → core.hooksPath)
brew install gitleaks  # macOS: gitleaks für den Scan installieren
```
(Manuell alternativ: `git config core.hooksPath .githooks`.)

## Verzeichnisstruktur (Kurzüberblick)

- `db/` — Schema (Drizzle) & reine SQL-Migrationen (hosterunabhängig)
- `src/app/` — Präsentation (Routen, SSR) an der Domain-Wurzel
- `src/modules/` — Geschäftslogik je Fachmodul
- `src/server/` — serverseitig-only: `dal/`, `adapters/`, `auth/`, `config/`
- `src/styles/tokens.css` — zentrale Design-Tokens
```
