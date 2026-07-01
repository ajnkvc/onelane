-- ============================================================================
-- 0003_phase_e_slug_null_guard.sql — Phase E (008b): Defense-in-Depth für den
-- Slug-Sonderfall `ort IS NULL`.
-- ----------------------------------------------------------------------------
-- Der bestehende Unique-Index `(land, ort, slug)` (0000) schützt NULL-Orte NICHT,
-- weil PostgreSQL NULL in Unique-Indizes nicht als gleich behandelt. Der OSM-Import
-- materialisiert ort-lose Kandidaten zwar bewusst NICHT (→ Review), aber dieser
-- partielle Index schließt das Loch zusätzlich DB-seitig.
--
-- Klein + nicht-invasiv: lässt `(land, ort, slug)` für normale Orte unberührt.
-- Schlägt fehl, falls bereits doppelte `(land, NULL, slug)`-Zeilen existieren
-- (in der aktuellen Seed-/Testbasis nicht der Fall) — bewusst KEINE Datenbereinigung.
-- ============================================================================

begin;

grant app_owner to current_user;
set role app_owner;

create unique index uq_driving_schools_slug_null_ort
  on public.driving_schools (land, slug)
  where ort is null;

reset role;

commit;
