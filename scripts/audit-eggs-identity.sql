-- Read-only Phase 2 catalog audit. No application rows or secrets are selected.
begin read only;
set local statement_timeout = '20s';
select jsonb_build_object(
  'database', current_database(),
  'server_version', current_setting('server_version'),
  'audit_role', current_user,
  'operator_table', to_regclass('public.profiles'),
  'player_table', to_regclass('public.players'),
  'schemas', (select jsonb_agg(jsonb_build_object('name', nspname, 'owner', pg_get_userbyid(nspowner), 'acl', nspacl::text) order by nspname) from pg_namespace where nspname not like 'pg_%' and nspname <> 'information_schema'),
  'relations', (select jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,'kind',c.relkind,'owner',pg_get_userbyid(c.relowner),'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,'acl',c.relacl::text,'options',c.reloptions) order by n.nspname,c.relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private','storage') and c.relkind in ('r','p','v','m','S')),
  'columns', (select jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,'column',a.attname,'type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid),'identity',a.attidentity,'generated',a.attgenerated,'acl',a.attacl::text,'collation',coll.collname) order by n.nspname,c.relname,a.attnum) from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum left join pg_collation coll on coll.oid=a.attcollation where a.attnum>0 and not a.attisdropped and c.relkind in ('r','p') and (n.nspname in ('public','private') or (n.nspname='auth' and c.relname in ('users','sessions')))),
  'constraints', (select jsonb_agg(jsonb_build_object('table',conrelid::regclass::text,'name',conname,'type',contype,'definition',pg_get_constraintdef(oid),'validated',convalidated,'deferrable',condeferrable) order by conrelid::regclass::text,conname) from pg_constraint where connamespace in (select oid from pg_namespace where nspname in ('public','private')) or conrelid=to_regclass('auth.users')),
  'indexes', (select jsonb_agg(jsonb_build_object('schema',schemaname,'table',tablename,'name',indexname,'definition',indexdef) order by schemaname,tablename,indexname) from pg_indexes where schemaname in ('public','private')),
  'policies', (select jsonb_agg(to_jsonb(p) order by schemaname,tablename,policyname) from pg_policies p where schemaname in ('public','private','auth','storage')),
  'roles', (select jsonb_agg(jsonb_build_object('name',rolname,'superuser',rolsuper,'inherit',rolinherit,'bypass_rls',rolbypassrls,'can_login',rolcanlogin) order by rolname) from pg_roles where rolname in ('anon','authenticated','service_role','authenticator','postgres','supabase_auth_admin')),
  'memberships', (select jsonb_agg(jsonb_build_object('role',pg_get_userbyid(roleid),'member',pg_get_userbyid(member),'admin_option',admin_option)) from pg_auth_members where member in (select oid from pg_roles where rolname in ('anon','authenticated','service_role','authenticator'))),
  'default_grants', (select jsonb_agg(jsonb_build_object('owner',pg_get_userbyid(defaclrole),'schema',n.nspname,'object_type',defaclobjtype,'acl',defaclacl::text)) from pg_default_acl d left join pg_namespace n on n.oid=d.defaclnamespace),
  'triggers', (select jsonb_agg(jsonb_build_object('table',t.tgrelid::regclass::text,'name',t.tgname,'enabled',t.tgenabled,'definition',pg_get_triggerdef(t.oid),'function',t.tgfoid::regprocedure::text) order by t.tgrelid::regclass::text,t.tgname) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where not t.tgisinternal and n.nspname in ('public','private','auth','storage')),
  'functions', (select jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'owner',pg_get_userbyid(p.proowner),'security_definer',p.prosecdef,'volatility',p.provolatile,'config',p.proconfig,'acl',p.proacl::text,'definition',pg_get_functiondef(p.oid)) order by p.oid::regprocedure::text) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.prokind in ('f','p') and not exists(select 1 from pg_depend dep where dep.classid='pg_proc'::regclass and dep.objid=p.oid and dep.deptype='e')),
  'auth_helpers', (select jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'definition',pg_get_functiondef(p.oid),'acl',p.proacl::text,'owner',pg_get_userbyid(p.proowner))) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='auth' and p.proname in ('uid','jwt')),
  'views', (select jsonb_agg(jsonb_build_object('schema',schemaname,'name',viewname,'definition',definition) order by schemaname,viewname) from pg_views where schemaname in ('public','private')),
  'api_schemas', current_setting('pgrst.db_schemas',true),
  'auth_user_counts', (select jsonb_build_object('total',count(*),'anonymous',count(*) filter(where is_anonymous),'email_confirmed',count(*) filter(where email_confirmed_at is not null)) from auth.users)
) as audit;
rollback;
