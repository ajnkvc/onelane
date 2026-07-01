-- ============================================================================
-- 0008_phase_e_kundennummer_preisstatus.sql
-- ----------------------------------------------------------------------------
--  * kundennummer — fortlaufende, stabile Nummer je Schule (Anzeige/Zuordnung im
--    Review; wird später die Kundennummer der Fahrschule). Bestand deterministisch
--    backfilled (Reihenfolge PLZ, Name), neue Zeilen via Sequenz.
--  * preise_verifiziert — Preise sind RECHERCHIERT und gelten als UNBESTÄTIGT
--    (ohne Gewähr), bis die Fahrschule sie selbst bestätigt (dann grünes Abzeichen).
--    Standardwert false; nur die Schule (Claim) setzt true — NICHT der Rechercheur.
-- Beide erben bestehende RLS-Policies.
-- ============================================================================

begin;

grant app_owner to current_user;
set role app_owner;

-- Kundennummer (fortlaufend, stabil)
create sequence if not exists public.driving_schools_kundennummer_seq;
alter table public.driving_schools add column if not exists kundennummer bigint;

with ordered as (
  select id, row_number() over (order by plz nulls last, name, id) as rn
  from public.driving_schools where kundennummer is null
)
update public.driving_schools ds set kundennummer = o.rn from ordered o where ds.id = o.id;

select setval('public.driving_schools_kundennummer_seq',
              coalesce((select max(kundennummer) from public.driving_schools), 0) + 1, false);
alter table public.driving_schools alter column kundennummer set default nextval('public.driving_schools_kundennummer_seq');
create unique index if not exists uq_driving_schools_kundennummer on public.driving_schools (kundennummer);

-- Preise-Bestätigungsstatus (default: unbestätigt/recherchiert)
alter table public.school_profiles add column if not exists preise_verifiziert boolean not null default false;

reset role;

commit;
