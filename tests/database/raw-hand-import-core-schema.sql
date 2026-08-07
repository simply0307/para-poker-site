-- Disposable-test-only core schema inferred from the repository's live query shapes.
-- Never apply this fixture to a deployed Para Poker project.

create extension if not exists pgcrypto;

create table public.players (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  pokernow_name text,
  slug text not null unique
);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  season_code text not null default 'S0',
  session_number integer,
  session_code text not null unique,
  played_at timestamptz not null,
  table_name text not null,
  format text not null,
  status text not null,
  raw_log_rows integer,
  hands_count integer,
  players_count integer
);

create table public.hands (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  hand_no integer not null,
  hand_id text,
  start_time timestamptz,
  board text,
  winner_player_id uuid references public.players(id) on delete set null,
  winner_name text,
  pot_collected numeric,
  winning_hand text,
  showdown boolean,
  raw_result text
);

create table public.actions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  hand_id uuid references public.hands(id) on delete cascade,
  hand_no integer,
  log_order integer,
  street text,
  player_id uuid references public.players(id) on delete set null,
  player_name text,
  position text,
  seat_index integer,
  dealer_name text,
  preflop_action_order integer,
  action text,
  amount numeric,
  all_in boolean,
  faced_raise boolean,
  faced_3bet boolean,
  is_open_raise boolean,
  is_3bet boolean,
  is_limp boolean,
  is_call_vs_raise boolean,
  raw_entry text
);

create table public.notable_hands (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  hand_no integer,
  hand_code text,
  tags text[],
  winner_name text,
  pot_collected numeric,
  winning_hand text,
  board text,
  involved_players text[],
  summary text,
  raw_result text
);

create table public.player_session_stats (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  player_id uuid references public.players(id) on delete set null,
  player_name text not null,
  hands integer not null default 0,
  hands_won integer not null default 0,
  hand_win_pct numeric not null default 0,
  total_collected numeric not null default 0,
  biggest_pot_won numeric not null default 0,
  all_ins integer not null default 0,
  folds integer not null default 0,
  fold_pct numeric not null default 0,
  notable_hands integer not null default 0,
  primary_label text,
  secondary_label text
);

create table public.session_results (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  player_id uuid references public.players(id) on delete set null,
  player_name text not null,
  finish integer,
  league_points numeric,
  final_stack numeric,
  confidence text,
  notes text,
  approved boolean not null default false
);

create table public.standings (
  id uuid primary key default gen_random_uuid(),
  season_code text not null,
  player_id uuid references public.players(id) on delete set null,
  player_name text not null,
  sessions_played integer not null default 0,
  total_points numeric not null default 0,
  wins integer not null default 0,
  top_3s integer not null default 0,
  top_4s integer not null default 0,
  best_finish integer,
  avg_finish numeric,
  latest_session_code text,
  rank integer,
  updated_at timestamptz not null default now()
);
