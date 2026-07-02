-- 0025_portal_jobs_gehalt_kuratierung.sql
-- Portal-Ausbau: Jobbörse M5 — strukturierte Gehalts-/Stellen-Metadaten,
-- kuratiertes Rechte-Modell und Bewerbungs-Delta (Muster 0016/0019/0021–0023).
--
--  (1) school_jobs: reduziertes Phase-1-Set an strukturierten Feldern
--      (Gehaltsspanne, Vergütungsmodell, Klassen, Quereinstieg, Arbeitszeit,
--      Prüf-/Veröffentlichungsdatum).
--
--      GEHALTS-INTEGRITÄT IST DB-HART (kein Render-Gate): Der CHECK
--      chk_school_jobs_gehalt erlaubt AUSSCHLIESSLICH zwei Zustände —
--      ENTWEDER alle vier Gehaltsfelder NULL ODER alle vier gesetzt mit
--      bis >= von, plausibler Obergrenze je Zeitraum und gesetztem
--      gehalt_bestaetigt_am. BEGRÜNDUNG: Anzeige-Regel ist „Gehalt NUR bei
--      kompletter, von der Fahrschule bestätigter Spanne" (Review-Auflagen).
--      Ein UI-Gate allein könnte durch neue Render-Pfade (API, JSON-LD, Feeds)
--      umgangen werden — hier existieren unbestätigte/halbe Gehaltsangaben
--      in der Tabelle schlicht NIE, also kann auch nichts leaken.
--
--  (2) Rechte-Modell Phase 1 KURATIERT: school_jobs-Writes NICHT mehr für
--      Schul-Manager (kein Arbeitgeber-Self-Service in M5) — nur noch
--      admin + editor (= Kurator-Rolle der Plattform, wie blog_posts).
--      Der breite Tabellen-Grant aus 0001 wird durch Spalten-Allowlists
--      ersetzt (0016-Muster). Public-SELECT (Gültigkeitsfenster, 0023/K8)
--      bleibt unverändert.
--
--  (3) job_applications-Delta: bewerber_status (+Backfill 'unbekannt'),
--      klassen, Verfügbarkeit, einwilligung_weitergabe_at (ab jetzt Pflicht
--      im WITH CHECK der Public-Insert-Policy — konsistent zu leads/0022)
--      sowie CV-/Foto-METADATEN (nur Dateiname+Größe; die Dateien selbst
--      werden NIE gespeichert — Durchleitungs-Prinzip, siehe modules/jobs).
--
--  (4) school_profiles.bewerbungs_email: je Schule individualisierbare
--      Bewerbungs-Adresse, INTERN wie `email` (wird nie öffentlich gerendert;
--      App-Fallback: bewerbungs_email ?? email).
--
--  (5) Purge/Retention: privilegierte, auditierbare Wartungsfunktion
--      app.purge_job_applications(p_stichtag) — Soft-Delete → Hard-Purge für
--      erledigte Bewerbungen älter 6 Monate. HINWEIS (bewusst offen): dieselbe
--      Retention-Frage stellt sich für `leads` — wird NICHT hier gelöst,
--      sondern als eigener Punkt mit Anwalts-Klärung (DSGVO-Memo) geführt.
--
-- PG16+. Idempotent. Nichts Destruktives. Abschließende fail-closed Assertions.

begin;

grant app_owner to current_user;
set role app_owner;

-- ----------------------------------------------------------------------------
-- (0) Helfer: Array-Eindeutigkeit für CHECK-Constraints (CHECKs erlauben keine
-- direkten Subqueries — die IMMUTABLE-Funktion kapselt den Distinct-Vergleich).
-- ----------------------------------------------------------------------------
create or replace function app.array_eindeutig(p_werte text[])
returns boolean
language sql immutable
set search_path = pg_catalog, pg_temp
as $fn$
  select p_werte is null
      or coalesce(cardinality(p_werte), 0) = (select count(distinct w) from unnest(p_werte) w);
$fn$;

revoke all on function app.array_eindeutig(text[]) from public;
-- app_user braucht EXECUTE: CHECK-Constraints laufen mit den Rechten des Schreibenden.
grant execute on function app.array_eindeutig(text[]) to app_user;

-- ----------------------------------------------------------------------------
-- (1) school_jobs: strukturierte Phase-1-Felder
-- ----------------------------------------------------------------------------
alter table public.school_jobs add column if not exists gehalt_von_euro numeric(10,2);
alter table public.school_jobs add column if not exists gehalt_bis_euro numeric(10,2);
alter table public.school_jobs add column if not exists gehalt_zeitraum text;
alter table public.school_jobs add column if not exists gehalt_bestaetigt_am date;
alter table public.school_jobs add column if not exists verguetungsmodell text;
alter table public.school_jobs add column if not exists tarif_hinweis text;
alter table public.school_jobs add column if not exists klassen text[] not null default '{}';
alter table public.school_jobs add column if not exists quereinsteiger_willkommen boolean not null default false;
alter table public.school_jobs add column if not exists quereinsteiger_finanzierung text not null default 'keine';
alter table public.school_jobs add column if not exists arbeitszeit_modell text;
alter table public.school_jobs add column if not exists samstag_dienst boolean;
alter table public.school_jobs add column if not exists geprueft_am date;
alter table public.school_jobs add column if not exists erstveroeffentlicht_am date;

-- Gehalts-Integrität DB-HART (Begründung siehe Kopf-Kommentar): alles-oder-nichts,
-- bis >= von, Plausibilitäts-Deckel je Zeitraum (impliziert die Zeitraum-Allowlist
-- über `else false`), Bestätigungsdatum nie in der Zukunft.
alter table public.school_jobs drop constraint if exists chk_school_jobs_gehalt;
alter table public.school_jobs add constraint chk_school_jobs_gehalt
  check (
    (gehalt_von_euro is null and gehalt_bis_euro is null
     and gehalt_zeitraum is null and gehalt_bestaetigt_am is null)
    or
    (gehalt_von_euro is not null and gehalt_bis_euro is not null
     and gehalt_zeitraum is not null and gehalt_bestaetigt_am is not null
     and gehalt_von_euro > 0
     and gehalt_bis_euro >= gehalt_von_euro
     and gehalt_bestaetigt_am <= current_date
     and case gehalt_zeitraum
           when 'stunde' then gehalt_bis_euro <= 500
           when 'monat'  then gehalt_bis_euro <= 50000
           when 'jahr'   then gehalt_bis_euro <= 500000
           else false
         end)
  );

alter table public.school_jobs drop constraint if exists chk_school_jobs_verguetungsmodell;
alter table public.school_jobs add constraint chk_school_jobs_verguetungsmodell
  check (verguetungsmodell is null
         or verguetungsmodell in ('fix', 'fix_plus_umsatz', 'nach_vereinbarung'));

alter table public.school_jobs drop constraint if exists chk_school_jobs_tarif_hinweis_size;
alter table public.school_jobs add constraint chk_school_jobs_tarif_hinweis_size
  check (tarif_hinweis is null or octet_length(tarif_hinweis) <= 300);

-- Klassen-Allowlist (MUSS synchron bleiben mit JOB_KLASSEN in src/modules/jobs/schema.ts)
-- + Längen-Cap + Duplikat-Schutz (Distinct-Vergleich via app.array_eindeutig).
alter table public.school_jobs drop constraint if exists chk_school_jobs_klassen;
alter table public.school_jobs add constraint chk_school_jobs_klassen
  check (
    klassen <@ array['AM','A1','A2','A','B','B196','B197','BE','C1','C1E','C','CE','D1','D1E','D','DE','L','T']::text[]
    and coalesce(array_length(klassen, 1), 0) <= 12
    and app.array_eindeutig(klassen)
  );

alter table public.school_jobs drop constraint if exists chk_school_jobs_quereinsteiger_finanzierung;
alter table public.school_jobs add constraint chk_school_jobs_quereinsteiger_finanzierung
  check (quereinsteiger_finanzierung in ('keine', 'anteilig', 'voll', 'nach_vereinbarung'));

alter table public.school_jobs drop constraint if exists chk_school_jobs_arbeitszeit_modell;
alter table public.school_jobs add constraint chk_school_jobs_arbeitszeit_modell
  check (arbeitszeit_modell is null
         or arbeitszeit_modell in ('vollzeit', 'teilzeit', 'flexibel'));

-- Prüf-/Veröffentlichungsdaten liegen nie in der Zukunft (ehrliche „geprüft am"-Zeile).
alter table public.school_jobs drop constraint if exists chk_school_jobs_daten_plausibel;
alter table public.school_jobs add constraint chk_school_jobs_daten_plausibel
  check (
    (geprueft_am is null or geprueft_am <= current_date)
    and (erstveroeffentlicht_am is null or erstveroeffentlicht_am <= current_date)
  );

-- ----------------------------------------------------------------------------
-- (2) Rechte-Modell KURATIERT: Writes nur admin/editor; Spalten-Allowlists
-- statt des breiten 0001-Grants (select,insert,update,delete auf ALLES).
-- ----------------------------------------------------------------------------
drop policy if exists school_jobs_write on public.school_jobs;
create policy school_jobs_write on public.school_jobs for all to app_user
  using (app.has_platform_role('editor') or app.has_platform_role('admin'))
  with check (app.has_platform_role('editor') or app.has_platform_role('admin'));

revoke all on table public.school_jobs from app_user;
-- SELECT: alle Anzeige-Spalten (Zeilen-Gating macht die Public-Policy aus 0023).
grant select (
  id, school_id, titel, beschreibung, art, aktiv, created_at, updated_at,
  slug, beschaeftigungsart, verguetung_text, gueltig_bis, position,
  gehalt_von_euro, gehalt_bis_euro, gehalt_zeitraum, gehalt_bestaetigt_am,
  verguetungsmodell, tarif_hinweis, klassen, quereinsteiger_willkommen,
  quereinsteiger_finanzierung, arbeitszeit_modell, samstag_dienst,
  geprueft_am, erstveroeffentlicht_am
) on table public.school_jobs to app_user;
-- INSERT: exakt die Kuratierungs-Felder (id/created_at/updated_at via Default/Trigger).
grant insert (
  school_id, titel, beschreibung, art, aktiv,
  slug, beschaeftigungsart, verguetung_text, gueltig_bis, position,
  gehalt_von_euro, gehalt_bis_euro, gehalt_zeitraum, gehalt_bestaetigt_am,
  verguetungsmodell, tarif_hinweis, klassen, quereinsteiger_willkommen,
  quereinsteiger_finanzierung, arbeitszeit_modell, samstag_dienst,
  geprueft_am, erstveroeffentlicht_am
) on table public.school_jobs to app_user;
-- UPDATE: wie INSERT, aber OHNE school_id (Zeilen-Identität fix, 0021-Muster).
grant update (
  titel, beschreibung, art, aktiv,
  slug, beschaeftigungsart, verguetung_text, gueltig_bis, position,
  gehalt_von_euro, gehalt_bis_euro, gehalt_zeitraum, gehalt_bestaetigt_am,
  verguetungsmodell, tarif_hinweis, klassen, quereinsteiger_willkommen,
  quereinsteiger_finanzierung, arbeitszeit_modell, samstag_dienst,
  geprueft_am, erstveroeffentlicht_am
) on table public.school_jobs to app_user;
-- DELETE bleibt möglich (Anzeigen sind keine PII) — zeilen-gated auf admin/editor.
grant delete on table public.school_jobs to app_user;

-- ----------------------------------------------------------------------------
-- (3) job_applications-Delta
-- ----------------------------------------------------------------------------
alter table public.job_applications add column if not exists bewerber_status text;
alter table public.job_applications add column if not exists klassen text[] not null default '{}';
alter table public.job_applications add column if not exists verfuegbar_status text;
alter table public.job_applications add column if not exists verfuegbar_ab date;
alter table public.job_applications add column if not exists einwilligung_weitergabe_at timestamptz;
-- CV-/Foto-METADATEN (Durchleitungs-Prinzip): die Dateien gehen ausschließlich als
-- Mail-Anhang an die Fahrschule und werden bei uns NIE gespeichert. Vorteile: keine
-- Dokumenten-Haltung = kleinere Angriffsfläche; der 6-Monats-Purge bleibt DB-only.
alter table public.job_applications add column if not exists cv_dateiname text;
alter table public.job_applications add column if not exists cv_groesse_bytes integer;
alter table public.job_applications add column if not exists foto_dateiname text;
alter table public.job_applications add column if not exists foto_groesse_bytes integer;

-- Backfill Bestand → 'unbekannt', dann NOT NULL + Default (idempotent).
update public.job_applications set bewerber_status = 'unbekannt' where bewerber_status is null;
alter table public.job_applications alter column bewerber_status set default 'unbekannt';
alter table public.job_applications alter column bewerber_status set not null;

alter table public.job_applications drop constraint if exists chk_job_applications_bewerber_status;
alter table public.job_applications add constraint chk_job_applications_bewerber_status
  check (bewerber_status in ('fahrlehrer', 'anwaerter', 'quereinsteiger', 'unbekannt'));

alter table public.job_applications drop constraint if exists chk_job_applications_klassen;
alter table public.job_applications add constraint chk_job_applications_klassen
  check (
    klassen <@ array['AM','A1','A2','A','B','B196','B197','BE','C1','C1E','C','CE','D1','D1E','D','DE','L','T']::text[]
    and coalesce(array_length(klassen, 1), 0) <= 12
    and app.array_eindeutig(klassen)
  );

-- Verfügbarkeit: Datum GENAU DANN, wenn 'zum_datum' (beide Richtungen explizit,
-- damit NULL-Status nicht per Drei-Wert-Logik durchrutscht).
alter table public.job_applications drop constraint if exists chk_job_applications_verfuegbar;
alter table public.job_applications add constraint chk_job_applications_verfuegbar
  check (
    (verfuegbar_status is null
     or verfuegbar_status in ('sofort', 'zum_datum', 'flexibel'))
    and (verfuegbar_ab is null or verfuegbar_status = 'zum_datum')
    and (verfuegbar_status is distinct from 'zum_datum' or verfuegbar_ab is not null)
  );

-- Unterlagen-Metadaten: Name+Größe paarweise, sanitisierter Dateiname (nur
-- [A-Za-z0-9._-], max. 120), Größen-CHECK > 0 mit den Modul-Caps (CV 5 MB, Foto 3 MB).
alter table public.job_applications drop constraint if exists chk_job_applications_unterlagen;
alter table public.job_applications add constraint chk_job_applications_unterlagen
  check (
    ((cv_dateiname is null) = (cv_groesse_bytes is null))
    and ((foto_dateiname is null) = (foto_groesse_bytes is null))
    and (cv_dateiname is null or cv_dateiname ~ '^[A-Za-z0-9._-]{1,120}$')
    and (foto_dateiname is null or foto_dateiname ~ '^[A-Za-z0-9._-]{1,120}$')
    and (cv_groesse_bytes is null or (cv_groesse_bytes > 0 and cv_groesse_bytes <= 5242880))
    and (foto_groesse_bytes is null or (foto_groesse_bytes > 0 and foto_groesse_bytes <= 3145728))
  );

-- Public-Insert-Policy: verlangt AB JETZT auch die Weitergabe-Einwilligung
-- (Deckung für die Voll-Weiterleitung der Bewerbung an die Schule; 0022-Linie).
drop policy if exists job_applications_public_insert on public.job_applications;
create policy job_applications_public_insert on public.job_applications for insert to app_user
  with check (
    status = 'neu'
    and deleted_at is null
    and einwilligung_datenschutz_at is not null
    and einwilligung_weitergabe_at is not null
    and exists (
      select 1 from public.school_jobs j
       where j.id = job_id
         and j.aktiv = true
         and app.is_school_listed(j.school_id)
         and (j.gueltig_bis is null or j.gueltig_bis >= current_date)
    )
  );

-- Grants neu aufbauen (0023-Muster + neue Spalten): INSERT exakt Formularfelder,
-- SELECT ohne deleted_at, UPDATE weiterhin NUR status, KEIN DELETE.
revoke all on table public.job_applications from app_user;
grant insert (
  job_id, name, email, telefon, nachricht,
  bewerber_status, klassen, verfuegbar_status, verfuegbar_ab,
  cv_dateiname, cv_groesse_bytes, foto_dateiname, foto_groesse_bytes,
  einwilligung_datenschutz_at, einwilligung_weitergabe_at, quelle_pfad
) on table public.job_applications to app_user;
grant select (
  id, job_id, name, email, telefon, nachricht,
  bewerber_status, klassen, verfuegbar_status, verfuegbar_ab,
  cv_dateiname, cv_groesse_bytes, foto_dateiname, foto_groesse_bytes,
  einwilligung_datenschutz_at, einwilligung_weitergabe_at,
  status, quelle_pfad, created_at, updated_at
) on table public.job_applications to app_user;
grant update (status) on table public.job_applications to app_user;

-- ----------------------------------------------------------------------------
-- (4) school_profiles.bewerbungs_email — INTERN wie `email` (nie öffentlich
-- rendern; App-Fallback bewerbungs_email ?? email). Format + Byte-Cap analog
-- der E-Mail-Spalten aus 0022/0023.
-- ----------------------------------------------------------------------------
alter table public.school_profiles add column if not exists bewerbungs_email text;

alter table public.school_profiles drop constraint if exists chk_school_profiles_bewerbungs_email;
alter table public.school_profiles add constraint chk_school_profiles_bewerbungs_email
  check (
    bewerbungs_email is null
    or (bewerbungs_email ~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'
        and octet_length(bewerbungs_email) <= 320)
  );

-- ----------------------------------------------------------------------------
-- (5) Purge/Retention: privilegierte, auditierbare Wartungsfunktion.
--
-- BETRIEBS-RUNBOOK: Aufruf AUSSCHLIESSLICH über den erhöhten Betreiber-Pfad
-- (Tooling-/Owner-Verbindung, z. B. via withElevatedAudit oder manuell):
--     select app.purge_job_applications();                       -- Standard: 6 Monate
--     select app.purge_job_applications('2026-01-01'::timestamptz); -- expliziter Stichtag
-- Zwei Stufen: (a) erledigte Bewerbungen älter Stichtag → Soft-Delete
-- (deleted_at = now()); (b) bereits soft-gelöschte älter Stichtag → Hard-Delete.
-- Dadurch vergeht zwischen Soft- und Hard-Delete mindestens eine weitere
-- Purge-Periode (Wiederherstellungs-Fenster). Jeder Lauf schreibt ein
-- security_events-System-Event mit den Zählern (auditierbar, keine PII).
--
-- Absicherung (zweischichtig, fail-closed):
--   * KEIN EXECUTE-Grant für app_user/public → 42501 im regulären Request-Pfad.
--   * GUC-Gate in der Funktion: app.current_user_id() muss NULL sein (nur der
--     erhöhte Server-/Betreiber-Pfad ohne Nutzerkontext).
--   * Stichtag-Gate: die 6-Monats-Retention kann nicht unterschritten werden.
-- ----------------------------------------------------------------------------
create or replace function app.purge_job_applications(
  p_stichtag timestamptz default now() - interval '6 months'
)
returns jsonb
language plpgsql volatile security definer
set search_path = pg_catalog, pg_temp
as $fn$
declare
  v_soft integer := 0;
  v_hard integer := 0;
begin
  if app.current_user_id() is not null then
    raise exception 'purge_job_applications: nur der erhoehte Betreiber-Pfad (ohne Nutzerkontext) darf purgen'
      using errcode = '42501';
  end if;
  if p_stichtag is null or p_stichtag > now() - interval '6 months' then
    raise exception 'purge_job_applications: Stichtag unterschreitet die 6-Monats-Retention'
      using errcode = '22023';
  end if;

  update public.job_applications
     set deleted_at = now()
   where deleted_at is null
     and status = 'erledigt'
     and updated_at < p_stichtag;
  get diagnostics v_soft = row_count;

  delete from public.job_applications
   where deleted_at is not null
     and deleted_at < p_stichtag;
  get diagnostics v_hard = row_count;

  insert into public.security_events (actor_user_id, event_type, initiator_type, target_table, metadata)
  values (null, 'job_applications_purge', 'maintenance', 'job_applications',
          jsonb_build_object(
            'stichtag', to_char(p_stichtag at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
            'soft_geloescht', v_soft,
            'hart_geloescht', v_hard));

  return jsonb_build_object('soft_geloescht', v_soft, 'hart_geloescht', v_hard);
end
$fn$;

revoke all on function app.purge_job_applications(timestamptz) from public;
-- BEWUSST kein Grant an app_user: Purge läuft nur über die Betreiber-Rolle.

-- ----------------------------------------------------------------------------
-- Fail-closed Assertions.
-- ----------------------------------------------------------------------------
do $$
declare
  v record;
  v_qual text;
begin
  -- Neue Spalten vorhanden.
  for v in
    select * from (values
      ('school_jobs', 'gehalt_von_euro'), ('school_jobs', 'gehalt_bis_euro'),
      ('school_jobs', 'gehalt_zeitraum'), ('school_jobs', 'gehalt_bestaetigt_am'),
      ('school_jobs', 'verguetungsmodell'), ('school_jobs', 'tarif_hinweis'),
      ('school_jobs', 'klassen'), ('school_jobs', 'quereinsteiger_willkommen'),
      ('school_jobs', 'quereinsteiger_finanzierung'), ('school_jobs', 'arbeitszeit_modell'),
      ('school_jobs', 'samstag_dienst'), ('school_jobs', 'geprueft_am'),
      ('school_jobs', 'erstveroeffentlicht_am'),
      ('job_applications', 'bewerber_status'), ('job_applications', 'klassen'),
      ('job_applications', 'verfuegbar_status'), ('job_applications', 'verfuegbar_ab'),
      ('job_applications', 'einwilligung_weitergabe_at'),
      ('job_applications', 'cv_dateiname'), ('job_applications', 'cv_groesse_bytes'),
      ('job_applications', 'foto_dateiname'), ('job_applications', 'foto_groesse_bytes'),
      ('school_profiles', 'bewerbungs_email')
    ) as expected(tabname, colname)
  loop
    if not exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = v.tabname and column_name = v.colname
    ) then
      raise exception '0025: Spalte %.% fehlt', v.tabname, v.colname;
    end if;
  end loop;

  -- CHECKs vorhanden.
  for v in
    select * from (values
      ('school_jobs', 'chk_school_jobs_gehalt'),
      ('school_jobs', 'chk_school_jobs_verguetungsmodell'),
      ('school_jobs', 'chk_school_jobs_tarif_hinweis_size'),
      ('school_jobs', 'chk_school_jobs_klassen'),
      ('school_jobs', 'chk_school_jobs_quereinsteiger_finanzierung'),
      ('school_jobs', 'chk_school_jobs_arbeitszeit_modell'),
      ('school_jobs', 'chk_school_jobs_daten_plausibel'),
      ('job_applications', 'chk_job_applications_bewerber_status'),
      ('job_applications', 'chk_job_applications_klassen'),
      ('job_applications', 'chk_job_applications_verfuegbar'),
      ('job_applications', 'chk_job_applications_unterlagen'),
      ('school_profiles', 'chk_school_profiles_bewerbungs_email')
    ) as expected(tabname, conname)
  loop
    if not exists (
      select 1 from pg_constraint c
        join pg_class t on t.oid = c.conrelid
        join pg_namespace n on n.oid = t.relnamespace
       where n.nspname = 'public' and t.relname = v.tabname and c.conname = v.conname
    ) then
      raise exception '0025: CHECK % auf public.% fehlt', v.conname, v.tabname;
    end if;
  end loop;

  -- Backfill vollständig (kein NULL-Bestand).
  if exists (select 1 from public.job_applications where bewerber_status is null) then
    raise exception '0025: bewerber_status-Backfill unvollstaendig';
  end if;

  -- Kuratiertes Rechte-Modell: Write-Policy referenziert admin/editor und
  -- KEINE Schul-Rollen mehr.
  select coalesce(pg_get_expr(p.polqual, p.polrelid), '') into v_qual
    from pg_policy p
   where p.polrelid = 'public.school_jobs'::regclass and p.polname = 'school_jobs_write';
  if v_qual is null then
    raise exception '0025: Policy school_jobs_write fehlt';
  end if;
  if v_qual not like '%has_platform_role%' then
    raise exception '0025: school_jobs_write ohne Plattformrollen-Gate';
  end if;
  if v_qual like '%is_school_manager%' or v_qual like '%is_member_of_school%' then
    raise exception '0025: school_jobs_write erlaubt noch Schul-Rollen (Phase 1 ist kuratiert)';
  end if;

  -- Public-SELECT-Policy (Gültigkeitsfenster, 0023) unangetastet.
  if not exists (
    select 1 from pg_policy p
     where p.polrelid = 'public.school_jobs'::regclass
       and p.polname = 'school_jobs_public_select'
       and coalesce(pg_get_expr(p.polqual, p.polrelid), '') like '%gueltig_bis%'
  ) then
    raise exception '0025: school_jobs_public_select ohne gueltig_bis-Fenster';
  end if;

  -- Public-Insert-Policy verlangt die Weitergabe-Einwilligung.
  if not exists (
    select 1 from pg_policy p
     where p.polrelid = 'public.job_applications'::regclass
       and p.polname = 'job_applications_public_insert'
       and coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '') like '%einwilligung_weitergabe_at%'
  ) then
    raise exception '0025: job_applications_public_insert ohne einwilligung_weitergabe_at';
  end if;

  -- Spaltenprivilegien school_jobs (Allowlist statt breitem 0001-Grant).
  for v in
    select * from (values
      ('public.school_jobs', 'titel', 'SELECT', true),
      ('public.school_jobs', 'gehalt_von_euro', 'SELECT', true),
      ('public.school_jobs', 'klassen', 'SELECT', true),
      ('public.school_jobs', 'geprueft_am', 'SELECT', true),
      ('public.school_jobs', 'school_id', 'INSERT', true),
      ('public.school_jobs', 'titel', 'INSERT', true),
      ('public.school_jobs', 'id', 'INSERT', false),
      ('public.school_jobs', 'created_at', 'INSERT', false),
      ('public.school_jobs', 'updated_at', 'INSERT', false),
      ('public.school_jobs', 'titel', 'UPDATE', true),
      ('public.school_jobs', 'school_id', 'UPDATE', false),
      ('public.school_jobs', 'created_at', 'UPDATE', false),
      ('public.job_applications', 'bewerber_status', 'INSERT', true),
      ('public.job_applications', 'klassen', 'INSERT', true),
      ('public.job_applications', 'verfuegbar_status', 'INSERT', true),
      ('public.job_applications', 'einwilligung_weitergabe_at', 'INSERT', true),
      ('public.job_applications', 'cv_dateiname', 'INSERT', true),
      ('public.job_applications', 'cv_groesse_bytes', 'INSERT', true),
      ('public.job_applications', 'status', 'INSERT', false),
      ('public.job_applications', 'id', 'INSERT', false),
      ('public.job_applications', 'deleted_at', 'INSERT', false),
      ('public.job_applications', 'status', 'UPDATE', true),
      ('public.job_applications', 'bewerber_status', 'UPDATE', false),
      ('public.job_applications', 'cv_dateiname', 'UPDATE', false),
      ('public.job_applications', 'name', 'UPDATE', false),
      ('public.job_applications', 'bewerber_status', 'SELECT', true),
      ('public.job_applications', 'cv_dateiname', 'SELECT', true),
      ('public.job_applications', 'deleted_at', 'SELECT', false)
    ) as expected(relname, colname, privname, allowed)
  loop
    if has_column_privilege('app_user', v.relname, v.colname, v.privname)
       is distinct from v.allowed then
      raise exception '0025: app_user %-Privileg fuer %.% erwartet %',
        v.privname, v.relname, v.colname, v.allowed;
    end if;
  end loop;

  if has_table_privilege('app_user', 'public.job_applications', 'DELETE') then
    raise exception '0025: app_user darf job_applications nicht DELETEn';
  end if;

  -- Funktions-Gates: array_eindeutig für app_user (CHECK-Auswertung), Purge NICHT.
  if not has_function_privilege('app_user', 'app.array_eindeutig(text[])', 'EXECUTE') then
    raise exception '0025: app_user muss app.array_eindeutig ausfuehren duerfen (CHECKs)';
  end if;
  if has_function_privilege('app_user', 'app.purge_job_applications(timestamptz)', 'EXECUTE') then
    raise exception '0025: app_user darf app.purge_job_applications NICHT ausfuehren';
  end if;
end
$$;

reset role;

commit;
