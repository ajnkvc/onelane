# db/RUNBOOK.md — Migration & Rollen ausrollen

Dieses Runbook beschreibt das Einspielen der kanonischen Migration und die
**out-of-band**-Schritte (Secrets, Supabase-spezifische Kante). **Keine Secrets
ins Repo** — Passwörter/Keys nur aus dem Secret-Manager des Hosts.

## 0. Lokale Entwicklung (Phase C-lokal)
Lokales Postgres **16** (Parität zu PGlite/Prod), **ohne** hosted Supabase:
- **Nativ:** `brew install postgresql@16 && brew services start postgresql@16 && createdb fahrschul_dev` — der lokale Superuser dient als Migrator-Login.
- **Docker:** `npm run db:up` (Service `db`, Owner `fahrschul_owner`, dev-only Creds; siehe `docker-compose.yml`).
- `.env.development.local` (gitignored) setzen: `DATABASE_URL` (Rolle `app_user`) + `TOOLING_DATABASE_URL` (lokaler **Migrator/Admin-Login**, **nicht** `app_owner`) + `NEXT_PUBLIC_SITE_URL`.
- `npm run db:setup` → Migration (idempotent, Drift-Check) + aktiviert `app_user`-LOGIN mit dem lokalen Dev-Passwort aus `DATABASE_URL` + lädt den Demo-Seed.
- `npm run db:smoke` → RLS-Beweis (anonym nur gelistete Schulen sichtbar, private Tabellen 0). Dann `npm run dev`.

> **1:1-Carry-over zu hosted Supabase:** Nur `DATABASE_URL`/`TOOLING_DATABASE_URL` auf das Supabase-Projekt zeigen lassen und die Schritte 1–4 unten ausführen (Migration, `app_user`-Login, `auth.users`-Trigger, API-Exposure). **Kein** Schema-/Code-Umbau; `app_owner` bleibt überall NOLOGIN; Seed ist Dev-only.

## 1. Migration einspielen
`db/migrations/0000_schritt_b_init.sql` gegen eine frische PostgreSQL einspielen
(lokal, Supabase oder via Test-DB). Sie ist die **maßgebliche Wahrheit** des Schemas
(Tabellen, Indizes, Trigger, RLS, Policies, Grants, Rollen `app_owner`/`app_user`).

```bash
psql "$ADMIN_DATABASE_URL" -f db/migrations/0000_schritt_b_init.sql
```

> `app_owner` und `app_user` werden als **NOLOGIN** angelegt (kein Passwort in SQL).

## 2. app_user-Login aktivieren (out-of-band, Secret)
Die reguläre App verbindet sich als `app_user`. LOGIN + Passwort werden **außerhalb**
der Migration gesetzt (Passwort aus dem Secret-Manager, NIE im Repo):

```sql
-- Beispiel; <SECRET> aus dem Secret-Manager einsetzen:
alter role app_user with login password '<SECRET>';
```

Danach `DATABASE_URL` (siehe `.env.example`) auf eine Verbindung **als app_user**
setzen — NICHT als `postgres`/Owner/Superuser.

### 2.1 Härtung der `app_user`-Rolle (out-of-band, DoS-/Kostenschutz)
Backstops, die als Rollen-Eigenschaft gesetzt werden müssen (nicht in der Migration,
da privilegiert + pooler-robust). Werte an Pooler-Kapazität anpassen:

```sql
-- Server-seitiges Verbindungs-Limit (App-Pool ≠ DB-Limit): Backstop gegen
-- Verbindungs-Erschöpfung bei mehreren Instanzen/Cold-Starts.
alter role app_user connection limit 30;

-- Pooler-robuste Laufzeit-Limits als Rollen-Default (ergänzt die transaktions-
-- lokalen SET-LOCAL-Guards im DAL; greift auch dort, wo SET LOCAL nicht ankommt):
alter role app_user set statement_timeout = '5s';
alter role app_user set lock_timeout = '3s';
alter role app_user set idle_in_transaction_session_timeout = '10s';
```

> Den Tooling-/Owner-Pfad NICHT so drosseln — Migrationen/Importe laufen bewusst lang.

> Erhöhter Pfad (Migrationen, Import, Webhooks): eigene Verbindung über
> `TOOLING_DATABASE_URL` (Owner/Service-Rolle, RLS-bypass). Jede Nutzung protokollieren.

## 3. Supabase-spezifische Kante: auth.users → public.users
Bewusst NICHT Teil der portablen Migration (das `auth`-Schema ist Supabase-spezifisch).
Auf Supabase EINMALIG einspielen, damit bei jeder Registrierung eine Profilzeile entsteht.
**Bei Auth-Wechsel nur diesen Trigger ersetzen — nicht das Datenmodell.**

```sql
create or replace function app.handle_new_auth_user()
returns trigger language plpgsql security definer
set search_path = pg_catalog, pg_temp as $$
begin
  insert into public.users (id, email)
  values (new.id, coalesce(new.email, ''))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app.handle_new_auth_user();
```

## 4. PostgREST-/API-Exposure absichern (Supabase)
Unsere Tabellen liegen in `public`. Da Tabellen-Grants **ausschließlich an `app_user`**
gehen (nicht an `anon`/`authenticated`), kann die Supabase-Daten-API sie nicht lesen.
Zusätzlich empfohlen: `public` aus den „Exposed schemas" der Supabase-API entfernen bzw.
nur die wirklich benötigten Objekte freigeben. Daten-CRUD läuft ausschließlich über die
Next.js-DAL (Drizzle) als `app_user`.

## 5. Verifikation
- RLS-Test-Suite lokal grün: `npm test` (läuft gegen PGlite = echtes PostgreSQL).
- Nach Deploy stichprobenartig prüfen: als `app_user` ohne Claims liefern private
  Tabellen 0 Zeilen; öffentliche nur die erlaubten Zeilen.
