-- 0018_public_url_constraints.sql
-- Phase-0 Re-Audit (Block 7): DB-CHECK-Constraints auf öffentlich ausgegebene URL-Felder
-- (F-040 + H3 stored-URL-XSS defense-in-depth). Ergänzt die Laufzeit-Validierung
-- (normalizePublicHttpUrl in src/lib/public-config.ts): selbst wenn ein Tooling-/Import-Pfad
-- die App-Validierung umgeht, kann kein `javascript:`/`data:`-Link und keine überlange URL
-- in den Belegdatenbestand gelangen.
--
-- website: NUR http(s) + Längen-Cap (wird als href + JSON-LD-url ausgegeben → XSS-relevant).
-- logo_url / school_images.url: Längen-Cap (kein Scheme-Zwang — können Storage-/relative Pfade sein;
--   <img src> führt `javascript:` ohnehin nicht aus).

begin;
grant app_owner to current_user;
set role app_owner;

alter table public.school_profiles drop constraint if exists chk_school_profiles_website_url;
alter table public.school_profiles add constraint chk_school_profiles_website_url
  -- ~* = case-insensitiv (deckungsgleich mit normalizePublicHttpUrl, das HTTPS:// akzeptiert).
  check (website is null or (website ~* '^https?://' and length(website) <= 2048));

alter table public.school_profiles drop constraint if exists chk_school_profiles_logo_url_len;
alter table public.school_profiles add constraint chk_school_profiles_logo_url_len
  check (logo_url is null or length(logo_url) <= 2048);

alter table public.school_images drop constraint if exists chk_school_images_url_len;
alter table public.school_images add constraint chk_school_images_url_len
  check (url is null or length(url) <= 2048);

-- Fail-closed Validierung: Constraints müssen existieren.
do $$
declare
  v record;
begin
  for v in
    select * from (values
      ('school_profiles', 'chk_school_profiles_website_url'),
      ('school_profiles', 'chk_school_profiles_logo_url_len'),
      ('school_images', 'chk_school_images_url_len')
    ) as expected(table_name, constraint_name)
  loop
    if not exists (
      select 1 from pg_constraint c
        join pg_class t on t.oid = c.conrelid
        join pg_namespace n on n.oid = t.relnamespace
       where n.nspname = 'public' and t.relname = v.table_name and c.conname = v.constraint_name
    ) then
      raise exception '0018: CHECK % auf %.% fehlt', v.constraint_name, 'public', v.table_name;
    end if;
  end loop;
end
$$;

reset role;
commit;
