-- 0016_policy_data_minimization.sql
-- Phase-0 Re-Audit (Block 3): Policy-/Datenminimierung, current-user Wrapper, Spalten-Allowlists.
-- Kritisch geprüft (Peer-Review) + gegen die echte App-Nutzung kalibriert.
--
-- Korrekturen ggü. Erstentwurf (Review):
--   * users wird NICHT spalten-gesperrt (Column-Grants gelten app_user-weit → würden auch Admins
--     email/telefon nehmen). F-008 für users löst die Row-Policy (Support raus), nicht ein column-revoke.
--   * driving_schools-Allowlist = exakt die Spalten, die die öffentlichen Read-Pfade nutzen
--     (queries.ts/search.ts/profile.ts) + hausnummer (atomares Adressfeld). Least-Privilege:
--     interne Provenienz-/Dedup-/Review-Spalten bleiben gesperrt; neue Spalten sind per Default
--     unsichtbar, bis ein Feature sie explizit braucht (dann Grant in dessen Migration).
--   * reviews/instructors-Allowlist = exakt die Spalten der security_invoker-Views
--     (reviews_public / instructors_public) → Views bleiben funktionsfähig, author_user_id/
--     enrollment_id/user_id bleiben gesperrt (De-Anonymisierungsschutz).
--
-- PG16+ (konsistent mit 0015). Idempotent. Abschließende fail-closed Assertions.

begin;

grant app_owner to current_user;
set role app_owner;

-- ----------------------------------------------------------------------------
-- F-037: Current-user-only Wrapper. Der arbitrary-user Helper bleibt für SECURITY-
-- DEFINER-Funktionen erhalten (app_owner als Owner darf ihn weiter ausführen), ist
-- aber für app_user NICHT mehr ausführbar → keine Rollenabfrage für fremde Nutzer.
-- ----------------------------------------------------------------------------
create or replace function app.current_user_has_school_role(p_school uuid, p_role text)
returns boolean
language sql stable security definer
set search_path = pg_catalog, pg_temp
as $fn$
  select app.user_has_school_role(app.current_user_id(), p_school, p_role);
$fn$;

create or replace function app.is_member_of_school(p_school uuid) returns boolean
language sql stable security definer
set search_path = pg_catalog, pg_temp
as $fn$
  select app.current_user_has_school_role(p_school, null);
$fn$;

create or replace function app.is_school_manager(p_school uuid) returns boolean
language sql stable security definer
set search_path = pg_catalog, pg_temp
as $fn$
  select app.current_user_has_school_role(p_school, 'inhaber')
      or app.current_user_has_school_role(p_school, 'verwaltung');
$fn$;

revoke all on function app.user_has_school_role(uuid, uuid, text) from public;
revoke execute on function app.user_has_school_role(uuid, uuid, text) from app_user;

revoke all on function app.current_user_has_school_role(uuid, text) from public;
revoke all on function app.is_member_of_school(uuid) from public;
revoke all on function app.is_school_manager(uuid) from public;

grant execute on function
  app.current_user_has_school_role(uuid, text),
  app.is_member_of_school(uuid),
  app.is_school_manager(uuid)
to app_user;

-- F-037: school_members_write nutzt den Wrapper statt eines direkten user_has_school_role-Aufrufs.
drop policy if exists school_members_write on public.school_members;
create policy school_members_write on public.school_members for all to app_user
  using (app.current_user_has_school_role(school_id, 'inhaber')
         or app.has_platform_role('admin'))
  with check (app.current_user_has_school_role(school_id, 'inhaber')
         or app.has_platform_role('admin'));

-- ----------------------------------------------------------------------------
-- F-004: school_billing — SELECT für admin/inhaber/verwaltung, WRITE admin-only.
-- stripe_account_ref (Auszahlungsziel) und abo_status (Tarif) sind die einzigen
-- pflegbaren Felder und beide integritätskritisch → kein Inhaber-Self-Write.
-- ----------------------------------------------------------------------------
drop policy if exists school_billing_access on public.school_billing;
drop policy if exists school_billing_select on public.school_billing;
drop policy if exists school_billing_insert on public.school_billing;
drop policy if exists school_billing_update on public.school_billing;
drop policy if exists school_billing_delete on public.school_billing;

create policy school_billing_select on public.school_billing for select to app_user
  using (app.has_platform_role('admin')
         or app.current_user_has_school_role(school_id, 'inhaber')
         or app.current_user_has_school_role(school_id, 'verwaltung'));

create policy school_billing_insert on public.school_billing for insert to app_user
  with check (app.has_platform_role('admin'));

create policy school_billing_update on public.school_billing for update to app_user
  using (app.has_platform_role('admin'))
  with check (app.has_platform_role('admin'));

create policy school_billing_delete on public.school_billing for delete to app_user
  using (app.has_platform_role('admin'));

-- Defense-in-depth: selbst falls je eine breitere Write-Policy entsteht, bleiben die
-- sensiblen Felder server-/admin-only (current_user_id() is null = erhöhter Server-Pfad).
create or replace function app.tg_school_billing_admin_fields_guard() returns trigger
language plpgsql security definer
set search_path = pg_catalog, pg_temp
as $fn$
begin
  if app.current_user_id() is null or app.has_platform_role('admin') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.stripe_account_ref is not null or new.abo_status is distinct from 'none' then
      raise exception 'school_billing: stripe_account_ref/abo_status sind server-/admin-only';
    end if;
  elsif tg_op = 'UPDATE' then
    if new.stripe_account_ref is distinct from old.stripe_account_ref
       or new.abo_status is distinct from old.abo_status then
      raise exception 'school_billing: stripe_account_ref/abo_status sind server-/admin-only';
    end if;
  end if;

  return new;
end
$fn$;

drop trigger if exists tg_school_billing_admin_fields_guard on public.school_billing;
create trigger tg_school_billing_admin_fields_guard
  before insert or update on public.school_billing
  for each row execute function app.tg_school_billing_admin_fields_guard();

-- ----------------------------------------------------------------------------
-- F-008: Support aus den PII-Tabellen users/enrollments/invoices entfernen
-- (kein Support-UI in Phase 0; späterer Zugriff über spalten-minimierte support_* Views).
-- ----------------------------------------------------------------------------
drop policy if exists users_select on public.users;
create policy users_select on public.users for select to app_user
  using (id = app.current_user_id()
         or app.has_platform_role('admin'));

drop policy if exists enrollments_select on public.enrollments;
create policy enrollments_select on public.enrollments for select to app_user
  using (student_user_id = app.current_user_id()
         or app.is_member_of_school(school_id)
         or app.has_platform_role('admin'));

drop policy if exists invoices_select on public.invoices;
create policy invoices_select on public.invoices for select to app_user
  using (exists (select 1 from public.enrollments e
                 where e.id = enrollment_id
                   and (e.student_user_id = app.current_user_id()
                        or app.is_school_manager(e.school_id)))
         or app.has_platform_role('admin'));

-- F-010: enrollments write-Policies (rollenscharf, identisch zu 0013) über den Wrapper.
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
-- F-003: SELECT-Spalten minimieren (REVOKE table-level, dann GRANT auf sichere Spalten).
-- driving_schools: exakt die Spalten der öffentlichen Read-Pfade + hausnummer.
-- Interne Spalten (source/source_ref/imported_at/verification_status/dedupe_*/
-- cluster_key/is_duplicate/duplicate_of/review_notiz/maps_url/kundennummer) bleiben gesperrt.
-- ----------------------------------------------------------------------------
revoke select on table public.driving_schools from app_user;
grant select (
  id, name, slug, strasse, hausnummer, plz, ort, stadtbezirk, bundesland, land,
  latitude, longitude, google_rating, google_reviews_count, fail_rate, sprachen,
  is_partner, is_verified
) on table public.driving_schools to app_user;

-- reviews/instructors: öffentlich über die security_invoker-Views, die GENAU diese
-- Spalten selektieren → Views bleiben funktionsfähig; De-Anonymisierungs-Spalten gesperrt.
revoke select on table public.reviews from app_user;
grant select (id, school_id, instructor_id, rating, text, moderation_status, published_at, created_at)
  on table public.reviews to app_user;

revoke select on table public.instructors from app_user;
grant select (id, school_id, name, slug, aktiv)
  on table public.instructors to app_user;

grant select on table public.reviews_public, public.instructors_public to app_user;

-- F-010: enrollments SELECT/INSERT/UPDATE-Spalten allowlisten. WICHTIG: der breite
-- Tabellen-Grant aus 0000 (select,insert,update,delete) lässt sonst app_user die
-- Stripe-/SEPA-Token + Vertrags-/Zahlfelder LESEN (Student/Schulmitglied via SELECT-Policy).
-- SELECT: nur Identitäts-/Status-Felder; Vertrags-/Zahlfelder server-only (spätere
-- Schüler-Sicht via minimierter View/SECURITY-DEFINER).
revoke select, insert, update on table public.enrollments from app_user;
grant select (id, student_user_id, school_id, fuehrerscheinklasse, status, created_at)
  on table public.enrollments to app_user;
grant insert (student_user_id, school_id, fuehrerscheinklasse, status)
  on table public.enrollments to app_user;
grant update (fuehrerscheinklasse, status)
  on table public.enrollments to app_user;

-- F-003/F-010: invoices — stripe_payment_ref (Stripe-Token) für app_user sperren;
-- Beträge/Positionen/Status/Daten bleiben für Student/Verwaltung sichtbar.
revoke select on table public.invoices from app_user;
grant select (id, enrollment_id, betrag, positionen, status, erstellt_am, bezahlt_am)
  on table public.invoices to app_user;

-- Immutabilität (Identität für ALLE Rollen) + Zahl-/Vertragsfelder server-only (für app_user).
create or replace function app.tg_enrollments_locked_fields() returns trigger
language plpgsql security definer
set search_path = pg_catalog, pg_temp
as $fn$
begin
  if tg_op = 'UPDATE' then
    if new.student_user_id is distinct from old.student_user_id
       or new.school_id is distinct from old.school_id then
      raise exception 'enrollments: student_user_id/school_id sind unveraenderlich';
    end if;
  end if;

  if app.current_user_id() is not null then
    if tg_op = 'INSERT' then
      if new.vertragsabschluss_datum is not null
         or new.zahlungsmethode is not null
         or new.stripe_customer_ref is not null
         or new.sepa_mandat_ref is not null then
        raise exception 'enrollments: Vertrags-/Zahlungsfelder sind server-only';
      end if;
    elsif tg_op = 'UPDATE' then
      if new.vertragsabschluss_datum is distinct from old.vertragsabschluss_datum
         or new.zahlungsmethode is distinct from old.zahlungsmethode
         or new.stripe_customer_ref is distinct from old.stripe_customer_ref
         or new.sepa_mandat_ref is distinct from old.sepa_mandat_ref then
        raise exception 'enrollments: Vertrags-/Zahlungsfelder sind server-only';
      end if;
    end if;
  end if;

  return new;
end
$fn$;

drop trigger if exists tg_enrollments_locked_fields on public.enrollments;
create trigger tg_enrollments_locked_fields
  before insert or update on public.enrollments
  for each row execute function app.tg_enrollments_locked_fields();

-- ----------------------------------------------------------------------------
-- Fail-closed Assertions: Spaltenprivilegien, Funktions-Grants, Policy-Sauberkeit, Trigger.
-- ----------------------------------------------------------------------------
do $$
declare
  v record;
begin
  -- SELECT-Spaltenprivilegien (öffentlich erlaubt / intern gesperrt).
  for v in
    select * from (values
      ('public.driving_schools', 'id', true),
      ('public.driving_schools', 'name', true),
      ('public.driving_schools', 'hausnummer', true),
      ('public.driving_schools', 'fail_rate', true),
      ('public.driving_schools', 'is_verified', true),
      ('public.driving_schools', 'source', false),
      ('public.driving_schools', 'source_ref', false),
      ('public.driving_schools', 'imported_at', false),
      ('public.driving_schools', 'verification_status', false),
      ('public.driving_schools', 'dedupe_key', false),
      ('public.driving_schools', 'cluster_key', false),
      ('public.driving_schools', 'is_duplicate', false),
      ('public.driving_schools', 'duplicate_of', false),
      ('public.driving_schools', 'dedupe_checked', false),
      ('public.driving_schools', 'review_notiz', false),
      ('public.driving_schools', 'maps_url', false),
      ('public.driving_schools', 'kundennummer', false),
      ('public.reviews', 'id', true),
      ('public.reviews', 'rating', true),
      ('public.reviews', 'text', true),
      ('public.reviews', 'moderation_status', true),
      ('public.reviews', 'enrollment_id', false),
      ('public.reviews', 'author_user_id', false),
      ('public.reviews', 'moderated_by_user_id', false),
      ('public.reviews', 'moderated_at', false),
      ('public.instructors', 'id', true),
      ('public.instructors', 'name', true),
      ('public.instructors', 'aktiv', true),
      ('public.instructors', 'user_id', false),
      ('public.enrollments', 'id', true),
      ('public.enrollments', 'status', true),
      ('public.enrollments', 'fuehrerscheinklasse', true),
      ('public.enrollments', 'stripe_customer_ref', false),
      ('public.enrollments', 'sepa_mandat_ref', false),
      ('public.enrollments', 'zahlungsmethode', false),
      ('public.enrollments', 'vertragsabschluss_datum', false),
      ('public.invoices', 'id', true),
      ('public.invoices', 'betrag', true),
      ('public.invoices', 'status', true),
      ('public.invoices', 'stripe_payment_ref', false)
    ) as expected(relname, colname, allowed)
  loop
    if has_column_privilege('app_user', v.relname, v.colname, 'SELECT') is distinct from v.allowed then
      raise exception '0016: app_user SELECT privilege mismatch for %.% (expected %)',
        v.relname, v.colname, v.allowed;
    end if;
  end loop;

  -- enrollments INSERT/UPDATE-Spaltenprivilegien.
  for v in
    select * from (values
      ('public.enrollments', 'fuehrerscheinklasse', 'INSERT', true),
      ('public.enrollments', 'status', 'INSERT', true),
      ('public.enrollments', 'student_user_id', 'INSERT', true),
      ('public.enrollments', 'school_id', 'INSERT', true),
      ('public.enrollments', 'stripe_customer_ref', 'INSERT', false),
      ('public.enrollments', 'sepa_mandat_ref', 'INSERT', false),
      ('public.enrollments', 'fuehrerscheinklasse', 'UPDATE', true),
      ('public.enrollments', 'status', 'UPDATE', true),
      ('public.enrollments', 'student_user_id', 'UPDATE', false),
      ('public.enrollments', 'school_id', 'UPDATE', false),
      ('public.enrollments', 'zahlungsmethode', 'UPDATE', false),
      ('public.enrollments', 'stripe_customer_ref', 'UPDATE', false)
    ) as expected(relname, colname, privname, allowed)
  loop
    if has_column_privilege('app_user', v.relname, v.colname, v.privname) is distinct from v.allowed then
      raise exception '0016: app_user % privilege mismatch for %.% (expected %)',
        v.privname, v.relname, v.colname, v.allowed;
    end if;
  end loop;

  -- Funktions-Grants: arbitrary-user Helper gesperrt, current-user Wrapper erlaubt.
  if has_function_privilege('app_user', 'app.user_has_school_role(uuid, uuid, text)', 'EXECUTE') then
    raise exception '0016: app_user darf app.user_has_school_role(uuid,uuid,text) nicht ausfuehren';
  end if;
  if not has_function_privilege('app_user', 'app.current_user_has_school_role(uuid, text)', 'EXECUTE') then
    raise exception '0016: app_user muss app.current_user_has_school_role(uuid,text) ausfuehren duerfen';
  end if;

  -- Keine app_user-Policy ruft den arbitrary-user Helper noch direkt auf.
  if exists (
    select 1 from pg_policy p
     where (coalesce(pg_get_expr(p.polqual, p.polrelid), '') || ' ' ||
            coalesce(pg_get_expr(p.polwithcheck, p.polrelid), ''))
           ~ '(^|[^[:alnum:]_])user_has_school_role[[:space:]]*[(]'
  ) then
    raise exception '0016: eine Policy referenziert noch direkt app.user_has_school_role';
  end if;

  -- Trigger vorhanden.
  for v in
    select * from (values
      ('public', 'school_billing', 'tg_school_billing_admin_fields_guard'),
      ('public', 'enrollments', 'tg_enrollments_locked_fields'),
      ('public', 'enrollments', 'tg_enrollments_student_guard')
    ) as expected(schema_name, table_name, trigger_name)
  loop
    if not exists (
      select 1 from pg_trigger t
        join pg_class c on c.oid = t.tgrelid
        join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = v.schema_name and c.relname = v.table_name
         and t.tgname = v.trigger_name and not t.tgisinternal
    ) then
      raise exception '0016: Trigger % auf %.% fehlt', v.trigger_name, v.schema_name, v.table_name;
    end if;
  end loop;
end
$$;

reset role;

commit;
