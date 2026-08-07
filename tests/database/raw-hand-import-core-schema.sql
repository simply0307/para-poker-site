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
  session_number integer not null,
  session_code text not null unique,
  played_at timestamptz,
  table_name text,
  format text,
  status text,
  raw_log_rows integer,
  hands_count integer,
  players_count integer
);

create table public.hands (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.sessions(id) on delete cascade,
  hand_no integer,
  hand_id text,
  start_time timestamptz,
  board text,
  winner_player_id uuid references public.players(id) on delete set null,
  winner_name text,
  pot_collected integer,
  winning_hand text,
  showdown boolean,
  raw_result text
);

create table public.actions (
  id bigserial primary key,
  session_id uuid references public.sessions(id) on delete cascade,
  hand_id uuid references public.hands(id) on delete cascade,
  hand_no integer,
  log_order bigint,
  street text,
  player_id uuid references public.players(id) on delete set null,
  player_name text,
  position text,
  seat_index integer,
  dealer_name text,
  preflop_action_order integer,
  action text,
  amount integer,
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
  id bigserial primary key,
  session_id uuid references public.sessions(id) on delete cascade,
  hand_no integer,
  hand_code text,
  tags text[],
  winner_name text,
  pot_collected integer,
  winning_hand text,
  board text,
  involved_players text[],
  summary text,
  raw_result text
);

create table public.player_session_stats (
  id bigserial primary key,
  session_id uuid references public.sessions(id) on delete cascade,
  player_id uuid references public.players(id),
  player_name text,
  hands integer,
  hands_won integer,
  hand_win_pct numeric,
  total_collected integer,
  biggest_pot_won integer,
  all_ins integer,
  folds integer,
  fold_pct numeric,
  notable_hands integer,
  primary_label text,
  secondary_label text
);

create table public.session_results (
  id bigserial primary key,
  session_id uuid references public.sessions(id) on delete cascade,
  player_id uuid references public.players(id),
  player_name text,
  finish integer,
  league_points integer,
  final_stack integer,
  confidence text,
  notes text,
  approved boolean
);

create table public.standings (
  id bigserial primary key,
  season_code text,
  player_id uuid references public.players(id),
  player_name text,
  sessions_played integer,
  total_points integer,
  wins integer,
  top_3s integer,
  top_4s integer,
  best_finish integer,
  avg_finish numeric,
  latest_session_code text,
  rank integer,
  updated_at timestamptz
);
