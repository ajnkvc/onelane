-- 0027_portal_haertung_review_abnahme.sql
-- Härtungen aus der Sicherheits-Gesamtabnahme (2026-07-02) — drei Bausteine:
--
--  (1) school_profiles.bewerbungs_email DB-HART intern: Der breite Tabellen-
--      Grant aus der Frühzeit machte die neue interne Spalte (0025) für
--      app_user selektier-/schreibbar — die „nie öffentlich"-Invariante war
--      nur App-Konvention. Jetzt: Tabellen-Grants ersetzt durch explizite
--      Spalten-Allowlists OHNE bewerbungs_email (0016-Muster). Der einzige
--      legitime Leser ist der Bewerbungs-Versand — dafür (2).
--  (2) SECURITY-DEFINER-Funktion app.job_bewerbung_empfaenger(p_job_id):
--      liefert bewerbungs_email ?? email der Ziel-Schule NUR innerhalb des
--      sanktionierten Submission-Kontexts (GUC app.public_submission = '1',
--      gesetzt ausschließlich von withPublicSubmissionContext) und NUR für
--      aktive, gültige Anzeigen gelisteter Schulen. Kein Orakel: sonst NULL.
--  (3) app.zaehle_ereignis präzisiert: Slugs sind nur je (land, ort) eindeutig
--      (uq_driving_schools_slug) — die 2-Parameter-Fassung konnte Tel-Klicks
--      bei Städte-übergreifenden Slug-Kollisionen der falschen Schule
--      zuschreiben. Neu: optionaler p_ort; bei MEHRDEUTIGER Auflösung wird
--      NICHT gezählt (strikt, lieber Untererfassung als Fehlzurechnung).
--
-- PG16+. Idempotent. Abschließende fail-closed Assertions.

begin;

grant app_owner to current_user;
set role app_owner;

-- ----------------------------------------------------------------------------
-- (1) school_profiles: Tabellen-Grants → Spalten-Allowlists ohne bewerbungs_email
-- ----------------------------------------------------------------------------
revoke all on table public.school_profiles from app_user;

grant select (
  id, school_id, beschreibung, website, telefon, whatsapp, email, logo_url,
  fuehrerscheinklassen, preise, preise_verifiziert, oeffnungszeiten,
  theoriezeiten, faq, show_images, show_vehicles, show_instructors, show_faq,
  show_zeiten, show_jobs, updated_at
) on table public.school_profiles to app_user;

grant insert (
  id, school_id, beschreibung, website, telefon, whatsapp, email, logo_url,
  fuehrerscheinklassen, preise, preise_verifiziert, oeffnungszeiten,
  theoriezeiten, faq, show_images, show_vehicles, show_instructors, show_faq,
  show_zeiten, show_jobs, updated_at
) on table public.school_profiles to app_user;

grant update (
  beschreibung, website, telefon, whatsapp, email, logo_url,
  fuehrerscheinklassen, preise, preise_verifiziert, oeffnungszeiten,
  theoriezeiten, faq, show_images, show_vehicles, show_instructors, show_faq,
  show_zeiten, show_jobs, updated_at
) on table public.school_profiles to app_user;

-- ----------------------------------------------------------------------------
-- (2) Empfänger-Auflösung für den Bewerbungs-Versand (GUC-gated, kein Orakel)
-- ----------------------------------------------------------------------------
create or replace function app.job_bewerbung_empfaenger(p_job_id uuid)
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
    select coalesce(nullif(sp.bewerbungs_email, ''), nullif(sp.email, ''))
      from public.school_jobs j
      join public.driving_schools ds on ds.id = j.school_id and ds.is_listed = true
      left join public.school_profiles sp on sp.school_id = j.school_id
     where j.id = p_job_id
       and j.aktiv = true
       and (j.gueltig_bis is null or j.gueltig_bis >= current_date)
  );
end
$fn$;

revoke all on function app.job_bewerbung_empfaenger(uuid) from public;
grant execute on function app.job_bewerbung_empfaenger(uuid) to app_user;

-- ----------------------------------------------------------------------------
-- (3) zaehle_ereignis: Ort-Disambiguierung, strikt bei Mehrdeutigkeit
-- ----------------------------------------------------------------------------
drop function if exists app.zaehle_ereignis(text, text);

create or replace function app.zaehle_ereignis(p_slug text, p_typ text, p_ort text default null)
returns boolean
language plpgsql volatile security definer
set search_path = pg_catalog, pg_temp
as $fn$
declare
  v_schulen uuid[];
  v_cap constant integer := 5000; -- harter Tages-Deckel je Schule/Typ
begin
  if p_typ is null or p_typ not in ('tel_klick') then
    return false;
  end if;
  if p_slug is null or length(p_slug) > 200 then
    return false;
  end if;
  if p_ort is not null and length(p_ort) > 120 then
    return false;
  end if;

  select array_agg(ds.id) into v_schulen
    from public.driving_schools ds
   where ds.slug = p_slug and ds.is_listed = true
     and (p_ort is null or ds.ort = p_ort);

  -- STRIKT: genau EIN Treffer, sonst nicht zählen (Slugs sind nur je
  -- (land, ort) eindeutig — Fehlzurechnung wiegt schwerer als Untererfassung).
  if v_schulen is null or array_length(v_schulen, 1) is distinct from 1 then
    return false;
  end if;

  insert into public.ereignis_zaehler as ez (school_id, ereignis_typ, tag, anzahl)
       values (v_schulen[1], p_typ, current_date, 1)
  on conflict on constraint uq_ereignis_zaehler
  do update set anzahl = ez.anzahl + 1
        where ez.anzahl < v_cap;

  return true;
end
$fn$;

revoke all on function app.zaehle_ereignis(text, text, text) from public;
grant execute on function app.zaehle_ereignis(text, text, text) to app_user;

-- ----------------------------------------------------------------------------
-- Fail-closed Assertions.
-- ----------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.column_privileges
    where table_schema = 'public' and table_name = 'school_profiles'
      and column_name = 'bewerbungs_email' and grantee = 'app_user'
  ) then
    raise exception '0027: bewerbungs_email ist fuer app_user noch erreichbar.';
  end if;

  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname = 'job_bewerbung_empfaenger'
  ) then
    raise exception '0027: app.job_bewerbung_empfaenger fehlt.';
  end if;

  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname = 'zaehle_ereignis' and p.pronargs = 2
  ) then
    raise exception '0027: alte 2-Parameter-Fassung von zaehle_ereignis existiert noch.';
  end if;
end $$;

reset role;
commit;
