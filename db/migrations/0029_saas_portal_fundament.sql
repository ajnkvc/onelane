-- 0029_saas_portal_fundament.sql
-- OS-V1 P1 (Fundament): RLS-Fix Bestand + Plattformrolle 'vertrieb' + neue
-- SaaS-/Portal-Tabellen + subscription_plans-Referenzdaten.
--
-- Inhalt (Review-Auflagen 2/3/5/6/9 des OS-V1-Plans):
--   1. RLS-FIX enrollments/appointments/invoices: SUPPORT RAUS (PII-Linie 0016),
--      Schul-Lesezugriff bleibt bewusst fuer ALLE drei Schulrollen (Gruender-
--      Entscheid Quer-Routing: fahrlehrer liest schulweit); Spalten-Minimierung
--      appointments nach 0016-Muster (Finanzfelder preis/abgerechnet server-only);
--      Write-Grant-Rueckbau auf Tabellen ohne Write-Policies (fail-closed).
--   2. Plattformrolle 'vertrieb' in die 0000-CHECK-Allowlist (KEINE 'lehrer'-Rolle).
--   3. Neue Tabellen, JEDE mit RLS + engen Policies + minimalen Spalten-Grants +
--      Owner-/fail-closed-Assertions: api_partners, api_partner_members, api_keys,
--      api_idempotency (deny-by-default), time_entries, feature_flags,
--      webhook_subscriptions. Key-/Secret-Material NUR als sha256-Hash, NIE Klartext.
--   4. subscription_plans: code/preis-Cent-Spalten + idempotente REFERENZDATEN
--      ('onelane start' 0 Cent, 'onelane os' 9900 Cent (je FAHRSCHULE, nicht Standort) + 2900 Cent je Fahrlehrer-Seat; Aktion 3 Monate 4900)
--      — Stammdaten-Seed in Migration folgt dem 0002-Muster (import_exclusion).
--      KEINE Demo-/Betriebsdaten (die liegen ausschliesslich in scripts/seed-demo.mjs).
--
-- PG16+. Idempotent. Erbt das Betriebsmodell der Bestands-Migrationen
-- (app_owner-Pfad, DEFINER-Helfer, abschliessende fail-closed Assertions).

begin;

grant app_owner to current_user;
set role app_owner;

-- ----------------------------------------------------------------------------
-- 1) RLS-FIX Bestand: enrollments / appointments / invoices
-- ----------------------------------------------------------------------------
-- enrollments_select: kanonische Neufassung (inhaltlich = 0016/F-008). Student
-- liest eigene; JEDES Schulmitglied (inhaber/verwaltung/fahrlehrer) liest die
-- Enrollments der Schule (GRUENDER-ENTSCHEID Quer-Routing, saas-licensing-Memo);
-- admin liest alles. KEIN support (PII-Linie).
drop policy if exists enrollments_select on public.enrollments;
create policy enrollments_select on public.enrollments for select to app_user
  using (student_user_id = app.current_user_id()
         or app.is_member_of_school(school_id)
         or app.has_platform_role('admin'));

-- appointments_select: bisher noch die 0000-Fassung MIT support — Neufassung ohne.
-- Student (eigene via Enrollment), Schulmitglieder aller drei Rollen (schulweit,
-- Quer-Routing), admin. Die exists-Unterabfrage laeuft selbst unter enrollments-RLS
-- (Defense-in-Depth: wer das Enrollment nicht sieht, sieht auch den Termin nicht).
drop policy if exists appointments_select on public.appointments;
create policy appointments_select on public.appointments for select to app_user
  using (exists (select 1 from public.enrollments e
                 where e.id = enrollment_id
                   and (e.student_user_id = app.current_user_id()
                        or app.is_member_of_school(e.school_id)))
         or app.has_platform_role('admin'));

-- invoices_select ist seit 0016 bereits korrekt eng (Student eigene / inhaber+
-- verwaltung via app.is_school_manager / admin — KEIN fahrlehrer, KEIN support);
-- hier NICHT neu gefasst, aber unten hart mitgeprueft (Assertion: support-frei).

-- Spalten-Minimierung appointments (0016-Muster): der breite 0000-Tabellen-Grant
-- liesse sonst JEDES lesende Schulmitglied die Abrechnungsfelder sehen. preis/
-- abgerechnet sind Finanzdaten → server-only, bis das Finanzen-Modul sie fuer
-- die Verwaltungs-Sicht explizit freigibt (dann Grant in DESSEN Migration).
-- Write-Grants komplett zurueck: appointments hat KEINE Write-Policies fuer
-- app_user (Schreiben kommt mit dem Kalender-Modul samt eigener Policies).
revoke all on table public.appointments from app_user;
grant select (id, enrollment_id, instructor_id, typ, start, ende, status,
              storno_frist_bis, created_at)
  on table public.appointments to app_user;

-- invoices: SELECT-Spalten sind seit 0016 minimiert (ohne stripe_payment_ref).
-- Fail-closed-Rueckbau der nie policy-gedeckten Write-Grants aus 0000.
revoke insert, update, delete on table public.invoices from app_user;

-- enrollments: SELECT/INSERT/UPDATE-Spalten sind seit 0016 minimiert; DELETE hat
-- keine Policy und faellt jetzt auch als Grant (fail-closed).
revoke delete on table public.enrollments from app_user;

-- ----------------------------------------------------------------------------
-- 2) Plattformrolle 'vertrieb' (Allowlist-Erweiterung der 0000-CHECK)
--    BEWUSST KEINE Rolle 'lehrer' (Kooperations-Lehrkraefte = eigenes Konzept spaeter).
-- ----------------------------------------------------------------------------
alter table public.platform_role_assignments
  drop constraint if exists platform_role_assignments_role_check;
alter table public.platform_role_assignments
  drop constraint if exists chk_platform_role_allowlist;
alter table public.platform_role_assignments
  add constraint chk_platform_role_allowlist
  check (role in ('admin', 'support', 'moderator', 'editor', 'vertrieb'));

-- ----------------------------------------------------------------------------
-- 3) api_partners — externe API-/MCP-Partner (Firmen), Verwaltung admin-only.
--    (Tabellen zuerst, danach der Mitglieds-Helfer + Policies — language-sql-
--     Funktionskoerper werden bei CREATE geparst und brauchen die Tabellen.)
-- ----------------------------------------------------------------------------
create table if not exists public.api_partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'aktiv',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.api_partners drop constraint if exists chk_api_partners_status;
alter table public.api_partners add constraint chk_api_partners_status
  check (status in ('aktiv', 'pausiert', 'beendet'));

alter table public.api_partners drop constraint if exists chk_api_partners_name_cap;
alter table public.api_partners add constraint chk_api_partners_name_cap
  check (octet_length(name) between 1 and 200);

drop trigger if exists tg_api_partners_updated_at on public.api_partners;
create trigger tg_api_partners_updated_at before update on public.api_partners
  for each row execute function app.tg_set_updated_at();

-- ----------------------------------------------------------------------------
-- 4) api_partner_members — Zuordnung Partner ↔ Nutzer (Verwaltung admin-only).
-- ----------------------------------------------------------------------------
create table if not exists public.api_partner_members (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.api_partners(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (partner_id, user_id)
);
create index if not exists idx_api_partner_members_user
  on public.api_partner_members (user_id);

-- ----------------------------------------------------------------------------
-- 5) Helfer: ist der AKTUELLE Nutzer Mitglied eines API-Partners? (DEFINER,
--    fail-closed; Muster app.is_member_of_school/0016-Wrapper)
-- ----------------------------------------------------------------------------
create or replace function app.is_api_partner_member(p_partner uuid) returns boolean
language sql stable security definer
set search_path = pg_catalog, pg_temp
as $fn$
  select p_partner is not null
     and app.current_user_id() is not null
     and exists (select 1 from public.api_partner_members m
                 where m.partner_id = p_partner
                   and m.user_id = app.current_user_id());
$fn$;

revoke all on function app.is_api_partner_member(uuid) from public;
grant execute on function app.is_api_partner_member(uuid) to app_user;

-- RLS + Policies + Grants api_partners.
alter table public.api_partners enable row level security;

drop policy if exists api_partners_select on public.api_partners;
create policy api_partners_select on public.api_partners for select to app_user
  using (app.has_platform_role('admin') or app.is_api_partner_member(id));

drop policy if exists api_partners_insert on public.api_partners;
create policy api_partners_insert on public.api_partners for insert to app_user
  with check (app.has_platform_role('admin'));

drop policy if exists api_partners_update on public.api_partners;
create policy api_partners_update on public.api_partners for update to app_user
  using (app.has_platform_role('admin'))
  with check (app.has_platform_role('admin'));

-- Grants: kein DELETE (Beendigung via status='beendet').
revoke all on table public.api_partners from app_user;
grant select (id, name, status, created_at, updated_at) on table public.api_partners to app_user;
grant insert (name, status) on table public.api_partners to app_user;
grant update (name, status) on table public.api_partners to app_user;

-- RLS + Policies + Grants api_partner_members.
alter table public.api_partner_members enable row level security;

-- Mitglieder sehen die eigene Zuordnung (nicht das ganze Partner-Roster); admin alles.
drop policy if exists api_partner_members_select on public.api_partner_members;
create policy api_partner_members_select on public.api_partner_members for select to app_user
  using (user_id = app.current_user_id() or app.has_platform_role('admin'));

drop policy if exists api_partner_members_insert on public.api_partner_members;
create policy api_partner_members_insert on public.api_partner_members for insert to app_user
  with check (app.has_platform_role('admin'));

drop policy if exists api_partner_members_delete on public.api_partner_members;
create policy api_partner_members_delete on public.api_partner_members for delete to app_user
  using (app.has_platform_role('admin'));

revoke all on table public.api_partner_members from app_user;
grant select (id, partner_id, user_id, created_at) on table public.api_partner_members to app_user;
grant insert (partner_id, user_id) on table public.api_partner_members to app_user;
grant delete on table public.api_partner_members to app_user;

-- ----------------------------------------------------------------------------
-- 6) api_keys — Zugangs-Fundament REST+MCP. NIEMALS Klartext: key_hash = sha256(hex)
--    des hochentropischen Keys; prefix dient NUR der Identifikation in UIs.
--    Rotation/Revocation ueber status/rotated_at/expires_at (kein DELETE).
--    P1: Verwaltung admin-only (Partner-Selfservice-Konsole = P3, eigene Migration).
-- ----------------------------------------------------------------------------
create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.api_partners(id) on delete cascade,
  key_hash text not null unique,
  prefix text not null,
  scopes text[] not null default '{}',
  status text not null default 'aktiv',
  expires_at timestamptz,
  rotated_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_api_keys_partner on public.api_keys (partner_id);

alter table public.api_keys drop constraint if exists chk_api_keys_hash_format;
alter table public.api_keys add constraint chk_api_keys_hash_format
  check (key_hash ~ '^[0-9a-f]{64}$');

alter table public.api_keys drop constraint if exists chk_api_keys_prefix_format;
alter table public.api_keys add constraint chk_api_keys_prefix_format
  check (prefix ~ '^[a-z0-9_]{4,32}$');

-- Scope-Allowlist: nur bekannte Scopes (Erweiterung = neue Migration, bewusst eng).
alter table public.api_keys drop constraint if exists chk_api_keys_scopes_allowlist;
alter table public.api_keys add constraint chk_api_keys_scopes_allowlist
  check (scopes <@ array['mcp', 'rest_read']::text[]);

alter table public.api_keys drop constraint if exists chk_api_keys_status;
alter table public.api_keys add constraint chk_api_keys_status
  check (status in ('aktiv', 'rotiert', 'widerrufen'));

alter table public.api_keys enable row level security;

drop policy if exists api_keys_select on public.api_keys;
create policy api_keys_select on public.api_keys for select to app_user
  using (app.has_platform_role('admin') or app.is_api_partner_member(partner_id));

drop policy if exists api_keys_insert on public.api_keys;
create policy api_keys_insert on public.api_keys for insert to app_user
  with check (app.has_platform_role('admin'));

drop policy if exists api_keys_update on public.api_keys;
create policy api_keys_update on public.api_keys for update to app_user
  using (app.has_platform_role('admin'))
  with check (app.has_platform_role('admin'));

-- Spalten-Minimierung: key_hash ist fuer app_user UNSICHTBAR (kein SELECT-Grant) —
-- der Key-Auth-Lookup (P3) laeuft ueber einen eigenen, auditierten Server-Pfad.
revoke all on table public.api_keys from app_user;
grant select (id, partner_id, prefix, scopes, status, expires_at, rotated_at,
              last_used_at, created_at)
  on table public.api_keys to app_user;
grant insert (partner_id, key_hash, prefix, scopes, status, expires_at)
  on table public.api_keys to app_user;
grant update (scopes, status, expires_at, rotated_at, last_used_at)
  on table public.api_keys to app_user;

-- ----------------------------------------------------------------------------
-- 7) api_idempotency — persistente Idempotenz fuer /api/v1 (exactly-once).
--    DENY-BY-DEFAULT: RLS aktiv, KEINE app_user-Policies/-Grants (0000-Muster fuer
--    vorbereitete Tabellen) — Zugriff ausschliesslich ueber den erhoehten/API-Pfad,
--    dessen Zugriffsfunktionen die P3-Migration definiert. TTL via expires_at
--    (Purge uebernimmt der Wartungspfad, peaknetworks-Cron-Muster).
-- ----------------------------------------------------------------------------
create table if not exists public.api_idempotency (
  id uuid primary key default gen_random_uuid(),
  key_hash text not null,
  endpoint text not null,
  response_hash text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  unique (endpoint, key_hash)
);

alter table public.api_idempotency drop constraint if exists chk_api_idem_hash_format;
alter table public.api_idempotency add constraint chk_api_idem_hash_format
  check (key_hash ~ '^[0-9a-f]{64}$');

alter table public.api_idempotency drop constraint if exists chk_api_idem_endpoint_format;
alter table public.api_idempotency add constraint chk_api_idem_endpoint_format
  check (endpoint ~ '^/[a-z0-9/_\-]{0,199}$');

alter table public.api_idempotency drop constraint if exists chk_api_idem_response_hash;
alter table public.api_idempotency add constraint chk_api_idem_response_hash
  check (response_hash is null or response_hash ~ '^[0-9a-f]{64}$');

alter table public.api_idempotency drop constraint if exists chk_api_idem_ttl;
alter table public.api_idempotency add constraint chk_api_idem_ttl
  check (expires_at > created_at);

alter table public.api_idempotency enable row level security;
revoke all on table public.api_idempotency from app_user;

-- ----------------------------------------------------------------------------
-- 8) time_entries — Zeiterfassung je Schul-Mitglied.
--    RLS: Mitglied schreibt/liest EIGENE Eintraege; inhaber+verwaltung lesen die
--    Schule; admin alles. school_id/member_user_id sind nach INSERT unveraenderlich
--    (kein UPDATE-Spalten-Grant). Arbeitszeitgesetz-Detailtiefe = Ausbaustufe.
-- ----------------------------------------------------------------------------
create table if not exists public.time_entries (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.driving_schools(id) on delete restrict,
  member_user_id uuid not null references public.users(id) on delete restrict,
  start_at timestamptz not null,
  ende_at timestamptz,
  kategorie text not null default 'buero',
  notiz text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_time_entries_school on public.time_entries (school_id, start_at desc);
create index if not exists idx_time_entries_member on public.time_entries (member_user_id, start_at desc);

alter table public.time_entries drop constraint if exists chk_time_entries_kategorie;
alter table public.time_entries add constraint chk_time_entries_kategorie
  check (kategorie in ('fahrstunde', 'theorie', 'buero', 'verwaltung', 'sonstiges'));

alter table public.time_entries drop constraint if exists chk_time_entries_zeitraum;
alter table public.time_entries add constraint chk_time_entries_zeitraum
  check (ende_at is null or ende_at > start_at);

alter table public.time_entries drop constraint if exists chk_time_entries_notiz_cap;
alter table public.time_entries add constraint chk_time_entries_notiz_cap
  check (notiz is null or octet_length(notiz) <= 1000);

drop trigger if exists tg_time_entries_updated_at on public.time_entries;
create trigger tg_time_entries_updated_at before update on public.time_entries
  for each row execute function app.tg_set_updated_at();

alter table public.time_entries enable row level security;

drop policy if exists time_entries_select on public.time_entries;
create policy time_entries_select on public.time_entries for select to app_user
  using (member_user_id = app.current_user_id()
         or app.is_school_manager(school_id)
         or app.has_platform_role('admin'));

drop policy if exists time_entries_insert on public.time_entries;
create policy time_entries_insert on public.time_entries for insert to app_user
  with check ((member_user_id = app.current_user_id()
               and app.is_member_of_school(school_id))
              or app.has_platform_role('admin'));

drop policy if exists time_entries_update on public.time_entries;
create policy time_entries_update on public.time_entries for update to app_user
  using ((member_user_id = app.current_user_id()
          and app.is_member_of_school(school_id))
         or app.has_platform_role('admin'))
  with check ((member_user_id = app.current_user_id()
               and app.is_member_of_school(school_id))
              or app.has_platform_role('admin'));

revoke all on table public.time_entries from app_user;
grant select (id, school_id, member_user_id, start_at, ende_at, kategorie, notiz,
              created_at, updated_at)
  on table public.time_entries to app_user;
grant insert (school_id, member_user_id, start_at, ende_at, kategorie, notiz)
  on table public.time_entries to app_user;
grant update (start_at, ende_at, kategorie, notiz)
  on table public.time_entries to app_user;

-- ----------------------------------------------------------------------------
-- 9) feature_flags — global oder je Schule; Key-Allowlist (nur 'pay').
--    RLS: lesen authentifizierte gemaess Scope (global = jeder Eingeloggte,
--    school = Schulmitglieder); schreiben NUR admin. Anonym: keine Zeilen.
-- ----------------------------------------------------------------------------
create table if not exists public.feature_flags (
  id uuid primary key default gen_random_uuid(),
  scope text not null,
  school_id uuid references public.driving_schools(id) on delete cascade,
  key text not null,
  aktiv boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.feature_flags drop constraint if exists chk_feature_flags_scope;
alter table public.feature_flags add constraint chk_feature_flags_scope
  check (scope in ('global', 'school'));

alter table public.feature_flags drop constraint if exists chk_feature_flags_key_allowlist;
alter table public.feature_flags add constraint chk_feature_flags_key_allowlist
  check (key in ('pay'));

alter table public.feature_flags drop constraint if exists chk_feature_flags_scope_school;
alter table public.feature_flags add constraint chk_feature_flags_scope_school
  check ((scope = 'global' and school_id is null)
      or (scope = 'school' and school_id is not null));

create unique index if not exists uq_feature_flags_global
  on public.feature_flags (key) where scope = 'global';
create unique index if not exists uq_feature_flags_school
  on public.feature_flags (key, school_id) where scope = 'school';

drop trigger if exists tg_feature_flags_updated_at on public.feature_flags;
create trigger tg_feature_flags_updated_at before update on public.feature_flags
  for each row execute function app.tg_set_updated_at();

alter table public.feature_flags enable row level security;

drop policy if exists feature_flags_select on public.feature_flags;
create policy feature_flags_select on public.feature_flags for select to app_user
  using ((scope = 'global' and app.current_user_id() is not null)
         or (scope = 'school' and app.is_member_of_school(school_id))
         or app.has_platform_role('admin'));

drop policy if exists feature_flags_insert on public.feature_flags;
create policy feature_flags_insert on public.feature_flags for insert to app_user
  with check (app.has_platform_role('admin'));

drop policy if exists feature_flags_update on public.feature_flags;
create policy feature_flags_update on public.feature_flags for update to app_user
  using (app.has_platform_role('admin'))
  with check (app.has_platform_role('admin'));

revoke all on table public.feature_flags from app_user;
grant select (id, scope, school_id, key, aktiv, created_at, updated_at)
  on table public.feature_flags to app_user;
grant insert (scope, school_id, key, aktiv) on table public.feature_flags to app_user;
grant update (aktiv) on table public.feature_flags to app_user;

-- ----------------------------------------------------------------------------
-- 10) webhook_subscriptions — Struktur fuer spaeteren Webhook-Versand (P3+).
--     https-Pflicht, Event-Allowlist, secret NUR als sha256-Hash. RLS: admin +
--     eigener Partner LESEND; schreiben admin-only. Kein DELETE (status).
-- ----------------------------------------------------------------------------
create table if not exists public.webhook_subscriptions (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.api_partners(id) on delete cascade,
  url text not null,
  events text[] not null default '{}',
  secret_hash text not null,
  status text not null default 'aktiv',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_webhook_subscriptions_partner
  on public.webhook_subscriptions (partner_id);

alter table public.webhook_subscriptions drop constraint if exists chk_webhooks_url_https;
alter table public.webhook_subscriptions add constraint chk_webhooks_url_https
  check (url ~ '^https://[^[:space:]]+$' and octet_length(url) <= 512);

alter table public.webhook_subscriptions drop constraint if exists chk_webhooks_events_allowlist;
alter table public.webhook_subscriptions add constraint chk_webhooks_events_allowlist
  check (events <@ array['lead.eingegangen', 'bewerbung.eingegangen']::text[]);

alter table public.webhook_subscriptions drop constraint if exists chk_webhooks_secret_hash;
alter table public.webhook_subscriptions add constraint chk_webhooks_secret_hash
  check (secret_hash ~ '^[0-9a-f]{64}$');

alter table public.webhook_subscriptions drop constraint if exists chk_webhooks_status;
alter table public.webhook_subscriptions add constraint chk_webhooks_status
  check (status in ('aktiv', 'pausiert'));

drop trigger if exists tg_webhook_subscriptions_updated_at on public.webhook_subscriptions;
create trigger tg_webhook_subscriptions_updated_at before update on public.webhook_subscriptions
  for each row execute function app.tg_set_updated_at();

alter table public.webhook_subscriptions enable row level security;

drop policy if exists webhook_subscriptions_select on public.webhook_subscriptions;
create policy webhook_subscriptions_select on public.webhook_subscriptions for select to app_user
  using (app.has_platform_role('admin') or app.is_api_partner_member(partner_id));

drop policy if exists webhook_subscriptions_insert on public.webhook_subscriptions;
create policy webhook_subscriptions_insert on public.webhook_subscriptions for insert to app_user
  with check (app.has_platform_role('admin'));

drop policy if exists webhook_subscriptions_update on public.webhook_subscriptions;
create policy webhook_subscriptions_update on public.webhook_subscriptions for update to app_user
  using (app.has_platform_role('admin'))
  with check (app.has_platform_role('admin'));

-- Spalten-Minimierung: secret_hash ist fuer app_user UNSICHTBAR (Verifikation
-- macht der Versand-Pfad serverseitig, P3+).
revoke all on table public.webhook_subscriptions from app_user;
grant select (id, partner_id, url, events, status, created_at, updated_at)
  on table public.webhook_subscriptions to app_user;
grant insert (partner_id, url, events, secret_hash, status)
  on table public.webhook_subscriptions to app_user;
grant update (url, events, status)
  on table public.webhook_subscriptions to app_user;

-- ----------------------------------------------------------------------------
-- 11) subscription_plans — code/Preis-Cent-Spalten + REFERENZDATEN (idempotent).
--     Preise als INTEGER-Cent (netto), kein Float; Legacy-Spalte preis_pro_monat
--     bleibt (EUR, informativ). Lesen fuer AUTHENTIFIZIERTE (Katalog); Schreiben
--     bleibt dem erhoehten Betreiber-Pfad vorbehalten (keine Write-Policy/-Grants).
-- ----------------------------------------------------------------------------
alter table public.subscription_plans add column if not exists code text;
alter table public.subscription_plans add column if not exists preis_monat_netto_cent integer;
alter table public.subscription_plans add column if not exists seat_preis_monat_netto_cent integer;
-- Einfuehrungs-Aktion (Gruender 2026-07-03): reduzierte Grundgebuehr fuer die
-- ersten N Monate — als Stammdaten am Plan, damit das Abo-Modul sie nativ kennt.
alter table public.subscription_plans add column if not exists aktion_preis_monat_netto_cent integer;
alter table public.subscription_plans add column if not exists aktion_monate integer;

alter table public.subscription_plans drop constraint if exists chk_subscription_plans_code_format;
alter table public.subscription_plans add constraint chk_subscription_plans_code_format
  check (code is null or code ~ '^[a-z][a-z0-9_]{0,31}$');

alter table public.subscription_plans drop constraint if exists chk_subscription_plans_cents;
alter table public.subscription_plans add constraint chk_subscription_plans_cents
  check ((preis_monat_netto_cent is null or preis_monat_netto_cent >= 0)
     and (seat_preis_monat_netto_cent is null or seat_preis_monat_netto_cent >= 0)
     -- Aktion nur vollstaendig (Preis+Monate) und guenstiger als der Grundpreis
     and ((aktion_preis_monat_netto_cent is null and aktion_monate is null)
       or (aktion_preis_monat_netto_cent is not null and aktion_monate is not null
           and aktion_preis_monat_netto_cent >= 0 and aktion_monate between 1 and 24
           and preis_monat_netto_cent is not null
           and aktion_preis_monat_netto_cent < preis_monat_netto_cent)));

create unique index if not exists uq_subscription_plans_code
  on public.subscription_plans (code) where code is not null;

-- Referenzdaten (Stammdaten-Muster wie 0002/import_exclusion): idempotent via
-- update-dann-insert; Re-Runs setzen die kanonischen Werte durch.
update public.subscription_plans
   set typ = 'saas', name = 'onelane start', preis_pro_monat = 0.00,
       preis_monat_netto_cent = 0, seat_preis_monat_netto_cent = null,
       abrechnungseinheit = 'pro_schule', aktiv = true
 where code = 'start';
insert into public.subscription_plans
  (typ, code, name, preis_pro_monat, preis_monat_netto_cent,
   seat_preis_monat_netto_cent, abrechnungseinheit, aktiv)
select 'saas', 'start', 'onelane start', 0.00, 0, null, 'pro_schule', true
 where not exists (select 1 from public.subscription_plans where code = 'start');

-- Preisstrategie (Gruender 2026-07-03): 99 € netto je FAHRSCHULE (nicht je
-- Standort!) + 29 € netto je Fahrlehrer-Seat; Einfuehrungs-Aktion 3 Monate 49 €.
update public.subscription_plans
   set typ = 'saas', name = 'onelane os', preis_pro_monat = 99.00,
       preis_monat_netto_cent = 9900, seat_preis_monat_netto_cent = 2900,
       aktion_preis_monat_netto_cent = 4900, aktion_monate = 3,
       abrechnungseinheit = 'pro_schule', aktiv = true
 where code = 'os';
insert into public.subscription_plans
  (typ, code, name, preis_pro_monat, preis_monat_netto_cent,
   seat_preis_monat_netto_cent, aktion_preis_monat_netto_cent, aktion_monate,
   abrechnungseinheit, aktiv)
select 'saas', 'os', 'onelane os', 99.00, 9900, 2900, 4900, 3, 'pro_schule', true
 where not exists (select 1 from public.subscription_plans where code = 'os');

drop policy if exists subscription_plans_select on public.subscription_plans;
create policy subscription_plans_select on public.subscription_plans for select to app_user
  using (app.current_user_id() is not null and (aktiv = true or app.has_platform_role('admin')));

revoke insert, update, delete on table public.subscription_plans from app_user;

-- ----------------------------------------------------------------------------
-- 12) Fail-closed Assertions.
-- ----------------------------------------------------------------------------
do $$
declare
  v record;
begin
  -- Owner + RLS aktiv fuer alle neuen Tabellen (0015-Invariante).
  for v in
    select * from (values
      ('api_partners'), ('api_partner_members'), ('api_keys'), ('api_idempotency'),
      ('time_entries'), ('feature_flags'), ('webhook_subscriptions')
    ) as expected(relname)
  loop
    if not exists (
      select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relname = v.relname and c.relrowsecurity
    ) then
      raise exception '0029: RLS auf public.% ist nicht aktiviert', v.relname;
    end if;
    if (select relowner::regrole::text from pg_class
         where oid = ('public.' || v.relname)::regclass) is distinct from 'app_owner' then
      raise exception '0029: public.% gehoert nicht app_owner', v.relname;
    end if;
  end loop;

  -- Policy-Existenz (deny-by-default abgesichert; api_idempotency BEWUSST policy-los).
  for v in
    select * from (values
      ('public.api_partners'::regclass, 'api_partners_select'),
      ('public.api_partners'::regclass, 'api_partners_insert'),
      ('public.api_partners'::regclass, 'api_partners_update'),
      ('public.api_partner_members'::regclass, 'api_partner_members_select'),
      ('public.api_partner_members'::regclass, 'api_partner_members_insert'),
      ('public.api_partner_members'::regclass, 'api_partner_members_delete'),
      ('public.api_keys'::regclass, 'api_keys_select'),
      ('public.api_keys'::regclass, 'api_keys_insert'),
      ('public.api_keys'::regclass, 'api_keys_update'),
      ('public.time_entries'::regclass, 'time_entries_select'),
      ('public.time_entries'::regclass, 'time_entries_insert'),
      ('public.time_entries'::regclass, 'time_entries_update'),
      ('public.feature_flags'::regclass, 'feature_flags_select'),
      ('public.feature_flags'::regclass, 'feature_flags_insert'),
      ('public.feature_flags'::regclass, 'feature_flags_update'),
      ('public.webhook_subscriptions'::regclass, 'webhook_subscriptions_select'),
      ('public.webhook_subscriptions'::regclass, 'webhook_subscriptions_insert'),
      ('public.webhook_subscriptions'::regclass, 'webhook_subscriptions_update'),
      ('public.subscription_plans'::regclass, 'subscription_plans_select'),
      ('public.enrollments'::regclass, 'enrollments_select'),
      ('public.appointments'::regclass, 'appointments_select'),
      ('public.invoices'::regclass, 'invoices_select')
    ) as expected(rel, polname)
  loop
    if not exists (
      select 1 from pg_policy p where p.polrelid = v.rel and p.polname = v.polname
    ) then
      raise exception '0029: Policy % fehlt auf %', v.polname, v.rel::text;
    end if;
  end loop;

  if exists (select 1 from pg_policy where polrelid = 'public.api_idempotency'::regclass) then
    raise exception '0029: api_idempotency muss policy-los (deny-by-default) sein';
  end if;

  -- SUPPORT ist aus enrollments/appointments/invoices vollstaendig raus (PII-Linie).
  if exists (
    select 1 from pg_policy p
     where p.polrelid in ('public.enrollments'::regclass,
                          'public.appointments'::regclass,
                          'public.invoices'::regclass)
       and (coalesce(pg_get_expr(p.polqual, p.polrelid), '') || ' ' ||
            coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '')) ~ 'support'
  ) then
    raise exception '0029: eine Policy auf enrollments/appointments/invoices referenziert noch support';
  end if;

  -- Plattformrollen-Allowlist enthaelt vertrieb, aber KEIN lehrer.
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.platform_role_assignments'::regclass
       and conname = 'chk_platform_role_allowlist'
       and pg_get_constraintdef(oid) ~ 'vertrieb'
  ) then
    raise exception '0029: chk_platform_role_allowlist ohne vertrieb';
  end if;
  if exists (
    select 1 from pg_constraint
     where conrelid = 'public.platform_role_assignments'::regclass
       and conname = 'chk_platform_role_allowlist'
       and pg_get_constraintdef(oid) ~ 'lehrer'
  ) then
    raise exception '0029: chk_platform_role_allowlist darf keine lehrer-Rolle enthalten';
  end if;

  -- Spaltenprivilegien (Stichproben, fail-closed).
  for v in
    select * from (values
      ('public.appointments', 'id', 'SELECT', true),
      ('public.appointments', 'status', 'SELECT', true),
      ('public.appointments', 'preis', 'SELECT', false),
      ('public.appointments', 'abgerechnet', 'SELECT', false),
      ('public.api_keys', 'prefix', 'SELECT', true),
      ('public.api_keys', 'key_hash', 'SELECT', false),
      ('public.api_keys', 'key_hash', 'INSERT', true),
      ('public.api_keys', 'last_used_at', 'UPDATE', true),
      ('public.api_keys', 'partner_id', 'UPDATE', false),
      ('public.webhook_subscriptions', 'url', 'SELECT', true),
      ('public.webhook_subscriptions', 'secret_hash', 'SELECT', false),
      ('public.webhook_subscriptions', 'secret_hash', 'INSERT', true),
      ('public.webhook_subscriptions', 'secret_hash', 'UPDATE', false),
      ('public.time_entries', 'school_id', 'INSERT', true),
      ('public.time_entries', 'school_id', 'UPDATE', false),
      ('public.time_entries', 'member_user_id', 'UPDATE', false),
      ('public.time_entries', 'ende_at', 'UPDATE', true),
      ('public.feature_flags', 'key', 'SELECT', true),
      ('public.feature_flags', 'key', 'UPDATE', false),
      ('public.feature_flags', 'aktiv', 'UPDATE', true),
      ('public.subscription_plans', 'code', 'SELECT', true),
      ('public.subscription_plans', 'preis_monat_netto_cent', 'SELECT', true)
    ) as expected(relname, colname, privname, allowed)
  loop
    if has_column_privilege('app_user', v.relname, v.colname, v.privname)
       is distinct from v.allowed then
      raise exception '0029: app_user %-Privileg fuer %.% erwartet %',
        v.privname, v.relname, v.colname, v.allowed;
    end if;
  end loop;

  -- Write-Grant-Rueckbau + Deny-Posture.
  if has_table_privilege('app_user', 'public.appointments', 'INSERT')
     or has_table_privilege('app_user', 'public.appointments', 'UPDATE')
     or has_table_privilege('app_user', 'public.appointments', 'DELETE') then
    raise exception '0029: appointments darf fuer app_user keine Write-Grants haben';
  end if;
  if has_table_privilege('app_user', 'public.invoices', 'INSERT')
     or has_table_privilege('app_user', 'public.invoices', 'UPDATE')
     or has_table_privilege('app_user', 'public.invoices', 'DELETE') then
    raise exception '0029: invoices darf fuer app_user keine Write-Grants haben';
  end if;
  if has_table_privilege('app_user', 'public.enrollments', 'DELETE') then
    raise exception '0029: enrollments darf fuer app_user kein DELETE haben';
  end if;
  if has_table_privilege('app_user', 'public.api_idempotency', 'SELECT')
     or has_table_privilege('app_user', 'public.api_idempotency', 'INSERT')
     or has_table_privilege('app_user', 'public.api_idempotency', 'UPDATE')
     or has_table_privilege('app_user', 'public.api_idempotency', 'DELETE') then
    raise exception '0029: api_idempotency muss fuer app_user komplett gesperrt sein';
  end if;
  for v in
    select * from (values
      ('public.api_partners'), ('public.api_keys'), ('public.time_entries'),
      ('public.feature_flags'), ('public.webhook_subscriptions'),
      ('public.subscription_plans')
    ) as expected(relname)
  loop
    if has_table_privilege('app_user', v.relname, 'DELETE') then
      raise exception '0029: % darf fuer app_user kein DELETE haben', v.relname;
    end if;
  end loop;

  -- Funktions-Grant: Partner-Helfer nur app_user (nicht PUBLIC).
  if not has_function_privilege('app_user', 'app.is_api_partner_member(uuid)', 'EXECUTE') then
    raise exception '0029: app_user muss app.is_api_partner_member ausfuehren duerfen';
  end if;

  -- Referenzdaten: genau die zwei Plaene mit kanonischen Werten.
  if (select count(*) from public.subscription_plans
       where (code = 'start' and name = 'onelane start' and preis_monat_netto_cent = 0
              and seat_preis_monat_netto_cent is null and aktiv)
          or (code = 'os' and name = 'onelane os' and preis_monat_netto_cent = 9900
              and seat_preis_monat_netto_cent = 2900 and aktiv)) <> 2 then
    raise exception '0029: subscription_plans-Referenzdaten (start/os) unvollstaendig oder abweichend';
  end if;
end
$$;

reset role;

commit;
