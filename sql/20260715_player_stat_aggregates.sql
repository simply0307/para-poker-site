-- Canonical player stat aggregates.
-- Session imports write evidence rows, stat calculators populate
-- player_session_stats, and confirmed results roll into season/career rows.

create table if not exists public.player_season_stats (
  id uuid primary key default gen_random_uuid(),
  season_code text not null default 'S0',
  player_id uuid references public.players(id) on delete set null,
  player_name text not null,
  sessions_played integer not null default 0,
  hands integer not null default 0,
  hands_won integer not null default 0,
  hand_win_pct numeric not null default 0,
  total_collected numeric not null default 0,
  biggest_pot_won numeric not null default 0,
  all_ins integer not null default 0,
  folds integer not null default 0,
  fold_pct numeric not null default 0,
  vpip_pct numeric,
  pfr_pct numeric,
  vpip_pfr_gap numeric,
  three_bet_pct numeric,
  open_raise_pct numeric,
  limp_pct numeric,
  call_pf_raise_pct numeric,
  preflop_all_ins integer not null default 0,
  wins integer not null default 0,
  top_3s integer not null default 0,
  top_4s integer not null default 0,
  best_finish integer,
  avg_finish numeric,
  total_points numeric not null default 0,
  latest_session_id uuid references public.sessions(id) on delete set null,
  latest_session_code text,
  updated_at timestamptz not null default now(),
  unique (season_code, player_id)
);

alter table public.player_season_stats add column if not exists season_code text not null default 'S0';
alter table public.player_season_stats add column if not exists player_id uuid references public.players(id) on delete set null;
alter table public.player_season_stats add column if not exists player_name text not null default 'Player';
alter table public.player_season_stats add column if not exists sessions_played integer not null default 0;
alter table public.player_season_stats add column if not exists hands integer not null default 0;
alter table public.player_season_stats add column if not exists hands_won integer not null default 0;
alter table public.player_season_stats add column if not exists hand_win_pct numeric not null default 0;
alter table public.player_season_stats add column if not exists total_collected numeric not null default 0;
alter table public.player_season_stats add column if not exists biggest_pot_won numeric not null default 0;
alter table public.player_season_stats add column if not exists all_ins integer not null default 0;
alter table public.player_season_stats add column if not exists folds integer not null default 0;
alter table public.player_season_stats add column if not exists fold_pct numeric not null default 0;
alter table public.player_season_stats add column if not exists vpip_pct numeric;
alter table public.player_season_stats add column if not exists pfr_pct numeric;
alter table public.player_season_stats add column if not exists vpip_pfr_gap numeric;
alter table public.player_season_stats add column if not exists three_bet_pct numeric;
alter table public.player_season_stats add column if not exists open_raise_pct numeric;
alter table public.player_season_stats add column if not exists limp_pct numeric;
alter table public.player_season_stats add column if not exists call_pf_raise_pct numeric;
alter table public.player_season_stats add column if not exists preflop_all_ins integer not null default 0;
alter table public.player_season_stats add column if not exists wins integer not null default 0;
alter table public.player_season_stats add column if not exists top_3s integer not null default 0;
alter table public.player_season_stats add column if not exists top_4s integer not null default 0;
alter table public.player_season_stats add column if not exists best_finish integer;
alter table public.player_season_stats add column if not exists avg_finish numeric;
alter table public.player_season_stats add column if not exists total_points numeric not null default 0;
alter table public.player_season_stats add column if not exists latest_session_id uuid references public.sessions(id) on delete set null;
alter table public.player_season_stats add column if not exists latest_session_code text;
alter table public.player_season_stats add column if not exists updated_at timestamptz not null default now();

create unique index if not exists player_season_stats_season_player_uidx
  on public.player_season_stats (season_code, player_id);

create index if not exists player_season_stats_season_idx
  on public.player_season_stats (season_code, total_points desc, wins desc, best_finish asc);

create table if not exists public.player_career_stats (
  id uuid primary key default gen_random_uuid(),
  player_id uuid references public.players(id) on delete set null,
  player_name text not null,
  seasons_played integer not null default 0,
  sessions_played integer not null default 0,
  hands integer not null default 0,
  hands_won integer not null default 0,
  hand_win_pct numeric not null default 0,
  total_collected numeric not null default 0,
  biggest_pot_won numeric not null default 0,
  all_ins integer not null default 0,
  folds integer not null default 0,
  fold_pct numeric not null default 0,
  vpip_pct numeric,
  pfr_pct numeric,
  vpip_pfr_gap numeric,
  wins integer not null default 0,
  top_3s integer not null default 0,
  top_4s integer not null default 0,
  best_finish integer,
  avg_finish numeric,
  total_points numeric not null default 0,
  updated_at timestamptz not null default now(),
  unique (player_id)
);

alter table public.player_career_stats add column if not exists player_id uuid references public.players(id) on delete set null;
alter table public.player_career_stats add column if not exists player_name text not null default 'Player';
alter table public.player_career_stats add column if not exists seasons_played integer not null default 0;
alter table public.player_career_stats add column if not exists sessions_played integer not null default 0;
alter table public.player_career_stats add column if not exists hands integer not null default 0;
alter table public.player_career_stats add column if not exists hands_won integer not null default 0;
alter table public.player_career_stats add column if not exists hand_win_pct numeric not null default 0;
alter table public.player_career_stats add column if not exists total_collected numeric not null default 0;
alter table public.player_career_stats add column if not exists biggest_pot_won numeric not null default 0;
alter table public.player_career_stats add column if not exists all_ins integer not null default 0;
alter table public.player_career_stats add column if not exists folds integer not null default 0;
alter table public.player_career_stats add column if not exists fold_pct numeric not null default 0;
alter table public.player_career_stats add column if not exists vpip_pct numeric;
alter table public.player_career_stats add column if not exists pfr_pct numeric;
alter table public.player_career_stats add column if not exists vpip_pfr_gap numeric;
alter table public.player_career_stats add column if not exists wins integer not null default 0;
alter table public.player_career_stats add column if not exists top_3s integer not null default 0;
alter table public.player_career_stats add column if not exists top_4s integer not null default 0;
alter table public.player_career_stats add column if not exists best_finish integer;
alter table public.player_career_stats add column if not exists avg_finish numeric;
alter table public.player_career_stats add column if not exists total_points numeric not null default 0;
alter table public.player_career_stats add column if not exists updated_at timestamptz not null default now();

create unique index if not exists player_career_stats_player_uidx
  on public.player_career_stats (player_id);

create table if not exists public.stat_recalculation_runs (
  id uuid primary key default gen_random_uuid(),
  scope text not null,
  season_code text,
  session_id uuid references public.sessions(id) on delete set null,
  source text not null default 'admin',
  status text not null default 'completed',
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.player_season_stats enable row level security;
alter table public.player_career_stats enable row level security;
alter table public.stat_recalculation_runs enable row level security;

select pg_notify('pgrst', 'reload schema');
