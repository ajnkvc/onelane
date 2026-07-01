-- ============================================================================
-- 0007_phase_e_review_fields.sql — Zusatzfelder fürs manuelle Review.
-- ----------------------------------------------------------------------------
-- Führerscheinklassen + Preise existieren bereits auf school_profiles
-- (fuehrerscheinklassen text[], preise jsonb) — werden weitergenutzt.
-- Neu nur:
--   * review_notiz — internes Freitext-Notizfeld (NICHT für öffentliche Anzeige gedacht).
--   * maps_url      — optionaler exakter Google-Maps-Ortslink (Zeiger für spätere
--     Bewertungs-Anbindung via offizieller API; place_id holen wir später automatisch).
-- Beide erben die bestehenden RLS-Policies von driving_schools.
-- ============================================================================

begin;

grant app_owner to current_user;
set role app_owner;

alter table public.driving_schools
  add column if not exists review_notiz text,
  add column if not exists maps_url text;

reset role;

commit;
