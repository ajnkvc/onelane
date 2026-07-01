-- 0014_security_events_tamper_trigger.sql
-- Phase-0 #18: security_events ist append-only — jetzt AUCH gegen den elevated/app_owner-Pfad.
--
-- Bisher: Append-only beruhte ausschliesslich auf fehlenden UPDATE/DELETE-Grants fuer app_user
-- (Migration 0000, grant select,insert). Der Tooling-/System-Pfad (app_owner, Migrationen,
-- Wartungsjobs) unterliegt aber weder RLS noch Grant-Limit und koennte das Audit-Log lautlos
-- aendern/loeschen. Ein BEFORE UPDATE/DELETE/TRUNCATE-Trigger feuert fuer JEDE Rolle (auch den
-- Tabellen-Owner) und blockt jede Mutation auf DB-Ebene.
--
-- Grenze (ehrlich): Ein DB-Superuser koennte den Trigger via ALTER TABLE ... DISABLE TRIGGER
-- oder session_replication_role='replica' umgehen. Das ist jedoch ein auditierbarer DDL-/
-- Konfig-Eingriff (kein stilles UPDATE) und hebt die Manipulationshuerde erheblich. Voll
-- manipulationssicher erst mit externem, nur-anhaengendem WORM-Sink (Phase 2, SECURITY-KONZEPT).

begin;
grant app_owner to current_user;
set role app_owner;

-- Reine Verbots-Funktion: kein DB-Zugriff noetig -> kein SECURITY DEFINER.
-- ERRCODE 42501 (insufficient_privilege) = derselbe Fehlercode wie beim Grant-Pfad (app_user),
-- damit Clients "Mutation auf security_events verboten" einheitlich erkennen.
create function app.tg_security_events_no_mutate() returns trigger
language plpgsql
set search_path = pg_catalog, pg_temp
as $fn$
begin
  raise exception 'security_events ist append-only: % ist nicht erlaubt (Audit-Log unveraenderlich)', tg_op
    using errcode = '42501';
end
$fn$;

create trigger tg_security_events_no_update
  before update on public.security_events
  for each row execute function app.tg_security_events_no_mutate();

create trigger tg_security_events_no_delete
  before delete on public.security_events
  for each row execute function app.tg_security_events_no_mutate();

create trigger tg_security_events_no_truncate
  before truncate on public.security_events
  for each statement execute function app.tg_security_events_no_mutate();

reset role;
commit;
