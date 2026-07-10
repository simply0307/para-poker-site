-- Player-selected Featured Display / Player Showcase configuration.
-- This table stores presentation choices only; Plasmic still controls where
-- and how the featuredDisplaySlot appears on the public profile.

create table if not exists public.player_profile_display (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  season_code text not null default 'S0',
  display_mode text not null default 'player_selected',
  featured_cards jsonb not null default '[]'::jsonb,
  profile_theme text not null default 'default',
  banner_url text,
  custom_title text,
  updated_at timestamptz not null default now(),
  constraint player_profile_display_player_season_key
    unique (player_id, season_code)
);

comment on table public.player_profile_display is
  'Controls player-selected Featured Display / Player Showcase choices for a season.';

comment on column public.player_profile_display.featured_cards is
  'Ordered JSON cards for featured_1, featured_2, and featured_3. Supported types: stat, result, moment, achievement, team, quote, custom, placeholder.';

comment on column public.player_profile_display.display_mode is
  'Presentation mode. player_selected means featured_cards override smart defaults.';
