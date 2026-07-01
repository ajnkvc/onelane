-- 0017_elevated_audit_hardening.sql
-- Phase-0 Re-Audit (Block 4): Elevated-/Audit-Modell härten.
--
-- F-012/F-013: security_events bekommt einen verifizierten Initiator (initiator_type) und eine
--   Korrelations-ID (correlation_id), damit der erhöhte Pfad attempt/success/failure DAUERHAFT
--   und zurechenbar protokollieren kann (Code: src/server/dal/elevated.ts schreibt diese Felder;
--   das durable attempt/failure-Audit läuft dort in EIGENEN Transaktionen außerhalb des Rollbacks).
--
-- F-038: Import-/Fetch-Audit-Tabellen gegen Manipulation/Löschen härten — aber DIFFERENZIERT,
--   damit legitime Lifecycle-Übergänge erhalten bleiben:
--     * append-only (UPDATE/DELETE/TRUNCATE blockiert) — reine Belege/Logs, nur INSERT:
--         dedupe_decision, import_fetch_log
--     * no-erase (nur DELETE/TRUNCATE blockiert, UPDATE für Status-Lifecycle erlaubt):
--         import_run (status running→completed/…), import_exclusion (active-Toggle)
--   BEWUSST NICHT gehärtet (das Tooling löscht/überschreibt sie regulär; reine Arbeits-/
--   Aktualzustands-Tabellen, keine Historie): field_provenance + import_review_queue
--   (review-server.mjs/verify.mjs löschen darin), import_staging (Arbeitsdaten).
--   Eine echte append-only Historie für Provenienz/Review erfordert einen Tooling-Umbau
--   (delete+reinsert → Verlaufstabelle) und ist als Folgeschritt (mit F-018) vermerkt.
--
-- Owner-Pfad: Trigger feuern für JEDE Rolle (auch app_owner/Tooling). Grenze wie 0014:
-- ein DB-Superuser könnte Trigger via DDL/session_replication_role umgehen — auditierbarer
-- Eingriff, kein stilles UPDATE. Voll manipulationssicher erst mit externem WORM-Sink (Phase 2).

begin;
grant app_owner to current_user;
set role app_owner;

-- ----------------------------------------------------------------------------
-- F-012/F-013: security_events erweitern (DB-seitig, indizierbar).
-- ----------------------------------------------------------------------------
alter table public.security_events
  add column if not exists initiator_type text,
  add column if not exists correlation_id uuid;

-- initiator_type: technisches Token (lowercase snake_case, 2..64) ODER NULL.
alter table public.security_events drop constraint if exists chk_security_events_initiator_type;
alter table public.security_events add constraint chk_security_events_initiator_type
  check (initiator_type is null or initiator_type ~ '^[a-z][a-z0-9_]{1,63}$');

create index if not exists idx_security_events_correlation
  on public.security_events (correlation_id);

-- ----------------------------------------------------------------------------
-- F-038: generische Schutz-Trigger-Funktionen.
-- ----------------------------------------------------------------------------
-- (a) append-only: blockt UPDATE/DELETE/TRUNCATE (reine Belege/Logs).
create or replace function app.tg_audit_append_only() returns trigger
language plpgsql
set search_path = pg_catalog, pg_temp
as $fn$
begin
  raise exception '% ist append-only: % nicht erlaubt (Beleg unveraenderlich)', tg_table_name, tg_op
    using errcode = '42501';
end
$fn$;

-- (b) no-erase: blockt nur DELETE/TRUNCATE; UPDATE (Status-Lifecycle) bleibt erlaubt.
create or replace function app.tg_audit_no_erase() returns trigger
language plpgsql
set search_path = pg_catalog, pg_temp
as $fn$
begin
  raise exception '% ist nicht loeschbar: % nicht erlaubt (Beleg-/Historienpflicht)', tg_table_name, tg_op
    using errcode = '42501';
end
$fn$;

-- append-only: dedupe_decision (Entscheidungs-Log, nur INSERT).
drop trigger if exists tg_dedupe_decision_no_update on public.dedupe_decision;
drop trigger if exists tg_dedupe_decision_no_delete on public.dedupe_decision;
drop trigger if exists tg_dedupe_decision_no_truncate on public.dedupe_decision;
create trigger tg_dedupe_decision_no_update before update on public.dedupe_decision
  for each row execute function app.tg_audit_append_only();
create trigger tg_dedupe_decision_no_delete before delete on public.dedupe_decision
  for each row execute function app.tg_audit_append_only();
create trigger tg_dedupe_decision_no_truncate before truncate on public.dedupe_decision
  for each statement execute function app.tg_audit_append_only();

-- append-only: import_fetch_log (Fetch-/robots-Log, nur INSERT).
drop trigger if exists tg_import_fetch_log_no_update on public.import_fetch_log;
drop trigger if exists tg_import_fetch_log_no_delete on public.import_fetch_log;
drop trigger if exists tg_import_fetch_log_no_truncate on public.import_fetch_log;
create trigger tg_import_fetch_log_no_update before update on public.import_fetch_log
  for each row execute function app.tg_audit_append_only();
create trigger tg_import_fetch_log_no_delete before delete on public.import_fetch_log
  for each row execute function app.tg_audit_append_only();
create trigger tg_import_fetch_log_no_truncate before truncate on public.import_fetch_log
  for each statement execute function app.tg_audit_append_only();

-- no-erase: import_run (Lauf-Protokoll; status-UPDATE erlaubt, kein Löschen).
drop trigger if exists tg_import_run_no_delete on public.import_run;
drop trigger if exists tg_import_run_no_truncate on public.import_run;
create trigger tg_import_run_no_delete before delete on public.import_run
  for each row execute function app.tg_audit_no_erase();
create trigger tg_import_run_no_truncate before truncate on public.import_run
  for each statement execute function app.tg_audit_no_erase();

-- no-erase: import_exclusion (Sperren/Takedown/legal_hold; active-Toggle erlaubt, kein Löschen).
drop trigger if exists tg_import_exclusion_no_delete on public.import_exclusion;
drop trigger if exists tg_import_exclusion_no_truncate on public.import_exclusion;
create trigger tg_import_exclusion_no_delete before delete on public.import_exclusion
  for each row execute function app.tg_audit_no_erase();
create trigger tg_import_exclusion_no_truncate before truncate on public.import_exclusion
  for each statement execute function app.tg_audit_no_erase();

-- ----------------------------------------------------------------------------
-- Fail-closed Validierung: Spalten + Trigger vorhanden.
-- ----------------------------------------------------------------------------
do $$
declare
  v record;
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema='public' and table_name='security_events'
                    and column_name='initiator_type') then
    raise exception '0017: security_events.initiator_type fehlt';
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema='public' and table_name='security_events'
                    and column_name='correlation_id') then
    raise exception '0017: security_events.correlation_id fehlt';
  end if;

  for v in
    select * from (values
      ('dedupe_decision', 'tg_dedupe_decision_no_delete'),
      ('dedupe_decision', 'tg_dedupe_decision_no_update'),
      ('import_fetch_log', 'tg_import_fetch_log_no_delete'),
      ('import_run', 'tg_import_run_no_delete'),
      ('import_exclusion', 'tg_import_exclusion_no_delete')
    ) as expected(table_name, trigger_name)
  loop
    if not exists (
      select 1 from pg_trigger t
        join pg_class c on c.oid = t.tgrelid
        join pg_namespace n on n.oid = c.relnamespace
       where n.nspname='public' and c.relname=v.table_name
         and t.tgname=v.trigger_name and not t.tgisinternal
    ) then
      raise exception '0017: Trigger % auf %.% fehlt', v.trigger_name, 'public', v.table_name;
    end if;
  end loop;
end
$$;

reset role;
commit;
