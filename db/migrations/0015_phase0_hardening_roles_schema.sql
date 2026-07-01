-- 0015_phase0_hardening_roles_schema.sql
-- Phase-0 Re-Audit (Block 2) — DB-Rollen-/Schema-Invarianten FAIL-CLOSED absichern.
-- Läuft als Migrations-Rolle (current_user), NICHT als app_owner (reine Rollen-/Schema-Admin).
--
-- F-006: app_user darf RLS nie umgehen; app_owner-Owner-Exemption-Modell beruht auf NOLOGIN.
-- F-007: historisches CREATE-Recht auf Schema `public` von PUBLIC entziehen (Objekt-Injection).
--
-- Keine Superuser-Annahme: Die read-only VALIDIERUNGEN sind die harten Schranken (brechen ab,
-- falls Rollen/Schema unsicher provisioniert sind). ALTER/REVOKE sind best-effort.
-- Mindest-PostgreSQL: 15+ (Projekt nutzt security_invoker-Views); das Privilege 'SET' gibt es ab PG16,
-- sonst greift der 'MEMBER'-Fallback (siehe SET-ROLE-Prüfung unten). Ziel: PG17 (Supabase/peaknetworks).

begin;

-- F-006 — harte, read-only Validierung der Rollen-Invarianten.
do $$
declare
  su boolean; brls boolean; cdb boolean; crole boolean; repl boolean; canlogin boolean; can_set boolean;
begin
  -- app_user: existiert + KEINE RLS-umgehenden/eskalierenden Attribute.
  select rolsuper, rolbypassrls, rolcreatedb, rolcreaterole, rolreplication
    into su, brls, cdb, crole, repl
    from pg_roles where rolname = 'app_user';
  if not found then
    raise exception '0015: Rolle app_user fehlt — Provisioning unvollständig';
  end if;
  if su or brls or crole or cdb or repl then
    raise exception
      '0015: app_user hat unsichere Attribute (super=% bypassrls=% createrole=% createdb=% repl=%) — RLS wäre umgehbar',
      su, brls, crole, cdb, repl;
  end if;

  -- app_owner: existiert, NOLOGIN (Owner-Exemption-Modell), kein SUPERUSER.
  select rolsuper, rolcanlogin into su, canlogin from pg_roles where rolname = 'app_owner';
  if not found then
    raise exception '0015: Rolle app_owner fehlt — Provisioning unvollständig';
  end if;
  if canlogin then
    raise exception '0015: app_owner darf NICHT LOGIN haben (Owner umgeht RLS; Sicherheit beruht auf NOLOGIN)';
  end if;
  if su then
    raise exception '0015: app_owner darf kein SUPERUSER sein';
  end if;

  -- app_user darf NICHT (direkt ODER transitiv) SET ROLE app_owner können → RLS-Bypass.
  -- pg_has_role(...) folgt der Mitgliedschaftskette transitiv (nicht nur eine direkte Kante).
  -- SET-ROLE-Erreichbarkeit transitiv prüfen. Privilege-Typ 'SET' existiert erst ab PG16; davor 'MEMBER'
  -- (impliziert auf PG<16 die SET-ROLE-Fähigkeit). Versionsbewusst → fail-closed auf jeder PG-Version.
  if current_setting('server_version_num')::int >= 160000 then
    can_set := pg_has_role('app_user', 'app_owner', 'SET');
  else
    can_set := pg_has_role('app_user', 'app_owner', 'MEMBER');
  end if;
  if can_set then
    raise exception '0015: app_user kann (direkt/transitiv) SET ROLE app_owner — RLS-Bypass möglich';
  end if;

  -- RLS-Tabellen MÜSSEN app_owner gehören: ein Tabellen-Owner umgeht RLS (kein FORCE ROW LEVEL SECURITY).
  -- Positiv formuliert (Owner == app_owner) → schließt auch Drift auf eine DRITTE Owner-Rolle aus.
  -- Nur relrowsecurity-Tabellen (die owner-lose Migrations-Tracking-Tabelle ist bewusst ausgenommen).
  if exists (
    select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where c.relkind in ('r', 'p')
       and n.nspname in ('public', 'app')
       and c.relrowsecurity = true
       and c.relowner <> (select oid from pg_roles where rolname = 'app_owner')
  ) then
    raise exception
      '0015: RLS-Tabelle(n) gehören nicht app_owner — Owner-Exemption umgeht RLS (Eigentümer MUSS app_owner sein)';
  end if;
end
$$;

-- F-006 — best-effort enforce (idempotent). Validierung oben bleibt die Garantie.
do $$
begin
  alter role app_user nosuperuser nocreatedb nocreaterole noreplication;
exception when insufficient_privilege then
  raise notice '0015: app_user-Attribute nicht alterbar (keine Rechte) — Validierung sichert ab';
end
$$;
do $$
begin
  alter role app_user nobypassrls; -- nur Superuser darf das setzen
exception when insufficient_privilege then
  raise notice '0015: NOBYPASSRLS nicht setzbar (kein Superuser) — Validierung sichert ab';
end
$$;

-- F-007 — CREATE auf Schema public von PUBLIC entziehen (app_owner behält explizites CREATE).
do $$
begin
  revoke create on schema public from public;
exception when insufficient_privilege then
  raise notice '0015: REVOKE CREATE ON SCHEMA public FROM public nicht möglich (keine Owner-Rechte)';
end
$$;
-- F-007 — fail-closed Validierung: PUBLIC darf KEIN explizites CREATE mehr auf public haben.
-- (PG15+ Default ohne PUBLIC-CREATE; auf unserem PG17-Ziel ist NULL-ACL bereits sicher.)
do $$
begin
  if exists (
    select 1
      from pg_namespace n, aclexplode(n.nspacl) a
     where n.nspname = 'public' and a.grantee = 0 and a.privilege_type = 'CREATE'
  ) then
    raise exception '0015: PUBLIC hat weiterhin CREATE auf schema public — Provisioning unsicher';
  end if;
end
$$;

commit;
