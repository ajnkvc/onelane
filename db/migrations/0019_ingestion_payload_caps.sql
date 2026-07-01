-- 0019_ingestion_payload_caps.sql
-- Phase-0 Re-Audit (Block 8, F-039): Größen-Caps auf unbegrenzte jsonb-Payloads der Ingestion.
-- Ohne Cap könnten (fehlerhafte/böswillige) Importe sehr große Blobs oder ganze PII-Dumps in
-- staging/review/dedupe konservieren (DoS-/Datenschutz-Risiko). Großzügige, aber endliche Grenzen.

begin;
grant app_owner to current_user;
set role app_owner;

-- octet_length (BYTES, nicht Zeichen) → die KB-Grenzen gelten auch bei Multibyte-Payloads strikt.
alter table public.import_staging drop constraint if exists chk_import_staging_raw_size;
alter table public.import_staging add constraint chk_import_staging_raw_size
  check (raw is null or octet_length(raw::text) <= 262144);        -- 256 KB Rohdaten

alter table public.import_staging drop constraint if exists chk_import_staging_normalized_size;
alter table public.import_staging add constraint chk_import_staging_normalized_size
  check (normalized is null or octet_length(normalized::text) <= 65536);  -- 64 KB

alter table public.import_review_queue drop constraint if exists chk_review_queue_proposed_size;
alter table public.import_review_queue add constraint chk_review_queue_proposed_size
  check (proposed is null or octet_length(proposed::text) <= 65536);

alter table public.import_review_queue drop constraint if exists chk_review_queue_existing_size;
alter table public.import_review_queue add constraint chk_review_queue_existing_size
  check (existing is null or octet_length(existing::text) <= 65536);

alter table public.dedupe_decision drop constraint if exists chk_dedupe_match_factors_size;
alter table public.dedupe_decision add constraint chk_dedupe_match_factors_size
  check (match_factors is null or octet_length(match_factors::text) <= 16384);

-- Fail-closed: Constraints müssen existieren.
do $$
declare
  v record;
begin
  for v in
    select * from (values
      ('import_staging', 'chk_import_staging_raw_size'),
      ('import_staging', 'chk_import_staging_normalized_size'),
      ('import_review_queue', 'chk_review_queue_proposed_size'),
      ('import_review_queue', 'chk_review_queue_existing_size'),
      ('dedupe_decision', 'chk_dedupe_match_factors_size')
    ) as expected(table_name, constraint_name)
  loop
    if not exists (
      select 1 from pg_constraint c
        join pg_class t on t.oid = c.conrelid
        join pg_namespace n on n.oid = t.relnamespace
       where n.nspname = 'public' and t.relname = v.table_name and c.conname = v.constraint_name
    ) then
      raise exception '0019: CHECK % auf %.% fehlt', v.constraint_name, 'public', v.table_name;
    end if;
  end loop;
end
$$;

reset role;
commit;
