-- EGGS Hub v1. Separate/additive; the reviewed consumer candidate is unchanged.
-- Requires 20260922231308. No production grants, operator mappings or Poker data change.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
do $$ begin
  if to_regclass('public.eggs_profiles') is null or to_regprocedure('eggs_private.is_confirmed_user()') is null then
    raise exception 'Apply the reviewed EGGS identity foundation first';
  end if;
end $$;

create schema eggs_hub_private;
revoke all on schema eggs_hub_private from public, anon, authenticated, service_role;
grant usage on schema eggs_hub_private to anon, authenticated;
create table eggs_hub_private.editors (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('editor','publisher')),
  granted_at timestamptz not null default now()
);
alter table eggs_hub_private.editors enable row level security;
alter table eggs_hub_private.editors force row level security;
revoke all on eggs_hub_private.editors from public, anon, authenticated, service_role;
-- No automatic grants to consumers or Poker operators. Bootstrap is a separate approval.
create function eggs_hub_private.editor_role() returns text
language sql stable security definer set search_path = '' as $$
  select e.role from eggs_hub_private.editors e
  where e.auth_user_id=(select auth.uid()) and eggs_private.is_confirmed_user();
$$;
revoke all on function eggs_hub_private.editor_role() from public, anon, authenticated, service_role;
grant execute on function eggs_hub_private.editor_role() to authenticated;
create function public.eggs_hub_editor_role() returns text
language sql stable security invoker set search_path = '' as $$
  select eggs_hub_private.editor_role();
$$;
revoke all on function public.eggs_hub_editor_role() from public, anon, authenticated, service_role;
grant execute on function public.eggs_hub_editor_role() to authenticated;

-- External destinations must be HTTPS, with no credentials, control chars or token parameters.
-- Internal destinations are limited to the existing league and public project routes.
create function eggs_hub_private.safe_link(value text) returns boolean
language sql immutable set search_path = '' as $$
 select value is not null and char_length(value)<=500 and
 (value ~ '^/para/poker(/[a-zA-Z0-9_-]+)*$' or value ~ '^/projects/[a-z0-9-]+$'
  or value ~ '^https://[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?(/[a-zA-Z0-9._~!$&()*+,;=:@%/-]*)?$')
 and value !~ '[[:cntrl:]]' and value !~* '(%0[ad]|%5c|%2f%2f)';
$$;
create function eggs_hub_private.valid_content(value jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare key text;
begin
 if value is null or jsonb_typeof(value)<>'object' then return false; end if;
 if not (value ?& array['title','summary','description','category','status','destination','participation','publication_label','publication_url','asset','featured','sort_order']) then return false; end if;
 for key in select jsonb_object_keys(value) loop
   if not (key=any(array['title','summary','description','category','status','destination','participation','publication_label','publication_url','asset','featured','sort_order'])) then return false; end if;
   if key not in ('featured','sort_order') and jsonb_typeof(value->key)<>'string' then return false; end if;
 end loop;
 if jsonb_typeof(value->'featured')<>'boolean' or jsonb_typeof(value->'sort_order')<>'number'
 or (value->>'sort_order') !~ '^[0-9]{1,4}$' then return false; end if;
 return char_length(btrim(value->>'title')) between 1 and 80
 and char_length(btrim(value->>'summary')) between 1 and 240
 and char_length(btrim(value->>'description')) between 1 and 3000
 and char_length(value->>'participation')<=500 and char_length(value->>'publication_label')<=80
 and value->>'category' in ('game','league','publication','world')
 and value->>'status' in ('available','external','playtest','development','concept','invitation')
 and value->>'asset' in ('monogram','para')
 and (value->>'asset'<>'para' or value->>'category'='league')
 and (value->>'destination'='' or eggs_hub_private.safe_link(value->>'destination'))
 and ((value->>'publication_url'='' and value->>'publication_label'='') or
   (eggs_hub_private.safe_link(value->>'publication_url') and char_length(btrim(value->>'publication_label'))>0));
end $$;
revoke all on function eggs_hub_private.safe_link(text), eggs_hub_private.valid_content(jsonb) from public,anon,authenticated,service_role;
grant execute on function eggs_hub_private.safe_link(text), eggs_hub_private.valid_content(jsonb) to authenticated;

create table public.eggs_project_drafts (
 id uuid primary key default gen_random_uuid(),
 slug text not null unique check (char_length(slug) between 3 and 64 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 content jsonb not null check (eggs_hub_private.valid_content(content)),
 state text not null default 'draft' check (state in ('draft','published','archived')),
 version integer not null default 1 check (version>0),
 updated_at timestamptz not null default now()
);
create table public.eggs_projects (
 id uuid primary key references public.eggs_project_drafts(id) on delete restrict,
 slug text not null unique,
 content jsonb not null check (eggs_hub_private.valid_content(content)),
 version integer not null,
 published_at timestamptz not null default now()
);
create table eggs_hub_private.project_audit (
 id bigint generated always as identity primary key,
 project_id uuid not null references public.eggs_project_drafts(id) on delete restrict,
 actor_id uuid references auth.users(id) on delete set null,
 action text not null check (action in ('create','save','publish','archive')),
 version integer not null,
 content jsonb not null,
 occurred_at timestamptz not null default now()
);
alter table public.eggs_project_drafts enable row level security;
alter table public.eggs_project_drafts force row level security;
alter table public.eggs_projects enable row level security;
alter table public.eggs_projects force row level security;
alter table eggs_hub_private.project_audit enable row level security;
alter table eggs_hub_private.project_audit force row level security;
revoke all on public.eggs_project_drafts,public.eggs_projects,eggs_hub_private.project_audit from public,anon,authenticated,service_role;
grant select on public.eggs_project_drafts to authenticated;
grant select on public.eggs_projects to anon,authenticated;
create policy eggs_hub_drafts_read on public.eggs_project_drafts for select to authenticated
 using ((select eggs_hub_private.editor_role()) is not null);
create policy eggs_hub_published_read on public.eggs_projects for select to anon,authenticated using (true);

-- The private writer is the only write path. It locks membership and the draft,
-- checks a live session and expected version, and writes the public snapshot/audit atomically.
create function eggs_hub_private.write_project(p_id uuid,p_slug text,p_content jsonb,p_version integer,p_action text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare editor text; row public.eggs_project_drafts;
begin
 if not eggs_private.is_confirmed_user() then raise exception 'Sign in required' using errcode='42501'; end if;
 select role into editor from eggs_hub_private.editors where auth_user_id=auth.uid() for share;
 if editor is null or p_action not in ('save','publish','archive') or p_action is null then
   raise exception 'Editor required' using errcode='42501';
 end if;
 if p_action in ('publish','archive') and editor<>'publisher' then raise exception 'Publisher required' using errcode='42501'; end if;
 if p_id is null then
   if p_action<>'save' or p_version<>0 or p_version is null then raise exception 'Create a draft first' using errcode='22023'; end if;
   insert into public.eggs_project_drafts(slug,content) values(p_slug,p_content) returning * into row;
   insert into eggs_hub_private.project_audit(project_id,actor_id,action,version,content) values(row.id,auth.uid(),'create',row.version,row.content);
 else
   select * into row from public.eggs_project_drafts where id=p_id for update;
   if row.id is null or p_version is distinct from row.version then raise exception 'Project changed. Reload it.' using errcode='40001'; end if;
   if p_slug is distinct from row.slug then raise exception 'Project slugs are permanent' using errcode='22023'; end if;
   if p_action='save' then
     update public.eggs_project_drafts set content=p_content,version=version+1,updated_at=now() where id=p_id returning * into row;
   else
     -- Publish exactly the saved, previewed revision; request content cannot override it.
     if p_content is not null then raise exception 'Save before publishing' using errcode='22023'; end if;
     update public.eggs_project_drafts set state=case when p_action='publish' then 'published' else 'archived' end,
       version=version+1,updated_at=now() where id=p_id returning * into row;
     if p_action='publish' then
       insert into public.eggs_projects(id,slug,content,version,published_at) values(row.id,row.slug,row.content,row.version,now())
       on conflict(id) do update set content=excluded.content,version=excluded.version,published_at=excluded.published_at;
     else delete from public.eggs_projects where id=p_id; end if;
   end if;
   insert into eggs_hub_private.project_audit(project_id,actor_id,action,version,content) values(row.id,auth.uid(),p_action,row.version,row.content);
 end if;
 return to_jsonb(row);
end $$;
create function public.save_eggs_project(p_id uuid,p_slug text,p_content jsonb,p_version integer,p_action text) returns jsonb
language sql security invoker set search_path = '' as $$
 select eggs_hub_private.write_project(p_id,p_slug,p_content,p_version,p_action);
$$;
create function eggs_hub_private.read_audit(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
 if eggs_hub_private.editor_role() is null then raise exception 'Editor required' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(to_jsonb(a) order by a.id desc) from
   (select id,actor_id,action,version,occurred_at from eggs_hub_private.project_audit where project_id=p_id order by id desc limit 50) a),'[]');
end $$;
create function public.eggs_project_audit(p_id uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$ select eggs_hub_private.read_audit(p_id); $$;
revoke all on function eggs_hub_private.write_project(uuid,text,jsonb,integer,text),public.save_eggs_project(uuid,text,jsonb,integer,text),
 eggs_hub_private.read_audit(uuid),public.eggs_project_audit(uuid) from public,anon,authenticated,service_role;
grant execute on function eggs_hub_private.write_project(uuid,text,jsonb,integer,text),public.save_eggs_project(uuid,text,jsonb,integer,text),
 eggs_hub_private.read_audit(uuid),public.eggs_project_audit(uuid) to authenticated;

create table public.eggs_profile_expression (
 profile_id uuid primary key default eggs_private.current_profile_id() references public.eggs_profiles(id) on delete cascade,
 favorite_project_ids uuid[] not null default '{}' check (cardinality(favorite_project_ids)<=5 and array_ndims(favorite_project_ids) is not distinct from case when cardinality(favorite_project_ids)=0 then null else 1 end),
 affiliation text not null default '' check (affiliation in ('','player','explorer','maker','reader')),
 pinned_project_id uuid references public.eggs_project_drafts(id) on delete restrict,
 featured_note text not null default '' check (char_length(featured_note)<=160),
 accent text not null default 'sage' check (accent in ('sage','amber','sky','rose'))
);
alter table public.eggs_profile_expression enable row level security;
alter table public.eggs_profile_expression force row level security;
revoke all on public.eggs_profile_expression from public,anon,authenticated,service_role;
grant select on public.eggs_profile_expression to anon,authenticated;
grant insert(favorite_project_ids,affiliation,pinned_project_id,featured_note,accent),
 update(favorite_project_ids,affiliation,pinned_project_id,featured_note,accent) on public.eggs_profile_expression to authenticated;
create policy eggs_expression_public_read on public.eggs_profile_expression for select to anon,authenticated
 using (eggs_private.is_public_profile(profile_id));
create policy eggs_expression_owner_read on public.eggs_profile_expression for select to authenticated
 using (profile_id=(select eggs_private.current_profile_id()));
create policy eggs_expression_insert on public.eggs_profile_expression for insert to authenticated
 with check (profile_id=(select eggs_private.current_profile_id()));
create policy eggs_expression_update on public.eggs_profile_expression for update to authenticated
 using (profile_id=(select eggs_private.current_profile_id())) with check (profile_id=(select eggs_private.current_profile_id()));
create function eggs_hub_private.validate_expression() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
 if (select count(distinct x) from unnest(new.favorite_project_ids) x)<>cardinality(new.favorite_project_ids)
 or exists(select 1 from unnest(new.favorite_project_ids) x where not exists(select 1 from public.eggs_projects p where p.id=x))
 or (new.pinned_project_id is not null and not exists(select 1 from public.eggs_projects p where p.id=new.pinned_project_id)) then
   raise exception 'Choose published projects only' using errcode='23514';
 end if;
 return new;
end $$;
revoke all on function eggs_hub_private.validate_expression() from public,anon,authenticated,service_role;
create trigger eggs_expression_choices before insert or update on public.eggs_profile_expression
 for each row execute function eggs_hub_private.validate_expression();
create function public.save_eggs_expression(p_favorites uuid[],p_affiliation text,p_pin uuid,p_note text,p_accent text) returns jsonb
language sql security invoker set search_path = '' as $$
 with changed as (insert into public.eggs_profile_expression(favorite_project_ids,affiliation,pinned_project_id,featured_note,accent)
 values(p_favorites,p_affiliation,p_pin,p_note,p_accent)
 on conflict(profile_id) do update set favorite_project_ids=excluded.favorite_project_ids,affiliation=excluded.affiliation,
 pinned_project_id=excluded.pinned_project_id,featured_note=excluded.featured_note,accent=excluded.accent returning *)
 select to_jsonb(changed) from changed;
$$;
revoke all on function public.save_eggs_expression(uuid[],text,uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function public.save_eggs_expression(uuid[],text,uuid,text,text) to authenticated;
-- Initial published entries preserve the existing public portal. No editorial identities are seeded.
insert into public.eggs_project_drafts(id,slug,content,state) values('a0000000-0000-4000-8000-000000000001','para-poker','{"publication_label":"League articles","publication_url":"/para/poker/articles","asset":"para","featured":true,"sort_order":0,"title":"Para Poker League","summary":"Competition with a record. Follow the league, its players, and the stories at the table.","description":"The home of Para Poker League standings, session coverage, player dossiers and the public record. Poker stays its own league, with its own operators, evidence and scoring.","category":"league","status":"available","destination":"/para/poker","participation":"Explore the league record. Existing players can request a reviewed connection from their EGGS profile."}'::jsonb,'published');
insert into public.eggs_project_drafts(id,slug,content,state) values('a0000000-0000-4000-8000-000000000002','gauntlet-online','{"publication_label":"","publication_url":"","asset":"monogram","featured":false,"sort_order":1,"title":"Gauntlet Online","summary":"A card-strategy project with its own world and a place at the table.","description":"Discover Gauntlet at its existing destination. Game accounts, matches and progression remain managed by Gauntlet; an EGGS favorite is not an account connection.","category":"game","status":"external","destination":"https://gauntlet-online.vercel.app","participation":"Visit Gauntlet for its current game modes and participation details."}'::jsonb,'published');
insert into public.eggs_project_drafts(id,slug,content,state) values('a0000000-0000-4000-8000-000000000003','eggs-poker','{"publication_label":"","publication_url":"","asset":"monogram","featured":false,"sort_order":2,"title":"EGGS Poker","summary":"The play-money Poker client in the EGGS family.","description":"The existing ParaPoker client is the destination for play. Its accounts and game history remain with the client. Official league records continue to require the Para review process.","category":"game","status":"external","destination":"https://eggspoker.netlify.app","participation":"Open the client for its current tables and play options."}'::jsonb,'published');
insert into public.eggs_project_drafts(id,slug,content,state) values('a0000000-0000-4000-8000-000000000004','reath-digest','{"publication_label":"","publication_url":"","asset":"monogram","featured":false,"sort_order":3,"title":"Reath Digest","summary":"An independent New Jersey editorial project, built around sources and story review.","description":"Reath has an invitation-only editorial desk. This showcase links to its existing site; it does not expose internal stories or imply that its editorial backend is currently available.","category":"publication","status":"invitation","destination":"https://reath-digest.netlify.app","participation":"Desk access requires a Reath invitation. EGGS membership does not grant editorial access."}'::jsonb,'published');
insert into public.eggs_projects(id,slug,content,version) select id,slug,content,version from public.eggs_project_drafts;
insert into eggs_hub_private.project_audit(project_id,actor_id,action,version,content) select id,null,'publish',version,content from public.eggs_project_drafts;
commit;
