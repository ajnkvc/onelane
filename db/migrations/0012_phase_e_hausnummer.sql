-- ============================================================================
-- 0012_phase_e_hausnummer.sql — Hausnummer als eigenes Adressfeld.
-- ----------------------------------------------------------------------------
-- Bisher hielt `strasse` Straßenname + Hausnummer kombiniert. Für sauberes
-- Matching (B2B-/OSM-Abgleich) und spätere Adresslogik wird die Hausnummer als
-- eigenes Feld geführt. `strasse` bleibt bestehen und meint künftig den
-- Straßennamen; bestehende kombinierte Werte werden bei der manuellen
-- Review-/Re-Sourcing-Prüfung sauber getrennt (kein destruktives Auto-Parsen).
-- Erbt die RLS-Policies von driving_schools.
-- ============================================================================

begin;

grant app_owner to current_user;
set role app_owner;

alter table public.driving_schools add column if not exists hausnummer text;

reset role;

commit;
