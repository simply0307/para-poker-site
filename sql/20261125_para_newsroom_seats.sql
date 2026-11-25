create table public.para_newsroom_seats (
  seat text primary key check (seat in ('simply','burnt_ramen')),
  auth_user_id uuid unique references auth.users(id) on delete set null
);
alter table public.para_newsroom_seats enable row level security;
revoke all on public.para_newsroom_seats from public, anon, authenticated;
grant select on public.para_newsroom_seats to service_role;
insert into public.para_newsroom_seats(seat,auth_user_id) values
  ('simply','b4a05c86-36d6-4bb7-ab6b-d853d2beccc8'), ('burnt_ramen',null);
create view public.para_newsroom_operators with (security_invoker=true) as
select p.id,p.role,p.auth_user_id from public.profiles p
join public.para_newsroom_seats s on s.auth_user_id=p.auth_user_id
where p.role in ('owner','admin');
revoke all on public.para_newsroom_operators from public, anon, authenticated;
grant select on public.para_newsroom_operators to service_role;
notify pgrst,'reload schema';
