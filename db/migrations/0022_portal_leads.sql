-- 0022_portal_leads.sql
-- Portal-Ausbau: Lead-/Anfrage-Tabelle — der ERSTE anonyme Schreibpfad der Plattform.
--
-- Sicherheitsmodell (bewusst eng):
--   * INSERT ist für app_user OHNE Claims erlaubt (anonymer Portal-Besucher), aber nur
--     mit präzisem WITH CHECK: Ziel-Schule ist gelistet, Einwilligungen gesetzt,
--     Status ist 'neu', kein Soft-Delete. Der App-Pfad läuft ausschließlich über den
--     dedizierten DAL-Kontext (withPublicSubmissionContext) — withAnonContext bleibt
--     read-only (F-054) und kann hier NICHT schreiben.
--   * KEIN anonymes SELECT: INSERT erfolgt ohne RETURNING (RLS wendet SELECT-Policies
--     auf RETURNING an — anonyme Rückgabe würde hart scheitern; so ist es gewollt).
--   * SELECT/UPDATE nur Schul-Manager der Ziel-Schule + admin. KEIN support-Zugriff
--     (PII-Linie aus 0016: Support bleibt aus PII-Tabellen draußen).
--   * UPDATE ist per Spalten-Grant auf `status` beschränkt — PII ist für app_user
--     unveränderlich (append-only-Charakter); DELETE hat weder Grant noch Policy.
--   * Erasure-by-Design: FK RESTRICT (kein CASCADE auf PII-Pfaden), Soft-Delete-Spalte
--     deleted_at; endgültige Löschung/Pseudonymisierung nur über den erhöhten,
--     auditierten Betreiber-Pfad. Aufbewahrungsfristen: extern mit Anwalt (DSGVO-Memo).
--   * Minderjährigen-Gate: ist_minderjaehrig ⇒ Guardian-Kontakt Pflicht (eigener,
--     atomarer Datensatz-Teil; Datenminimierung — KEIN Geburtsdatum).
--   * Größen-Caps auf jedem Freitextfeld (0019-Muster, BYTES).
--
-- PG16+. Idempotent. Abschließende fail-closed Assertions.

begin;

grant app_owner to current_user;
set role app_owner;

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  -- RESTRICT statt CASCADE: Leads sind PII — eine Schul-Löschung darf sie nicht
  -- stillschweigend mitreißen (Erasure-Konzept: erst Leads behandeln, dann Schule).
  school_id uuid not null references public.driving_schools(id) on delete restrict,
  klasse text not null,
  zeitraum text not null default 'sofort',
  vorname text not null,
  nachname text,
  email text,
  telefon text,
  nachricht text,
  ist_minderjaehrig boolean not null default false,
  guardian_name text,
  guardian_email text,
  guardian_telefon text,
  -- Einwilligungen (Zeitpunkte, serverseitig gesetzt): Datenschutzerklärung +
  -- Weitergabe der Anfrage an GENAU DIESE Schule. Ohne beide kein INSERT (Policy).
  einwilligung_datenschutz_at timestamptz not null,
  einwilligung_weitergabe_at timestamptz not null,
  status text not null default 'neu',
  -- Server-seitig gesetzter Herkunfts-Pfad (nur Pathname, nie Query/PII).
  quelle_pfad text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Wertebereiche + Kontakt-Mindestregel + Minderjährigen-Gate.
alter table public.leads drop constraint if exists chk_leads_klasse;
alter table public.leads add constraint chk_leads_klasse
  check (klasse ~ '^[A-Z][A-Z0-9]{0,5}$');

alter table public.leads drop constraint if exists chk_leads_zeitraum;
alter table public.leads add constraint chk_leads_zeitraum
  check (zeitraum in ('sofort', 'in_1_3_monaten', 'spaeter'));

alter table public.leads drop constraint if exists chk_leads_status;
alter table public.leads add constraint chk_leads_status
  check (status in ('neu', 'gesehen', 'erledigt'));

alter table public.leads drop constraint if exists chk_leads_kontakt;
alter table public.leads add constraint chk_leads_kontakt
  check (email is not null or telefon is not null);

alter table public.leads drop constraint if exists chk_leads_guardian_gate;
alter table public.leads add constraint chk_leads_guardian_gate
  check (
    ist_minderjaehrig = false
    or (guardian_name is not null and (guardian_email is not null or guardian_telefon is not null))
  );

-- Format-Plausibilität (bewusst locker — echte Validierung macht Zod an der Modul-
-- Grenze; die DB verhindert nur grob Unbrauchbares/Injection-Spielraum).
alter table public.leads drop constraint if exists chk_leads_email_format;
alter table public.leads add constraint chk_leads_email_format
  check (email is null or email ~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$');

alter table public.leads drop constraint if exists chk_leads_guardian_email_format;
alter table public.leads add constraint chk_leads_guardian_email_format
  check (guardian_email is null or guardian_email ~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$');

alter table public.leads drop constraint if exists chk_leads_telefon_format;
alter table public.leads add constraint chk_leads_telefon_format
  check (telefon is null or telefon ~ '^[0-9+][0-9 ()/\-]{2,63}$');

alter table public.leads drop constraint if exists chk_leads_guardian_telefon_format;
alter table public.leads add constraint chk_leads_guardian_telefon_format
  check (guardian_telefon is null or guardian_telefon ~ '^[0-9+][0-9 ()/\-]{2,63}$');

-- Größen-Caps (BYTES, 0019-Muster).
alter table public.leads drop constraint if exists chk_leads_text_sizes;
alter table public.leads add constraint chk_leads_text_sizes
  check (
    octet_length(vorname) <= 200
    and (nachname is null or octet_length(nachname) <= 200)
    and (email is null or octet_length(email) <= 320)
    and (telefon is null or octet_length(telefon) <= 64)
    and (nachricht is null or octet_length(nachricht) <= 4000)
    and (guardian_name is null or octet_length(guardian_name) <= 200)
    and (guardian_email is null or octet_length(guardian_email) <= 320)
    and (guardian_telefon is null or octet_length(guardian_telefon) <= 64)
    and (quelle_pfad is null or octet_length(quelle_pfad) <= 512)
  );

create index if not exists idx_leads_school_active
  on public.leads (school_id, created_at desc) where deleted_at is null;

drop trigger if exists tg_leads_updated_at on public.leads;
create trigger tg_leads_updated_at before update on public.leads
  for each row execute function app.tg_set_updated_at();

-- ----------------------------------------------------------------------------
-- RLS: deny-by-default; drei enge Policies (kein DELETE, kein support).
-- ----------------------------------------------------------------------------
alter table public.leads enable row level security;

-- Anonymer/öffentlicher INSERT: nur 'neu', nur gelistete Ziel-Schule, Einwilligungen
-- gesetzt, kein Soft-Delete. (Klaims-lose app_user-Transaktion = Portal-Besucher.)
drop policy if exists leads_public_insert on public.leads;
create policy leads_public_insert on public.leads for insert to app_user
  with check (
    status = 'neu'
    and deleted_at is null
    and einwilligung_datenschutz_at is not null
    and einwilligung_weitergabe_at is not null
    and app.is_school_listed(school_id)
  );

drop policy if exists leads_select on public.leads;
create policy leads_select on public.leads for select to app_user
  using (
    (deleted_at is null and app.is_school_manager(school_id))
    or app.has_platform_role('admin')
  );

drop policy if exists leads_update on public.leads;
create policy leads_update on public.leads for update to app_user
  using (
    (deleted_at is null and app.is_school_manager(school_id))
    or app.has_platform_role('admin')
  )
  with check (
    (deleted_at is null and app.is_school_manager(school_id))
    or app.has_platform_role('admin')
  );

-- ----------------------------------------------------------------------------
-- Grants mit Spalten-Allowlist: INSERT exakt die Formularfelder (id/status/created_at/
-- deleted_at NICHT — Defaults greifen, Status-Wahl unmöglich); UPDATE NUR status
-- (PII für app_user unveränderlich); SELECT ohne deleted_at (intern); KEIN DELETE.
-- ----------------------------------------------------------------------------
revoke all on table public.leads from app_user;
grant insert (
  school_id, klasse, zeitraum, vorname, nachname, email, telefon, nachricht,
  ist_minderjaehrig, guardian_name, guardian_email, guardian_telefon,
  einwilligung_datenschutz_at, einwilligung_weitergabe_at, quelle_pfad
) on table public.leads to app_user;
grant select (
  id, school_id, klasse, zeitraum, vorname, nachname, email, telefon, nachricht,
  ist_minderjaehrig, guardian_name, guardian_email, guardian_telefon,
  einwilligung_datenschutz_at, einwilligung_weitergabe_at, status, quelle_pfad,
  created_at, updated_at
) on table public.leads to app_user;
grant update (status) on table public.leads to app_user;

-- ----------------------------------------------------------------------------
-- Fail-closed Assertions.
-- ----------------------------------------------------------------------------
do $$
declare
  v record;
begin
  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = 'leads' and c.relrowsecurity
  ) then
    raise exception '0022: RLS auf public.leads ist nicht aktiviert';
  end if;

  if (select relowner::regrole::text from pg_class where oid = 'public.leads'::regclass)
     is distinct from 'app_owner' then
    raise exception '0022: public.leads gehoert nicht app_owner';
  end if;

  -- FK muss RESTRICT sein (kein CASCADE auf PII-Pfaden).
  if not exists (
    select 1 from pg_constraint c
     where c.conrelid = 'public.leads'::regclass and c.contype = 'f'
       and c.confrelid = 'public.driving_schools'::regclass and c.confdeltype = 'r'
  ) then
    raise exception '0022: leads.school_id-FK ist nicht ON DELETE RESTRICT';
  end if;

  for v in
    select * from (values
      ('leads_public_insert'), ('leads_select'), ('leads_update')
    ) as expected(polname)
  loop
    if not exists (
      select 1 from pg_policy p where p.polrelid = 'public.leads'::regclass
        and p.polname = v.polname
    ) then
      raise exception '0022: Policy % fehlt auf public.leads', v.polname;
    end if;
  end loop;

  -- Es darf KEINE DELETE-Policy existieren (deny-by-default für DELETE).
  if exists (
    select 1 from pg_policy p where p.polrelid = 'public.leads'::regclass and p.polcmd = 'd'
  ) then
    raise exception '0022: unerwartete DELETE-Policy auf public.leads';
  end if;

  for v in
    select * from (values
      ('vorname', 'INSERT', true),
      ('einwilligung_datenschutz_at', 'INSERT', true),
      ('status', 'INSERT', false),
      ('id', 'INSERT', false),
      ('created_at', 'INSERT', false),
      ('deleted_at', 'INSERT', false),
      ('status', 'UPDATE', true),
      ('vorname', 'UPDATE', false),
      ('email', 'UPDATE', false),
      ('guardian_email', 'UPDATE', false),
      ('deleted_at', 'UPDATE', false),
      ('school_id', 'UPDATE', false),
      ('vorname', 'SELECT', true),
      ('deleted_at', 'SELECT', false)
    ) as expected(colname, privname, allowed)
  loop
    if has_column_privilege('app_user', 'public.leads', v.colname, v.privname)
       is distinct from v.allowed then
      raise exception '0022: app_user %-Privileg fuer leads.% erwartet %',
        v.privname, v.colname, v.allowed;
    end if;
  end loop;

  if has_table_privilege('app_user', 'public.leads', 'DELETE') then
    raise exception '0022: app_user darf leads nicht DELETEn';
  end if;

  if not exists (
    select 1 from pg_trigger t
     where t.tgrelid = 'public.leads'::regclass
       and t.tgname = 'tg_leads_updated_at' and not t.tgisinternal
  ) then
    raise exception '0022: Trigger tg_leads_updated_at fehlt';
  end if;
end
$$;

reset role;

commit;
