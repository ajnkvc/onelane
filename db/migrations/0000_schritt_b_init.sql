-- ============================================================================
-- 0000_schritt_b_init.sql — Kanonische Erst-Migration (Schritt B)
-- ----------------------------------------------------------------------------
-- Dies ist die MASSGEBLICHE WAHRHEIT des Schemas (siehe ARCHITECTURE.md 5.5).
-- Reines Standard-PostgreSQL (>=14), keine proprietären Supabase-Features.
-- Einspielbar gegen jede frische PostgreSQL-Datenbank (lokal, PGlite, Supabase).
--
-- ROLLEN-/EIGENTUMSMODELL:
--   app_owner  NOLOGIN  — Eigentümer aller Objekte (Schema/Tabellen/Funktionen).
--                         Da NOLOGIN, kann sich niemand als app_owner verbinden;
--                         der „Owner-bypass" von RLS ist damit KEINE Angriffsfläche.
--   app_user   NOLOGIN  — die einzige reguläre Laufzeitrolle. RLS-pflichtig,
--                         KEIN BYPASSRLS, KEIN Owner. LOGIN+Passwort werden
--                         AUSSERHALB dieser Migration (Runbook/Secret-Manager)
--                         gesetzt — hier KEIN Passwort (kein Secret im Repo).
--
-- WARUM KEIN „FORCE ROW LEVEL SECURITY": Die SECURITY-DEFINER-Helfer laufen als
-- app_owner (Tabelleneigentümer) und müssen Tabellen wie school_members lesen,
-- OHNE deren RLS erneut auszulösen (sonst Policy-Rekursion). Owner-bypass über
-- Eigentum löst das; FORCE würde es brechen. Da app_owner NOLOGIN ist, ist das
-- sicher. (Bewusste, dokumentierte Entscheidung — siehe SECURITY.md.)
--
-- Status-Tokens technisch ENGLISCH; die UI übersetzt nach Deutsch.
-- ============================================================================

begin;

-- Body-Prüfung in dieser Migration aussetzen: Die app.*-Helfer referenzieren
-- Tabellen, die weiter unten in derselben Migration erzeugt werden (Helfer ->
-- Tabellen -> Trigger -> Policies). Die Funktions-Bodies werden vollständig durch
-- die RLS-Test-Suite (PGlite) zur Laufzeit validiert.
set local check_function_bodies = off;

-- ----------------------------------------------------------------------------
-- 0) Rollen
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'app_owner') then
    create role app_owner nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'app_user') then
    create role app_user nologin;
  end if;
end
$$;

-- ermöglicht ALTER OWNER / SET ROLE während der Migration
grant app_owner to current_user;

-- ----------------------------------------------------------------------------
-- 1) Schemas + Basis-Grants
-- ----------------------------------------------------------------------------
create schema if not exists app authorization app_owner;

-- app_user darf die Schemas benutzen (Zugriff steuert RLS, nicht das Schema)
grant usage on schema public to app_user;
-- app_owner braucht CREATE in public (Tabellen liegen in public)
grant create, usage on schema public to app_owner;

-- Ab hier wird alles als app_owner erzeugt -> Eigentum = app_owner.
set role app_owner;

grant usage on schema app to app_user;

-- ----------------------------------------------------------------------------
-- 2) Native Enums (nur stabile Wertemengen)
-- ----------------------------------------------------------------------------
create type land as enum ('DE', 'AT', 'CH');
create type account_typ as enum ('student', 'school_staff', 'platform_staff');
create type school_member_rolle as enum ('inhaber', 'verwaltung', 'fahrlehrer');

-- ----------------------------------------------------------------------------
-- 3) RLS-Helfer im Schema app
--    INVOKER (nur GUC) bzw. SECURITY DEFINER (Tabellenzugriff). Alle fail-closed,
--    fester search_path, schemaqualifiziert, REVOKE FROM PUBLIC + GRANT app_user.
-- ----------------------------------------------------------------------------

-- aktueller Nutzer aus verifizierten Claims (INVOKER; kein Tabellenzugriff)
create function app.current_user_id() returns uuid
language plpgsql stable
set search_path = pg_catalog, pg_temp
as $fn$
declare
  raw text;
  claims jsonb;
  uid text;
begin
  raw := current_setting('request.jwt.claims', true);
  if raw is null or raw = '' then return null; end if;
  begin
    claims := raw::jsonb;
  exception when others then
    return null;
  end;
  uid := claims ->> 'sub';
  if uid is null then return null; end if;
  begin
    return uid::uuid;
  exception when others then
    return null;
  end;
end
$fn$;

-- fachliche Rolle = Wahrheit aus public.users (DEFINER)
create function app.current_account_type() returns text
language plpgsql stable security definer
set search_path = pg_catalog, pg_temp
as $fn$
declare
  uid uuid;
  t text;
begin
  uid := app.current_user_id();
  if uid is null then return null; end if;
  select u.account_typ::text into t from public.users u where u.id = uid;
  return t; -- NULL wenn keine Zeile -> fail-closed
end
$fn$;

-- Plattformrolle (admin = Supersatz) (DEFINER)
create function app.has_platform_role(p_role text) returns boolean
language plpgsql stable security definer
set search_path = pg_catalog, pg_temp
as $fn$
declare
  uid uuid;
begin
  uid := app.current_user_id();
  if uid is null then return false; end if;
  if exists (select 1 from public.platform_role_assignments p
             where p.user_id = uid and p.role = 'admin') then
    return true;
  end if;
  if p_role is null then return false; end if;
  return exists (select 1 from public.platform_role_assignments p
                 where p.user_id = uid and p.role = p_role);
end
$fn$;

-- Schulmitgliedschaft eines KONKRETEN Nutzers (DEFINER)
create function app.user_has_school_role(p_user uuid, p_school uuid, p_role text)
returns boolean
language plpgsql stable security definer
set search_path = pg_catalog, pg_temp
as $fn$
begin
  if p_user is null or p_school is null then return false; end if;
  if p_role is null then
    return exists (select 1 from public.school_members m
                   where m.user_id = p_user and m.school_id = p_school);
  end if;
  return exists (select 1 from public.school_members m
                 where m.user_id = p_user and m.school_id = p_school
                   and m.rolle::text = p_role);
end
$fn$;

-- Mitgliedschaft des AKTUELLEN Nutzers (Wrapper, DEFINER)
create function app.is_member_of_school(p_school uuid) returns boolean
language sql stable security definer
set search_path = pg_catalog, pg_temp
as $fn$
  select app.user_has_school_role(app.current_user_id(), p_school, null);
$fn$;

-- ist eine Schule öffentlich gelistet? (DEFINER)
create function app.is_school_listed(p_school uuid) returns boolean
language sql stable security definer
set search_path = pg_catalog, pg_temp
as $fn$
  select exists (select 1 from public.driving_schools s
                 where s.id = p_school and s.is_listed);
$fn$;

-- ----------------------------------------------------------------------------
-- 4) Tabellen (in Abhängigkeitsreihenfolge)
-- ----------------------------------------------------------------------------

-- users: gespiegelt von auth.users.id (Supabase). Profilanlage per auth-Trigger
-- (Supabase-spezifisch, separat dokumentiert; NICHT Teil dieser portablen Migration).
create table public.users (
  id uuid primary key,
  email text not null,
  telefon text,
  vorname text,
  nachname text,
  account_typ account_typ not null default 'student',
  created_at timestamptz not null default now(),
  last_login timestamptz
);
create unique index uq_users_email_lower on public.users (lower(email));

create table public.platform_role_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null check (role in ('admin', 'support', 'moderator', 'editor')),
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
create index idx_pra_user on public.platform_role_assignments (user_id);

create table public.school_brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  inhaber_user_id uuid not null references public.users(id),
  created_at timestamptz not null default now()
);

create table public.driving_schools (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references public.school_brands(id),
  name text not null,
  slug text not null,
  strasse text,
  plz text,
  ort text,
  stadtbezirk text,
  bundesland text,
  land land not null default 'DE',
  latitude double precision,
  longitude double precision,
  google_place_id text,
  google_rating numeric(2,1),
  google_reviews_count integer,
  sprachen text[] not null default '{}',
  is_partner boolean not null default false,
  is_verified boolean not null default false,
  is_listed boolean not null default true,
  fail_rate numeric(5,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Slug eindeutig SCOPED (Land + Ort), nicht global
create unique index uq_driving_schools_slug on public.driving_schools (land, ort, slug);
create index idx_driving_schools_geo on public.driving_schools (latitude, longitude);
create index idx_driving_schools_loc on public.driving_schools (land, ort, stadtbezirk);
create index idx_driving_schools_sprachen on public.driving_schools using gin (sprachen);

-- school_billing: getrennt + privat (keine Klartext-IBAN, nur Stripe-Referenz)
create table public.school_billing (
  school_id uuid primary key references public.driving_schools(id) on delete cascade,
  stripe_account_ref text,
  abo_status text not null default 'none'
    check (abo_status in ('none', 'portal_only', 'saas_active')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.school_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  school_id uuid not null references public.driving_schools(id) on delete cascade,
  rolle school_member_rolle not null,
  created_at timestamptz not null default now(),
  unique (user_id, school_id)
);
create index idx_school_members_school on public.school_members (school_id);

create table public.school_profiles (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null unique references public.driving_schools(id) on delete cascade,
  beschreibung text,
  fuehrerscheinklassen text[] not null default '{}',
  preise jsonb,
  oeffnungszeiten jsonb,
  faq jsonb,
  logo_url text,
  updated_at timestamptz not null default now(),
  check (preise is null or jsonb_typeof(preise) = 'object'),
  check (oeffnungszeiten is null or jsonb_typeof(oeffnungszeiten) = 'object'),
  check (faq is null or jsonb_typeof(faq) in ('array', 'object'))
);
create index idx_school_profiles_klassen on public.school_profiles using gin (fuehrerscheinklassen);

create table public.instructors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id),
  school_id uuid not null references public.driving_schools(id) on delete cascade,
  name text not null,
  slug text not null,
  aktiv boolean not null default true,
  created_at timestamptz not null default now(),
  unique (school_id, slug)
);

create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  student_user_id uuid not null references public.users(id),
  school_id uuid not null references public.driving_schools(id),
  fuehrerscheinklasse text,
  status text not null default 'pending'
    check (status in ('pending', 'active', 'cancelled', 'completed')),
  vertragsabschluss_datum timestamptz,
  zahlungsmethode text check (zahlungsmethode in ('sepa', 'stripe_card')),
  stripe_customer_ref text,
  sepa_mandat_ref text,
  created_at timestamptz not null default now()
);
create index idx_enrollments_student on public.enrollments (student_user_id);
create index idx_enrollments_school on public.enrollments (school_id);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.driving_schools(id) on delete cascade,
  instructor_id uuid references public.instructors(id),
  enrollment_id uuid not null references public.enrollments(id),
  author_user_id uuid not null references public.users(id),
  rating integer not null check (rating between 1 and 5),
  text text,
  moderation_status text not null default 'pending'
    check (moderation_status in ('pending', 'published', 'rejected')),
  published_at timestamptz,
  moderated_by_user_id uuid references public.users(id),
  moderated_at timestamptz,
  created_at timestamptz not null default now()
);
-- NULL-sichere Eindeutigkeit (Partial Unique Indexes)
create unique index uq_review_school
  on public.reviews (enrollment_id) where instructor_id is null;
create unique index uq_review_instructor
  on public.reviews (enrollment_id, instructor_id) where instructor_id is not null;
create index idx_reviews_school_mod on public.reviews (school_id, moderation_status);

create table public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  content text,
  meta_description text,
  author_user_id uuid references public.users(id),
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_blog_posts_pub on public.blog_posts (status, published_at);

create table public.security_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.users(id),
  -- nur technische Tokens (lowercase snake_case, 2..64 Zeichen)
  event_type text not null check (event_type ~ '^[a-z][a-z0-9_]{1,63}$'),
  target_table text,
  target_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now(),
  check (metadata is null or jsonb_typeof(metadata) = 'object'),
  -- Payload-Größe begrenzen (kein beliebig großes metadata)
  check (metadata is null or length(metadata::text) <= 8192)
);
create index idx_security_events_created on public.security_events (created_at);

-- ---- Monetarisierung (vorbereitet) ----
create table public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  typ text not null check (typ in ('portal_listing', 'saas')),
  name text not null,
  preis_pro_monat numeric(10,2),
  abrechnungseinheit text check (abrechnungseinheit in ('pro_schule', 'pro_fahrlehrer')),
  feature_liste jsonb,
  aktiv boolean not null default true
);

create table public.school_subscriptions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.driving_schools(id) on delete cascade,
  plan_id uuid not null references public.subscription_plans(id),
  anzahl_lizenzen integer not null default 1,
  status text not null default 'active' check (status in ('active', 'paused', 'cancelled')),
  start_datum date,
  stripe_subscription_ref text,
  created_at timestamptz not null default now()
);

-- ---- SaaS-Kern (vorbereitet) ----
create table public.instructor_availability (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid not null references public.instructors(id) on delete cascade,
  datum date,
  wochentag smallint check (wochentag between 0 and 6),
  von time,
  bis time,
  ist_blockiert boolean not null default false,
  check (von is null or bis is null or von < bis)
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  instructor_id uuid references public.instructors(id),
  typ text not null check (typ in ('fahrstunde', 'theorie', 'fragenkatalog', 'pruefung')),
  start timestamptz,
  ende timestamptz,
  status text not null default 'booked' check (status in ('booked', 'cancelled', 'completed')),
  storno_frist_bis timestamptz,
  preis numeric(10,2),
  abgerechnet boolean not null default false,
  created_at timestamptz not null default now(),
  check (start is null or ende is null or start < ende)
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments(id),
  betrag numeric(10,2),
  positionen jsonb,
  status text not null default 'draft'
    check (status in ('draft', 'open', 'paid', 'failed', 'void')),
  stripe_payment_ref text,
  erstellt_am timestamptz not null default now(),
  bezahlt_am timestamptz,
  check (positionen is null or jsonb_typeof(positionen) = 'array')
);
create index idx_invoices_enrollment on public.invoices (enrollment_id);
create index idx_invoices_erstellt on public.invoices (erstellt_am);

-- ---- Kommunikation (vorbereitet) ----
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  von_user_id uuid not null references public.users(id),
  an_user_id uuid not null references public.users(id),
  enrollment_id uuid references public.enrollments(id),
  inhalt text,
  gelesen boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---- Lern-App / Online-Theorie (vorbereitet) ----
create table public.question_catalogs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  fuehrerscheinklassen text[] not null default '{}',
  aktiv boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.theory_lessons (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('platform', 'school')),
  school_id uuid references public.driving_schools(id) on delete cascade,
  title text not null,
  beschreibung text,
  content_type text not null check (content_type in ('video', 'ai', 'document')),
  media_ref text, -- opaque/privat; KEINE öffentliche URL/Token/Secret
  fuehrerscheinklassen text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'published')),
  review_status text check (review_status in ('pending', 'approved', 'rejected')),
  created_by_user_id uuid references public.users(id),
  published_by_user_id uuid references public.users(id),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Nullable-Tenant abgesichert
  check ((scope = 'platform' and school_id is null)
      or (scope = 'school'   and school_id is not null)),
  -- Veröffentlichung nur nach redaktioneller Freigabe
  check (status <> 'published'
      or (review_status = 'approved'
          and published_at is not null
          and published_by_user_id is not null)),
  -- Draft trägt keine Veröffentlichungs-Metadaten
  check (status <> 'draft'
      or (published_at is null and published_by_user_id is null))
);

create table public.student_progress (
  id uuid primary key default gen_random_uuid(),
  student_user_id uuid not null references public.users(id) on delete cascade,
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  lesson_id uuid references public.theory_lessons(id),
  catalog_id uuid references public.question_catalogs(id),
  status text not null default 'not_started'
    check (status in ('not_started', 'in_progress', 'completed')),
  score numeric(5,2),
  updated_at timestamptz not null default now(),
  -- genau EINE Referenz
  check ((lesson_id is not null and catalog_id is null)
      or (lesson_id is null and catalog_id is not null))
);

create table public.live_sessions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.driving_schools(id) on delete cascade,
  host_user_id uuid not null references public.users(id),
  title text not null,
  scheduled_start timestamptz not null,
  scheduled_end timestamptz not null,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'live', 'ended', 'cancelled')),
  stream_ref text, -- opaque/privat
  created_at timestamptz not null default now(),
  check (scheduled_start < scheduled_end)
);

create table public.live_session_questions (
  id uuid primary key default gen_random_uuid(),
  live_session_id uuid not null references public.live_sessions(id) on delete cascade,
  enrollment_id uuid not null references public.enrollments(id),
  student_user_id uuid not null references public.users(id),
  frage text not null,
  beantwortet boolean not null default false,
  status text not null default 'visible' check (status in ('visible', 'hidden', 'removed')),
  hidden_at timestamptz,
  hidden_by_user_id uuid references public.users(id),
  created_at timestamptz not null default now(),
  -- Moderations-Konsistenz
  check ((status = 'visible' and hidden_at is null and hidden_by_user_id is null)
      or (status in ('hidden', 'removed') and hidden_at is not null and hidden_by_user_id is not null))
);

-- ---- Accounting / DATEV (vorbereitet) ----
create table public.accounting_exports (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.driving_schools(id),
  period_start date not null,
  period_end date not null,
  format text not null check (format in ('datev_buchungsstapel')),
  format_version text,
  status text not null default 'created' check (status in ('created', 'exported', 'failed')),
  record_count integer not null default 0 check (record_count >= 0),
  content_hash text,
  file_ref text, -- opaque/privat
  created_by_user_id uuid references public.users(id),
  exported_at timestamptz,
  error_message text, -- ohne PII/Secrets
  created_at timestamptz not null default now(),
  check (period_start <= period_end),
  check (status <> 'exported'
      or (file_ref is not null and content_hash is not null and exported_at is not null)),
  check (status <> 'failed' or error_message is not null)
);

create table public.accounting_export_items (
  id uuid primary key default gen_random_uuid(),
  export_id uuid not null references public.accounting_exports(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id),
  created_at timestamptz not null default now(),
  unique (export_id, invoice_id)
);

-- ----------------------------------------------------------------------------
-- 5) Trigger-Funktionen (tabellenübergreifende Invarianten) + Trigger
--    SECURITY DEFINER, damit die Validierung Tabellen ungehindert lesen kann
--    (sonst würde RLS dem app_user Zeilen verbergen, die die Prüfung braucht).
-- ----------------------------------------------------------------------------

-- users.account_typ nur durch admin änderbar (Nicht-Admin-App-Nutzer blockiert;
-- erhöhter/Seed-Pfad ohne Nutzerkontext erlaubt).
create function app.tg_users_guard_account_typ() returns trigger
language plpgsql security definer
set search_path = pg_catalog, pg_temp
as $fn$
begin
  if new.account_typ is distinct from old.account_typ
     and app.current_user_id() is not null
     and not app.has_platform_role('admin') then
    raise exception 'users.account_typ darf nur von admin geaendert werden';
  end if;
  return new;
end
$fn$;
create trigger tg_users_guard_account_typ
  before update on public.users
  for each row execute function app.tg_users_guard_account_typ();

-- driving_schools: gesperrte Felder (name/slug/Adresse) nur durch admin änderbar.
create function app.tg_driving_schools_locked_fields() returns trigger
language plpgsql security definer
set search_path = pg_catalog, pg_temp
as $fn$
begin
  if app.current_user_id() is not null and not app.has_platform_role('admin') then
    if new.name is distinct from old.name
       or new.slug is distinct from old.slug
       or new.strasse is distinct from old.strasse
       or new.plz is distinct from old.plz
       or new.ort is distinct from old.ort
       or new.stadtbezirk is distinct from old.stadtbezirk
       or new.bundesland is distinct from old.bundesland then
      raise exception 'driving_schools: Name/Slug/Adresse sind gesperrt (nur admin)';
    end if;
  end if;
  return new;
end
$fn$;
create trigger tg_driving_schools_locked_fields
  before update on public.driving_schools
  for each row execute function app.tg_driving_schools_locked_fields();

-- reviews: Bindung an verifiziertes Enrollment + Student darf nicht direkt publishen.
create function app.tg_reviews_validate() returns trigger
language plpgsql security definer
set search_path = pg_catalog, pg_temp
as $fn$
declare
  e_student uuid;
  e_school uuid;
  e_status text;
  is_priv boolean;
begin
  select student_user_id, school_id, status
    into e_student, e_school, e_status
    from public.enrollments where id = new.enrollment_id;
  if e_student is null then
    raise exception 'reviews: enrollment % nicht gefunden', new.enrollment_id;
  end if;
  if new.school_id <> e_school then
    raise exception 'reviews: school_id passt nicht zum enrollment';
  end if;
  if e_status not in ('active', 'completed') then
    raise exception 'reviews: enrollment ist nicht active/completed';
  end if;
  if new.author_user_id <> e_student then
    raise exception 'reviews: author muss der Student des Enrollments sein';
  end if;
  if new.instructor_id is not null then
    if not exists (select 1 from public.instructors i
                   where i.id = new.instructor_id and i.school_id = new.school_id) then
      raise exception 'reviews: instructor gehoert nicht zur Schule';
    end if;
  end if;

  -- privilegiert = moderator/admin oder erhöhter Pfad (kein Nutzerkontext)
  is_priv := app.current_user_id() is null
             or app.has_platform_role('moderator')
             or app.has_platform_role('admin');
  if not is_priv then
    -- Student: darf nicht direkt veröffentlichen
    new.moderation_status := 'pending';
    new.published_at := null;
    new.moderated_by_user_id := null;
    new.moderated_at := null;
    if new.author_user_id <> app.current_user_id() then
      raise exception 'reviews: author muss der angemeldete Nutzer sein';
    end if;
  end if;
  return new;
end
$fn$;
create trigger tg_reviews_validate
  before insert on public.reviews
  for each row execute function app.tg_reviews_validate();

-- live_sessions: Host muss Fahrlehrer derselben Schule sein.
create function app.tg_live_sessions_host() returns trigger
language plpgsql security definer
set search_path = pg_catalog, pg_temp
as $fn$
begin
  if not app.user_has_school_role(new.host_user_id, new.school_id, 'fahrlehrer') then
    raise exception 'live_sessions: host muss Fahrlehrer derselben Schule sein';
  end if;
  return new;
end
$fn$;
create trigger tg_live_sessions_host
  before insert or update on public.live_sessions
  for each row execute function app.tg_live_sessions_host();

-- live_session_questions: Enrollment + Session tenant-konsistent.
create function app.tg_live_question_tenant() returns trigger
language plpgsql security definer
set search_path = pg_catalog, pg_temp
as $fn$
declare
  e_student uuid;
  e_school uuid;
  ls_school uuid;
begin
  select student_user_id, school_id into e_student, e_school
    from public.enrollments where id = new.enrollment_id;
  select school_id into ls_school
    from public.live_sessions where id = new.live_session_id;
  if e_student is null or ls_school is null then
    raise exception 'live_session_questions: enrollment/session nicht gefunden';
  end if;
  if new.student_user_id <> e_student then
    raise exception 'live_session_questions: student passt nicht zum enrollment';
  end if;
  if e_school <> ls_school then
    raise exception 'live_session_questions: enrollment-Schule <> session-Schule';
  end if;
  return new;
end
$fn$;
create trigger tg_live_question_tenant
  before insert or update on public.live_session_questions
  for each row execute function app.tg_live_question_tenant();

-- student_progress: tenant-konsistent (kein Cross-Tenant-Lesson).
create function app.tg_student_progress_tenant() returns trigger
language plpgsql security definer
set search_path = pg_catalog, pg_temp
as $fn$
declare
  e_student uuid;
  e_school uuid;
  l_scope text;
  l_school uuid;
begin
  select student_user_id, school_id into e_student, e_school
    from public.enrollments where id = new.enrollment_id;
  if e_student is null then
    raise exception 'student_progress: enrollment nicht gefunden';
  end if;
  if new.student_user_id <> e_student then
    raise exception 'student_progress: student passt nicht zum enrollment';
  end if;
  if new.lesson_id is not null then
    select scope, school_id into l_scope, l_school
      from public.theory_lessons where id = new.lesson_id;
    if l_scope = 'school' and l_school is distinct from e_school then
      raise exception 'student_progress: Lesson gehoert zu anderer Schule';
    end if;
  end if;
  return new;
end
$fn$;
create trigger tg_student_progress_tenant
  before insert or update on public.student_progress
  for each row execute function app.tg_student_progress_tenant();

-- accounting_export_items: Schule + Zeitraum konsistent.
create function app.tg_export_item_consistency() returns trigger
language plpgsql security definer
set search_path = pg_catalog, pg_temp
as $fn$
declare
  ex_school uuid;
  ex_from date;
  ex_to date;
  inv_school uuid;
  inv_date date;
begin
  select school_id, period_start, period_end into ex_school, ex_from, ex_to
    from public.accounting_exports where id = new.export_id;
  select e.school_id, i.erstellt_am::date into inv_school, inv_date
    from public.invoices i
    join public.enrollments e on e.id = i.enrollment_id
    where i.id = new.invoice_id;
  if inv_school is null then
    raise exception 'accounting_export_items: invoice/enrollment nicht gefunden';
  end if;
  -- school_id NULL = Plattform-/Adminexport (alle Schulen erlaubt)
  if ex_school is not null and inv_school <> ex_school then
    raise exception 'accounting_export_items: Rechnung gehoert zu anderer Schule';
  end if;
  if inv_date < ex_from or inv_date > ex_to then
    raise exception 'accounting_export_items: Rechnung ausserhalb des Exportzeitraums';
  end if;
  return new;
end
$fn$;
create trigger tg_export_item_consistency
  before insert or update on public.accounting_export_items
  for each row execute function app.tg_export_item_consistency();

-- security_events: actor_user_id muss der aktuelle Nutzer sein (oder NULL = System).
-- Per Trigger erzwungen (zusätzlich zur RLS-Policy) — robust und unabhängig von der
-- WITH-CHECK-Funktionsauswertung.
create function app.tg_security_events_actor() returns trigger
language plpgsql security definer
set search_path = pg_catalog, pg_temp
as $fn$
begin
  if app.current_user_id() is null then
    -- System-/Tooling-Kontext (kein Nutzer): actor MUSS NULL sein
    if new.actor_user_id is not null then
      raise exception 'security_events: System-Events (ohne Nutzerkontext) müssen actor_user_id = NULL haben';
    end if;
  else
    -- Nutzerkontext: actor MUSS der aktuelle Nutzer sein (nicht NULL, nicht fremd)
    if new.actor_user_id is distinct from app.current_user_id() then
      raise exception 'security_events: actor_user_id muss der aktuelle Nutzer sein';
    end if;
  end if;
  return new;
end
$fn$;
create trigger tg_security_events_actor
  before insert on public.security_events
  for each row execute function app.tg_security_events_actor();

-- platform_role_assignments: Plattformrollen nur für account_typ='platform_staff'.
create function app.tg_platform_role_requires_staff() returns trigger
language plpgsql security definer
set search_path = pg_catalog, pg_temp
as $fn$
declare
  t text;
begin
  select u.account_typ::text into t from public.users u where u.id = new.user_id;
  if t is null then
    raise exception 'platform_role_assignments: Nutzer % nicht gefunden', new.user_id;
  end if;
  if t <> 'platform_staff' then
    raise exception 'platform_role_assignments: Plattformrollen nur fuer platform_staff (account_typ=%)', t;
  end if;
  return new;
end
$fn$;
create trigger tg_platform_role_requires_staff
  before insert or update on public.platform_role_assignments
  for each row execute function app.tg_platform_role_requires_staff();

-- enrollments: Schüler dürfen nur 'pending' anlegen, KEINE Vertrags-/Zahlungsfelder
-- setzen und Enrollments NICHT selbst ändern/aktivieren. Schule/Admin/erhöhter Pfad
-- (kein Nutzerkontext) dürfen alles. Verhindert Fake-„verifizierte" Bewertungen.
create function app.tg_enrollments_student_guard() returns trigger
language plpgsql security definer
set search_path = pg_catalog, pg_temp
as $fn$
declare
  is_privileged boolean;
begin
  is_privileged := app.current_user_id() is null
    or app.has_platform_role('admin')
    or app.is_member_of_school(new.school_id);
  if is_privileged then
    return new;
  end if;
  -- Schüler-Kontext:
  if new.student_user_id <> app.current_user_id() then
    raise exception 'enrollments: student_user_id muss der angemeldete Nutzer sein';
  end if;
  if tg_op = 'UPDATE' then
    raise exception 'enrollments: Schüler dürfen Enrollments nicht selbst ändern';
  end if;
  if new.status <> 'pending' then
    raise exception 'enrollments: Schüler dürfen nur Status pending anlegen';
  end if;
  if new.vertragsabschluss_datum is not null
     or new.stripe_customer_ref is not null
     or new.sepa_mandat_ref is not null then
    raise exception 'enrollments: Vertrags-/Zahlungsfelder dürfen Schüler nicht setzen';
  end if;
  return new;
end
$fn$;
create trigger tg_enrollments_student_guard
  before insert or update on public.enrollments
  for each row execute function app.tg_enrollments_student_guard();

-- reviews: Kernfelder sind nach dem Anlegen UNVERÄNDERLICH (Audit-Sicherheit); nur
-- Moderationsfelder dürfen sich ändern. Gilt für alle Pfade (auch admin via app_user);
-- bewusste Korrekturen nur über separaten, erhöhten Tooling-Pfad (Trigger temporär aus).
create function app.tg_reviews_immutable_core() returns trigger
language plpgsql
set search_path = pg_catalog, pg_temp
as $fn$
begin
  if new.school_id      is distinct from old.school_id
   or new.instructor_id is distinct from old.instructor_id
   or new.enrollment_id is distinct from old.enrollment_id
   or new.author_user_id is distinct from old.author_user_id
   or new.rating        is distinct from old.rating
   or new.text          is distinct from old.text
   or new.created_at    is distinct from old.created_at then
    raise exception 'reviews: Kernfelder sind nach dem Anlegen unveränderlich (nur Moderationsfelder änderbar)';
  end if;
  return new;
end
$fn$;
create trigger tg_reviews_immutable_core
  before update on public.reviews
  for each row execute function app.tg_reviews_immutable_core();

-- users: identitäts-/sicherheitsrelevante Felder NICHT per Self-Update änderbar.
-- E-Mail-Wahrheit liegt bei Supabase Auth (Sync/Admin); account_typ ist die
-- Sicherheitsklasse (keine Selbst-Eskalation); id ist unveränderlich.
-- Privilegiert = System-/Owner-Pfad (kein Nutzerkontext) ODER Admin.
create function app.tg_users_guard() returns trigger
language plpgsql
set search_path = pg_catalog, pg_temp
as $fn$
begin
  if app.current_user_id() is null or app.has_platform_role('admin') then
    return new;
  end if;
  if new.email is distinct from old.email then
    raise exception 'users: E-Mail nur über Auth-Sync/Admin änderbar';
  end if;
  if new.account_typ is distinct from old.account_typ then
    raise exception 'users: account_typ nicht selbst änderbar';
  end if;
  if new.id is distinct from old.id then
    raise exception 'users: id ist unveränderlich';
  end if;
  return new;
end
$fn$;
create trigger tg_users_guard
  before update on public.users
  for each row execute function app.tg_users_guard();

-- updated_at automatisch bei jedem UPDATE setzen (sonst bliebe es stale).
create function app.tg_set_updated_at() returns trigger
language plpgsql
set search_path = pg_catalog, pg_temp
as $fn$
begin
  new.updated_at := now();
  return new;
end
$fn$;
create trigger tg_driving_schools_updated_at before update on public.driving_schools
  for each row execute function app.tg_set_updated_at();
create trigger tg_school_billing_updated_at before update on public.school_billing
  for each row execute function app.tg_set_updated_at();
create trigger tg_school_profiles_updated_at before update on public.school_profiles
  for each row execute function app.tg_set_updated_at();
create trigger tg_blog_posts_updated_at before update on public.blog_posts
  for each row execute function app.tg_set_updated_at();
create trigger tg_theory_lessons_updated_at before update on public.theory_lessons
  for each row execute function app.tg_set_updated_at();
create trigger tg_student_progress_updated_at before update on public.student_progress
  for each row execute function app.tg_set_updated_at();

-- ----------------------------------------------------------------------------
-- 6) RLS aktivieren (ALLE Tabellen) + Policies (TO app_user, deny-by-default)
-- ----------------------------------------------------------------------------
alter table public.users                     enable row level security;
alter table public.platform_role_assignments enable row level security;
alter table public.school_brands             enable row level security;
alter table public.driving_schools           enable row level security;
alter table public.school_billing            enable row level security;
alter table public.school_members            enable row level security;
alter table public.school_profiles           enable row level security;
alter table public.instructors               enable row level security;
alter table public.enrollments               enable row level security;
alter table public.reviews                   enable row level security;
alter table public.blog_posts                enable row level security;
alter table public.security_events           enable row level security;
alter table public.subscription_plans        enable row level security;
alter table public.school_subscriptions      enable row level security;
alter table public.instructor_availability   enable row level security;
alter table public.appointments              enable row level security;
alter table public.invoices                  enable row level security;
alter table public.messages                  enable row level security;
alter table public.question_catalogs         enable row level security;
alter table public.theory_lessons            enable row level security;
alter table public.student_progress          enable row level security;
alter table public.live_sessions             enable row level security;
alter table public.live_session_questions    enable row level security;
alter table public.accounting_exports        enable row level security;
alter table public.accounting_export_items   enable row level security;

-- users
create policy users_select on public.users for select to app_user
  using (id = app.current_user_id()
         or app.has_platform_role('admin')
         or app.has_platform_role('support'));
create policy users_update_self on public.users for update to app_user
  using (id = app.current_user_id() or app.has_platform_role('admin'))
  with check (id = app.current_user_id() or app.has_platform_role('admin'));

-- platform_role_assignments
create policy pra_select on public.platform_role_assignments for select to app_user
  using (user_id = app.current_user_id() or app.has_platform_role('admin'));
create policy pra_write on public.platform_role_assignments for all to app_user
  using (app.has_platform_role('admin'))
  with check (app.has_platform_role('admin'));

-- school_brands
create policy school_brands_select on public.school_brands for select to app_user
  using (inhaber_user_id = app.current_user_id()
         or app.has_platform_role('admin')
         or app.has_platform_role('support'));
create policy school_brands_write on public.school_brands for all to app_user
  using (inhaber_user_id = app.current_user_id() or app.has_platform_role('admin'))
  with check (inhaber_user_id = app.current_user_id() or app.has_platform_role('admin'));

-- driving_schools: ÖFFENTLICH nur is_listed; Verwaltung durch Schulmitglieder/admin
create policy driving_schools_public_select on public.driving_schools for select to app_user
  using (is_listed = true
         or app.is_member_of_school(id)
         or app.has_platform_role('admin')
         or app.has_platform_role('support'));
-- driving_schools ist PLATTFORM-kontrolliert: Partnerstatus, Verifizierung, Listing/
-- Takedown, Google-Daten, Geo und Portal-Kernfelder dürfen NICHT von Schulen geändert
-- werden. Daher UPDATE admin-only. Schulpflege läuft über school_profiles + school_billing.
create policy driving_schools_update on public.driving_schools for update to app_user
  using (app.has_platform_role('admin'))
  with check (app.has_platform_role('admin'));
-- INSERT/DELETE: nur admin (Import läuft über erhöhten Pfad)
create policy driving_schools_admin_write on public.driving_schools for insert to app_user
  with check (app.has_platform_role('admin'));
create policy driving_schools_admin_delete on public.driving_schools for delete to app_user
  using (app.has_platform_role('admin'));

-- school_billing: KEIN Support, KEIN Fahrlehrer; admin + inhaber/verwaltung
create policy school_billing_access on public.school_billing for all to app_user
  using (app.has_platform_role('admin')
         or app.user_has_school_role(app.current_user_id(), school_id, 'inhaber')
         or app.user_has_school_role(app.current_user_id(), school_id, 'verwaltung'))
  with check (app.has_platform_role('admin')
         or app.user_has_school_role(app.current_user_id(), school_id, 'inhaber')
         or app.user_has_school_role(app.current_user_id(), school_id, 'verwaltung'));

-- school_members
create policy school_members_select on public.school_members for select to app_user
  using (user_id = app.current_user_id()
         or app.is_member_of_school(school_id)
         or app.has_platform_role('admin')
         or app.has_platform_role('support'));
create policy school_members_write on public.school_members for all to app_user
  using (app.user_has_school_role(app.current_user_id(), school_id, 'inhaber')
         or app.has_platform_role('admin'))
  with check (app.user_has_school_role(app.current_user_id(), school_id, 'inhaber')
         or app.has_platform_role('admin'));

-- school_profiles: ÖFFENTLICH nur wenn Schule gelistet; Verwaltung Schule/admin
create policy school_profiles_public_select on public.school_profiles for select to app_user
  using (app.is_school_listed(school_id)
         or app.is_member_of_school(school_id)
         or app.has_platform_role('admin')
         or app.has_platform_role('support'));
create policy school_profiles_write on public.school_profiles for all to app_user
  using (app.is_member_of_school(school_id) or app.has_platform_role('admin'))
  with check (app.is_member_of_school(school_id) or app.has_platform_role('admin'));

-- instructors: öffentlich lesbar wenn Schule gelistet; Verwaltung Schule/admin
create policy instructors_public_select on public.instructors for select to app_user
  using (app.is_school_listed(school_id)
         or app.is_member_of_school(school_id)
         or app.has_platform_role('admin')
         or app.has_platform_role('support'));
create policy instructors_write on public.instructors for all to app_user
  using (app.is_member_of_school(school_id) or app.has_platform_role('admin'))
  with check (app.is_member_of_school(school_id) or app.has_platform_role('admin'));

-- enrollments: Student (eigene) / Schulmitglied / admin / support(lesend)
create policy enrollments_select on public.enrollments for select to app_user
  using (student_user_id = app.current_user_id()
         or app.is_member_of_school(school_id)
         or app.has_platform_role('admin')
         or app.has_platform_role('support'));
create policy enrollments_student_insert on public.enrollments for insert to app_user
  with check (student_user_id = app.current_user_id()
              or app.is_member_of_school(school_id)
              or app.has_platform_role('admin'));
create policy enrollments_update on public.enrollments for update to app_user
  using (app.is_member_of_school(school_id) or app.has_platform_role('admin'))
  with check (app.is_member_of_school(school_id) or app.has_platform_role('admin'));

-- reviews: ÖFFENTLICH nur published UND Schule gelistet; INSERT Student;
-- Moderation (UPDATE) nur moderator/admin
create policy reviews_public_select on public.reviews for select to app_user
  using ((moderation_status = 'published' and app.is_school_listed(school_id))
         or author_user_id = app.current_user_id()
         or app.has_platform_role('moderator')
         or app.has_platform_role('admin')
         or app.has_platform_role('support'));
create policy reviews_insert on public.reviews for insert to app_user
  with check (author_user_id = app.current_user_id()
              or app.has_platform_role('admin'));
create policy reviews_moderate on public.reviews for update to app_user
  using (app.has_platform_role('moderator') or app.has_platform_role('admin'))
  with check (app.has_platform_role('moderator') or app.has_platform_role('admin'));
create policy reviews_delete on public.reviews for delete to app_user
  using (app.has_platform_role('admin'));

-- blog_posts: ÖFFENTLICH nur published & nicht zukünftig; Schreiben editor/admin
create policy blog_public_select on public.blog_posts for select to app_user
  using ((status = 'published' and published_at is not null and published_at <= now())
         or app.has_platform_role('editor')
         or app.has_platform_role('admin'));
create policy blog_write on public.blog_posts for all to app_user
  using (app.has_platform_role('editor') or app.has_platform_role('admin'))
  with check (app.has_platform_role('editor') or app.has_platform_role('admin'));

-- security_events: append-only; INSERT nur für eigenen (oder system-) Actor.
-- Zusätzlich erzwingt der Trigger app.tg_security_events_actor die Actor-Bindung
-- (Defense-in-Depth). SELECT nur admin. Kein UPDATE/DELETE-Grant => append-only.
-- Hinweis: Ein normaler Nutzer kann eigene Events NICHT zurücklesen (SELECT=admin),
-- daher beim INSERT KEIN RETURNING verwenden.
-- app_user (authentifiziert) darf nur Events mit eigenem actor schreiben. Anonyme
-- app_user-Sessions (current_user_id NULL) können gar nicht schreiben. System-/Tooling-
-- Events (actor NULL) laufen über den erhöhten Pfad (service_role, umgeht RLS); der
-- Trigger app.tg_security_events_actor erlaubt dort actor=NULL nur ohne Nutzerkontext.
create policy security_events_insert on public.security_events for insert to app_user
  with check (actor_user_id = app.current_user_id());
create policy security_events_select on public.security_events for select to app_user
  using (app.has_platform_role('admin'));

-- enrollments-abhängige private Tabellen: Student (eigene) / Schule / admin
create policy appointments_select on public.appointments for select to app_user
  using (exists (select 1 from public.enrollments e
                 where e.id = enrollment_id
                   and (e.student_user_id = app.current_user_id()
                        or app.is_member_of_school(e.school_id)))
         or app.has_platform_role('admin')
         or app.has_platform_role('support'));

create policy invoices_select on public.invoices for select to app_user
  using (exists (select 1 from public.enrollments e
                 where e.id = enrollment_id
                   and (e.student_user_id = app.current_user_id()
                        or app.is_member_of_school(e.school_id)))
         or app.has_platform_role('admin')
         or app.has_platform_role('support'));

-- messages: Chat ist Phase 2/3. BEWUSST deny-by-default (RLS aktiv, KEINE app_user-
-- Policy). Normale App-Nutzer können (noch) nicht lesen/schreiben; nur der erhöhte
-- Pfad (service_role/Tooling) kann seeden/migrieren. Konkrete Chat-Policies (inkl.
-- Enrollment-/Tenant-Konsistenz) werden erst bei Feature-Aktivierung ergänzt.

-- ÜBRIGE vorbereitete Tabellen: RLS aktiv, KEINE app_user-Policy => deny-by-default.
-- Zugriff erfolgt bis zur Feature-Aktivierung ausschließlich über den erhöhten
-- Pfad (service_role/Tooling). Policies werden mit dem jeweiligen Feature ergänzt:
--   subscription_plans, school_subscriptions, instructor_availability,
--   question_catalogs, theory_lessons, student_progress, live_sessions,
--   live_session_questions, accounting_exports, accounting_export_items.

-- ----------------------------------------------------------------------------
-- 7) Tabellen-Grants an app_user (RLS steuert die Zeilen)
-- ----------------------------------------------------------------------------
grant select, insert, update, delete on
  public.users, public.platform_role_assignments, public.school_brands,
  public.driving_schools, public.school_billing, public.school_members,
  public.school_profiles, public.instructors, public.enrollments,
  public.reviews, public.blog_posts,
  public.subscription_plans, public.school_subscriptions,
  public.instructor_availability, public.appointments, public.invoices,
  public.messages, public.question_catalogs, public.theory_lessons,
  public.student_progress, public.live_sessions, public.live_session_questions,
  public.accounting_exports, public.accounting_export_items
to app_user;

-- security_events: append-only -> nur INSERT + SELECT (kein UPDATE/DELETE)
grant select, insert on public.security_events to app_user;

-- app.*-Helfer: nicht für PUBLIC, nur app_user darf ausführen
revoke all on function
  app.current_user_id(),
  app.current_account_type(),
  app.has_platform_role(text),
  app.user_has_school_role(uuid, uuid, text),
  app.is_member_of_school(uuid),
  app.is_school_listed(uuid)
from public;
grant execute on function
  app.current_user_id(),
  app.current_account_type(),
  app.has_platform_role(text),
  app.user_has_school_role(uuid, uuid, text),
  app.is_member_of_school(uuid),
  app.is_school_listed(uuid)
to app_user;

-- ----------------------------------------------------------------------------
-- 8) Öffentliche Views (Spalten-Minimierung für Public-Reads)
-- ----------------------------------------------------------------------------
-- RLS ist zeilen-, nicht spaltenbasiert. Diese Views begrenzen die öffentlich
-- sichtbaren SPALTEN (Datenschutz, da Bewertungen u. a. von Minderjährigen stammen)
-- und respektieren weiterhin die RLS der Basistabelle dank `security_invoker = true`
-- (die View läuft mit den Rechten des AUFRUFERS = app_user, nicht des View-Owners).
-- KEINE identifizierenden Spalten (author_user_id, enrollment_id, moderated_by_user_id,
-- instructors.user_id). Die DAL liest öffentliche Daten über diese Views.

create view public.reviews_public
with (security_invoker = true) as
  select id, school_id, instructor_id, rating, text, moderation_status,
         published_at, created_at
  from public.reviews;

create view public.instructors_public
with (security_invoker = true) as
  select id, school_id, name, slug, aktiv
  from public.instructors;

grant select on public.reviews_public, public.instructors_public to app_user;

reset role;

commit;
