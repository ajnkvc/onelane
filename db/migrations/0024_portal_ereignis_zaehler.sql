-- 0024_portal_ereignis_zaehler.sql
-- Portal-Ausbau: aggregierte Ereignis-Zähler je Fahrschule (zunächst Telefon-Klicks).
--
-- ZWECK (Strategie): belegbare Vermittlungs-Zahlen je Schule („so viele Interessenten
-- kamen über onelane") als B2B-Grundlage — Analytics-Leitplanke bleibt strikt:
-- first-party, cookieless, KEINE Besucher-PII, keine Roh-IP, nur Aggregat
-- school_id × ereignis_typ × Tag.
--
-- Sicherheitsmodell (bewusst noch enger als leads/0022):
--   * Die Tabelle hat für app_user KEINERLEI Schreib-Grants und keine
--     INSERT/UPDATE-Policies. Der EINZIGE Schreibweg ist die SECURITY-DEFINER-
--     Funktion app.zaehle_ereignis(slug, typ): validiert Typ-Whitelist und
--     dass die Schule GELISTET ist, löst den Slug selbst auf (keine UUID-
--     Enumeration von außen) und macht ein Upsert +1. Aufruf im App-Pfad über
--     withPublicSubmissionContext (withAnonContext ist read-only — Writes
--     scheitern dort hart, auch in DEFINER-Funktionen).
--   * SELECT nur für Schul-Manager der eigenen Schule + admin (Policy) —
--     anonyme Besucher können Zählerstände NICHT lesen.
--   * DoS-/Wachstums-Deckel: Funktion zählt still NICHT weiter, wenn der
--     Tageszähler ein hartes Cap erreicht (Schutz gegen Klick-Fluten; App-seitig
--     kommt zusätzlich Rate-Limiting an der Route).
--
-- PG16+. Idempotent. Abschließende fail-closed Assertions.

begin;

grant app_owner to current_user;
set role app_owner;

create table if not exists public.ereignis_zaehler (
  id uuid primary key default gen_random_uuid(),
  -- CASCADE ok: reine Aggregat-Zahlen ohne PII — hängen an der Schule.
  school_id uuid not null references public.driving_schools(id) on delete cascade,
  ereignis_typ text not null,
  tag date not null default current_date,
  anzahl integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint uq_ereignis_zaehler unique (school_id, ereignis_typ, tag)
);

alter table public.ereignis_zaehler drop constraint if exists chk_ereignis_typ;
alter table public.ereignis_zaehler add constraint chk_ereignis_typ
  check (ereignis_typ in ('tel_klick'));

alter table public.ereignis_zaehler drop constraint if exists chk_ereignis_anzahl;
alter table public.ereignis_zaehler add constraint chk_ereignis_anzahl
  check (anzahl >= 0 and anzahl <= 100000);

create index if not exists idx_ereignis_zaehler_school
  on public.ereignis_zaehler (school_id, tag desc);

drop trigger if exists tg_ereignis_zaehler_updated_at on public.ereignis_zaehler;
create trigger tg_ereignis_zaehler_updated_at before update on public.ereignis_zaehler
  for each row execute function app.tg_set_updated_at();

-- ----------------------------------------------------------------------------
-- Einziger Schreibweg: SECURITY-DEFINER-Upsert mit Slug-Auflösung + Gates.
-- Gibt true zurück, wenn gezählt wurde (Schule gelistet, Cap nicht erreicht).
-- ----------------------------------------------------------------------------
create or replace function app.zaehle_ereignis(p_slug text, p_typ text)
returns boolean
language plpgsql volatile security definer
set search_path = pg_catalog, pg_temp
as $fn$
declare
  v_school uuid;
  v_cap constant integer := 5000; -- harter Tages-Deckel je Schule/Typ
begin
  -- Typ-Whitelist fail-closed (unabhängig vom CHECK, klare Fehlermeldungs-Hygiene).
  if p_typ is null or p_typ not in ('tel_klick') then
    return false;
  end if;
  if p_slug is null or length(p_slug) > 200 then
    return false;
  end if;

  select ds.id into v_school
    from public.driving_schools ds
   where ds.slug = p_slug and ds.is_listed = true
   limit 1;
  if v_school is null then
    return false;
  end if;

  insert into public.ereignis_zaehler as ez (school_id, ereignis_typ, tag, anzahl)
       values (v_school, p_typ, current_date, 1)
  on conflict on constraint uq_ereignis_zaehler
  do update set anzahl = ez.anzahl + 1
        where ez.anzahl < v_cap;

  return true;
end
$fn$;

revoke all on function app.zaehle_ereignis(text, text) from public;
grant execute on function app.zaehle_ereignis(text, text) to app_user;

-- ----------------------------------------------------------------------------
-- RLS: deny-by-default; NUR eine SELECT-Policy (Manager der Schule + admin).
-- Keine INSERT/UPDATE/DELETE-Policies und keine Schreib-Grants für app_user.
-- ----------------------------------------------------------------------------
alter table public.ereignis_zaehler enable row level security;

drop policy if exists ereignis_zaehler_select on public.ereignis_zaehler;
create policy ereignis_zaehler_select on public.ereignis_zaehler for select to app_user
  using (app.is_school_manager(school_id) or app.has_platform_role('admin'));

revoke all on table public.ereignis_zaehler from app_user;
grant select (id, school_id, ereignis_typ, tag, anzahl, updated_at)
  on table public.ereignis_zaehler to app_user;

-- ----------------------------------------------------------------------------
-- Fail-closed Assertions.
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = 'ereignis_zaehler' and c.relrowsecurity
  ) then
    raise exception '0024: RLS auf public.ereignis_zaehler ist nicht aktiviert';
  end if;

  if (select relowner::regrole::text from pg_class where oid = 'public.ereignis_zaehler'::regclass)
     is distinct from 'app_owner' then
    raise exception '0024: public.ereignis_zaehler gehoert nicht app_owner';
  end if;

  if not exists (
    select 1 from pg_policy p where p.polrelid = 'public.ereignis_zaehler'::regclass
      and p.polname = 'ereignis_zaehler_select' and p.polcmd = 'r'
  ) then
    raise exception '0024: SELECT-Policy fehlt';
  end if;

  if exists (
    select 1 from pg_policy p where p.polrelid = 'public.ereignis_zaehler'::regclass
      and p.polcmd in ('a','w','d')
  ) then
    raise exception '0024: unerwartete Schreib-Policy auf ereignis_zaehler';
  end if;

  if has_table_privilege('app_user', 'public.ereignis_zaehler', 'INSERT')
     or has_table_privilege('app_user', 'public.ereignis_zaehler', 'UPDATE')
     or has_table_privilege('app_user', 'public.ereignis_zaehler', 'DELETE') then
    raise exception '0024: app_user hat unerwartete Schreibrechte auf ereignis_zaehler';
  end if;

  if not has_function_privilege('app_user', 'app.zaehle_ereignis(text, text)', 'EXECUTE') then
    raise exception '0024: app_user muss app.zaehle_ereignis ausfuehren duerfen';
  end if;
end
$$;

reset role;

commit;
