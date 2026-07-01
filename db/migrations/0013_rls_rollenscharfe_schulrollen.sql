-- ============================================================================
-- 0013_rls_rollenscharfe_schulrollen.sql — rollenscharfe RLS für Schulrollen.
-- ----------------------------------------------------------------------------
-- Schließt die bestätigte Lücke, dass JEDES Schulmitglied (inkl. `fahrlehrer`)
-- enrollments SCHREIBEN sowie Profile/Instructors/Unterseiten ändern und alle
-- invoices der Schule LESEN konnte (Policies nutzten rollen-agnostisch
-- `app.is_member_of_school`).
--
-- BEWUSST UNVERÄNDERT (Geschäftsbedarf): Jedes Schulmitglied — auch `fahrlehrer`
-- — LIEST weiterhin ALLE enrollments/appointments der Schule (Quer-Routing bei
-- Engpässen). Eine je-Fahrlehrer konfigurierbare Einschränkung („nur zugewiesene")
-- kommt als eigener Folge-Schritt (Flag + bedingte Policy). Spalten-Minimierung
-- sensibler Felder (Mandat/Zahlung) für Fahrlehrer folgt per Sicht/DAL.
--
-- NEU (rollenscharf):
--   * enrollments SCHREIBEN nur Verwaltung (inhaber/verwaltung) + admin;
--     Self-Insert nur für echte Schüler (account_typ='student').
--   * invoices LESEN nur Student (eigene) / Verwaltung / admin / support
--     — KEIN fahrlehrer-Zugriff auf Finanzdaten.
--   * Schreiben an school_profiles/instructors/school_images/vehicles/faq/
--     opening_hours/jobs nur Verwaltung + admin.
--   * Trigger tg_enrollments_student_guard: fahrlehrer NICHT mehr privilegiert;
--     Schüler-Self-Insert nur mit account_typ='student'.
-- Erbt das Betriebsmodell der bestehenden Migrationen (app_owner-Pfad, DEFINER).
-- ============================================================================

begin;

grant app_owner to current_user;
set role app_owner;

-- ----------------------------------------------------------------------------
-- 1) Neuer Helfer: Verwaltungs-Rolle (inhaber ODER verwaltung), fail-closed
-- ----------------------------------------------------------------------------
create function app.is_school_manager(p_school uuid) returns boolean
language sql stable security definer
set search_path = pg_catalog, pg_temp
as $fn$
  select app.user_has_school_role(app.current_user_id(), p_school, 'inhaber')
      or app.user_has_school_role(app.current_user_id(), p_school, 'verwaltung');
$fn$;

revoke all on function app.is_school_manager(uuid) from public;
grant execute on function app.is_school_manager(uuid) to app_user;

-- ----------------------------------------------------------------------------
-- 2) enrollments: SCHREIBEN nur Verwaltung; Self-Insert nur echte Schüler
--    (Lesen bleibt mitglied-weit, unverändert aus 0000)
-- ----------------------------------------------------------------------------
drop policy if exists enrollments_student_insert on public.enrollments;
create policy enrollments_student_insert on public.enrollments for insert to app_user
  with check ((student_user_id = app.current_user_id() and app.current_account_type() = 'student')
              or app.is_school_manager(school_id)
              or app.has_platform_role('admin'));

drop policy if exists enrollments_update on public.enrollments;
create policy enrollments_update on public.enrollments for update to app_user
  using (app.is_school_manager(school_id) or app.has_platform_role('admin'))
  with check (app.is_school_manager(school_id) or app.has_platform_role('admin'));

-- ----------------------------------------------------------------------------
-- 3) invoices: KEIN fahrlehrer-Zugriff (Finanzdaten) — nur Student/Verwaltung
-- ----------------------------------------------------------------------------
drop policy if exists invoices_select on public.invoices;
create policy invoices_select on public.invoices for select to app_user
  using (exists (select 1 from public.enrollments e
                 where e.id = enrollment_id
                   and (e.student_user_id = app.current_user_id()
                        or app.is_school_manager(e.school_id)))
         or app.has_platform_role('admin')
         or app.has_platform_role('support'));

-- ----------------------------------------------------------------------------
-- 4) Schreib-Verengung auf Verwaltung: school_profiles, instructors + 0001-Untertabellen
-- ----------------------------------------------------------------------------
drop policy if exists school_profiles_write on public.school_profiles;
create policy school_profiles_write on public.school_profiles for all to app_user
  using (app.is_school_manager(school_id) or app.has_platform_role('admin'))
  with check (app.is_school_manager(school_id) or app.has_platform_role('admin'));

drop policy if exists instructors_write on public.instructors;
create policy instructors_write on public.instructors for all to app_user
  using (app.is_school_manager(school_id) or app.has_platform_role('admin'))
  with check (app.is_school_manager(school_id) or app.has_platform_role('admin'));

drop policy if exists school_images_write on public.school_images;
create policy school_images_write on public.school_images for all to app_user
  using (app.is_school_manager(school_id) or app.has_platform_role('admin'))
  with check (app.is_school_manager(school_id) or app.has_platform_role('admin'));

drop policy if exists school_vehicles_write on public.school_vehicles;
create policy school_vehicles_write on public.school_vehicles for all to app_user
  using (app.is_school_manager(school_id) or app.has_platform_role('admin'))
  with check (app.is_school_manager(school_id) or app.has_platform_role('admin'));

drop policy if exists school_faq_items_write on public.school_faq_items;
create policy school_faq_items_write on public.school_faq_items for all to app_user
  using (app.is_school_manager(school_id) or app.has_platform_role('admin'))
  with check (app.is_school_manager(school_id) or app.has_platform_role('admin'));

drop policy if exists school_opening_hours_write on public.school_opening_hours;
create policy school_opening_hours_write on public.school_opening_hours for all to app_user
  using (app.is_school_manager(school_id) or app.has_platform_role('admin'))
  with check (app.is_school_manager(school_id) or app.has_platform_role('admin'));

drop policy if exists school_jobs_write on public.school_jobs;
create policy school_jobs_write on public.school_jobs for all to app_user
  using (app.is_school_manager(school_id) or app.has_platform_role('admin'))
  with check (app.is_school_manager(school_id) or app.has_platform_role('admin'));

-- ----------------------------------------------------------------------------
-- 5) Trigger: fahrlehrer NICHT mehr privilegiert; Self-Insert nur echte Schüler
-- ----------------------------------------------------------------------------
create or replace function app.tg_enrollments_student_guard() returns trigger
language plpgsql security definer
set search_path = pg_catalog, pg_temp
as $fn$
declare
  is_privileged boolean;
begin
  is_privileged := app.current_user_id() is null
    or app.has_platform_role('admin')
    or app.is_school_manager(new.school_id);
  if is_privileged then
    return new;
  end if;
  -- Schüler-Kontext: nur echte Schüler dürfen sich selbst anlegen.
  if app.current_account_type() is distinct from 'student' then
    raise exception 'enrollments: nur Schüler oder die Verwaltung dürfen Enrollments anlegen';
  end if;
  if new.student_user_id <> app.current_user_id() then
    raise exception 'enrollments: student_user_id muss der angemeldete Nutzer sein';
  end if;
  if tg_op = 'UPDATE' then
    raise exception 'enrollments: Schüler dürfen Enrollments nicht selbst ändern';
  end if;
  if new.status <> 'pending' then
    raise exception 'enrollments: Schüler dürfen nur Status pending anlegen';
  end if;
  if new.vertragsabschluss_datum is not null
     or new.stripe_customer_ref is not null
     or new.sepa_mandat_ref is not null then
    raise exception 'enrollments: Vertrags-/Zahlungsfelder dürfen Schüler nicht setzen';
  end if;
  return new;
end
$fn$;

reset role;

commit;
