-- ============================================================================
-- 0011_phase_e_whatsapp.sql — optionale WhatsApp-Kontaktnummer je Schule.
-- ----------------------------------------------------------------------------
-- Zusätzlich zur normalen Telefonnummer (school_profiles.telefon). Optional —
-- nicht jede Fahrschule bietet WhatsApp an. Erbt die RLS-Policies von
-- school_profiles (öffentlich lesbar nur bei gelisteter Schule).
-- ============================================================================

begin;

grant app_owner to current_user;
set role app_owner;

alter table public.school_profiles add column if not exists whatsapp text;

reset role;

commit;
