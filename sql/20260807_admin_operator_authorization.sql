begin;

alter table public.profiles
  add column if not exists auth_user_id uuid references auth.users(id) on delete set null;

create unique index if not exists profiles_auth_user_id_key
  on public.profiles (auth_user_id)
  where auth_user_id is not null;

-- One-time bridge from the existing legacy identity record to the sole current
-- Supabase Auth user. Email is used only inside this reviewed migration; runtime
-- authorization uses the stable auth.users UUID exclusively.
update public.profiles as profile
set auth_user_id = auth_user.id
from auth.users as auth_user
where profile.auth_user_id is null
  and lower(profile.email) = lower(auth_user.email)
  and profile.role in ('admin', 'owner')
  and not exists (
    select 1
    from public.profiles as other_profile
    where other_profile.auth_user_id = auth_user.id
  );

comment on column public.profiles.auth_user_id is
  'Stable Supabase Auth identity used by the server-only admin authorization boundary.';

commit;
