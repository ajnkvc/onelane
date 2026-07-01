-- ============================================================================
-- 0002_phase_e_ingestion_foundation.sql — Phase E (008a): FUNDAMENT für die
-- Fahrschul-Daten-Ingestion (OSM-Import + Website/Impressum-Verifikation folgen
-- in 008b/008c/008d). Diese Migration legt NUR Schema/RLS/Constraints an —
-- KEIN Import, KEIN Web-Zugriff, KEINE Daten außer der Ausschluss-Seed.
-- ----------------------------------------------------------------------------
-- Konventionen wie 0000/0001 (MASSGEBLICHE WAHRHEIT): reines Standard-PostgreSQL,
-- Eigentum app_owner, RLS-pflichtig, fail-/deny-closed.
--
-- Kernideen:
--  * Brand/Firma kann jetzt PORTAL-VERWALTET (ohne Owner) existieren → importierte
--    Firmen sind gruppierbar; ein späterer Claim hängt den Owner an.
--  * driving_schools bekommt eine IMPORT-IDENTITÄT (source/source_ref) für
--    Idempotenz; importierte Datensätze gehen NICHT automatisch live (is_listed
--    wird vom Import-Pfad explizit auf false gesetzt; das Gate prüft 008c).
--  * Interne Ingestion-Tabellen (Run/Staging/Provenienz/Review/Dedupe/Exclusion)
--    sind DENY-BY-DEFAULT und nur für die interne Plattformrolle `admin` sichtbar/
--    bearbeitbar (enthalten Quell-URLs und potenziell personenbezogene Kontakte).
--    Der erhöhte Tooling-Pfad (Owner) schreibt sie ohnehin RLS-frei.
--  * BELEGPFLICHT: field_provenance hält je canonical Feld die Quelle + Stand.
--  * 123fahrschule wird als Ausschluss geseedet (greift VOR Match/Publish in 008b).
-- ============================================================================

begin;

grant app_owner to current_user;
set role app_owner;

-- ----------------------------------------------------------------------------
-- 1) Brand/Firma: portal-verwaltet möglich (Owner optional)
-- ----------------------------------------------------------------------------
alter table public.school_brands
  alter column inhaber_user_id drop not null,
  add column is_portal_managed boolean not null default false;

-- Entweder geclaimt (Owner vorhanden) ODER portal-verwaltet. Verhindert
-- "verwaiste" Brands ohne Owner, die nicht bewusst portal-verwaltet sind.
alter table public.school_brands
  add constraint school_brands_owner_or_portal
  check (inhaber_user_id is not null or is_portal_managed = true);

-- ----------------------------------------------------------------------------
-- 2) driving_schools: Import-Identität (Idempotenz) + Verifikationsstatus
-- ----------------------------------------------------------------------------
alter table public.driving_schools
  add column source text,                 -- z. B. 'osm'
  add column source_ref text,             -- z. B. 'node/123456' (stabile Quell-ID)
  add column imported_at timestamptz,
  add column verification_status text
    check (verification_status is null or verification_status in
      ('unverified', 'needs_review', 'auto_verified', 'manual_verified', 'rejected'));

-- Idempotenz: dieselbe Quell-ID darf nur EINE Schule erzeugen. Bestehende (manuell
-- angelegte) Zeilen ohne source/source_ref bleiben unberührt (partieller Index).
create unique index uq_driving_schools_source_ref
  on public.driving_schools (source, source_ref)
  where source is not null and source_ref is not null;

-- ----------------------------------------------------------------------------
-- 3) import_run — Lauf-Protokoll (Audit jeder erhöhten Ingestion)
-- ----------------------------------------------------------------------------
create table public.import_run (
  id uuid primary key default gen_random_uuid(),
  source text not null,                   -- 'osm', …
  source_version text,                    -- Extrakt-/Overpass-Stand (reproduzierbar)
  query text,                             -- reproduzierbare Quell-Query
  params jsonb,
  status text not null default 'running'
    check (status in ('running', 'completed', 'failed', 'aborted')),
  counts jsonb,                           -- {candidates, excluded, unique, with_website, auto_listed, review, rejected, errors}
  error_summary text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  check (params is null or jsonb_typeof(params) = 'object'),
  check (counts is null or jsonb_typeof(counts) = 'object')
);
create index idx_import_run_started on public.import_run (started_at);

-- ----------------------------------------------------------------------------
-- 4) import_staging — Roh-/Kandidatendaten je Quell-Objekt (kein Blind-Upsert)
-- ----------------------------------------------------------------------------
create table public.import_staging (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.import_run(id) on delete set null,
  source text not null,
  source_ref text not null,               -- z. B. 'node/123456'
  source_url text,
  raw jsonb,                              -- begrenzte Rohdaten
  normalized jsonb,                       -- normalisierte Felder
  content_hash text,                      -- Idempotenz-/Änderungsschlüssel
  status text not null default 'pending'
    check (status in ('pending', 'matched', 'imported', 'excluded', 'review', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (raw is null or jsonb_typeof(raw) = 'object'),
  check (normalized is null or jsonb_typeof(normalized) = 'object')
);
create unique index uq_import_staging_source on public.import_staging (source, source_ref);
create index idx_import_staging_run on public.import_staging (run_id);
create index idx_import_staging_status on public.import_staging (status);

-- ----------------------------------------------------------------------------
-- 5) field_provenance — BELEGPFLICHT je canonical Feld (Quelle + Stand)
-- ----------------------------------------------------------------------------
create table public.field_provenance (
  id uuid primary key default gen_random_uuid(),
  target_table text not null check (target_table in ('driving_schools', 'school_profiles')),
  target_id uuid not null,                -- polymorph (kein FK; siehe target_table)
  field text not null,
  value_hash text,                        -- Snapshot-Hash des gespeicherten Werts
  source text not null
    check (source in ('osm', 'school_website', 'impressum', 'manual_review', 'search_discovery')),
  source_url text,
  source_ref text,
  observed_at timestamptz,
  verified_at timestamptz,
  confidence numeric(4,3) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  decided_by uuid references public.users(id),
  run_id uuid references public.import_run(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (target_table, target_id, field)  -- aktuelle Herkunft je Feld
);
create index idx_field_provenance_target on public.field_provenance (target_table, target_id);

-- ----------------------------------------------------------------------------
-- 6) import_review_queue — manuelle Prüfung (Unsicheres geht NICHT live)
-- ----------------------------------------------------------------------------
create table public.import_review_queue (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.import_run(id) on delete set null,
  staging_id uuid references public.import_staging(id) on delete cascade,
  school_id uuid references public.driving_schools(id) on delete cascade,
  reasons text[] not null default '{}',          -- maschinenlesbare Gründe
  conflict_fields text[] not null default '{}',
  proposed jsonb,
  existing jsonb,
  priority smallint not null default 0,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'deferred')),
  reviewer_user_id uuid references public.users(id),
  decision text,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (proposed is null or jsonb_typeof(proposed) = 'object'),
  check (existing is null or jsonb_typeof(existing) = 'object')
);
create index idx_review_queue_status on public.import_review_queue (status);
create index idx_review_queue_staging on public.import_review_queue (staging_id);

-- ----------------------------------------------------------------------------
-- 7) dedupe_decision — Filialen ≠ Duplikate (auditierbar)
-- ----------------------------------------------------------------------------
create table public.dedupe_decision (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.import_run(id) on delete set null,
  staging_id uuid references public.import_staging(id) on delete cascade,
  canonical_school_id uuid references public.driving_schools(id) on delete set null,
  decision text not null
    check (decision in ('merged', 'not_duplicate', 'separate_branch', 'needs_review')),
  score numeric(4,3) check (score is null or (score >= 0 and score <= 1)),
  match_factors jsonb,
  decided_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  check (match_factors is null or jsonb_typeof(match_factors) = 'object')
);
create index idx_dedupe_decision_staging on public.dedupe_decision (staging_id);
create index idx_dedupe_decision_school on public.dedupe_decision (canonical_school_id);

-- ----------------------------------------------------------------------------
-- 8) import_exclusion — harte Sperren VOR Match/Publish (+ DSGVO-Zustände)
-- ----------------------------------------------------------------------------
create table public.import_exclusion (
  id uuid primary key default gen_random_uuid(),
  typ text not null check (typ in ('name', 'domain', 'source', 'pattern')),
  value text not null,                    -- normalisierter Wert/Pattern
  reason text not null
    check (reason in ('excluded_brand', 'opt_out', 'takedown', 'legal_hold', 'claimed_conflict', 'other')),
  notiz text,
  active boolean not null default true,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Aktive Sperren je (Typ, Wert) eindeutig (case-insensitiv).
create unique index uq_import_exclusion_active on public.import_exclusion (typ, lower(value)) where active = true;
create index idx_import_exclusion_active on public.import_exclusion (active);

-- updated_at automatisch (Wiederverwendung der 0000-Funktion app.tg_set_updated_at)
create trigger tg_import_staging_updated_at before update on public.import_staging
  for each row execute function app.tg_set_updated_at();
create trigger tg_import_review_queue_updated_at before update on public.import_review_queue
  for each row execute function app.tg_set_updated_at();
create trigger tg_import_exclusion_updated_at before update on public.import_exclusion
  for each row execute function app.tg_set_updated_at();

-- ----------------------------------------------------------------------------
-- 9) RLS — DENY-BY-DEFAULT; nur interne Plattformrolle `admin` (app_user-Pfad).
--    anon/student/school_staff sehen NICHTS. Erhöhter Tooling-Pfad (Owner) umgeht
--    RLS und ist über import_run + security_events auditiert.
-- ----------------------------------------------------------------------------
alter table public.import_run           enable row level security;
alter table public.import_staging       enable row level security;
alter table public.field_provenance     enable row level security;
alter table public.import_review_queue  enable row level security;
alter table public.dedupe_decision      enable row level security;
alter table public.import_exclusion     enable row level security;

create policy import_run_admin_all on public.import_run for all to app_user
  using (app.has_platform_role('admin')) with check (app.has_platform_role('admin'));
create policy import_staging_admin_all on public.import_staging for all to app_user
  using (app.has_platform_role('admin')) with check (app.has_platform_role('admin'));
create policy field_provenance_admin_all on public.field_provenance for all to app_user
  using (app.has_platform_role('admin')) with check (app.has_platform_role('admin'));
create policy import_review_queue_admin_all on public.import_review_queue for all to app_user
  using (app.has_platform_role('admin')) with check (app.has_platform_role('admin'));
create policy dedupe_decision_admin_all on public.dedupe_decision for all to app_user
  using (app.has_platform_role('admin')) with check (app.has_platform_role('admin'));
create policy import_exclusion_admin_all on public.import_exclusion for all to app_user
  using (app.has_platform_role('admin')) with check (app.has_platform_role('admin'));

-- ----------------------------------------------------------------------------
-- 10) Tabellen-Grants an app_user (RLS steuert die Zeilen)
-- ----------------------------------------------------------------------------
grant select, insert, update, delete on
  public.import_run, public.import_staging, public.field_provenance,
  public.import_review_queue, public.dedupe_decision, public.import_exclusion
to app_user;

-- ----------------------------------------------------------------------------
-- 11) Seed: harte Ausschlüsse (Gründer-Vorgabe). 'pattern' matcht Name ODER Domain
--     mit „123fahrschule" (robust, ohne eine exakte Domain zu raten); zusätzlich
--     der normalisierte Name als expliziter Treffer.
-- ----------------------------------------------------------------------------
insert into public.import_exclusion (typ, value, reason, notiz) values
  ('name',    '123fahrschule', 'excluded_brand', 'Nicht listen (Gründer-Vorgabe).'),
  ('pattern', '123fahrschule', 'excluded_brand', 'Matcht Name/Domain mit „123fahrschule" (Gründer-Vorgabe).');

reset role;

commit;
