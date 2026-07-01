-- ============================================================================
-- 0009_phase_e_kundennummer_pro_kunde.sql
-- ----------------------------------------------------------------------------
-- Korrektur des Kundennummern-Modells: Die Kundennummer gehört dem KUNDEN
-- (= Gruppe/Brand bzw. Einzelschule), NICHT dem einzelnen Standort.
--   * school_brands.kundennummer — Nummer der Gruppe (alle Standorte teilen sie).
--   * driving_schools.kundennummer — Nummer der EINZELschule (ohne Brand).
--   * Gruppierte Standorte: eigene kundennummer = NULL (sie nutzen die der Brand).
-- Anzeige je Standort = <Kundennummer>-<Standort-Index> (Haupt = 1, dann 2,3…),
-- Index wird live berechnet (kein Speicher nötig). SaaS-Abrechnung: Standorte je
-- Kunde = COUNT der Schulen mit dieser Brand (+ pro Fahrlehrer).
-- Dieselbe Sequenz wie 0008 (driving_schools_kundennummer_seq) — keine Kollisionen.
-- ============================================================================

begin;

grant app_owner to current_user;
set role app_owner;

alter table public.school_brands add column if not exists kundennummer bigint;

-- jede bestehende Brand bekommt eine Kundennummer (Fortsetzung der Sequenz)
update public.school_brands set kundennummer = nextval('public.driving_schools_kundennummer_seq')
  where kundennummer is null;
create unique index if not exists uq_school_brands_kundennummer on public.school_brands (kundennummer);

-- gruppierte Standorte haben KEINE eigene Kundennummer mehr (nutzen die der Brand)
update public.driving_schools set kundennummer = null where brand_id is not null;

-- App vergibt Kundennummern künftig gezielt (Einzelschule = eigene; Standort = keine)
alter table public.driving_schools alter column kundennummer drop default;

reset role;

commit;
