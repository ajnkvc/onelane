-- 0032_feature_flags_sichtbarkeit.sql
-- Sicherheits-Abnahme-Fix (2026-07-03): GLOBALE Feature-Flags waren fuer JEDEN
-- authentifizierten Nutzer lesbar (0029) — damit leakte bereits die EXISTENZ
-- vertraulicher Flags (z. B. key 'pay') an Schueler/alle Rollen.
--
-- Neuer Zuschnitt:
--   * scope='global'  → NUR platform admin (einziger V1-Konsument ist der
--                       geschuetzte intern-Bereich).
--   * scope='school'  → Mitglieder der Schule (GEWOLLT: eine freigeschaltete
--                       Schule darf IHR eigenes Flag sehen — das ist die
--                       spaetere Aktivierungs-Mechanik) + admin.
--
-- PG16+. Idempotent. Fail-closed Assertion.

begin;

grant app_owner to current_user;
set role app_owner;

drop policy if exists feature_flags_select on public.feature_flags;
create policy feature_flags_select on public.feature_flags for select to app_user
  using ((scope = 'school' and app.is_member_of_school(school_id))
         or app.has_platform_role('admin'));

do $$
declare
  v_def text;
begin
  select pg_get_expr(p.polqual, p.polrelid) into v_def
    from pg_policy p
   where p.polrelid = 'public.feature_flags'::regclass and p.polname = 'feature_flags_select';
  if v_def is null then
    raise exception '0032: feature_flags_select fehlt.';
  end if;
  -- fail-closed: die alte Jeder-Eingeloggte-Klausel darf nicht mehr vorkommen.
  if v_def like '%current_user_id() IS NOT NULL%' then
    raise exception '0032: globale Flags sind weiterhin fuer alle Authentifizierten lesbar.';
  end if;
end $$;

reset role;
commit;
