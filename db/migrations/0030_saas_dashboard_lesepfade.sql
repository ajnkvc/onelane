-- 0030_saas_dashboard_lesepfade.sql
-- OS-V1 P2 (Shell/Dashboards): zwei kleine, additive Lesepfade fuer die
-- rollenspezifischen Dashboards. KEINE neuen Tabellen, KEINE Kontrakt-Aenderung.
--
-- Inhalt:
--   1. instructor_availability: bisher deny-by-default (0000: RLS aktiv, keine
--      Policy — Feature "kommt mit Aktivierung"). Das Dashboard-Modul (P2) zeigt
--      "Fahrlehrer-Slots heute" fuer Schul-Rollen → enge SELECT-Policy:
--      Schulmitglieder lesen die Verfuegbarkeit der Fahrlehrer IHRER Schule
--      (alle drei Rollen — Gruender-Entscheid Quer-Routing wie appointments),
--      admin liest alles. KEIN support, KEIN student, KEIN public (interne
--      Betriebsdaten; oeffentliche Slot-Anzeigen kommen spaeter nur aggregiert).
--      Write-Grants (INSERT/UPDATE aus dem breiten 0000-Grant) werden fail-closed
--      entzogen — es gibt keine Write-Policies; Schreiben kommt mit dem
--      Kalender-Modul (P3) samt eigener Migration.
--   2. app.own_instructor_ids(): SECURITY-DEFINER-Helfer, der die instructors-
--      Zeilen des ANGEMELDETEN Nutzers liefert (user_id = current_user_id).
--      Hintergrund: instructors.user_id ist fuer app_user bewusst NICHT
--      selektierbar (0016-Spalten-Minimierung, instructors_public_select ist
--      teil-oeffentlich — ein user_id-Grant wuerde Nutzer-IDs leaken). Der
--      Fahrlehrer braucht aber "MEINE Termine" (appointments.instructor_id).
--      Der Helfer gibt NUR die eigenen instructor-IDs preis (keine fremden
--      user_ids, kein Parameter, kein Enumerationspfad) — Muster 0013/0016.
--
-- PG16+. Idempotent. Betriebsmodell wie Bestand (app_owner, Assertions).

begin;

grant app_owner to current_user;
set role app_owner;

-- ----------------------------------------------------------------------------
-- 1) instructor_availability: enge SELECT-Policy + fail-closed Write-Rueckbau
-- ----------------------------------------------------------------------------
drop policy if exists instructor_availability_select on public.instructor_availability;
create policy instructor_availability_select on public.instructor_availability
  for select to app_user
  using (exists (select 1 from public.instructors i
                 where i.id = instructor_id
                   and app.is_member_of_school(i.school_id))
         or app.has_platform_role('admin'));

-- 0000 vergab pauschal select/insert/update/delete; es gab und gibt KEINE
-- Write-Policies → Grants fail-closed zurueckbauen (0029-Linie). SELECT bleibt
-- als Spalten-Grant erhalten (alle Spalten sind fachlich noetig, kein Secret).
revoke insert, update, delete on table public.instructor_availability from app_user;
grant select (id, instructor_id, datum, wochentag, von, bis, ist_blockiert)
  on table public.instructor_availability to app_user;

-- ----------------------------------------------------------------------------
-- 2) app.own_instructor_ids() — eigene instructors-Zeilen ohne user_id-Grant
-- ----------------------------------------------------------------------------
create or replace function app.own_instructor_ids() returns setof uuid
language sql stable security definer
set search_path = pg_catalog, pg_temp
as $fn$
  select i.id from public.instructors i
   where i.user_id is not distinct from app.current_user_id()
     and i.user_id is not null;
$fn$;

revoke all on function app.own_instructor_ids() from public;
grant execute on function app.own_instructor_ids() to app_user;

-- ----------------------------------------------------------------------------
-- Abschluss-Assertions (fail-closed)
-- ----------------------------------------------------------------------------
do $$
declare
  v record;
begin
  -- Policy existiert und referenziert weder support noch student-Pfade.
  if not exists (
    select 1 from pg_policy p
     where p.polrelid = 'public.instructor_availability'::regclass
       and p.polname = 'instructor_availability_select'
  ) then
    raise exception '0030: instructor_availability_select fehlt';
  end if;
  if exists (
    select 1 from pg_policy p
     where p.polrelid = 'public.instructor_availability'::regclass
       and coalesce(pg_get_expr(p.polqual, p.polrelid), '') ~ 'support'
  ) then
    raise exception '0030: instructor_availability-Policy referenziert support';
  end if;
  -- Es gibt weiterhin KEINE Write-Policies (SELECT-only Feature-Stand P2).
  if exists (
    select 1 from pg_policy p
     where p.polrelid = 'public.instructor_availability'::regclass
       and p.polcmd <> 'r'
  ) then
    raise exception '0030: instructor_availability darf (noch) keine Write-Policies haben';
  end if;

  -- Write-Grants sind vollstaendig entzogen; SELECT-Spalten vorhanden.
  for v in
    select * from (values
      ('instructor_id', 'SELECT', true),
      ('von',           'SELECT', true),
      ('ist_blockiert', 'SELECT', true),
      ('instructor_id', 'INSERT', false),
      ('von',           'UPDATE', false)
    ) as expected(col, priv, erlaubt)
  loop
    if (exists (
          select 1 from information_schema.column_privileges
           where grantee = 'app_user' and table_schema = 'public'
             and table_name = 'instructor_availability'
             and column_name = v.col and privilege_type = v.priv
        )) is distinct from v.erlaubt then
      raise exception '0030: Spalten-Grant % % auf instructor_availability erwartet=%',
        v.priv, v.col, v.erlaubt;
    end if;
  end loop;
  if exists (
    select 1 from information_schema.table_privileges
     where grantee = 'app_user' and table_schema = 'public'
       and table_name = 'instructor_availability'
       and privilege_type in ('INSERT', 'UPDATE', 'DELETE')
  ) then
    raise exception '0030: instructor_availability traegt noch Write-Tabellen-Grants';
  end if;

  -- Definer-Helfer: Owner app_owner, Ausfuehrung nur app_user (nicht PUBLIC).
  if (select proowner::regrole::text from pg_proc
       where oid = 'app.own_instructor_ids()'::regprocedure) is distinct from 'app_owner' then
    raise exception '0030: app.own_instructor_ids gehoert nicht app_owner';
  end if;
  if exists (
    select 1 from information_schema.routine_privileges
     where routine_schema = 'app' and routine_name = 'own_instructor_ids'
       and grantee = 'PUBLIC'
  ) then
    raise exception '0030: app.own_instructor_ids darf nicht PUBLIC ausfuehrbar sein';
  end if;
end $$;

reset role;

commit;
