-- 0021_portal_school_prices.sql
-- Portal-Ausbau: strukturierte Preisangaben je Führerscheinklasse (Quelle der Wahrheit
-- für Preisdarstellung/-filter; löst das formlose school_profiles.preise-JSONB ab, das
-- unangetastet bleibt — kein destruktiver Umbau).
--
-- Struktur folgt bewusst dem amtlichen Preisaushang (§ 32 FahrlG, Anlage 4 zu § 7
-- FahrlG-DV): Grundbetrag, Fahrstunde à 45 min, Sonderfahrten GETRENNT NACH FAHRTART
-- (Überland/Autobahn/Dämmerung), Vorstellung zur theoretischen/praktischen Prüfung.
-- Nur so ist die Darstellung als vollständiges Pflichtangaben-Set möglich; Gesamt-/
-- Pauschalpreise werden bewusst NICHT modelliert (Preisklarheit/Preiswahrheit,
-- OLG Celle 13 U 134/12). Behördliche Prüfgebühren (TÜV/DEKRA) sind Drittgebühren
-- und gehören NICHT in diese Tabelle.
--
-- Status-Modell: 'recherchiert' (ohne Gewähr, Default) → 'bestaetigt' (durch die
-- Fahrschule; erst dann grünes Abzeichen im UI — Migration 0008-Linie).
-- `quelle` ist interne Provenienz und bleibt öffentlich GESPERRT (Spalten-Allowlist,
-- 0016-Muster: neue Spalten sind nur sichtbar, wenn ein Feature sie explizit grantet).
--
-- PG16+. Idempotent. Abschließende fail-closed Assertions.

begin;

grant app_owner to current_user;
set role app_owner;

create table if not exists public.school_prices (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.driving_schools(id) on delete cascade,
  -- Technische Klassen-Tokens analog school_profiles.fuehrerscheinklassen (text, kein Enum:
  -- Klassenkatalog kann sich ändern — 0000-Konvention "text + CHECK").
  klasse text not null,
  -- Entgelt-Komponenten laut Preisaushang (Anlage 4). NULL = (noch) nicht erfasst —
  -- Unvollständigkeit wird im UI transparent gemacht, nie stillschweigend ergänzt.
  grundbetrag numeric(10,2),
  fahrstunde_45 numeric(10,2),
  sonderfahrt_ueberland_45 numeric(10,2),
  sonderfahrt_autobahn_45 numeric(10,2),
  sonderfahrt_daemmerung_45 numeric(10,2),
  vorstellung_theorie numeric(10,2),
  vorstellung_praxis numeric(10,2),
  lehrmaterial numeric(10,2),
  waehrung text not null default 'EUR',
  status text not null default 'recherchiert',
  -- Datum, auf das sich die Angaben beziehen (Aushang-/Recherche-Stand); Pflicht fürs UI
  -- („Stand: …"), aber nullable für Altbestände.
  stand date,
  -- Interne Provenienz (z. B. Aushang-URL, Recherche-Notiz) — NICHT öffentlich.
  quelle text,
  aktiv boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_school_prices_school_klasse unique (school_id, klasse)
);

-- Wertebereich-CHECKs (idempotent via drop/add): keine negativen Entgelte, EUR-only,
-- Status-Token-Liste, Klassen-Token-Format (kurz, Aushang-üblich: B, B197, A1, BE, …).
alter table public.school_prices drop constraint if exists chk_school_prices_klasse;
alter table public.school_prices add constraint chk_school_prices_klasse
  check (klasse ~ '^[A-Z][A-Z0-9]{0,5}$');

alter table public.school_prices drop constraint if exists chk_school_prices_status;
alter table public.school_prices add constraint chk_school_prices_status
  check (status in ('recherchiert', 'bestaetigt'));

alter table public.school_prices drop constraint if exists chk_school_prices_waehrung;
alter table public.school_prices add constraint chk_school_prices_waehrung
  check (waehrung = 'EUR');

alter table public.school_prices drop constraint if exists chk_school_prices_nonnegative;
alter table public.school_prices add constraint chk_school_prices_nonnegative
  check (
    coalesce(grundbetrag, 0) >= 0 and coalesce(fahrstunde_45, 0) >= 0
    and coalesce(sonderfahrt_ueberland_45, 0) >= 0 and coalesce(sonderfahrt_autobahn_45, 0) >= 0
    and coalesce(sonderfahrt_daemmerung_45, 0) >= 0 and coalesce(vorstellung_theorie, 0) >= 0
    and coalesce(vorstellung_praxis, 0) >= 0 and coalesce(lehrmaterial, 0) >= 0
  );

-- Größen-Cap auf freien Text (0019-Muster; BYTES via octet_length).
alter table public.school_prices drop constraint if exists chk_school_prices_quelle_size;
alter table public.school_prices add constraint chk_school_prices_quelle_size
  check (quelle is null or octet_length(quelle) <= 2048);

create index if not exists idx_school_prices_school on public.school_prices (school_id);

-- updated_at automatisch (0000-Funktion).
drop trigger if exists tg_school_prices_updated_at on public.school_prices;
create trigger tg_school_prices_updated_at before update on public.school_prices
  for each row execute function app.tg_set_updated_at();

-- ----------------------------------------------------------------------------
-- RLS: Public-Read = Schule gelistet UND Zeile aktiv (0001-Formel); Pflege durch
-- Schul-Manager (inhaber/verwaltung — Preise sind rechtlich sensibel, kein
-- Fahrlehrer-Write) oder admin. Support darf lesen (keine PII), nicht schreiben.
-- ----------------------------------------------------------------------------
alter table public.school_prices enable row level security;

drop policy if exists school_prices_public_select on public.school_prices;
create policy school_prices_public_select on public.school_prices for select to app_user
  using ((aktiv = true and app.is_school_listed(school_id))
         or app.is_member_of_school(school_id)
         or app.has_platform_role('admin')
         or app.has_platform_role('support'));

drop policy if exists school_prices_write on public.school_prices;
create policy school_prices_write on public.school_prices for all to app_user
  using (app.is_school_manager(school_id) or app.has_platform_role('admin'))
  with check (app.is_school_manager(school_id) or app.has_platform_role('admin'));

-- ----------------------------------------------------------------------------
-- Grants mit Spalten-Allowlist (0016-Muster): SELECT ohne `quelle` (intern);
-- INSERT/UPDATE ohne `quelle` (wird nur vom erhöhten Import-/Tooling-Pfad gesetzt)
-- und UPDATE zusätzlich ohne school_id/klasse (Identität der Zeile unveränderlich —
-- Korrektur läuft über neue Zeile/Delete, hält die UNIQUE-Semantik sauber).
-- ----------------------------------------------------------------------------
revoke all on table public.school_prices from app_user;
grant select (
  id, school_id, klasse, grundbetrag, fahrstunde_45,
  sonderfahrt_ueberland_45, sonderfahrt_autobahn_45, sonderfahrt_daemmerung_45,
  vorstellung_theorie, vorstellung_praxis, lehrmaterial,
  waehrung, status, stand, aktiv, created_at, updated_at
) on table public.school_prices to app_user;
grant insert (
  school_id, klasse, grundbetrag, fahrstunde_45,
  sonderfahrt_ueberland_45, sonderfahrt_autobahn_45, sonderfahrt_daemmerung_45,
  vorstellung_theorie, vorstellung_praxis, lehrmaterial,
  waehrung, status, stand, aktiv
) on table public.school_prices to app_user;
grant update (
  grundbetrag, fahrstunde_45,
  sonderfahrt_ueberland_45, sonderfahrt_autobahn_45, sonderfahrt_daemmerung_45,
  vorstellung_theorie, vorstellung_praxis, lehrmaterial,
  waehrung, status, stand, aktiv
) on table public.school_prices to app_user;
grant delete on table public.school_prices to app_user;

-- ----------------------------------------------------------------------------
-- Fail-closed Assertions: RLS an, Policies da, Spaltenprivilegien exakt, Trigger da,
-- Eigentum bei app_owner (0015-Linie).
-- ----------------------------------------------------------------------------
do $$
declare
  v record;
begin
  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = 'school_prices' and c.relrowsecurity
  ) then
    raise exception '0021: RLS auf public.school_prices ist nicht aktiviert';
  end if;

  if (select relowner::regrole::text from pg_class where oid = 'public.school_prices'::regclass)
     is distinct from 'app_owner' then
    raise exception '0021: public.school_prices gehoert nicht app_owner';
  end if;

  for v in
    select * from (values
      ('school_prices_public_select'), ('school_prices_write')
    ) as expected(polname)
  loop
    if not exists (
      select 1 from pg_policy p where p.polrelid = 'public.school_prices'::regclass
        and p.polname = v.polname
    ) then
      raise exception '0021: Policy % fehlt auf public.school_prices', v.polname;
    end if;
  end loop;

  for v in
    select * from (values
      ('grundbetrag', 'SELECT', true),
      ('fahrstunde_45', 'SELECT', true),
      ('sonderfahrt_ueberland_45', 'SELECT', true),
      ('sonderfahrt_autobahn_45', 'SELECT', true),
      ('sonderfahrt_daemmerung_45', 'SELECT', true),
      ('status', 'SELECT', true),
      ('stand', 'SELECT', true),
      ('quelle', 'SELECT', false),
      ('quelle', 'INSERT', false),
      ('quelle', 'UPDATE', false),
      ('school_id', 'INSERT', true),
      ('school_id', 'UPDATE', false),
      ('klasse', 'INSERT', true),
      ('klasse', 'UPDATE', false),
      ('status', 'UPDATE', true)
    ) as expected(colname, privname, allowed)
  loop
    if has_column_privilege('app_user', 'public.school_prices', v.colname, v.privname)
       is distinct from v.allowed then
      raise exception '0021: app_user %-Privileg fuer school_prices.% erwartet %',
        v.privname, v.colname, v.allowed;
    end if;
  end loop;

  if not exists (
    select 1 from pg_trigger t
     where t.tgrelid = 'public.school_prices'::regclass
       and t.tgname = 'tg_school_prices_updated_at' and not t.tgisinternal
  ) then
    raise exception '0021: Trigger tg_school_prices_updated_at fehlt';
  end if;

  for v in
    select * from (values
      ('chk_school_prices_klasse'), ('chk_school_prices_status'),
      ('chk_school_prices_waehrung'), ('chk_school_prices_nonnegative'),
      ('chk_school_prices_quelle_size')
    ) as expected(conname)
  loop
    if not exists (
      select 1 from pg_constraint c where c.conrelid = 'public.school_prices'::regclass
        and c.conname = v.conname
    ) then
      raise exception '0021: CHECK % fehlt auf public.school_prices', v.conname;
    end if;
  end loop;
end
$$;

reset role;

commit;
