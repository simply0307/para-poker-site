create table public.suitfire_editorial_reports (
  match_id text primary key check(length(match_id) between 1 and 100),
  headline text not null check(length(headline) between 1 and 240),
  prose text not null check(length(prose) between 1 and 40000),
  version int not null default 1,
  updated_at timestamptz not null default now(),
  published_headline text, published_prose text, published_at timestamptz
);
alter table public.suitfire_editorial_reports enable row level security;
revoke all on public.suitfire_editorial_reports from public,anon,authenticated;
grant select,insert,update on public.suitfire_editorial_reports to service_role;
notify pgrst,'reload schema';
