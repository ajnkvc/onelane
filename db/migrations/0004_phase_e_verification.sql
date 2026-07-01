-- ============================================================================
-- 0004_phase_e_verification.sql — Phase E (008c): Website-Verifikation.
-- ----------------------------------------------------------------------------
-- Zwei interne Tooling-Tabellen (deny-by-default, admin-only; Owner/Tooling
-- schreibt RLS-frei):
--   * school_brand_domains — idempotente Brand-Identität je verifizierter Domain
--     (Domain → genau EINE Brand, case-insensitiv eindeutig; mehrere Domains je
--     Brand erlaubt). Filialen bleiben getrennte driving_schools-Zeilen.
--   * import_fetch_log — Audit je abgerufener URL (robots/Status/Final-URL/Hash/
--     Timing). KEIN HTML-Body, KEINE extrahierten Kontakt-Klartexte; error nur
--     typisiert/gekürzt (PII-Minimierung).
-- ============================================================================

begin;

grant app_owner to current_user;
set role app_owner;

-- ----------------------------------------------------------------------------
-- 1) Brand ↔ Domain (idempotente Gruppierung)
-- ----------------------------------------------------------------------------
create table public.school_brand_domains (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.school_brands(id) on delete cascade,
  domain text not null,
  created_at timestamptz not null default now()
);
-- Domain → genau eine Brand (case-insensitiv). Mehrere Domains je Brand sind ok.
create unique index uq_school_brand_domains_domain on public.school_brand_domains (lower(domain));
create index idx_school_brand_domains_brand on public.school_brand_domains (brand_id);

-- ----------------------------------------------------------------------------
-- 2) Fetch-Audit (PII-minimiert)
-- ----------------------------------------------------------------------------
create table public.import_fetch_log (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.import_run(id) on delete set null,
  source_ref text,
  url text not null,
  final_url text,
  robots_decision text
    check (robots_decision is null or robots_decision in
      ('allowed', 'disallowed', 'absent', 'unreachable', 'malformed')),
  http_status integer,
  content_hash text,
  error_code text,
  error_message text,
  duration_ms integer,
  fetched_at timestamptz not null default now(),
  -- PII-/Größen-Minimierung: error gekürzt, kein HTML/Kontakt-Klartext.
  check (error_message is null or length(error_message) <= 500)
);
-- Idempotenz je Lauf: keine Fetch-Log-Dubletten pro (Lauf, Quelle, URL).
create unique index uq_import_fetch_log_run_ref_url on public.import_fetch_log (run_id, source_ref, url);
create index idx_import_fetch_log_run on public.import_fetch_log (run_id);
create index idx_import_fetch_log_source_ref on public.import_fetch_log (source_ref);
create index idx_import_fetch_log_fetched on public.import_fetch_log (fetched_at);

-- ----------------------------------------------------------------------------
-- 3) RLS: deny-by-default, nur admin (app_user-Pfad); Owner/Tooling RLS-frei
-- ----------------------------------------------------------------------------
alter table public.school_brand_domains enable row level security;
alter table public.import_fetch_log     enable row level security;

create policy school_brand_domains_admin_all on public.school_brand_domains for all to app_user
  using (app.has_platform_role('admin')) with check (app.has_platform_role('admin'));
create policy import_fetch_log_admin_all on public.import_fetch_log for all to app_user
  using (app.has_platform_role('admin')) with check (app.has_platform_role('admin'));

grant select, insert, update, delete on
  public.school_brand_domains, public.import_fetch_log
to app_user;

reset role;

commit;
