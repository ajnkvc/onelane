-- 0023_portal_jobs_ausbau.sql
-- Portal-Ausbau: Jobbörse — school_jobs marktreif erweitern + Bewerbungs-Leads.
--
--  (1) school_jobs: slug (globale Detail-URL /jobs/{slug}), Beschäftigungsart,
--      freiwillige Vergütungsangabe (Freitext — KEINE erzwungene Spanne, keine
--      erfundenen Werte), Gültigkeitsfenster, Sortier-Position, Größen-Caps.
--      Die PUBLIC-Read-Policy wird um das Gültigkeitsfenster ergänzt (bisher
--      lieferte sie abgelaufene Anzeigen aus — 0001-Lücke).
--  (2) job_applications: Bewerbungs-Leads, analog zum leads-Modell aus 0022
--      (anonymer INSERT über dedizierten DAL-Schreibkontext, kein RETURNING,
--      kein support, UPDATE nur status, kein DELETE, FK RESTRICT, Soft-Delete).
--      AGG-/Datenminimierung by Design: KEINE Felder für Geburtsdatum, Foto,
--      Geschlecht, Familienstand — bewusst nicht modelliert.
--
-- PG16+. Idempotent. Abschließende fail-closed Assertions.

begin;

grant app_owner to current_user;
set role app_owner;

-- ----------------------------------------------------------------------------
-- (1) school_jobs erweitern
-- ----------------------------------------------------------------------------
alter table public.school_jobs add column if not exists slug text;
alter table public.school_jobs add column if not exists beschaeftigungsart text;
alter table public.school_jobs add column if not exists verguetung_text text;
alter table public.school_jobs add column if not exists gueltig_bis date;
alter table public.school_jobs add column if not exists position integer not null default 0;

-- Backfill für Bestandszeilen (idempotent: nur wo slug fehlt): titel-basiert,
-- transliteriert grob (Detailfeinheit macht @/lib/slug in der App; hier nur ein
-- eindeutiger, URL-sicherer Fallback), + Kurz-ID gegen Kollisionen.
-- Fail-safe: Titel ganz ohne [a-z0-9] (z. B. nur Sonderzeichen/CJK) ergäben einen
-- leeren Basis-Slug und fielen am CHECK — dann greift der Fallback 'job-{shortid}'.
update public.school_jobs
   set slug = coalesce(
         nullif(
           trim(both '-' from
             regexp_replace(
               translate(lower(titel), 'äöüß', 'aous'),
               '[^a-z0-9]+', '-', 'g'
             )
           ), ''
         ) || '-',
         'job-'
       ) || left(id::text, 8)
 where slug is null;

alter table public.school_jobs alter column slug set not null;

create unique index if not exists uq_school_jobs_slug on public.school_jobs (slug);

alter table public.school_jobs drop constraint if exists chk_school_jobs_slug;
alter table public.school_jobs add constraint chk_school_jobs_slug
  check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and octet_length(slug) <= 200);

alter table public.school_jobs drop constraint if exists chk_school_jobs_beschaeftigungsart;
alter table public.school_jobs add constraint chk_school_jobs_beschaeftigungsart
  check (beschaeftigungsart is null
         or beschaeftigungsart in ('vollzeit', 'teilzeit', 'minijob', 'nebenberuflich'));

alter table public.school_jobs drop constraint if exists chk_school_jobs_text_sizes;
alter table public.school_jobs add constraint chk_school_jobs_text_sizes
  check (
    octet_length(titel) <= 300
    and (beschreibung is null or octet_length(beschreibung) <= 16384)
    and (verguetung_text is null or octet_length(verguetung_text) <= 300)
  );

-- K8: Public-Read zusätzlich auf das Gültigkeitsfenster einschränken (Schul-Mitglieder/
-- admin/support sehen weiterhin alles, z. B. zum Reaktivieren abgelaufener Anzeigen).
drop policy if exists school_jobs_public_select on public.school_jobs;
create policy school_jobs_public_select on public.school_jobs for select to app_user
  using ((aktiv = true
          and app.is_school_listed(school_id)
          and (gueltig_bis is null or gueltig_bis >= current_date))
         or app.is_member_of_school(school_id)
         or app.has_platform_role('admin')
         or app.has_platform_role('support'));

-- ----------------------------------------------------------------------------
-- (2) job_applications — Bewerbungs-Leads (PII, 0022-Muster)
-- ----------------------------------------------------------------------------
create table if not exists public.job_applications (
  id uuid primary key default gen_random_uuid(),
  -- RESTRICT: Bewerbungen sind PII — Löschkaskade über Job-/Schul-Löschung verboten
  -- (Erasure-Konzept: erst Bewerbungen behandeln, dann Anzeige).
  job_id uuid not null references public.school_jobs(id) on delete restrict,
  name text not null,
  email text not null,
  telefon text,
  nachricht text,
  einwilligung_datenschutz_at timestamptz not null,
  status text not null default 'neu',
  quelle_pfad text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.job_applications drop constraint if exists chk_job_applications_status;
alter table public.job_applications add constraint chk_job_applications_status
  check (status in ('neu', 'gesehen', 'erledigt'));

alter table public.job_applications drop constraint if exists chk_job_applications_email_format;
alter table public.job_applications add constraint chk_job_applications_email_format
  check (email ~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$');

alter table public.job_applications drop constraint if exists chk_job_applications_telefon_format;
alter table public.job_applications add constraint chk_job_applications_telefon_format
  check (telefon is null or telefon ~ '^[0-9+][0-9 ()/\-]{2,63}$');

alter table public.job_applications drop constraint if exists chk_job_applications_text_sizes;
alter table public.job_applications add constraint chk_job_applications_text_sizes
  check (
    octet_length(name) <= 200
    and octet_length(email) <= 320
    and (telefon is null or octet_length(telefon) <= 64)
    and (nachricht is null or octet_length(nachricht) <= 4000)
    and (quelle_pfad is null or octet_length(quelle_pfad) <= 512)
  );

create index if not exists idx_job_applications_job_active
  on public.job_applications (job_id, created_at desc) where deleted_at is null;

drop trigger if exists tg_job_applications_updated_at on public.job_applications;
create trigger tg_job_applications_updated_at before update on public.job_applications
  for each row execute function app.tg_set_updated_at();

alter table public.job_applications enable row level security;

-- Anonymer INSERT: nur auf öffentlich sichtbare (aktive, gelistete, gültige) Anzeigen.
-- Der EXISTS-Unterabfrage-Pfad läuft unter den RLS-Policies des Aufrufers auf
-- school_jobs — anonym sind das exakt die öffentlichen Anzeigen (konsistent by design).
drop policy if exists job_applications_public_insert on public.job_applications;
create policy job_applications_public_insert on public.job_applications for insert to app_user
  with check (
    status = 'neu'
    and deleted_at is null
    and einwilligung_datenschutz_at is not null
    and exists (
      select 1 from public.school_jobs j
       where j.id = job_id
         and j.aktiv = true
         and app.is_school_listed(j.school_id)
         and (j.gueltig_bis is null or j.gueltig_bis >= current_date)
    )
  );

drop policy if exists job_applications_select on public.job_applications;
create policy job_applications_select on public.job_applications for select to app_user
  using (
    (deleted_at is null and exists (
      select 1 from public.school_jobs j
       where j.id = job_id and app.is_school_manager(j.school_id)
    ))
    or app.has_platform_role('admin')
  );

drop policy if exists job_applications_update on public.job_applications;
create policy job_applications_update on public.job_applications for update to app_user
  using (
    (deleted_at is null and exists (
      select 1 from public.school_jobs j
       where j.id = job_id and app.is_school_manager(j.school_id)
    ))
    or app.has_platform_role('admin')
  )
  with check (
    (deleted_at is null and exists (
      select 1 from public.school_jobs j
       where j.id = job_id and app.is_school_manager(j.school_id)
    ))
    or app.has_platform_role('admin')
  );

-- Grants (Spalten-Allowlist, 0022-Muster): INSERT exakt Formularfelder, UPDATE nur
-- status, SELECT ohne deleted_at, KEIN DELETE.
revoke all on table public.job_applications from app_user;
grant insert (
  job_id, name, email, telefon, nachricht, einwilligung_datenschutz_at, quelle_pfad
) on table public.job_applications to app_user;
grant select (
  id, job_id, name, email, telefon, nachricht, einwilligung_datenschutz_at,
  status, quelle_pfad, created_at, updated_at
) on table public.job_applications to app_user;
grant update (status) on table public.job_applications to app_user;

-- ----------------------------------------------------------------------------
-- Fail-closed Assertions.
-- ----------------------------------------------------------------------------
do $$
declare
  v record;
begin
  -- school_jobs: neue Spalten + Slug-Härtung vorhanden.
  for v in
    select * from (values
      ('slug'), ('beschaeftigungsart'), ('verguetung_text'), ('gueltig_bis'), ('position')
    ) as expected(colname)
  loop
    if not exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'school_jobs' and column_name = v.colname
    ) then
      raise exception '0023: Spalte school_jobs.% fehlt', v.colname;
    end if;
  end loop;

  if exists (select 1 from public.school_jobs where slug is null) then
    raise exception '0023: school_jobs.slug-Backfill unvollstaendig';
  end if;

  if not exists (
    select 1 from pg_indexes
     where schemaname = 'public' and tablename = 'school_jobs' and indexname = 'uq_school_jobs_slug'
  ) then
    raise exception '0023: Unique-Index uq_school_jobs_slug fehlt';
  end if;

  -- Public-Policy enthält das Gültigkeitsfenster.
  if not exists (
    select 1 from pg_policy p
     where p.polrelid = 'public.school_jobs'::regclass
       and p.polname = 'school_jobs_public_select'
       and coalesce(pg_get_expr(p.polqual, p.polrelid), '') like '%gueltig_bis%'
  ) then
    raise exception '0023: school_jobs_public_select ohne gueltig_bis-Fenster';
  end if;

  -- job_applications: RLS, Eigentum, FK RESTRICT, Policies, Grants.
  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = 'job_applications' and c.relrowsecurity
  ) then
    raise exception '0023: RLS auf public.job_applications ist nicht aktiviert';
  end if;

  if (select relowner::regrole::text from pg_class where oid = 'public.job_applications'::regclass)
     is distinct from 'app_owner' then
    raise exception '0023: public.job_applications gehoert nicht app_owner';
  end if;

  if not exists (
    select 1 from pg_constraint c
     where c.conrelid = 'public.job_applications'::regclass and c.contype = 'f'
       and c.confrelid = 'public.school_jobs'::regclass and c.confdeltype = 'r'
  ) then
    raise exception '0023: job_applications.job_id-FK ist nicht ON DELETE RESTRICT';
  end if;

  for v in
    select * from (values
      ('job_applications_public_insert'), ('job_applications_select'), ('job_applications_update')
    ) as expected(polname)
  loop
    if not exists (
      select 1 from pg_policy p where p.polrelid = 'public.job_applications'::regclass
        and p.polname = v.polname
    ) then
      raise exception '0023: Policy % fehlt auf public.job_applications', v.polname;
    end if;
  end loop;

  if exists (
    select 1 from pg_policy p
     where p.polrelid = 'public.job_applications'::regclass and p.polcmd = 'd'
  ) then
    raise exception '0023: unerwartete DELETE-Policy auf public.job_applications';
  end if;

  for v in
    select * from (values
      ('name', 'INSERT', true),
      ('einwilligung_datenschutz_at', 'INSERT', true),
      ('status', 'INSERT', false),
      ('id', 'INSERT', false),
      ('deleted_at', 'INSERT', false),
      ('status', 'UPDATE', true),
      ('name', 'UPDATE', false),
      ('email', 'UPDATE', false),
      ('deleted_at', 'UPDATE', false),
      ('job_id', 'UPDATE', false),
      ('name', 'SELECT', true),
      ('deleted_at', 'SELECT', false)
    ) as expected(colname, privname, allowed)
  loop
    if has_column_privilege('app_user', 'public.job_applications', v.colname, v.privname)
       is distinct from v.allowed then
      raise exception '0023: app_user %-Privileg fuer job_applications.% erwartet %',
        v.privname, v.colname, v.allowed;
    end if;
  end loop;

  if has_table_privilege('app_user', 'public.job_applications', 'DELETE') then
    raise exception '0023: app_user darf job_applications nicht DELETEn';
  end if;

  if not exists (
    select 1 from pg_trigger t
     where t.tgrelid = 'public.job_applications'::regclass
       and t.tgname = 'tg_job_applications_updated_at' and not t.tgisinternal
  ) then
    raise exception '0023: Trigger tg_job_applications_updated_at fehlt';
  end if;
end
$$;

reset role;

commit;
