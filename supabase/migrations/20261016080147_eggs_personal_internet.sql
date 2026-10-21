-- EGGS Personal Internet. LOCAL/REVIEW CANDIDATE ONLY.
-- Requires the unchanged reviewed identity and Hub candidates, in that order.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $$ begin
 if to_regclass('public.eggs_profile_expression') is null then raise exception 'Apply EGGS Hub first'; end if;
end $$;

create schema eggs_rooms_private;
revoke all on schema eggs_rooms_private from public,anon,authenticated,service_role;
grant usage on schema eggs_rooms_private to anon,authenticated;
create table eggs_rooms_private.assets (
 id text primary key, source text not null, attribution text not null,
 permitted_use text not null check(permitted_use in ('reference-only','site-public')),
 verified_at timestamptz, derivative text not null
);
alter table eggs_rooms_private.assets enable row level security;
alter table eggs_rooms_private.assets force row level security;
revoke all on eggs_rooms_private.assets from public,anon,authenticated,service_role;
insert into eggs_rooms_private.assets values
 ('signal-grid','public/eggs/works/signal-grid.svg','EGGS studio — original geometric design','site-public',now(),'Original SVG; no external source material'),
 ('night-ticket','public/eggs/works/night-ticket.svg','EGGS studio — original typographic design','site-public',now(),'Original SVG; no external source material'),
 ('room-map','public/eggs/works/room-map.svg','EGGS studio — original geometric design','site-public',now(),'Original SVG; no external source material');

create function eggs_rooms_private.exact_keys(v jsonb, keys text[]) returns boolean
language sql immutable set search_path='' as $$
 select coalesce(jsonb_typeof(v)='object' and v ?& keys and (select count(*) from jsonb_object_keys(v))=cardinality(keys),false);
$$;
create function eggs_rooms_private.valid_work(v jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
begin
 if not eggs_rooms_private.exact_keys(v,array['title','summary','description','asset_id','project_id']) then return false; end if;
 return coalesce(jsonb_typeof(v->'title')='string' and length(btrim(v->>'title')) between 1 and 80
 and jsonb_typeof(v->'summary')='string' and length(btrim(v->>'summary')) between 1 and 240
 and jsonb_typeof(v->'description')='string' and length(btrim(v->>'description')) between 1 and 3000
 and jsonb_typeof(v->'asset_id')='string'
 and (v->'project_id'='null'::jsonb or (v->>'project_id') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),false);
end $$;
create table public.eggs_work_drafts (
 id uuid primary key default gen_random_uuid(),
 slug text not null unique check(length(slug) between 3 and 64 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 content jsonb not null check(eggs_rooms_private.valid_work(content)),
 state text not null default 'draft' check(state in ('draft','published','archived')),
 version integer not null default 1 check(version>0),
 updated_at timestamptz not null default now()
);
create table public.eggs_works (
 id uuid primary key references public.eggs_work_drafts(id) on delete restrict,
 slug text not null unique, content jsonb not null, provenance jsonb not null,
 version integer not null, published_at timestamptz not null default now()
);
create table eggs_rooms_private.work_audit (
 id bigint generated always as identity primary key,
 work_id uuid not null references public.eggs_work_drafts(id) on delete restrict,
 actor_id uuid references auth.users(id) on delete set null,
 action text not null check(action in ('create','save','publish','archive')),
 version integer not null, content jsonb not null, provenance jsonb,
 occurred_at timestamptz not null default now()
);
create index eggs_work_audit_work_revision on eggs_rooms_private.work_audit(work_id,id desc);
create index eggs_work_audit_actor on eggs_rooms_private.work_audit(actor_id);
alter table public.eggs_work_drafts enable row level security;
alter table public.eggs_work_drafts force row level security;
alter table public.eggs_works enable row level security;
alter table public.eggs_works force row level security;
alter table eggs_rooms_private.work_audit enable row level security;
alter table eggs_rooms_private.work_audit force row level security;
revoke all on public.eggs_work_drafts,public.eggs_works,eggs_rooms_private.work_audit from public,anon,authenticated,service_role;
grant select on public.eggs_work_drafts to authenticated;
grant select on public.eggs_works to anon,authenticated;
create policy work_editor_read on public.eggs_work_drafts for select to authenticated using ((select eggs_hub_private.editor_role()) is not null);
create policy work_public_read on public.eggs_works for select to anon,authenticated using(true);

create function eggs_rooms_private.write_work(p_id uuid,p_slug text,p_content jsonb,p_version integer,p_action text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare editor text; row public.eggs_work_drafts; asset eggs_rooms_private.assets; provenance jsonb;
begin
 if not eggs_private.is_confirmed_user() then raise exception 'Sign in required' using errcode='42501'; end if;
 select role into editor from eggs_hub_private.editors where auth_user_id=auth.uid() for share;
 if editor is null or p_action is null or p_action not in ('save','publish','archive') then raise exception 'Editor required' using errcode='42501'; end if;
 if p_action in ('publish','archive') and editor<>'publisher' then raise exception 'Publisher required' using errcode='42501'; end if;
 if p_action='save' then
  if not eggs_rooms_private.valid_work(p_content) then raise exception 'Invalid work' using errcode='23514'; end if;
  select * into asset from eggs_rooms_private.assets where id=p_content->>'asset_id' for share;
  if asset.id is null then raise exception 'Choose a registered asset' using errcode='23514'; end if;
  if p_content->>'project_id' is not null then
   perform 1 from public.eggs_projects where id=(p_content->>'project_id')::uuid for share;
   if not found then raise exception 'Choose a published project' using errcode='23514'; end if;
  end if;
 end if;
 if p_id is null then
  if p_action<>'save' or p_version is distinct from 0 then raise exception 'Save a draft first' using errcode='22023'; end if;
  insert into public.eggs_work_drafts(slug,content) values(p_slug,p_content) returning * into row;
 else
  select * into row from public.eggs_work_drafts where id=p_id for update;
  if row.id is null or row.version is distinct from p_version then raise exception 'Work changed. Reload it.' using errcode='40001'; end if;
  if row.slug is distinct from p_slug then raise exception 'Slugs are permanent' using errcode='22023'; end if;
  if p_action='save' then
   update public.eggs_work_drafts set content=p_content,version=version+1,updated_at=now() where id=p_id returning * into row;
  else
   if p_content is not null then raise exception 'Preview the saved work first' using errcode='22023'; end if;
   if p_action='publish' then
    select * into asset from eggs_rooms_private.assets where id=row.content->>'asset_id' for share;
    if asset.permitted_use is distinct from 'site-public' or asset.verified_at is null then raise exception 'Public-use permission is unverified' using errcode='23514'; end if;
    if row.content->>'project_id' is not null then
     perform 1 from public.eggs_projects where id=(row.content->>'project_id')::uuid for share;
     if not found then raise exception 'Associated project is unavailable' using errcode='23514'; end if;
    end if;
    provenance=to_jsonb(asset)-'id';
   end if;
   update public.eggs_work_drafts set state=case when p_action='publish' then 'published' else 'archived' end,version=version+1,updated_at=now()
   where id=p_id returning * into row;
   if p_action='publish' then
    insert into public.eggs_works(id,slug,content,provenance,version) values(row.id,row.slug,row.content,provenance,row.version)
    on conflict(id) do update set content=excluded.content,provenance=excluded.provenance,version=excluded.version,published_at=now();
   else delete from public.eggs_works where id=p_id; end if;
  end if;
 end if;
 insert into eggs_rooms_private.work_audit(work_id,actor_id,action,version,content,provenance)
 values(row.id,auth.uid(),case when p_id is null then 'create' else p_action end,row.version,row.content,provenance);
 return to_jsonb(row);
end $$;
create function public.save_eggs_work(p_id uuid,p_slug text,p_content jsonb,p_version integer,p_action text) returns jsonb
language sql security invoker set search_path='' as $$ select eggs_rooms_private.write_work(p_id,p_slug,p_content,p_version,p_action); $$;
create function eggs_rooms_private.work_history(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if eggs_hub_private.editor_role() is null then raise exception 'Editor required' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(to_jsonb(a) order by a.id desc) from
 (select id,actor_id,action,version,occurred_at from eggs_rooms_private.work_audit where work_id=p_id order by id desc limit 100) a),'[]');
end $$;
create function public.eggs_work_audit(p_id uuid) returns jsonb
language sql stable security invoker set search_path='' as $$ select eggs_rooms_private.work_history(p_id); $$;

create function eggs_rooms_private.valid_appearance(v jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
begin
 if not eggs_rooms_private.exact_keys(v,array['theme','wallpaper','cover','avatar','accent','stamps']) then return false; end if;
 if jsonb_typeof(v->'stamps') is distinct from 'array' then return false; end if;
 return coalesce(v->>'theme' in ('carton','after-hours')
 and v->>'wallpaper' in ('plain','graph','dots','stripes','checker','stars')
 and v->>'cover' in ('sunrise','airmail','orbit','midnight')
 and v->>'avatar' in ('egg','orbit','flower','spark')
 and v->>'accent' in ('sage','amber','sky','rose')
 and jsonb_array_length(v->'stamps')<=12
 and not exists(select 1 from jsonb_array_elements(v->'stamps') x where jsonb_typeof(x)<>'string' or x#>>'{}' not in
 ('approved','local','dreamer','open','fragile','original','visitor','night-owl','player','maker','good-egg','handle-with-care'))
 and (select count(distinct x) from jsonb_array_elements(v->'stamps') x)=jsonb_array_length(v->'stamps'),false);
end $$;
create function eggs_rooms_private.valid_modules(v jsonb,ordering text[]) returns boolean
language sql immutable set search_path='' as $$
 select eggs_rooms_private.exact_keys(v,array['bio','favorites','affiliation','featured_note','showcase'])
 and not exists(select 1 from jsonb_each(v) x where jsonb_typeof(x.value)<>'boolean')
 and cardinality(ordering)=5 and (select count(distinct x) from unnest(ordering) x)=5
 and ordering <@ array['bio','favorites','affiliation','featured_note','showcase']::text[];
$$;
create function eggs_rooms_private.default_appearance() returns jsonb language sql immutable set search_path='' as $$
 select '{"theme":"carton","wallpaper":"graph","cover":"sunrise","avatar":"egg","accent":"sage","stamps":[]}'::jsonb;
$$;
create table eggs_rooms_private.rooms (
 profile_id uuid primary key references public.eggs_profiles(id) on delete cascade,
 appearance jsonb not null default eggs_rooms_private.default_appearance() check(eggs_rooms_private.valid_appearance(appearance)),
 module_visibility jsonb not null default '{"bio":true,"favorites":true,"affiliation":true,"featured_note":true,"showcase":true}',
 module_order text[] not null default array['bio','affiliation','favorites','featured_note','showcase'],
 revision bigint not null default 0 check(revision>=0),
 updated_at timestamptz not null default now(),
 check(eggs_rooms_private.valid_modules(module_visibility,module_order))
);
create table eggs_rooms_private.featured_slots (
 profile_id uuid not null references public.eggs_profiles(id) on delete cascade,
 position integer not null check(position between 0 and 7),
 project_id uuid references public.eggs_project_drafts(id) on delete restrict,
 work_id uuid references public.eggs_work_drafts(id) on delete restrict,
 primary key(profile_id,position), unique(profile_id,project_id),unique(profile_id,work_id),
 check(num_nonnulls(project_id,work_id)=1)
);
create index eggs_featured_project on eggs_rooms_private.featured_slots(project_id);
create index eggs_featured_work on eggs_rooms_private.featured_slots(work_id);
alter table eggs_rooms_private.rooms enable row level security;
alter table eggs_rooms_private.rooms force row level security;
alter table eggs_rooms_private.featured_slots enable row level security;
alter table eggs_rooms_private.featured_slots force row level security;
revoke all on eggs_rooms_private.rooms,eggs_rooms_private.featured_slots from public,anon,authenticated,service_role;

-- Close raw public paths, independent of application feature flags.
revoke select(bio) on public.eggs_profiles from anon,authenticated;
drop policy eggs_expression_public_read on public.eggs_profile_expression;
revoke select on public.eggs_profile_expression from anon;
-- All expression/profile updates now have a single revisioned writer. Inserts still support onboarding.
revoke update(display_name,bio,avatar_path,visibility) on public.eggs_profiles from authenticated;
revoke insert(favorite_project_ids,affiliation,pinned_project_id,featured_note,accent),
 update(favorite_project_ids,affiliation,pinned_project_id,featured_note,accent) on public.eggs_profile_expression from authenticated;
revoke execute on function public.save_eggs_expression(uuid[],text,uuid,text,text) from authenticated;

create function eggs_rooms_private.public_bio(p_id uuid) returns text
language sql stable security definer set search_path='' as $$
 select p.bio from public.eggs_profiles p left join eggs_rooms_private.rooms r on r.profile_id=p.id
 where p.id=p_id and eggs_private.is_public_profile(p.id) and coalesce((r.module_visibility->>'bio')::boolean,true);
$$;
create or replace view public.eggs_public_profiles with(security_invoker=true,security_barrier=true) as
 select id,handle,display_name,eggs_rooms_private.public_bio(id) as bio,avatar_path,visibility,created_at,updated_at
 from public.eggs_profiles where visibility='public' and eggs_private.is_public_profile(id);
create function eggs_rooms_private.my_profile() returns setof public.eggs_public_profiles
language sql stable security definer set search_path='' as $$
 select id,handle,display_name,bio,avatar_path,visibility,created_at,updated_at
 from public.eggs_profiles where id=eggs_private.current_profile_id();
$$;
create or replace function public.get_my_eggs_profile() returns setof public.eggs_public_profiles
language sql stable security invoker set search_path='' as $$ select * from eggs_rooms_private.my_profile(); $$;

-- Retain unavailable existing choices; do not allow new archived selections.
create or replace function eggs_hub_private.validate_expression() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if (select count(distinct x) from unnest(new.favorite_project_ids) x)<>cardinality(new.favorite_project_ids)
 or exists(select 1 from unnest(new.favorite_project_ids) x where not exists(select 1 from public.eggs_projects p where p.id=x)
   and (tg_op='INSERT' or not x=any(old.favorite_project_ids)))
 or (new.pinned_project_id is not null and not exists(select 1 from public.eggs_projects p where p.id=new.pinned_project_id)
   and (tg_op='INSERT' or new.pinned_project_id is distinct from old.pinned_project_id)) then
  raise exception 'Choose published projects only' using errcode='23514';
 end if;
 return new;
end $$;

create function eggs_rooms_private.room(p_id uuid,owner_read boolean) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare p public.eggs_profiles; r eggs_rooms_private.rooms; e public.eggs_profile_expression; result jsonb; modules jsonb='{}'; board jsonb;
begin
 if owner_read then
  if p_id is distinct from eggs_private.current_profile_id() or p_id is null then raise exception 'Owner required' using errcode='42501'; end if;
 elsif not eggs_private.is_public_profile(p_id) then return null; end if;
 select * into p from public.eggs_profiles where id=p_id;
 if p.id is null then return null; end if;
 select * into r from eggs_rooms_private.rooms where profile_id=p_id;
 select * into e from public.eggs_profile_expression where profile_id=p_id;
 r.appearance=coalesce(r.appearance,eggs_rooms_private.default_appearance());
 r.module_visibility=coalesce(r.module_visibility,'{"bio":true,"favorites":true,"affiliation":true,"featured_note":true,"showcase":true}');
 r.module_order=coalesce(r.module_order,array['bio','affiliation','favorites','featured_note','showcase']);
 if owner_read then
  modules=jsonb_build_object('bio',p.bio,'affiliation',coalesce(e.affiliation,''),'favorite_project_ids',coalesce(e.favorite_project_ids,'{}'),
   'pinned_project_id',e.pinned_project_id,'featured_note',coalesce(e.featured_note,''),'accent',coalesce(e.accent,'sage'));
 else
  if (r.module_visibility->>'bio')::boolean then modules=modules||jsonb_build_object('bio',p.bio); end if;
  if (r.module_visibility->>'affiliation')::boolean then modules=modules||jsonb_build_object('affiliation',coalesce(e.affiliation,'')); end if;
  if (r.module_visibility->>'favorites')::boolean then
   modules=modules||jsonb_build_object('favorites',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'slug',x.slug,'title',x.content->>'title') order by f.ordinality)
    from unnest(e.favorite_project_ids) with ordinality f(id,ordinality) join public.eggs_projects x on x.id=f.id),'[]'));
  end if;
  if (r.module_visibility->>'featured_note')::boolean then
   modules=modules||jsonb_build_object('featured_note',coalesce(e.featured_note,''));
   if e.pinned_project_id is not null then
    modules=modules||coalesce((select jsonb_build_object('pinned_project',jsonb_build_object('slug',x.slug,'title',x.content->>'title')) from public.eggs_projects x where x.id=e.pinned_project_id),'{}');
   end if;
  end if;
 end if;
 if owner_read or (r.module_visibility->>'showcase')::boolean then
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('type',case when s.project_id is null then 'work' else 'project' end,
   'id',coalesce(s.project_id,s.work_id),'position',s.position,
   'slug',coalesce(pr.slug,w.slug),'title',coalesce(pr.content->>'title',w.content->>'title'),
   'asset',coalesce(pr.content->>'asset',w.content->>'asset_id'),
   'unavailable',case when owner_read then pr.id is null and w.id is null else null end)) order by s.position),'[]') into board
  from eggs_rooms_private.featured_slots s left join public.eggs_projects pr on pr.id=s.project_id left join public.eggs_works w on w.id=s.work_id
  where s.profile_id=p_id and (owner_read or pr.id is not null or w.id is not null);
  modules=modules||jsonb_build_object('showcase',board);
 end if;
 result=jsonb_build_object('profile',jsonb_build_object('id',p.id,'handle',p.handle,'display_name',p.display_name),
 'appearance',r.appearance,'module_order',r.module_order,'modules',modules);
 if owner_read then result=result||jsonb_build_object('revision',coalesce(r.revision,0),'visibility',p.visibility,'module_visibility',r.module_visibility); end if;
 return result;
end $$;
create function eggs_rooms_private.public_room(p_handle text) returns jsonb
language sql stable security definer set search_path='' as $$
 select eggs_rooms_private.room(p.id,false) from public.eggs_profiles p where p.handle=p_handle and eggs_private.is_public_profile(p.id);
$$;
create function public.get_public_eggs_room(p_handle text) returns jsonb
language sql stable security invoker set search_path='' as $$ select eggs_rooms_private.public_room(p_handle); $$;
create function public.get_my_eggs_room() returns jsonb
language sql stable security invoker set search_path='' as $$ select eggs_rooms_private.room(eggs_private.current_profile_id(),true); $$;

create function eggs_rooms_private.save_room(p_revision bigint,p_value jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare pid uuid; rev bigint; a jsonb; e jsonb; v jsonb; ordering text[]; item jsonb; target uuid; pos integer=0; seen text[]='{}'; favorites uuid[];
begin
 pid=eggs_private.current_profile_id();
 if pid is null then raise exception 'Create a profile and sign in' using errcode='42501'; end if;
 -- Lock the existing owner row even on the first save, so absent room rows cannot race.
 perform 1 from public.eggs_profiles where id=pid for update;
 select revision into rev from eggs_rooms_private.rooms where profile_id=pid;
 if p_revision is distinct from coalesce(rev,0) then raise exception 'Room changed. Reload before saving.' using errcode='PT409'; end if;
 if not eggs_rooms_private.exact_keys(p_value,array['profile','expression','appearance','module_visibility','module_order','showcase'])
 or not eggs_rooms_private.exact_keys(p_value->'profile',array['display_name','bio','visibility'])
 or not eggs_rooms_private.exact_keys(p_value->'expression',array['favorite_project_ids','affiliation','pinned_project_id','featured_note','accent'])
 then raise exception 'Invalid room fields' using errcode='23514'; end if;
 v=p_value->'profile';e=p_value->'expression';a=p_value->'appearance';
 if jsonb_typeof(v->'display_name')<>'string' or jsonb_typeof(v->'bio')<>'string'
 or jsonb_typeof(p_value->'showcase') is distinct from 'array'
 or jsonb_typeof(p_value->'module_order') is distinct from 'array'
 or jsonb_typeof(e->'favorite_project_ids') is distinct from 'array'
 or jsonb_typeof(e->'affiliation')<>'string' or jsonb_typeof(e->'featured_note')<>'string' or jsonb_typeof(e->'accent')<>'string'
 then raise exception 'Invalid room values' using errcode='23514'; end if;
 if jsonb_array_length(p_value->'showcase')>8 then raise exception 'Eight selections maximum' using errcode='23514'; end if;
 ordering=array(select jsonb_array_elements_text(p_value->'module_order'));
 if not eggs_rooms_private.valid_appearance(a) or not eggs_rooms_private.valid_modules(p_value->'module_visibility',ordering)
 then raise exception 'Choose listed appearance and modules' using errcode='23514'; end if;
 -- Validate every reference before replacing anything. Retained archived references are allowed.
 for item in select value from jsonb_array_elements(p_value->'showcase') loop
  if not eggs_rooms_private.exact_keys(item,array['type','id']) or item->>'type' not in ('project','work') then raise exception 'Invalid selection' using errcode='23514'; end if;
  target=(item->>'id')::uuid;
  if target is null or (item->>'type'||':'||target::text)=any(seen) then raise exception 'Duplicate selection' using errcode='23514'; end if;
  seen=array_append(seen,item->>'type'||':'||target::text);
  if item->>'type'='project' then
   perform 1 from public.eggs_projects where id=target for share;
   if not found and not exists(select 1 from eggs_rooms_private.featured_slots where profile_id=pid and project_id=target) then raise exception 'Project unavailable' using errcode='23514'; end if;
  else
   perform 1 from public.eggs_works where id=target for share;
   if not found and not exists(select 1 from eggs_rooms_private.featured_slots where profile_id=pid and work_id=target) then raise exception 'Work unavailable' using errcode='23514'; end if;
  end if;
 end loop;
 favorites=array(select jsonb_array_elements_text(e->'favorite_project_ids'))::uuid[];
 update public.eggs_profiles set display_name=v->>'display_name',bio=v->>'bio',visibility=v->>'visibility' where id=pid;
 update public.eggs_profile_expression set favorite_project_ids=favorites,affiliation=e->>'affiliation',
 pinned_project_id=(e->>'pinned_project_id')::uuid,featured_note=e->>'featured_note',accent=e->>'accent' where profile_id=pid;
 if not found then
  insert into public.eggs_profile_expression(profile_id,favorite_project_ids,affiliation,pinned_project_id,featured_note,accent)
  values(pid,favorites,e->>'affiliation',(e->>'pinned_project_id')::uuid,e->>'featured_note',e->>'accent');
 end if;
 insert into eggs_rooms_private.rooms(profile_id,appearance,module_visibility,module_order,revision)
 values(pid,a,p_value->'module_visibility',ordering,coalesce(rev,0)+1)
 on conflict(profile_id) do update set appearance=excluded.appearance,module_visibility=excluded.module_visibility,
 module_order=excluded.module_order,revision=excluded.revision,updated_at=now();
 delete from eggs_rooms_private.featured_slots where profile_id=pid;
 for item in select value from jsonb_array_elements(p_value->'showcase') loop
  insert into eggs_rooms_private.featured_slots(profile_id,position,project_id,work_id)
  values(pid,pos,case when item->>'type'='project' then (item->>'id')::uuid end,case when item->>'type'='work' then (item->>'id')::uuid end);
  pos=pos+1;
 end loop;
 return eggs_rooms_private.room(pid,true);
end $$;
create function public.save_my_eggs_room(p_revision bigint,p_value jsonb) returns jsonb
language sql security invoker set search_path='' as $$ select eggs_rooms_private.save_room(p_revision,p_value); $$;

-- No implicit PUBLIC function execution. Public wrappers are invokers; privileged helpers
-- are unexposed and authorize exact owner/editor operations or public-only projections.
revoke all on all functions in schema eggs_rooms_private from public,anon,authenticated,service_role;
grant execute on function eggs_rooms_private.public_bio(uuid),eggs_rooms_private.public_room(text) to anon,authenticated;
grant execute on function eggs_rooms_private.my_profile(),eggs_rooms_private.room(uuid,boolean),
 eggs_rooms_private.save_room(bigint,jsonb),eggs_rooms_private.write_work(uuid,text,jsonb,integer,text),
 eggs_rooms_private.work_history(uuid) to authenticated;
revoke all on function public.get_public_eggs_room(text),public.get_my_eggs_room(),public.save_my_eggs_room(bigint,jsonb),
 public.save_eggs_work(uuid,text,jsonb,integer,text),public.eggs_work_audit(uuid) from public,anon,authenticated,service_role;
grant execute on function public.get_public_eggs_room(text) to anon,authenticated;
grant execute on function public.get_my_eggs_room(),public.save_my_eggs_room(bigint,jsonb),
 public.save_eggs_work(uuid,text,jsonb,integer,text),public.eggs_work_audit(uuid) to authenticated;
commit;
