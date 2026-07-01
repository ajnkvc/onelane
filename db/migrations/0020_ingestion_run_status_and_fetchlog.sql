-- 0020_ingestion_run_status_and_fetchlog.sql — Block 9 (Tooling/Ingestion-Härtung)
-- ============================================================================
-- F-045: import_run.status um 'completed_with_errors' erweitern, damit ein Lauf mit
--        Kandidatenfehlern nicht als sauberes 'completed' verschleiert wird (Runner
--        setzt zusätzlich Exit ≠ 0). 'failed' bleibt echten Abbrüchen vorbehalten.
-- F-080: import_fetch_log-Idempotenz greift bei NULL-Spalten (run_id/source_ref) nicht,
--        weil NULLs in einem UNIQUE-Index als verschieden gelten → Dubletten möglich.
--        Index mit NULLS NOT DISTINCT (PG15+; Laufzeit PG16/17) neu anlegen.
-- Rerun-idempotent (F-081): drop/add mit if (not) exists, Constraint-Rebuild deterministisch.
begin;

-- F-045 — Status-Wertebereich erweitern (Constraint-Name aus 0002 wiederverwenden).
alter table public.import_run drop constraint if exists import_run_status_check;
alter table public.import_run
  add constraint import_run_status_check
  check (status in ('running', 'completed', 'completed_with_errors', 'failed', 'aborted'));

-- F-080 — Fetch-Log-Idempotenz auch bei NULL run_id/source_ref.
drop index if exists uq_import_fetch_log_run_ref_url;
create unique index uq_import_fetch_log_run_ref_url
  on public.import_fetch_log (run_id, source_ref, url) nulls not distinct;

-- Fail-closed-Selbstprüfung (datenfrei: import_run ist no-erase/RLS → kein Probe-Insert/Delete).
do $$
begin
  if position('completed_with_errors' in coalesce(
       (select pg_get_constraintdef(oid) from pg_constraint where conname = 'import_run_status_check'), '')) = 0 then
    raise exception 'Migration 0020: import_run_status_check enthält completed_with_errors nicht.';
  end if;
  if not exists (
    select 1 from pg_index i join pg_class c on c.oid = i.indexrelid
    where c.relname = 'uq_import_fetch_log_run_ref_url' and i.indnullsnotdistinct) then
    raise exception 'Migration 0020: uq_import_fetch_log_run_ref_url fehlt oder ist nicht NULLS NOT DISTINCT.';
  end if;
end $$;

commit;
