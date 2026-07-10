-- Optional player/admin profile presentation customization.
-- Run this manually after sql/player_profile_display.sql.

alter table public.player_profile_display
  add column if not exists hero_bg_url text;

alter table public.player_profile_display
  add column if not exists featured_display_bg_url text;

alter table public.player_profile_display
  add column if not exists public_hud_bg_url text;

alter table public.player_profile_display
  add column if not exists moments_bg_url text;

alter table public.player_profile_display
  add column if not exists achievements_bg_url text;

alter table public.player_profile_display
  add column if not exists locked_sections_bg_url text;

comment on column public.player_profile_display.hero_bg_url is
  'Optional background image URL for the profile hero area.';

comment on column public.player_profile_display.featured_display_bg_url is
  'Optional background image URL for the Plasmic outer layer named Featured Display Section.';

comment on column public.player_profile_display.public_hud_bg_url is
  'Optional background image URL for the Plasmic outer layer named Public HUD Section.';

comment on column public.player_profile_display.moments_bg_url is
  'Optional background image URL for the Plasmic outer layer named Moments Section.';

comment on column public.player_profile_display.achievements_bg_url is
  'Optional background image URL for the Plasmic outer layer named Achievements.';

comment on column public.player_profile_display.locked_sections_bg_url is
  'Optional background image URL for the Plasmic outer layer named Locked Sections.';

comment on column public.player_profile_display.profile_theme is
  'Named profile theme metadata retained alongside section customization.';

comment on column public.player_profile_display.banner_url is
  'Optional profile banner URL retained for profile presentation.';

comment on column public.player_profile_display.custom_title is
  'Optional custom profile title retained for future presentation use.';
