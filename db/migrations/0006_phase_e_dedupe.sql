-- ============================================================================
-- 0006_phase_e_dedupe.sql — Duplikat-Erkennung & -Markierung.
-- ----------------------------------------------------------------------------
-- Mehrschichtiges Dedupe-System (siehe DEVLOG 008f):
--   * cluster_key  = land|plz|normName(name)         → BREITER Verdacht (Filiale ODER Dupe), für Review-Gruppierung.
--   * dedupe_key   = land|plz|normName(name)|normName(strasse) → STRIKTE Identität, für späteren Unique-Riegel.
--   * is_duplicate / duplicate_of → weiche Markierung (Zeile bleibt, wiederherstellbar; zeigt auf Behalten-Eintrag).
--   * dedupe_checked → vom Menschen geprüft („verschieden/Filialen") → nicht erneut als Verdacht zeigen.
-- Beide Keys werden von der App (normalize.mjs) gesetzt; SQL kann normName nicht spiegeln.
-- Der UNIQUE-Riegel auf dedupe_key kommt in einer späteren Migration NACH der ersten Bereinigung
-- (sonst scheitert er an bereits vorhandenen Duplikaten).
-- Keine neue RLS nötig: Spalten erben die Policies von driving_schools.
-- ============================================================================

begin;

grant app_owner to current_user;
set role app_owner;

alter table public.driving_schools
  add column if not exists dedupe_key text,
  add column if not exists cluster_key text,
  add column if not exists is_duplicate boolean not null default false,
  add column if not exists duplicate_of uuid references public.driving_schools(id) on delete set null,
  add column if not exists dedupe_checked boolean not null default false;

-- schnelle Lookups (Verdachts-Cluster bzw. strikte Identität), Duplikate ausgenommen
create index if not exists idx_driving_schools_cluster_key on public.driving_schools (cluster_key) where not is_duplicate;
create index if not exists idx_driving_schools_dedupe_key  on public.driving_schools (dedupe_key)  where not is_duplicate;

reset role;

commit;
