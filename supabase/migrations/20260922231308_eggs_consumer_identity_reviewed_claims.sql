-- REVIEW CANDIDATE. Unapplied to production.
-- Reconciled with uzderzjbitmghfvrllvz, PostgreSQL 17.6, 2026-09-22.
-- Additive only: no legacy profile, player, evidence, grant or policy is changed.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $preflight$
begin
  if current_user <> 'postgres' or current_setting('server_version_num')::int < 170000 then
    raise exception 'Reviewed migration requires the postgres migration role and PostgreSQL 17 or later';
  end if;
  if not exists (select 1 from pg_roles where rolname=current_user and rolbypassrls)
     or exists (select 1 from pg_roles where rolname in ('anon','authenticated') and (rolsuper or rolbypassrls)) then
    raise exception 'Database roles differ from the audited RLS boundary';
  end if;
  if not has_table_privilege(current_user,'auth.sessions','SELECT') or
     (select count(*) from pg_attribute where attrelid='auth.sessions'::regclass and
       ((attname in ('id','user_id') and atttypid='uuid'::regtype) or (attname='not_after' and atttypid='timestamptz'::regtype)))<>3 then
    raise exception 'Auth session revocation boundary differs from the read-only audit';
  end if;
  if not exists (select 1 from pg_attribute where attrelid='public.players'::regclass and attname='id' and atttypid='uuid'::regtype and attnotnull)
     or not exists (select 1 from pg_attribute where attrelid='public.profiles'::regclass and attname='auth_user_id' and atttypid='uuid'::regtype) then
    raise exception 'Legacy identity schema differs from the read-only audit';
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.profiles'::regclass and conname='profiles_auth_user_id_fkey'
       and convalidated and not condeferrable
       and pg_get_constraintdef(oid)='FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE SET NULL')
     or not exists (select 1 from pg_index where indexrelid=to_regclass('public.profiles_auth_user_id_key') and indisunique and indisvalid
       and pg_get_indexdef(indexrelid)='CREATE UNIQUE INDEX profiles_auth_user_id_key ON public.profiles USING btree (auth_user_id) WHERE (auth_user_id IS NOT NULL)') then
    raise exception 'Existing operator Auth foreign key or uniqueness is missing';
  end if;
  if exists (select 1 from pg_class where oid in ('public.profiles'::regclass,'public.players'::regclass) and not relrowsecurity)
     or exists (select 1 from pg_policies where schemaname='public' and tablename in ('profiles','players')) then
    raise exception 'Legacy RLS boundary has changed; repeat the audit before proceeding';
  end if;
  if to_regnamespace('eggs_private') is not null or to_regclass('public.eggs_profiles') is not null
     or to_regclass('public.para_poker_player_claims') is not null or to_regclass('public.para_poker_profile_links') is not null then
    raise exception 'Consumer identity objects already exist; refusing to merge an unknown schema';
  end if;
end;
$preflight$;

create schema eggs_private authorization postgres;
revoke all on schema eggs_private from public, anon, authenticated, service_role;
-- Helpers can be evaluated by RLS, but eggs_private is not a Data API schema.
grant usage on schema eggs_private to anon, authenticated, service_role;

-- The namespace survives account deletion. A single unique key serializes
-- active registrations and retirement, including an insert racing a deletion.
create table eggs_private.handle_registry (
  handle text collate "C" primary key,
  reserved_at timestamptz not null default statement_timestamp(),
  retired_at timestamptz
);
alter table eggs_private.handle_registry enable row level security;
alter table eggs_private.handle_registry force row level security;
revoke all on eggs_private.handle_registry from public,anon,authenticated,service_role;

create table public.eggs_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique default auth.uid() references auth.users(id) on delete cascade,
  handle text collate "C" not null unique,
  display_name text not null,
  bio text not null default '',
  avatar_path text,
  visibility text not null default 'private' check (visibility in ('private','public')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Explicit ASCII exclusion also rejects trailing newlines, Unicode, spaces,
  -- punctuation and uppercase through direct SQL, COPY and service clients.
  constraint eggs_profiles_handle_canonical check (
    char_length(handle) between 3 and 30
    and handle !~ '[^a-z0-9_]'
    and handle = lower(btrim(handle) collate "C")
  ),
  constraint eggs_profiles_handle_reserved check (handle not in (
    'admin','administrator','api','auth','claim','eggs','help','library','login','logout',
    'music','operator','para','poker','profile','profiles','root','settings','support','system','www'
  )),
  constraint eggs_profiles_display_name_length check (char_length(display_name) between 1 and 80 and btrim(display_name) <> ''),
  constraint eggs_profiles_bio_length check (char_length(bio) <= 500),
  -- Storage upload authorization is not introduced. Reserve a profile-owned key.
  constraint eggs_profiles_avatar_path check (avatar_path is null or (
    char_length(avatar_path) <= 200
    and avatar_path ~ ('^' || id::text || '/[A-Za-z0-9_-]+[.](png|jpg|jpeg|webp)$')
    and avatar_path !~ '[[:space:]]'
  ))
);

create table public.para_poker_player_claims (
  id uuid primary key default gen_random_uuid(),
  claimant_profile_id uuid references public.eggs_profiles(id) on delete set null,
  claimant_profile_ref uuid not null,
  player_id uuid not null references public.players(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending','approved','rejected','withdrawn')),
  evidence_note text check (char_length(evidence_note) <= 2000),
  submitted_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolution_source text check (resolution_source in ('operator','claimant')),
  reviewed_at timestamptz,
  reviewer_auth_user_id uuid references auth.users(id) on delete set null,
  reviewer_profile_ref uuid,
  reviewer_role text check (reviewer_role in ('admin','owner')),
  review_note text check (char_length(review_note) between 3 and 500),
  constraint para_poker_claim_resolution check (
    (status='pending' and resolved_at is null and resolution_source is null and reviewed_at is null and reviewer_auth_user_id is null and reviewer_profile_ref is null and reviewer_role is null and review_note is null)
    or (status='withdrawn' and resolved_at is not null and resolution_source in ('claimant') and reviewed_at is null and reviewer_auth_user_id is null and reviewer_profile_ref is null and reviewer_role is null and review_note is null)
    or (status in ('approved','rejected') and resolved_at is not null and resolution_source='operator' and reviewed_at is not null and reviewer_profile_ref is not null and reviewer_role is not null and review_note is not null)
  )
);
create unique index para_poker_claim_pending_pair on public.para_poker_player_claims(claimant_profile_id,player_id) where status='pending';
create index para_poker_claim_profile_idx on public.para_poker_player_claims(claimant_profile_id);
create index para_poker_claim_player_idx on public.para_poker_player_claims(player_id);
create index para_poker_claim_reviewer_idx on public.para_poker_player_claims(reviewer_auth_user_id);
create index para_poker_claim_queue_idx on public.para_poker_player_claims(submitted_at,id) where status='pending';
create table public.para_poker_profile_links (
  profile_id uuid primary key references public.eggs_profiles(id) on delete cascade,
  player_id uuid not null unique references public.players(id) on delete restrict,
  claim_id uuid not null unique references public.para_poker_player_claims(id) on delete restrict,
  verified_at timestamptz not null,
  verified_by_auth_user_id uuid references auth.users(id) on delete set null,
  show_on_profile boolean not null default false
);
create index para_poker_link_reviewer_idx on public.para_poker_profile_links(verified_by_auth_user_id);

-- Identity verification and role authorization are deliberately distinct.
-- These small lookup helpers need definer rights because auth.users and the
-- existing operator profiles table intentionally have no consumer SELECT policy.
create function eggs_private.is_confirmed_user() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from auth.users u where u.id=(select auth.uid())
    and not u.is_anonymous and u.email_confirmed_at is not null and u.deleted_at is null
    and exists(select 1 from auth.sessions s where s.user_id=u.id
      and s.id=nullif(auth.jwt()->>'session_id','')::uuid
      and (s.not_after is null or s.not_after > statement_timestamp())));
$$;
create function eggs_private.current_profile_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select p.id from public.eggs_profiles p
  where p.auth_user_id=(select auth.uid()) and eggs_private.is_confirmed_user();
$$;
create function eggs_private.is_public_profile(p_profile_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.eggs_profiles p join auth.users u on u.id=p.auth_user_id
    where p.id=p_profile_id and p.visibility='public' and not u.is_anonymous
      and u.email_confirmed_at is not null and u.deleted_at is null);
$$;
create function eggs_private.is_poker_operator() returns boolean
language sql stable security definer set search_path = '' as $$
  select eggs_private.is_confirmed_user() and exists(select 1 from public.profiles p
    where p.auth_user_id=(select auth.uid()) and p.role in ('admin','owner'));
$$;
revoke all on function eggs_private.is_confirmed_user(), eggs_private.current_profile_id(), eggs_private.is_public_profile(uuid), eggs_private.is_poker_operator() from public, anon, authenticated, service_role;
grant execute on function eggs_private.is_confirmed_user(), eggs_private.current_profile_id(), eggs_private.is_public_profile(uuid), eggs_private.is_poker_operator() to anon, authenticated, service_role;
alter table public.para_poker_player_claims alter column claimant_profile_id set default eggs_private.current_profile_id();

create function eggs_private.reserve_profile_handle() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into eggs_private.handle_registry(handle) values(new.handle);
  return new;
end;
$$;
revoke all on function eggs_private.reserve_profile_handle() from public,anon,authenticated,service_role;
create trigger eggs_profiles_reserve_handle before insert on public.eggs_profiles
for each row execute function eggs_private.reserve_profile_handle();

-- Preserve the original claimant reference when the live profile is deleted.
create function eggs_private.stamp_claim_identity() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.claimant_profile_ref := new.claimant_profile_id;
  return new;
end;
$$;
revoke all on function eggs_private.stamp_claim_identity() from public,anon,authenticated,service_role;
create trigger poker_claim_stamp_identity before insert on public.para_poker_player_claims
for each row execute function eggs_private.stamp_claim_identity();

create function eggs_private.protect_profile_identity() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.id is distinct from old.id or new.auth_user_id is distinct from old.auth_user_id
     or new.handle is distinct from old.handle or new.created_at is distinct from old.created_at then
    raise exception using errcode='55000', message='Profile identity and handle are immutable in this phase';
  end if;
  new.updated_at := statement_timestamp();
  return new;
end;
$$;
revoke all on function eggs_private.protect_profile_identity() from public, anon, authenticated, service_role;
create trigger eggs_profiles_protect_identity before update on public.eggs_profiles
for each row execute function eggs_private.protect_profile_identity();

-- Deletion retires the handle permanently and keeps bounded claim audit data.
-- Evidence and decision status stay intact; only the live profile FK detaches.
create function eggs_private.detach_deleted_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update eggs_private.handle_registry set retired_at=statement_timestamp() where handle=old.handle;
  delete from public.para_poker_profile_links where profile_id=old.id;
  update public.para_poker_player_claims set claimant_profile_id=null
  where claimant_profile_id=old.id;
  return old;
end;
$$;
revoke all on function eggs_private.detach_deleted_profile() from public, anon, authenticated, service_role;
create trigger eggs_profiles_detach_before_delete before delete on public.eggs_profiles
for each row execute function eggs_private.detach_deleted_profile();

alter table public.eggs_profiles enable row level security;
alter table public.eggs_profiles force row level security;
alter table public.para_poker_player_claims enable row level security;
alter table public.para_poker_player_claims force row level security;
alter table public.para_poker_profile_links enable row level security;
alter table public.para_poker_profile_links force row level security;

-- The live project grants ALL by default. Revoke those grants on new objects
-- only. RLS does not protect TRUNCATE, column privacy or function execution.
revoke all on public.eggs_profiles, public.para_poker_player_claims, public.para_poker_profile_links from public, anon, authenticated, service_role;
grant select on public.eggs_profiles, public.para_poker_player_claims, public.para_poker_profile_links to service_role;
grant select(id,handle,display_name,bio,avatar_path,visibility,created_at,updated_at) on public.eggs_profiles to anon, authenticated;
grant insert(handle,display_name,bio,avatar_path,visibility) on public.eggs_profiles to authenticated;
grant update(display_name,bio,avatar_path,visibility) on public.eggs_profiles to authenticated;
grant delete on public.eggs_profiles to authenticated;
grant select(id,claimant_profile_id,player_id,status,submitted_at,resolved_at,reviewed_at) on public.para_poker_player_claims to authenticated;
grant insert(player_id,evidence_note) on public.para_poker_player_claims to authenticated;
grant select(profile_id,player_id,show_on_profile) on public.para_poker_profile_links to anon, authenticated;
grant update(show_on_profile) on public.para_poker_profile_links to authenticated;

create policy eggs_profile_read on public.eggs_profiles for select to anon, authenticated
using (eggs_private.is_public_profile(id) or (auth_user_id=(select auth.uid()) and (select eggs_private.is_confirmed_user())));
create policy eggs_profile_insert on public.eggs_profiles for insert to authenticated
with check (auth_user_id=(select auth.uid()) and (select eggs_private.is_confirmed_user()));
create policy eggs_profile_update on public.eggs_profiles for update to authenticated
using (auth_user_id=(select auth.uid()) and (select eggs_private.is_confirmed_user()))
with check (auth_user_id=(select auth.uid()) and (select eggs_private.is_confirmed_user()));
create policy eggs_profile_delete on public.eggs_profiles for delete to authenticated
using (auth_user_id=(select auth.uid()) and (select eggs_private.is_confirmed_user()));
create policy poker_claim_read on public.para_poker_player_claims for select to authenticated
using (claimant_profile_id=(select eggs_private.current_profile_id()) or (select eggs_private.is_poker_operator()));
create policy poker_claim_insert on public.para_poker_player_claims for insert to authenticated
with check (claimant_profile_id is not null and claimant_profile_id=(select eggs_private.current_profile_id()) and status='pending');
create policy poker_link_read on public.para_poker_profile_links for select to anon, authenticated
using (profile_id=(select eggs_private.current_profile_id()) or (show_on_profile and eggs_private.is_public_profile(profile_id)));
create policy poker_link_visibility_update on public.para_poker_profile_links for update to authenticated
using (profile_id=(select eggs_private.current_profile_id()))
with check (profile_id=(select eggs_private.current_profile_id()));

create view public.eggs_public_profiles with (security_invoker=true, security_barrier=true) as
select id,handle,display_name,bio,avatar_path,visibility,created_at,updated_at
from public.eggs_profiles where visibility='public';
create view public.para_poker_public_profile_links with (security_invoker=true, security_barrier=true) as
select l.profile_id,l.player_id from public.para_poker_profile_links l
join public.eggs_profiles p on p.id=l.profile_id where l.show_on_profile and p.visibility='public';
revoke all on public.eggs_public_profiles,public.para_poker_public_profile_links from public, anon, authenticated, service_role;
grant select on public.eggs_public_profiles,public.para_poker_public_profile_links to anon, authenticated, service_role;

create function public.get_my_eggs_profile() returns setof public.eggs_public_profiles
language sql stable security invoker set search_path = '' as $$
  select id,handle,display_name,bio,avatar_path,visibility,created_at,updated_at
  from public.eggs_profiles where id=(select eggs_private.current_profile_id());
$$;
revoke all on function public.get_my_eggs_profile() from public, anon, authenticated, service_role;
grant execute on function public.get_my_eggs_profile() to authenticated;
create function public.is_eggs_session_active() returns boolean
language sql stable security invoker set search_path = '' as $$ select eggs_private.is_confirmed_user(); $$;
revoke all on function public.is_eggs_session_active() from public,anon,authenticated,service_role;
grant execute on function public.is_eggs_session_active() to authenticated;

create function eggs_private.review_poker_claim(p_claim_id uuid, p_decision text, p_note text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  reviewer_id uuid := auth.uid();
  resolved_operator_role text;
  resolved_operator_profile uuid;
  target_profile uuid;
  target_player uuid;
  claim public.para_poker_player_claims%rowtype;
begin
  -- Fresh role lookup; no email, name, JWT metadata role or caller reviewer ID.
  -- Share locks keep a concurrent role revocation from racing this decision.
  select p.role,p.id into resolved_operator_role,resolved_operator_profile from public.profiles p join auth.users u on u.id=p.auth_user_id
  where p.auth_user_id=reviewer_id and p.role in ('admin','owner') and not u.is_anonymous
    and u.email_confirmed_at is not null and u.deleted_at is null and eggs_private.is_confirmed_user() for share of p,u;
  if resolved_operator_role is null then
    raise exception using errcode='42501', message='Para Poker operator authorization required';
  end if;
  if p_decision is null or p_decision not in ('approve','reject') or p_note is null or char_length(btrim(p_note)) not between 3 and 500 then
    raise exception using errcode='22023', message='Invalid claim review';
  end if;
  select claimant_profile_id,player_id into target_profile,target_player
    from public.para_poker_player_claims where id=p_claim_id;
  if not found then
    raise exception using errcode='55000', message='Claim is unavailable';
  end if;
  if target_profile is null and p_decision='approve' then
    raise exception using errcode='55000',message='Cannot approve a claim for a deleted profile';
  end if;
  -- Consistent lock order: profile -> player -> claim, also used by withdrawal
  -- and profile deletion. Independent connections must contend on these locks.
  if target_profile is not null then
    perform 1 from public.eggs_profiles p join auth.users u on u.id=p.auth_user_id
      where p.id=target_profile and not u.is_anonymous and u.email_confirmed_at is not null
        and u.deleted_at is null for update of p for share of u;
    if not found then raise exception using errcode='55000',message='Claimant profile is unavailable'; end if;
  end if;
  perform 1 from public.players where id=target_player for update;
  select * into claim from public.para_poker_player_claims where id=p_claim_id for update;
  if claim.claimant_profile_id is distinct from target_profile then
    raise exception using errcode='55000', message='Claimant changed during review';
  end if;
  if (claim.status='approved' and p_decision='approve') or (claim.status='rejected' and p_decision='reject') then
    return jsonb_build_object('claim_id',claim.id,'status',claim.status,'profile_id',target_profile,'player_id',target_player);
  end if;
  if claim.status <> 'pending' then
    raise exception using errcode='55000', message='Claim is already resolved';
  end if;
  if p_decision='approve' and exists(select 1 from public.para_poker_profile_links where profile_id=target_profile or player_id=target_player) then
    raise exception using errcode='23505', message='Profile or player already has a verified association';
  end if;
  update public.para_poker_player_claims set
    status=case when p_decision='approve' then 'approved' else 'rejected' end,
    resolved_at=statement_timestamp(),reviewed_at=statement_timestamp(),
    resolution_source='operator',
    reviewer_auth_user_id=reviewer_id,reviewer_profile_ref=resolved_operator_profile,reviewer_role=resolved_operator_role,review_note=btrim(p_note)
  where id=p_claim_id;
  if p_decision='approve' then
    insert into public.para_poker_profile_links(profile_id,player_id,claim_id,verified_at,verified_by_auth_user_id)
    values(target_profile,target_player,p_claim_id,statement_timestamp(),reviewer_id);
  end if;
  return jsonb_build_object('claim_id',p_claim_id,'status',case when p_decision='approve' then 'approved' else 'rejected' end,'profile_id',target_profile,'player_id',target_player);
end;
$$;
revoke all on function eggs_private.review_poker_claim(uuid,text,text) from public, anon, authenticated, service_role;
grant execute on function eggs_private.review_poker_claim(uuid,text,text) to authenticated;
create function public.review_para_poker_claim(p_claim_id uuid,p_decision text,p_note text default null) returns jsonb
language sql security invoker set search_path = '' as $$
  select eggs_private.review_poker_claim(p_claim_id,p_decision,p_note);
$$;
revoke all on function public.review_para_poker_claim(uuid,text,text) from public, anon, authenticated, service_role;
grant execute on function public.review_para_poker_claim(uuid,text,text) to authenticated;

create function eggs_private.withdraw_poker_claim(p_claim_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  own_profile uuid := eggs_private.current_profile_id();
  claim public.para_poker_player_claims%rowtype;
begin
  if own_profile is null then raise exception using errcode='42501',message='EGGS profile required'; end if;
  perform 1 from public.eggs_profiles where id=own_profile for update;
  select * into claim from public.para_poker_player_claims where id=p_claim_id and claimant_profile_id=own_profile for update;
  if not found then raise exception using errcode='42501',message='Claim does not belong to this profile'; end if;
  if claim.status='withdrawn' then return jsonb_build_object('claim_id',claim.id,'status',claim.status); end if;
  if claim.status <> 'pending' then raise exception using errcode='55000',message='Claim is already resolved'; end if;
  update public.para_poker_player_claims set status='withdrawn',resolved_at=statement_timestamp(),resolution_source='claimant' where id=p_claim_id;
  return jsonb_build_object('claim_id',p_claim_id,'status','withdrawn');
end;
$$;
revoke all on function eggs_private.withdraw_poker_claim(uuid) from public, anon, authenticated, service_role;
grant execute on function eggs_private.withdraw_poker_claim(uuid) to authenticated;
create function public.withdraw_para_poker_claim(p_claim_id uuid) returns jsonb
language sql security invoker set search_path = '' as $$
  select eggs_private.withdraw_poker_claim(p_claim_id);
$$;
revoke all on function public.withdraw_para_poker_claim(uuid) from public, anon, authenticated, service_role;
grant execute on function public.withdraw_para_poker_claim(uuid) to authenticated;

-- Only this bounded public league projection bypasses legacy service-only RLS.
-- It exposes already-public competition facts, never operator or claim data.
create function eggs_private.public_poker_players(p_search text,p_player_id uuid) returns setof jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('player_id',p.id,'display_name',p.display_name,
    'season_code',s.season_code,'rank',s.rank,'points',s.total_points,'sessions_played',s.sessions_played)
  from public.players p left join lateral (
    select season_code,rank,total_points,sessions_played from public.standings
    where player_id=p.id order by updated_at desc nulls last,id desc limit 1
  ) s on true
  where (p_player_id is null or p.id=p_player_id)
    and position(lower(left(coalesce(p_search,''),80)) in lower(p.display_name))>0
  order by lower(p.display_name),p.id limit 50;
$$;
revoke all on function eggs_private.public_poker_players(text,uuid) from public,anon,authenticated,service_role;
grant execute on function eggs_private.public_poker_players(text,uuid) to anon,authenticated;
create function public.get_public_poker_players(p_search text default '',p_player_id uuid default null) returns setof jsonb
language sql stable security invoker set search_path = '' as $$
  select * from eggs_private.public_poker_players(p_search,p_player_id);
$$;
revoke all on function public.get_public_poker_players(text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.get_public_poker_players(text,uuid) to anon,authenticated;

create function eggs_private.claim_details(p_claim_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  claim public.para_poker_player_claims%rowtype;
begin
  select * into claim from public.para_poker_player_claims where id=p_claim_id;
  -- A missing profile/session makes the comparison NULL; it must deny access,
  -- including direct helper calls outside the public RLS-filtered wrappers.
  if not found or not coalesce(eggs_private.is_poker_operator() or
     claim.claimant_profile_id=eggs_private.current_profile_id(),false) then
    raise exception using errcode='42501',message='Claim access denied';
  end if;
  return jsonb_build_object('id',claim.id,'claimant_profile_id',claim.claimant_profile_ref,
    'handle',(select handle from public.eggs_profiles where id=claim.claimant_profile_id),
    'player_id',claim.player_id,'player_name',(select display_name from public.players where id=claim.player_id),
    'status',claim.status,'submitted_at',claim.submitted_at,'resolved_at',claim.resolved_at,'reviewed_at',claim.reviewed_at,
    'resolution_source',claim.resolution_source,
    'reviewer_profile_id',claim.reviewer_profile_ref,'decision_reason',claim.review_note,
    'evidence_note',claim.evidence_note);
end;
$$;
revoke all on function eggs_private.claim_details(uuid) from public,anon,authenticated,service_role;
grant execute on function eggs_private.claim_details(uuid) to authenticated;
create function public.get_my_poker_claims() returns setof jsonb
language sql stable security invoker set search_path = '' as $$
  select eggs_private.claim_details(id) from public.para_poker_player_claims
  where claimant_profile_id=(select eggs_private.current_profile_id()) order by submitted_at desc,id limit 100;
$$;
revoke all on function public.get_my_poker_claims() from public,anon,authenticated,service_role;
grant execute on function public.get_my_poker_claims() to authenticated;

create function eggs_private.claim_review_queue(p_status text,p_offset integer) returns setof jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not eggs_private.is_poker_operator() then raise exception using errcode='42501',message='Operator access required'; end if;
  if p_status not in ('pending','approved','rejected','withdrawn','all') or p_status is null
     or p_offset is null or p_offset<0 or p_offset>100000 then
    raise exception using errcode='22023',message='Invalid queue filter';
  end if;
  return query select eggs_private.claim_details(id) from public.para_poker_player_claims
    where p_status='all' or status=p_status order by submitted_at desc,id limit 50 offset p_offset;
end;
$$;
revoke all on function eggs_private.claim_review_queue(text,integer) from public,anon,authenticated,service_role;
grant execute on function eggs_private.claim_review_queue(text,integer) to authenticated;
create function public.get_poker_claim_review_queue(p_status text default 'pending',p_offset integer default 0) returns setof jsonb
language sql stable security invoker set search_path = '' as $$
  select * from eggs_private.claim_review_queue(p_status,p_offset);
$$;
revoke all on function public.get_poker_claim_review_queue(text,integer) from public,anon,authenticated,service_role;
grant execute on function public.get_poker_claim_review_queue(text,integer) to authenticated;

comment on table public.eggs_profiles is 'Consumer identity only. Legacy public.profiles remains operator authority. Handles remain reserved permanently, including after deletion.';
comment on table public.para_poker_player_claims is 'Reviewed ownership claims with attached supporting evidence and no automatic expiration. Profile/reviewer references survive as audit snapshots.';
comment on table public.para_poker_profile_links is 'One reviewed EGGS profile per existing Poker player. League dossiers and evidence stay in their existing tables.';
comment on schema eggs_private is 'RLS and reviewed-claim internals. Keep this schema out of the Data API exposed-schema list.';
notify pgrst, 'reload schema';
commit;
