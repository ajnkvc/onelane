-- ============================================================================
-- 0001_phase_h_profile.sql — Phase H: strukturierte, je Schule DEAKTIVIERBARE
-- Profildaten (Bilder, Fahrzeuge, FAQ, Öffnungs-/Theoriezeiten, Jobgesuche) +
-- Kontaktfelder + Sektions-Sichtbarkeits-Flags am Profil.
-- ----------------------------------------------------------------------------
-- Konventionen wie 0000 (MASSGEBLICHE WAHRHEIT): reines Standard-PostgreSQL,
-- Eigentum app_owner, RLS-pflichtig. Public-Read jeder neuen Tabelle = Schule
-- `is_listed` UND Zeile `aktiv` (Muster wie veröffentlichte Reviews) → „im
-- Backend deaktivieren" ist damit RLS-erzwungen, nicht nur UI. Schreiben/volle
-- Sicht: Schulmitglied/admin; support liest.
-- ============================================================================

begin;

grant app_owner to current_user;
set role app_owner;

-- ----------------------------------------------------------------------------
-- Enums (stabile Wertemengen)
-- ----------------------------------------------------------------------------
create type vehicle_getriebe as enum ('schaltung', 'automatik');
create type image_kategorie as enum ('gebaeude', 'theorie', 'fahrzeug', 'team', 'sonstiges');
create type opening_art as enum ('theorie', 'buero', 'praxis');
create type job_art as enum ('fahrlehrer', 'anwaerter');

-- ----------------------------------------------------------------------------
-- Kontakt + Sektions-Sichtbarkeit am Profil (public-safe; Default sichtbar)
-- ----------------------------------------------------------------------------
alter table public.school_profiles
  add column telefon text,
  add column email text,
  add column website text,
  add column show_images boolean not null default true,
  add column show_vehicles boolean not null default true,
  add column show_instructors boolean not null default true,
  add column show_faq boolean not null default true,
  add column show_zeiten boolean not null default true,
  add column show_jobs boolean not null default true;

-- ----------------------------------------------------------------------------
-- Strukturtabellen (je mit `aktiv` für RLS-Gating + Backend-Deaktivierung)
-- ----------------------------------------------------------------------------
create table public.school_images (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.driving_schools(id) on delete cascade,
  kategorie image_kategorie not null default 'sonstiges',
  url text not null,
  alt text,
  position integer not null default 0,
  aktiv boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_school_images_school on public.school_images (school_id);

create table public.school_vehicles (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.driving_schools(id) on delete cascade,
  marke text,
  modell text,
  getriebe vehicle_getriebe,
  klasse text,
  besonderheiten text[] not null default '{}',
  position integer not null default 0,
  aktiv boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_school_vehicles_school on public.school_vehicles (school_id);

create table public.school_faq_items (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.driving_schools(id) on delete cascade,
  frage text not null,
  antwort text not null,
  position integer not null default 0,
  aktiv boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_school_faq_items_school on public.school_faq_items (school_id);

create table public.school_opening_hours (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.driving_schools(id) on delete cascade,
  art opening_art not null,
  wochentag smallint not null check (wochentag between 0 and 6), -- 0=Montag … 6=Sonntag
  von time not null,
  bis time not null,
  aktiv boolean not null default true,
  created_at timestamptz not null default now()
);
create index idx_school_opening_hours_school on public.school_opening_hours (school_id);

create table public.school_jobs (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.driving_schools(id) on delete cascade,
  titel text not null,
  beschreibung text,
  art job_art not null default 'fahrlehrer',
  aktiv boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_school_jobs_school on public.school_jobs (school_id);

-- updated_at automatisch (Wiederverwendung der 0000-Funktion app.tg_set_updated_at)
create trigger tg_school_images_updated_at before update on public.school_images
  for each row execute function app.tg_set_updated_at();
create trigger tg_school_vehicles_updated_at before update on public.school_vehicles
  for each row execute function app.tg_set_updated_at();
create trigger tg_school_faq_items_updated_at before update on public.school_faq_items
  for each row execute function app.tg_set_updated_at();
create trigger tg_school_jobs_updated_at before update on public.school_jobs
  for each row execute function app.tg_set_updated_at();

-- ----------------------------------------------------------------------------
-- RLS: Public-Read = gelistet UND aktiv; Verwaltung Schulmitglied/admin; support liest
-- ----------------------------------------------------------------------------
alter table public.school_images enable row level security;
alter table public.school_vehicles enable row level security;
alter table public.school_faq_items enable row level security;
alter table public.school_opening_hours enable row level security;
alter table public.school_jobs enable row level security;

-- school_images
create policy school_images_public_select on public.school_images for select to app_user
  using ((aktiv = true and app.is_school_listed(school_id))
         or app.is_member_of_school(school_id)
         or app.has_platform_role('admin')
         or app.has_platform_role('support'));
create policy school_images_write on public.school_images for all to app_user
  using (app.is_member_of_school(school_id) or app.has_platform_role('admin'))
  with check (app.is_member_of_school(school_id) or app.has_platform_role('admin'));

-- school_vehicles
create policy school_vehicles_public_select on public.school_vehicles for select to app_user
  using ((aktiv = true and app.is_school_listed(school_id))
         or app.is_member_of_school(school_id)
         or app.has_platform_role('admin')
         or app.has_platform_role('support'));
create policy school_vehicles_write on public.school_vehicles for all to app_user
  using (app.is_member_of_school(school_id) or app.has_platform_role('admin'))
  with check (app.is_member_of_school(school_id) or app.has_platform_role('admin'));

-- school_faq_items
create policy school_faq_items_public_select on public.school_faq_items for select to app_user
  using ((aktiv = true and app.is_school_listed(school_id))
         or app.is_member_of_school(school_id)
         or app.has_platform_role('admin')
         or app.has_platform_role('support'));
create policy school_faq_items_write on public.school_faq_items for all to app_user
  using (app.is_member_of_school(school_id) or app.has_platform_role('admin'))
  with check (app.is_member_of_school(school_id) or app.has_platform_role('admin'));

-- school_opening_hours
create policy school_opening_hours_public_select on public.school_opening_hours for select to app_user
  using ((aktiv = true and app.is_school_listed(school_id))
         or app.is_member_of_school(school_id)
         or app.has_platform_role('admin')
         or app.has_platform_role('support'));
create policy school_opening_hours_write on public.school_opening_hours for all to app_user
  using (app.is_member_of_school(school_id) or app.has_platform_role('admin'))
  with check (app.is_member_of_school(school_id) or app.has_platform_role('admin'));

-- school_jobs ("Fahrlehrer gesucht")
create policy school_jobs_public_select on public.school_jobs for select to app_user
  using ((aktiv = true and app.is_school_listed(school_id))
         or app.is_member_of_school(school_id)
         or app.has_platform_role('admin')
         or app.has_platform_role('support'));
create policy school_jobs_write on public.school_jobs for all to app_user
  using (app.is_member_of_school(school_id) or app.has_platform_role('admin'))
  with check (app.is_member_of_school(school_id) or app.has_platform_role('admin'));

-- ----------------------------------------------------------------------------
-- Tabellen-Grants an app_user (RLS steuert die Zeilen)
-- ----------------------------------------------------------------------------
grant select, insert, update, delete on
  public.school_images, public.school_vehicles, public.school_faq_items,
  public.school_opening_hours, public.school_jobs
to app_user;

reset role;

commit;
