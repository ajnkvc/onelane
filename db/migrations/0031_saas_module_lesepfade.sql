-- 0031_saas_module_lesepfade.sql
-- OS-V1 WELLE 2: die vertagten, geprueften DB-Pfade der P3-Module — EINE
-- Migration, ein Review (Kontrakt aus P1/P2/P3: "eigene, geprueft e Migration").
--
-- Inhalt:
--   1. app.schueler_namen(p_school_id) — DEFINER-Namenspfad fuer Schul-Personal.
--   2. app.api_key_pruefen(p_key_hash) + app.api_key_beruehren(p_key_id) —
--      GUC-gated DEFINER-Lookup des API-/MCP-Zugangs (Paket-C-Vertagung).
--   3. app.plan_katalog() — anon-tauglicher, PII-freier Plan-Lesepfad (MCP-Tool).
--   4. instructor_availability: Schreib-Policies Kalender V1 (Manager + eigene:r
--      Fahrlehrer:in). appointments-Schreiben bleibt bewusst AUS (s. unten).
--   5. app.termin_finanzen(p_school_id) — Finanzfelder NUR fuer Schul-Manager.
--   6. school_subscriptions: enger Lesepfad fuer die Abo-Seite (Manager).
--
-- ENTWURFS-ENTSCHEIDUNGEN (begruendet, Review-Auflage):
--
-- (1) SCHUELER-NAMEN — warum ein enger DEFINER-Pfad und KEINE users-Policy:
--     Postgres kennt keine Spalten-Policies; eine zusaetzliche users-SELECT-
--     Zeilen-Policy ("Schulmitglied liest User mit Enrollment") wuerde ALLE
--     grant-baren users-Spalten oeffnen — insbesondere email/telefon, die
--     Schul-Personal NICHT sehen darf (Lead-/Kontakt-Strategie: Kontakt laeuft
--     ueber unsere Formulare; 0016 hat users bewusst NICHT spalten-gesperrt,
--     weil Grants app_user-weit gelten und admin email braucht). Der DEFINER
--     gibt DATENMINIMIERT genau vorname/nachname heraus — sonst nichts.
--     GUC-FREI (anders als api_key_pruefen): Das Gate ist die authentifizierte
--     Schul-Mitgliedschaft selbst (app.is_member_of_school wertet den
--     verifizierten RLS-Kontext aus, fail-closed bei NULL) — es gibt keinen
--     "sanktionierten Sonderkontext", den eine GUC markieren muesste.
--     "AKTIVES Enrollment" = status in ('pending','active'): mit Storno bzw.
--     Abschluss endet der Namens-Zugriff (Datenminimierung; ein Alumni-Modul
--     braeuchte eine eigene Abwaegung). Alle drei Schul-Rollen lesen (Gruender-
--     Entscheid Quer-Routing, wie enrollments/appointments seit 0029).
--
-- (2) API-KEY-LOOKUP — warum MIT GUC-Gate (0027/0028-Muster):
--     Der Key-Hash ist selbst ein Geheimnis (sha256 eines hochentropischen
--     Tokens — nicht erratbar), insofern waere auch ein Gate-loser Definer
--     vertretbar. Das GUC-Gate kostet aber nichts und nimmt der Funktion JEDE
--     Verwendbarkeit ausserhalb des sanktionierten Maschinen-Auth-Pfads
--     (src/server/dal/rls-context.ts setzt app.api_key_auth transaktionslokal;
--     Defense-in-Depth z. B. gegen SQL-Injection in einem authentifizierten
--     Kontext oder ein versehentlich exponiertes Funktions-Grant).
--     Vertrag "Hash rein, Datensatz raus, NIE Hash raus": key_hash erscheint in
--     keiner Rueckgabespalte. NUR AKTIVE Schluessel werden geliefert —
--     rotiert/widerrufen ist nach aussen von "unbekannt" nicht unterscheidbar
--     (kein Schluessel-Orakel); Ablauf-/Partner-/Scope-Pruefung bleibt zentral
--     in der einen Kette (src/modules/api/auth.ts), deshalb kommen expires_at
--     und der Partner-Status mit heraus. last_used_at wird ueber den ZWEITEN
--     Definer fortgeschrieben — gedrosselt (max. 1 Write je 5 Minuten je
--     Schluessel), damit 60 req/min kein Write-Amplifier werden.
--
-- (3) PLAN-KATALOG: subscription_plans sind seit 0029 nur AUTHENTIFIZIERT
--     lesbar; der Katalog (Preise start/os) ist aber veroeffentlichte
--     Information (oeffentliche /os-Marketing-Seite). Der Definer liefert NUR
--     die PII-freien Katalogfelder aktiver saas-Plaene — fuer das MCP-Tool
--     plan_katalog und kuenftige anonyme Lesepfade.
--
-- (4) KALENDER V1: NUR instructor_availability wird schreibbar (Manager fuer
--     die ganze Schule; Fahrlehrer:in fuer die EIGENEN Zeilen via
--     app.own_instructor_ids + Mitgliedschafts-Check gegen Ghost-User).
--     appointments-Schreiben bleibt AUS: Termin-Anlage ist ein eigenes Modul
--     mit Storno-Regeln/Fristen/Gebuehrenlogik (payment-integrity-Linie) —
--     P4/V1.1; die fail-closed-Posture aus 0029 wird unten hart mitgeprueft.
--
-- (5) FINANZ-FREIGABE — warum DEFINER statt Spalten-Grant: ein SELECT-Grant
--     auf appointments.preis/abgerechnet gaelte app_user-WEIT — auch Student
--     und Fahrlehrer koennten die Finanzfelder jeder fuer sie sichtbaren Zeile
--     lesen (appointments-Zeilen sind seit 0029 fuer alle drei Schul-Rollen
--     sichtbar). Der Definer bindet die Freigabe DB-hart an
--     app.is_school_manager — das Modul-Gate (istSchulManager) ist damit nur
--     Komfort, nicht die Verteidigungslinie.
--
-- (6) school_subscriptions war seit 0000 deny-by-default (RLS ohne Policy,
--     aber mit breitem Tabellen-Grant). Jetzt: Lesen fuer inhaber/verwaltung
--     (+admin), Spalten OHNE stripe_subscription_ref (Token-Linie 0016),
--     Schreiben bleibt dem erhoehten Betreiber-Pfad vorbehalten (fail-closed
--     Grant-Rueckbau).
--
-- PG16+. Idempotent. Betriebsmodell wie Bestand (app_owner, fail-closed
-- Assertions am Ende).

begin;

grant app_owner to current_user;
set role app_owner;

-- ----------------------------------------------------------------------------
-- 1) app.schueler_namen(p_school_id) — Namens-Lesepfad fuer Schul-Personal.
--    NUR vorname/nachname (Datenminimierung), NUR Schueler mit aktivem
--    Enrollment (pending|active) an DIESER Schule, NUR fuer Mitglieder der
--    Schule. KEIN Parameter-Enumerationspfad: fremde school_id → 0 Zeilen.
-- ----------------------------------------------------------------------------
create or replace function app.schueler_namen(p_school_id uuid)
returns table(student_user_id uuid, vorname text, nachname text)
language sql stable security definer
set search_path = pg_catalog, pg_temp
as $fn$
  select distinct u.id, u.vorname, u.nachname
    from public.users u
    join public.enrollments e on e.student_user_id = u.id
   where e.school_id = p_school_id
     and e.status in ('pending', 'active')
     and app.is_member_of_school(p_school_id);
$fn$;

revoke all on function app.schueler_namen(uuid) from public;
grant execute on function app.schueler_namen(uuid) to app_user;

-- ----------------------------------------------------------------------------
-- 2) API-Key-Lookup (GUC-gated, s. Kopf) + gedrosselte last_used_at-Pflege.
-- ----------------------------------------------------------------------------
create or replace function app.api_key_pruefen(p_key_hash text)
returns table(
  key_id uuid, prefix text, scopes text[], status text, expires_at timestamptz,
  partner_id uuid, partner_name text, partner_status text
)
language sql stable security definer
set search_path = pg_catalog, pg_temp
as $fn$
  select k.id, k.prefix, k.scopes, k.status, k.expires_at,
         p.id, p.name, p.status
    from public.api_keys k
    join public.api_partners p on p.id = k.partner_id
   where coalesce(current_setting('app.api_key_auth', true), '') = '1'
     and p_key_hash ~ '^[0-9a-f]{64}$'
     and k.key_hash = p_key_hash
     and k.status = 'aktiv';
$fn$;

revoke all on function app.api_key_pruefen(text) from public;
grant execute on function app.api_key_pruefen(text) to app_user;

-- Drossel: hoechstens 1 Fortschreibung je 5 Minuten je Schluessel (kein
-- Write-Amplifier bei 60 req/min); nur aktive Schluessel, nur im Auth-Kontext.
create or replace function app.api_key_beruehren(p_key_id uuid)
returns boolean
language sql volatile security definer
set search_path = pg_catalog, pg_temp
as $fn$
  with aktualisiert as (
    update public.api_keys
       set last_used_at = now()
     where coalesce(current_setting('app.api_key_auth', true), '') = '1'
       and id = p_key_id
       and status = 'aktiv'
       and (last_used_at is null or last_used_at < now() - interval '5 minutes')
    returning id
  )
  select exists (select 1 from aktualisiert);
$fn$;

revoke all on function app.api_key_beruehren(uuid) from public;
grant execute on function app.api_key_beruehren(uuid) to app_user;

-- ----------------------------------------------------------------------------
-- 3) app.plan_katalog() — PII-freier Katalog aktiver saas-Plaene (anon-tauglich).
-- ----------------------------------------------------------------------------
create or replace function app.plan_katalog()
returns table(
  code text, name text, preis_monat_netto_cent integer,
  seat_preis_monat_netto_cent integer, aktion_preis_monat_netto_cent integer,
  aktion_monate integer
)
language sql stable security definer
set search_path = pg_catalog, pg_temp
as $fn$
  select sp.code, sp.name, sp.preis_monat_netto_cent, sp.seat_preis_monat_netto_cent,
         sp.aktion_preis_monat_netto_cent, sp.aktion_monate
    from public.subscription_plans sp
   where sp.aktiv = true and sp.typ = 'saas' and sp.code is not null
   order by coalesce(sp.preis_monat_netto_cent, 0) asc, sp.code asc;
$fn$;

revoke all on function app.plan_katalog() from public;
grant execute on function app.plan_katalog() to app_user;

-- ----------------------------------------------------------------------------
-- 4) instructor_availability — Schreib-Policies Kalender V1.
--    Manager (inhaber/verwaltung) pflegen ALLE Fahrlehrer der eigenen Schule;
--    Fahrlehrer:innen NUR die eigenen Zeilen (own_instructor_ids) UND nur mit
--    Schul-Mitgliedschaft (Ghost-User mit instructors.user_id, aber ohne
--    Rolle, bleiben draussen); admin alles. instructor_id ist nach INSERT
--    unveraenderlich (kein UPDATE-Spalten-Grant). Fachliche Validierung
--    (Zeitfenster, Wochentag vs. Datum) liegt in der Modul-Schicht; die
--    0000-CHECKs (von < bis, wochentag 0..6) bleiben die DB-Grundlinie.
-- ----------------------------------------------------------------------------
drop policy if exists instructor_availability_insert on public.instructor_availability;
create policy instructor_availability_insert on public.instructor_availability
  for insert to app_user
  with check (
    exists (select 1 from public.instructors i
             where i.id = instructor_id
               and (app.is_school_manager(i.school_id)
                    or (i.id in (select app.own_instructor_ids())
                        and app.is_member_of_school(i.school_id))))
    or app.has_platform_role('admin'));

drop policy if exists instructor_availability_update on public.instructor_availability;
create policy instructor_availability_update on public.instructor_availability
  for update to app_user
  using (
    exists (select 1 from public.instructors i
             where i.id = instructor_id
               and (app.is_school_manager(i.school_id)
                    or (i.id in (select app.own_instructor_ids())
                        and app.is_member_of_school(i.school_id))))
    or app.has_platform_role('admin'))
  with check (
    exists (select 1 from public.instructors i
             where i.id = instructor_id
               and (app.is_school_manager(i.school_id)
                    or (i.id in (select app.own_instructor_ids())
                        and app.is_member_of_school(i.school_id))))
    or app.has_platform_role('admin'));

drop policy if exists instructor_availability_delete on public.instructor_availability;
create policy instructor_availability_delete on public.instructor_availability
  for delete to app_user
  using (
    exists (select 1 from public.instructors i
             where i.id = instructor_id
               and (app.is_school_manager(i.school_id)
                    or (i.id in (select app.own_instructor_ids())
                        and app.is_member_of_school(i.school_id))))
    or app.has_platform_role('admin'));

-- Spalten-Grants passend zu den Policies (0030 hatte Writes komplett entzogen).
grant insert (instructor_id, datum, wochentag, von, bis, ist_blockiert)
  on table public.instructor_availability to app_user;
grant update (datum, wochentag, von, bis, ist_blockiert)
  on table public.instructor_availability to app_user;
grant delete on table public.instructor_availability to app_user;

-- ----------------------------------------------------------------------------
-- 5) app.termin_finanzen(p_school_id) — preis/abgerechnet NUR fuer Manager.
--    Die Spalten bleiben fuer app_user OHNE SELECT-Grant (0029, unten
--    mitgeprueft) — dieser Definer ist der EINZIGE Lesepfad.
-- ----------------------------------------------------------------------------
create or replace function app.termin_finanzen(p_school_id uuid)
returns table(appointment_id uuid, preis numeric, abgerechnet boolean)
language sql stable security definer
set search_path = pg_catalog, pg_temp
as $fn$
  select a.id, a.preis, a.abgerechnet
    from public.appointments a
    join public.enrollments e on e.id = a.enrollment_id
   where e.school_id = p_school_id
     and app.is_school_manager(p_school_id);
$fn$;

revoke all on function app.termin_finanzen(uuid) from public;
grant execute on function app.termin_finanzen(uuid) to app_user;

-- ----------------------------------------------------------------------------
-- 6) school_subscriptions — Lesepfad fuer die Abo-Seite (Manager + admin).
--    Spalten OHNE stripe_subscription_ref (Payment-Token-Linie 0016);
--    Schreiben bleibt dem erhoehten Betreiber-Pfad vorbehalten.
-- ----------------------------------------------------------------------------
alter table public.school_subscriptions enable row level security;

drop policy if exists school_subscriptions_select on public.school_subscriptions;
create policy school_subscriptions_select on public.school_subscriptions
  for select to app_user
  using (app.is_school_manager(school_id) or app.has_platform_role('admin'));

revoke all on table public.school_subscriptions from app_user;
grant select (id, school_id, plan_id, anzahl_lizenzen, status, start_datum, created_at)
  on table public.school_subscriptions to app_user;

-- ----------------------------------------------------------------------------
-- Fail-closed Assertions.
-- ----------------------------------------------------------------------------
do $$
declare
  v record;
  n integer;
begin
  -- Funktionen: existieren, gehoeren app_owner, sind NICHT PUBLIC-ausfuehrbar,
  -- app_user darf ausfuehren.
  for v in
    select * from (values
      ('app.schueler_namen(uuid)'),
      ('app.api_key_pruefen(text)'),
      ('app.api_key_beruehren(uuid)'),
      ('app.plan_katalog()'),
      ('app.termin_finanzen(uuid)')
    ) as expected(signatur)
  loop
    if (select proowner::regrole::text from pg_proc
         where oid = v.signatur::regprocedure) is distinct from 'app_owner' then
      raise exception '0031: % gehoert nicht app_owner', v.signatur;
    end if;
    if not has_function_privilege('app_user', v.signatur, 'EXECUTE') then
      raise exception '0031: app_user muss % ausfuehren duerfen', v.signatur;
    end if;
    if has_function_privilege('public', v.signatur, 'EXECUTE') then
      raise exception '0031: % darf nicht PUBLIC-ausfuehrbar sein', v.signatur;
    end if;
    if (select prosecdef from pg_proc where oid = v.signatur::regprocedure) is distinct from true then
      raise exception '0031: % muss SECURITY DEFINER sein', v.signatur;
    end if;
  end loop;

  -- Funktionale fail-closed-Smokes (ohne Nutzerkontext/GUC → NICHTS):
  select count(*) into n from app.schueler_namen(gen_random_uuid());
  if n <> 0 then
    raise exception '0031: schueler_namen liefert ohne Mitgliedschaft Zeilen (%)', n;
  end if;
  select count(*) into n from app.termin_finanzen(gen_random_uuid());
  if n <> 0 then
    raise exception '0031: termin_finanzen liefert ohne Manager-Kontext Zeilen (%)', n;
  end if;
  select count(*) into n from app.api_key_pruefen(repeat('0', 64));
  if n <> 0 then
    raise exception '0031: api_key_pruefen liefert ohne GUC-Gate Zeilen (%)', n;
  end if;
  if app.api_key_beruehren(gen_random_uuid()) then
    raise exception '0031: api_key_beruehren schreibt ohne GUC-Gate';
  end if;
  -- Mit GUC, aber Junk-Hash → weiterhin NICHTS (Format-Gate).
  perform set_config('app.api_key_auth', '1', true);
  select count(*) into n from app.api_key_pruefen('nicht-hex');
  if n <> 0 then
    raise exception '0031: api_key_pruefen akzeptiert Junk-Hash';
  end if;
  perform set_config('app.api_key_auth', '', true);

  -- plan_katalog liefert die 0029-Referenzplaene (start + os), PII-frei.
  select count(*) into n from app.plan_katalog() k where k.code in ('start', 'os');
  if n <> 2 then
    raise exception '0031: plan_katalog liefert die Referenzplaene nicht (%)', n;
  end if;

  -- instructor_availability: Policies vorhanden, Spalten-Grants exakt.
  for v in
    select * from (values
      ('instructor_availability_insert'),
      ('instructor_availability_update'),
      ('instructor_availability_delete')
    ) as expected(polname)
  loop
    if not exists (
      select 1 from pg_policy p
       where p.polrelid = 'public.instructor_availability'::regclass
         and p.polname = v.polname
    ) then
      raise exception '0031: Policy % fehlt', v.polname;
    end if;
  end loop;
  for v in
    select * from (values
      ('public.instructor_availability', 'instructor_id', 'INSERT', true),
      ('public.instructor_availability', 'von',           'INSERT', true),
      ('public.instructor_availability', 'instructor_id', 'UPDATE', false),
      ('public.instructor_availability', 'von',           'UPDATE', true),
      ('public.instructor_availability', 'ist_blockiert', 'UPDATE', true),
      ('public.school_subscriptions',    'status',        'SELECT', true),
      ('public.school_subscriptions',    'plan_id',       'SELECT', true),
      ('public.school_subscriptions',    'stripe_subscription_ref', 'SELECT', false),
      -- Finanzfelder bleiben OHNE direkten Grant (einziger Pfad: Definer 5).
      ('public.appointments',            'preis',         'SELECT', false),
      ('public.appointments',            'abgerechnet',   'SELECT', false)
    ) as expected(relname, colname, privname, allowed)
  loop
    if has_column_privilege('app_user', v.relname, v.colname, v.privname)
       is distinct from v.allowed then
      raise exception '0031: app_user %-Privileg fuer %.% erwartet %',
        v.privname, v.relname, v.colname, v.allowed;
    end if;
  end loop;
  if not has_table_privilege('app_user', 'public.instructor_availability', 'DELETE') then
    raise exception '0031: instructor_availability braucht DELETE fuer app_user (Policy-gedeckt)';
  end if;

  -- appointments bleibt fail-closed OHNE Write-Pfad (Termin-Anlage = eigenes
  -- Modul mit Storno-Regeln, P4/V1.1 — s. Kopf Punkt 4).
  if exists (
    select 1 from pg_policy p
     where p.polrelid = 'public.appointments'::regclass and p.polcmd <> 'r'
  ) then
    raise exception '0031: appointments darf (noch) keine Write-Policies haben';
  end if;
  if has_table_privilege('app_user', 'public.appointments', 'INSERT')
     or has_table_privilege('app_user', 'public.appointments', 'UPDATE')
     or has_table_privilege('app_user', 'public.appointments', 'DELETE') then
    raise exception '0031: appointments darf fuer app_user keine Write-Grants haben';
  end if;

  -- school_subscriptions: RLS aktiv, Owner korrekt, Policy da, Writes entzogen.
  if not exists (
    select 1 from pg_class c join pg_namespace nsp on nsp.oid = c.relnamespace
     where nsp.nspname = 'public' and c.relname = 'school_subscriptions' and c.relrowsecurity
  ) then
    raise exception '0031: RLS auf school_subscriptions ist nicht aktiviert';
  end if;
  if (select relowner::regrole::text from pg_class
       where oid = 'public.school_subscriptions'::regclass) is distinct from 'app_owner' then
    raise exception '0031: school_subscriptions gehoert nicht app_owner';
  end if;
  if not exists (
    select 1 from pg_policy p
     where p.polrelid = 'public.school_subscriptions'::regclass
       and p.polname = 'school_subscriptions_select'
  ) then
    raise exception '0031: Policy school_subscriptions_select fehlt';
  end if;
  if has_table_privilege('app_user', 'public.school_subscriptions', 'INSERT')
     or has_table_privilege('app_user', 'public.school_subscriptions', 'UPDATE')
     or has_table_privilege('app_user', 'public.school_subscriptions', 'DELETE') then
    raise exception '0031: school_subscriptions darf fuer app_user keine Write-Grants haben';
  end if;

  -- users-Posture unveraendert: die SELECT-Policy bleibt selbst/admin-eng —
  -- KEINE Policy darf Schul-Personal direkt auf users lassen (Namens-Zugriff
  -- laeuft AUSSCHLIESSLICH ueber den Definer aus Punkt 1).
  if exists (
    select 1 from pg_policy p
     where p.polrelid = 'public.users'::regclass
       and coalesce(pg_get_expr(p.polqual, p.polrelid), '') ~ 'is_member_of_school|is_school_manager'
  ) then
    raise exception '0031: users-Policy referenziert Schul-Mitgliedschaft — Namenspfad-Invariante verletzt';
  end if;
end
$$;

reset role;

commit;
