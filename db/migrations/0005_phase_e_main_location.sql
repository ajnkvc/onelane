-- ============================================================================
-- 0005_phase_e_main_location.sql — Hauptniederlassung je Gruppe/Brand.
-- ----------------------------------------------------------------------------
-- Fachlich: Eine Fahrschul-Gruppe (school_brands) hat genau EINEN Hauptstandort
-- (Zentrale). `is_main_location` markiert diesen Standort. Öffentliche IA:
--   /{stadt}/{schule}            = Gruppen-/Zentral-Seite (Hauptstandort)
--   /{stadt}/{schule}/{filiale}  = einzelne Standorte
-- Standorte bleiben getrennte driving_schools-Zeilen (eigene Fahrlehrer/Fahrzeuge),
-- gruppiert über brand_id (vgl. 0002/0004).
--
-- Keine neue RLS nötig: die Spalte erbt die bestehenden Policies von
-- driving_schools (öffentlich lesbar nur is_listed; Schreiben admin-only).
-- ============================================================================

begin;

grant app_owner to current_user;
set role app_owner;

alter table public.driving_schools
  add column if not exists is_main_location boolean not null default false;

-- Höchstens EIN Hauptstandort pro Brand/Gruppe (Standorte ohne Brand ausgenommen).
create unique index if not exists uq_driving_schools_main_per_brand
  on public.driving_schools (brand_id)
  where is_main_location and brand_id is not null;

reset role;

commit;
