-- 0028_portal_zustell_adressen_vermittlung.sql
-- Konfigurierbare Zustell-Adressen je Schule (Gründer 2026-07-02):
--
--  (1) school_profiles.anfragen_email — separate Zieladresse für SCHÜLER-
--      Anfragen (Leads), analog zur bewerbungs_email (0025): Betreiber UND
--      Inhaber (später im SaaS-Bereich, kuratierter Pfad) können je Schule
--      eine eigene Adresse hinterlegen; App-Fallback anfragen_email ?? email.
--      DB-HART INTERN von Geburt an: die Spalten-Allowlists aus 0027 umfassen
--      sie nicht — kein app_user-Privileg (Assertion unten).
--  (2) app.lead_anfrage_empfaenger(p_school_id) — GUC-gated SECURITY-DEFINER-
--      Auflösung der Lead-Zustelladresse, exakt das Muster von
--      app.job_bewerbung_empfaenger (0027): nur innerhalb des sanktionierten
--      Submission-Kontexts, nur für gelistete Schulen, sonst NULL.
--
--  HINWEIS (App-Schicht, kein DB-Bestandteil): Vermittlungs-Interessenten
--  (Quereinstieg/Ausbildungsplatz) werden bewusst NIE an die Schule
--  weitergeleitet — sie laufen an die onelane-Vermittlungsadresse
--  (Kommissions-USP; Routing in src/modules/jobs/actions.ts).
--
-- PG16+. Idempotent. Abschließende fail-closed Assertions.

begin;

grant app_owner to current_user;
set role app_owner;

alter table public.school_profiles add column if not exists anfragen_email text;

alter table public.school_profiles drop constraint if exists chk_school_profiles_anfragen_email;
alter table public.school_profiles add constraint chk_school_profiles_anfragen_email
  check (
    anfragen_email is null
    or (anfragen_email ~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'
        and octet_length(anfragen_email) <= 320)
  );

create or replace function app.lead_anfrage_empfaenger(p_school_id uuid)
returns text
language plpgsql stable security definer
set search_path = pg_catalog, pg_temp
as $fn$
begin
  -- Nur der sanktionierte anonyme Schreibpfad (withPublicSubmissionContext)
  -- setzt diese transaktionslokale GUC — jeder andere Aufruf erhält NULL.
  if coalesce(current_setting('app.public_submission', true), '') <> '1' then
    return null;
  end if;
  return (
    select coalesce(nullif(sp.anfragen_email, ''), nullif(sp.email, ''))
      from public.driving_schools ds
      left join public.school_profiles sp on sp.school_id = ds.id
     where ds.id = p_school_id
       and ds.is_listed = true
  );
end
$fn$;

revoke all on function app.lead_anfrage_empfaenger(uuid) from public;
grant execute on function app.lead_anfrage_empfaenger(uuid) to app_user;

-- ----------------------------------------------------------------------------
-- Fail-closed Assertions.
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'school_profiles'
      and column_name = 'anfragen_email'
  ) then
    raise exception '0028: Spalte school_profiles.anfragen_email fehlt.';
  end if;

  if exists (
    select 1 from information_schema.column_privileges
    where table_schema = 'public' and table_name = 'school_profiles'
      and column_name = 'anfragen_email' and grantee = 'app_user'
  ) then
    raise exception '0028: anfragen_email ist fuer app_user erreichbar — Invariante verletzt.';
  end if;

  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname = 'lead_anfrage_empfaenger'
  ) then
    raise exception '0028: app.lead_anfrage_empfaenger fehlt.';
  end if;
end $$;

reset role;
commit;
