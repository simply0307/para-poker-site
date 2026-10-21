-- EGGS community feed. Additive, unapplied review candidate; no Poker writes.
-- Requires the three unchanged identity, Hub and Personal Internet candidates.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $$ begin
 if to_regclass('eggs_rooms_private.rooms') is null then raise exception 'Apply EGGS rooms first'; end if;
end $$;

create schema eggs_community_private;
revoke all on schema eggs_community_private from public,anon,authenticated,service_role;
grant usage on schema eggs_community_private to anon,authenticated;
create table eggs_community_private.posts (
 id uuid primary key default gen_random_uuid(),
 profile_id uuid not null references public.eggs_profiles(id) on delete cascade,
 parent_id uuid references eggs_community_private.posts(id) on delete cascade,
 body text not null check(char_length(btrim(body)) between 1 and 1000),
 revision bigint not null default 1 check(revision>0),
 hidden boolean not null default false,
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(),
 check(parent_id is distinct from id)
);
create index eggs_community_posts_timeline on eggs_community_private.posts(created_at desc,id desc) where parent_id is null;
create index eggs_community_posts_author on eggs_community_private.posts(profile_id,created_at desc);
create index eggs_community_posts_parent on eggs_community_private.posts(parent_id,created_at,id);
create table eggs_community_private.likes (
 profile_id uuid not null references public.eggs_profiles(id) on delete cascade,
 post_id uuid not null references eggs_community_private.posts(id) on delete cascade,
 created_at timestamptz not null default clock_timestamp(),
 primary key(profile_id,post_id)
);
create index eggs_community_likes_post on eggs_community_private.likes(post_id);
-- A body-free event ledger makes deletion unable to reset the rolling rate limit.
create table eggs_community_private.rate_events (
 id bigint generated always as identity primary key,
 profile_id uuid not null references public.eggs_profiles(id) on delete cascade,
 kind text not null check(kind in ('post','reply')),
 created_at timestamptz not null default clock_timestamp()
);
create index eggs_community_rate_owner on eggs_community_private.rate_events(profile_id,kind,created_at desc);
-- Keep historical decisions if either author or moderator later deletes an account.
-- No body, Auth identifier, email, or arbitrary content is copied into this audit.
create table eggs_community_private.moderation_audit (
 id bigint generated always as identity primary key,
 post_id uuid not null,
 actor_id uuid references auth.users(id) on delete set null,
 action text not null check(action in ('hide','restore')),
 reason text not null check(char_length(btrim(reason)) between 1 and 240),
 revision bigint not null,
 occurred_at timestamptz not null default clock_timestamp()
);
create index eggs_community_moderation_post on eggs_community_private.moderation_audit(post_id,id desc);
create index eggs_community_moderation_actor on eggs_community_private.moderation_audit(actor_id);
alter table eggs_community_private.posts enable row level security;
alter table eggs_community_private.posts force row level security;
alter table eggs_community_private.likes enable row level security;
alter table eggs_community_private.likes force row level security;
alter table eggs_community_private.rate_events enable row level security;
alter table eggs_community_private.rate_events force row level security;
alter table eggs_community_private.moderation_audit enable row level security;
alter table eggs_community_private.moderation_audit force row level security;
revoke all on all tables in schema eggs_community_private from public,anon,authenticated,service_role;
revoke all on all sequences in schema eggs_community_private from public,anon,authenticated,service_role;

create function eggs_community_private.person(p_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',p.id,'handle',p.handle,'display_name',p.display_name,
 'avatar',coalesce(r.appearance->>'avatar','egg'),'theme',coalesce(r.appearance->>'theme','carton'))
 from public.eggs_profiles p left join eggs_rooms_private.rooms r on r.profile_id=p.id
 where p.id=p_id and eggs_private.is_public_profile(p.id);
$$;
create function eggs_community_private.visible(p_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from eggs_community_private.posts p
 where p.id=p_id and not p.hidden and eggs_private.is_public_profile(p.profile_id)
 and (p.parent_id is null or exists(select 1 from eggs_community_private.posts parent
  where parent.id=p.parent_id and parent.parent_id is null and not parent.hidden and eggs_private.is_public_profile(parent.profile_id))));
$$;
create function eggs_community_private.post(p_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',p.id,'body',p.body,'revision',p.revision,'created_at',p.created_at,'updated_at',p.updated_at,
 'author',eggs_community_private.person(p.profile_id),
 'like_count',(select count(*) from eggs_community_private.likes l where l.post_id=p.id and eggs_private.is_public_profile(l.profile_id)),
 'reply_count',(select count(*) from eggs_community_private.posts r where r.parent_id=p.id and not r.hidden and eggs_private.is_public_profile(r.profile_id)))
 from eggs_community_private.posts p where p.id=p_id and eggs_community_private.visible(p.id);
$$;
create function eggs_community_private.feed(p_before timestamptz,p_before_id uuid,p_limit integer,p_author text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare rows jsonb; cursor jsonb;
begin
 if p_limit is null or p_limit not between 1 and 50 or (p_before is null)<>(p_before_id is null)
 or (p_author is not null and (length(p_author) not between 3 and 30 or p_author ~ '[^a-z0-9_]'))
 then raise exception 'Invalid feed cursor or author' using errcode='22023'; end if;
 with candidates as (
  select p.id,p.created_at from eggs_community_private.posts p join public.eggs_profiles author on author.id=p.profile_id
  where p.parent_id is null and eggs_community_private.visible(p.id)
  and (p_author is null or author.handle=p_author)
  and (p_before is null or (p.created_at,p.id)<(p_before,p_before_id))
  order by p.created_at desc,p.id desc limit p_limit+1
 ), page as (select * from candidates order by created_at desc,id desc limit p_limit)
 select coalesce((select jsonb_agg(eggs_community_private.post(id) order by created_at desc,id desc) from page),'[]'),
 case when (select count(*) from candidates)>p_limit then
 (select jsonb_build_object('before',created_at,'before_id',id) from page order by created_at,id limit 1) end
 into rows,cursor;
 return jsonb_build_object('posts',rows,'next_cursor',cursor);
end $$;
create function eggs_community_private.thread(p_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('post',eggs_community_private.post(p.id),'replies',
 coalesce((select jsonb_agg(eggs_community_private.post(r.id) order by r.created_at,r.id)
 from eggs_community_private.posts r where r.parent_id=p.id and eggs_community_private.visible(r.id)),'[]'))
 from eggs_community_private.posts p where p.id=p_id and p.parent_id is null and eggs_community_private.visible(p.id);
$$;
create function eggs_community_private.people(p_query text,p_after text,p_limit integer) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare rows jsonb; cursor text;
begin
 if p_query is null or length(p_query)>80 or p_limit is null or p_limit not between 1 and 50
 or (p_after is not null and (length(p_after) not between 3 and 30 or p_after ~ '[^a-z0-9_]'))
 then raise exception 'Invalid people search or cursor' using errcode='22023'; end if;
 with candidates as (
  select p.id,p.handle from public.eggs_profiles p where eggs_private.is_public_profile(p.id)
  and (p_after is null or p.handle>p_after collate "C")
  and (strpos(lower(p.handle),lower(btrim(p_query)))>0 or strpos(lower(p.display_name),lower(btrim(p_query)))>0)
  order by p.handle collate "C" limit p_limit+1
 ), page as (select * from candidates order by handle collate "C" limit p_limit)
 select coalesce((select jsonb_agg(eggs_community_private.person(id) order by handle collate "C") from page),'[]'),
 case when (select count(*) from candidates)>p_limit then (select max(handle collate "C") from page) end into rows,cursor;
 return jsonb_build_object('people',rows,'next_cursor',cursor);
end $$;
create function eggs_community_private.mine() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare pid uuid; profile jsonb;
begin
 if not eggs_private.is_confirmed_user() then raise exception 'Live confirmed sign-in required' using errcode='42501'; end if;
 pid=eggs_private.current_profile_id();
 select jsonb_build_object('id',p.id,'handle',p.handle,'display_name',p.display_name,'visibility',p.visibility) into profile
 from public.eggs_profiles p where p.id=pid;
 return jsonb_build_object('profile',profile,'liked_post_ids',coalesce((select jsonb_agg(l.post_id order by l.post_id)
 from eggs_community_private.likes l where l.profile_id=pid and eggs_community_private.visible(l.post_id)),'[]'),
 'publisher',coalesce(eggs_hub_private.editor_role()='publisher',false));
end $$;
create function eggs_community_private.moderation() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not eggs_private.is_confirmed_user() or eggs_hub_private.editor_role() is distinct from 'publisher'
 then raise exception 'Publisher required' using errcode='42501'; end if;
 return jsonb_build_object('posts',coalesce((select jsonb_agg(x.dto order by x.created_at desc,x.id desc) from (
  select p.id,p.created_at,jsonb_build_object('id',p.id,'body',p.body,'revision',p.revision,'created_at',p.created_at,'updated_at',p.updated_at,
   'author',eggs_community_private.person(p.profile_id),'hidden',true,'like_count',0,'reply_count',0) dto
  from eggs_community_private.posts p where p.hidden and eggs_private.is_public_profile(p.profile_id)
  and (p.parent_id is null or exists(select 1 from eggs_community_private.posts parent where parent.id=p.parent_id and parent.parent_id is null and eggs_private.is_public_profile(parent.profile_id)))
  order by p.created_at desc,p.id desc limit 100
 ) x),'[]'));
end $$;
create function eggs_community_private.write(p_action text,p_id uuid,p_body text,p_parent uuid,p_revision bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
declare pid uuid; row eggs_community_private.posts; parent eggs_community_private.posts; event_kind text; maximum integer; count bigint;
begin
 if not eggs_private.is_confirmed_user() then raise exception 'Live confirmed sign-in required' using errcode='42501'; end if;
 if p_action is null or p_action not in ('create','edit','delete','like','unlike','hide','restore')
 then raise exception 'Unknown community action' using errcode='22023'; end if;
 if p_action='create' then
  if p_id is not null or p_revision is not null or p_body is null or char_length(btrim(p_body)) not between 1 and 1000
  then raise exception 'Invalid new post' using errcode='22023'; end if;
 elsif p_action='edit' then
  if p_id is null or p_parent is not null or p_revision is null or p_body is null or char_length(btrim(p_body)) not between 1 and 1000
  then raise exception 'Invalid edit' using errcode='22023'; end if;
 elsif p_action in ('hide','restore') then
  if p_id is null or p_parent is not null or p_revision is not null or p_body is null or char_length(btrim(p_body)) not between 1 and 240
  then raise exception 'A moderation reason is required' using errcode='22023'; end if;
 else
  if p_id is null or p_parent is not null or p_revision is not null or p_body is not null
  then raise exception 'Unexpected action arguments' using errcode='22023'; end if;
 end if;
 if p_action in ('hide','restore') then
  if eggs_hub_private.editor_role() is distinct from 'publisher' then raise exception 'Publisher required' using errcode='42501'; end if;
  select * into row from eggs_community_private.posts where id=p_id for update;
  if row.id is null or not eggs_private.is_public_profile(row.profile_id) or
   (row.parent_id is not null and not exists(select 1 from eggs_community_private.posts parent_row
    where parent_row.id=row.parent_id and eggs_private.is_public_profile(parent_row.profile_id)))
  then raise exception 'Post unavailable' using errcode='PT404'; end if;
  update eggs_community_private.posts set hidden=(p_action='hide'),revision=revision+1,updated_at=clock_timestamp() where id=p_id;
  insert into eggs_community_private.moderation_audit(post_id,actor_id,action,reason,revision)
  values(p_id,auth.uid(),p_action,btrim(p_body),row.revision+1);
  return jsonb_build_object('post',eggs_community_private.post(p_id));
 end if;
 pid=eggs_private.current_profile_id();
 if pid is null then raise exception 'Create an EGGS profile first' using errcode='42501'; end if;
 -- Serialize all personal writes with profile visibility changes and account deletion.
 perform 1 from public.eggs_profiles where id=pid for update;
 if p_action='create' then
  if not eggs_private.is_public_profile(pid) then raise exception 'A public profile is required to post' using errcode='42501'; end if;
  if p_parent is not null then
   select * into parent from eggs_community_private.posts where id=p_parent for share;
   if parent.id is null or parent.parent_id is not null or not eggs_community_private.visible(parent.id)
   then raise exception 'Public top-level post required' using errcode='PT404'; end if;
  end if;
  event_kind=case when p_parent is null then 'post' else 'reply' end;
  maximum=case when p_parent is null then 20 else 50 end;
  select count(*) into count from eggs_community_private.rate_events e
  where e.profile_id=pid and e.kind=event_kind and e.created_at>clock_timestamp()-interval '1 hour';
  if count>=maximum then raise exception 'Please wait before posting again' using errcode='PT429'; end if;
  insert into eggs_community_private.rate_events(profile_id,kind) values(pid,event_kind);
  insert into eggs_community_private.posts(profile_id,parent_id,body) values(pid,p_parent,btrim(p_body)) returning * into row;
  return jsonb_build_object('post',eggs_community_private.post(row.id));
 end if;
 select * into row from eggs_community_private.posts where id=p_id for update;
 if row.id is null then raise exception 'Post unavailable' using errcode='PT404'; end if;
 if p_action in ('edit','delete') then
  if row.profile_id<>pid then raise exception 'Post owner required' using errcode='42501'; end if;
  if p_action='delete' then
   delete from eggs_community_private.posts where id=p_id;
   return jsonb_build_object('deleted',true);
  end if;
  if row.revision is distinct from p_revision then raise exception 'This post changed. Reload before saving.' using errcode='PT409'; end if;
  if not eggs_private.is_public_profile(pid) or not eggs_community_private.visible(p_id)
  then raise exception 'Post unavailable for editing' using errcode='PT404'; end if;
  update eggs_community_private.posts set body=btrim(p_body),revision=revision+1,updated_at=clock_timestamp() where id=p_id;
  return jsonb_build_object('post',eggs_community_private.post(p_id));
 end if;
 -- Explicit like/unlike operations are idempotent, even across browser tabs.
 if not eggs_private.is_public_profile(pid) or not eggs_community_private.visible(p_id)
 then raise exception 'Public post and profile required' using errcode='PT404'; end if;
 if p_action='like' then
  insert into eggs_community_private.likes(profile_id,post_id) values(pid,p_id) on conflict do nothing;
 else delete from eggs_community_private.likes where profile_id=pid and post_id=p_id; end if;
 return jsonb_build_object('liked',p_action='like','like_count',
 (select count(*) from eggs_community_private.likes l where l.post_id=p_id and eggs_private.is_public_profile(l.profile_id)));
end $$;

create function public.get_eggs_community(p_before timestamptz default null,p_before_id uuid default null,p_limit integer default 20,p_author text default null) returns jsonb
language sql stable security invoker set search_path='' as $$ select eggs_community_private.feed(p_before,p_before_id,p_limit,p_author); $$;
create function public.get_eggs_community_post(p_id uuid) returns jsonb
language sql stable security invoker set search_path='' as $$ select eggs_community_private.thread(p_id); $$;
create function public.list_eggs_people(p_query text default '',p_after text default null,p_limit integer default 24) returns jsonb
language sql stable security invoker set search_path='' as $$ select eggs_community_private.people(p_query,p_after,p_limit); $$;
create function public.get_my_eggs_community() returns jsonb
language sql stable security invoker set search_path='' as $$ select eggs_community_private.mine(); $$;
create function public.get_eggs_community_moderation() returns jsonb
language sql stable security invoker set search_path='' as $$ select eggs_community_private.moderation(); $$;
create function public.write_eggs_community(p_action text,p_id uuid default null,p_body text default null,p_parent uuid default null,p_revision bigint default null) returns jsonb
language sql security invoker set search_path='' as $$ select eggs_community_private.write(p_action,p_id,p_body,p_parent,p_revision); $$;

revoke all on all functions in schema eggs_community_private from public,anon,authenticated,service_role;
grant execute on function eggs_community_private.feed(timestamptz,uuid,integer,text),eggs_community_private.thread(uuid),
 eggs_community_private.people(text,text,integer) to anon,authenticated;
grant execute on function eggs_community_private.mine(),eggs_community_private.moderation(),eggs_community_private.write(text,uuid,text,uuid,bigint) to authenticated;
revoke all on function public.get_eggs_community(timestamptz,uuid,integer,text),public.get_eggs_community_post(uuid),
 public.list_eggs_people(text,text,integer),public.get_my_eggs_community(),public.get_eggs_community_moderation(),public.write_eggs_community(text,uuid,text,uuid,bigint)
 from public,anon,authenticated,service_role;
grant execute on function public.get_eggs_community(timestamptz,uuid,integer,text),public.get_eggs_community_post(uuid),public.list_eggs_people(text,text,integer) to anon,authenticated;
grant execute on function public.get_my_eggs_community(),public.get_eggs_community_moderation(),public.write_eggs_community(text,uuid,text,uuid,bigint) to authenticated;

-- Publication formats extend the approved work validator without changing its
-- required legacy fields, registered assets, permission gate, or audit writer.
create or replace function eggs_rooms_private.valid_work(v jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
begin
 if jsonb_typeof(v) is distinct from 'object' or not v ?& array['title','summary','description','asset_id','project_id']
 or exists(select 1 from jsonb_object_keys(v) k where k not in ('title','summary','description','asset_id','project_id','format','media_url'))
 then return false; end if;
 if v ? 'format' and (jsonb_typeof(v->'format')<>'string' or v->>'format' not in ('article','issue','comic','funnies','video')) then return false; end if;
 if v->>'format'='video' and coalesce(v->>'media_url','')='' then return false; end if;
 if v ? 'media_url' and (jsonb_typeof(v->'media_url')<>'string' or
  (v->>'media_url'<>'' and (v->>'format' is distinct from 'video' or
   not ((v->>'media_url') ~ '^https://www[.]youtube[.]com/watch[?]v=[A-Za-z0-9_-]{11}$' or (v->>'media_url') ~ '^https://vimeo[.]com/[1-9][0-9]{0,11}$')))) then return false; end if;
 return coalesce(jsonb_typeof(v->'title')='string' and char_length(btrim(v->>'title')) between 1 and 80
 and jsonb_typeof(v->'summary')='string' and char_length(btrim(v->>'summary')) between 1 and 240
 and jsonb_typeof(v->'description')='string' and char_length(btrim(v->>'description')) between 1 and 3000
 and jsonb_typeof(v->'asset_id')='string'
 and (v->'project_id'='null'::jsonb or (v->>'project_id') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),false);
end $$;
commit;
