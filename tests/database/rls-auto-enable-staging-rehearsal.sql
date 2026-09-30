-- Transactional rehearsal only, never a production migration.
-- Requires the isolated staging fixture and absence of the production trigger.
BEGIN;
DO $check$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE name='eggs_staging_legacy_schema_fixture')
     OR to_regclass('public.eggs_profiles') IS NULL
     OR to_regprocedure('public.rls_auto_enable()') IS NOT NULL
     OR EXISTS (SELECT 1 FROM pg_event_trigger WHERE evtname='ensure_rls') THEN
    RAISE EXCEPTION 'Refusing target without isolated staging fixture or with existing trigger';
  END IF;
END
$check$;
CREATE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$
;
GRANT EXECUTE ON FUNCTION public.rls_auto_enable() TO PUBLIC, anon, authenticated, service_role;
CREATE EVENT TRIGGER ensure_rls ON ddl_command_end
  WHEN TAG IN ('CREATE TABLE','CREATE TABLE AS','SELECT INTO')
  EXECUTE FUNCTION public.rls_auto_enable();
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
SET LOCAL ROLE anon;
DO $check$
BEGIN
  PERFORM public.rls_auto_enable();
  RAISE EXCEPTION 'Anonymous caller unexpectedly reached trigger function';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END
$check$;
RESET ROLE;
SET LOCAL ROLE authenticated;
DO $check$
BEGIN
  PERFORM public.rls_auto_enable();
  RAISE EXCEPTION 'Authenticated caller unexpectedly reached trigger function';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END
$check$;
RESET ROLE;
CREATE TABLE public.eggs_rls_revoke_probe_20260923 (id uuid PRIMARY KEY);
DO $check$
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.eggs_rls_revoke_probe_20260923'::regclass)
     OR has_function_privilege('anon','public.rls_auto_enable()','EXECUTE')
     OR has_function_privilege('authenticated','public.rls_auto_enable()','EXECUTE')
     OR NOT has_function_privilege('service_role','public.rls_auto_enable()','EXECUTE') THEN
    RAISE EXCEPTION 'Revoke or automatic RLS verification failed';
  END IF;
END
$check$;
SELECT jsonb_build_object(
  'anon_execute',has_function_privilege('anon','public.rls_auto_enable()','EXECUTE'),
  'authenticated_execute',has_function_privilege('authenticated','public.rls_auto_enable()','EXECUTE'),
  'service_execute',has_function_privilege('service_role','public.rls_auto_enable()','EXECUTE'),
  'automatic_rls',(SELECT relrowsecurity FROM pg_class WHERE oid='public.eggs_rls_revoke_probe_20260923'::regclass),
  'owner',(SELECT pg_get_userbyid(proowner) FROM pg_proc WHERE oid='public.rls_auto_enable()'::regprocedure),
  'function_unchanged',pg_get_functiondef('public.rls_auto_enable()'::regprocedure) = 'CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''pg_catalog''
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN (''CREATE TABLE'', ''CREATE TABLE AS'', ''SELECT INTO'')
      AND object_type IN (''table'',''partitioned table'')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN (''public'') AND cmd.schema_name NOT IN (''pg_catalog'',''information_schema'') AND cmd.schema_name NOT LIKE ''pg_toast%'' AND cmd.schema_name NOT LIKE ''pg_temp%'' THEN
      BEGIN
        EXECUTE format(''alter table if exists %s enable row level security'', cmd.object_identity);
        RAISE LOG ''rls_auto_enable: enabled RLS on %'', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG ''rls_auto_enable: failed to enable RLS on %'', cmd.object_identity;
      END;
     ELSE
        RAISE LOG ''rls_auto_enable: skip % (either system schema or not in enforced list: %.)'', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$
',
  'trigger_enabled',(SELECT evtenabled FROM pg_event_trigger WHERE evtname='ensure_rls')
) verification;
ROLLBACK;
