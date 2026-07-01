-- ============================================================================
-- 0010_phase_e_theoriezeiten.sql — Theorie-Unterrichtszeiten je Wochentag.
-- ----------------------------------------------------------------------------
-- Büroöffnungszeiten nutzen das bestehende school_profiles.oeffnungszeiten (jsonb).
-- Theorie-Zeiten brauchen ein eigenes Feld: theoriezeiten jsonb, Form
--   { "Mo": "18:00–19:30", "Mi": "19:00–20:30", ... } (je Wochentag Zeiten).
-- Erbt RLS-Policies von school_profiles.
-- ============================================================================

begin;

grant app_owner to current_user;
set role app_owner;

alter table public.school_profiles add column if not exists theoriezeiten jsonb;
alter table public.school_profiles drop constraint if exists chk_school_profiles_theoriezeiten;
alter table public.school_profiles add constraint chk_school_profiles_theoriezeiten
  check (theoriezeiten is null or jsonb_typeof(theoriezeiten) = 'object');

reset role;

commit;
