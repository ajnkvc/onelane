-- 0026_portal_lead_wunsch_fahrlehrer.sql
-- Leads: optionaler Wunsch-Fahrlehrer (Gründer 2026-07-02) — Interessent:innen
-- dürfen im Anfrage-Funnel per Auswahl eine Fahrlehrer:in der Ziel-Schule als
-- Wunsch angeben.
--
-- Sicherheitsmodell (0022-Linie unverändert eng):
--   * Optionales Feld — WITH CHECK der Insert-Policy bleibt unberührt.
--   * Der App-Pfad validiert den Wert VOR dem Insert gegen instructors_public
--     der Ziel-Schule (nur aktive, öffentlich sichtbare Namen) — freier Text
--     erreicht die Spalte nicht; DB-seitig zusätzlich Byte-Cap (0019-Muster).
--   * Spalten-Grants ADDITIV erweitert (INSERT für den anonymen Schreibpfad,
--     SELECT für Schul-Manager/admin gemäß bestehender SELECT-Policies).
--
-- PG16+. Idempotent. Abschließende fail-closed Assertion.

begin;

grant app_owner to current_user;
set role app_owner;

alter table public.leads add column if not exists wunsch_fahrlehrer text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'leads_wunsch_fahrlehrer_cap'
      and conrelid = 'public.leads'::regclass
  ) then
    alter table public.leads
      add constraint leads_wunsch_fahrlehrer_cap
      check (wunsch_fahrlehrer is null or octet_length(wunsch_fahrlehrer) between 1 and 200);
  end if;
end $$;

grant insert (wunsch_fahrlehrer) on table public.leads to app_user;
grant select (wunsch_fahrlehrer) on table public.leads to app_user;

-- fail-closed: Spalte + Cap + Grants müssen existieren.
do $$
declare
  n int;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'leads' and column_name = 'wunsch_fahrlehrer'
  ) then
    raise exception '0026: Spalte leads.wunsch_fahrlehrer fehlt.';
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'leads_wunsch_fahrlehrer_cap' and conrelid = 'public.leads'::regclass
  ) then
    raise exception '0026: Byte-Cap-Constraint fehlt.';
  end if;
  select count(distinct privilege_type) into n from information_schema.column_privileges
  where table_schema = 'public' and table_name = 'leads'
    and column_name = 'wunsch_fahrlehrer' and grantee = 'app_user'
    and privilege_type in ('INSERT', 'SELECT');
  if n < 2 then
    raise exception '0026: Spalten-Grants für wunsch_fahrlehrer unvollständig (%).', n;
  end if;
end $$;

reset role;
commit;
