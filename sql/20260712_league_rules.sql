-- Integrated league rules/settings table.
-- Admin Rules writes here for tracking/versioning, then applies scoring to
-- session_results.league_points and rebuilds standings for public pages.

create table if not exists public.league_rules (
  id uuid primary key default gen_random_uuid(),
  season_code text not null default 'S0',
  name text not null default 'Season rules',
  status text not null default 'active',
  scoring_rules jsonb not null default '{}'::jsonb,
  import_rules jsonb not null default '{}'::jsonb,
  notes text,
  source_data_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  applied_at timestamptz
);

create index if not exists league_rules_active_idx
  on public.league_rules (season_code, status, updated_at desc);

select pg_notify('pgrst', 'reload schema');
