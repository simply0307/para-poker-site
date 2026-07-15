-- Big-blind normalization for cross-session pot comparison.
-- Run after the player stat aggregate migration.

alter table public.hands add column if not exists small_blind numeric;
alter table public.hands add column if not exists big_blind numeric;
alter table public.hands add column if not exists pot_bb numeric;

alter table public.notable_hands add column if not exists small_blind numeric;
alter table public.notable_hands add column if not exists big_blind numeric;
alter table public.notable_hands add column if not exists pot_bb numeric;

alter table public.player_session_stats add column if not exists total_collected_bb numeric;
alter table public.player_session_stats add column if not exists biggest_pot_won_bb numeric;

alter table public.player_season_stats add column if not exists total_collected_bb numeric;
alter table public.player_season_stats add column if not exists biggest_pot_won_bb numeric;

alter table public.player_career_stats add column if not exists total_collected_bb numeric;
alter table public.player_career_stats add column if not exists biggest_pot_won_bb numeric;

select pg_notify('pgrst', 'reload schema');
