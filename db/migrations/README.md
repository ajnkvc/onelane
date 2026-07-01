# db/migrations

Hier liegen die **reinen SQL-Migrationen** — die **maßgebliche Wahrheit** des Datenbankschemas
(Tabellen, Indizes, `ENABLE ROW LEVEL SECURITY` — bewusst **kein** `FORCE`, siehe SECURITY.md 3.9 —
GRANTs, RLS-Policies, Trigger, Views). Hosterunabhängig, in jede Standard-PostgreSQL einspielbar.
Das Drizzle-Schema (`db/schema/*`) spiegelt diese Dateien nur (Drift-Wächter: `tests/rls/drift.test.ts`).

## Anwenden (Runner)
Migrationen werden über den **Owner-/Tooling-Pfad** angewandt — direkte Verbindung (kein
Transaction-Pooler) über `TOOLING_DATABASE_URL`:

```
npm run db:migrate          # ausstehende Migrationen anwenden
npm run db:migrate:status   # nur anzeigen (dry-run), nichts anwenden
```

Der Runner (`scripts/migrate.mjs` + reiner Kern `db/migrate-core.mjs`) wendet `*.sql` in
**Namensreihenfolge** an und trackt Angewandtes in der Tabelle `_schema_migrations`
(Name + **Checksumme** + Zeitpunkt). Der Kern ist gegen PGlite getestet (`tests/migrate.test.ts`).

## Konvention
- **Fortlaufende Namen** mit Nummern-Präfix (`0000_…`, `0001_…`), die die Reihenfolge bestimmen.
- Jede Datei ist **self-contained** (verwaltet ggf. ihre eigene Transaktion, vgl. `0000_*.sql`).
- **Bereits angewandte Dateien NICHT mehr ändern** — sonst meldet der Runner **Drift** (Checksumme
  weicht ab) und führt sie nicht erneut aus. Änderungen kommen als **neue** Migration (höhere Nummer).
- `_schema_migrations` gehört dem Migrator/Owner und ist **nicht** an `app_user` gegrantet.
