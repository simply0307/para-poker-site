-- Clean generation-first newsroom content model.
-- These tables separate future admin workspaces while preserving recap_drafts
-- for the current working S0-001 session flow.

create extension if not exists pgcrypto;

create table if not exists public.profile_drafts (
  id uuid primary key default gen_random_uuid(),
  player_id uuid references public.players(id) on delete set null,
  draft jsonb not null default '{}'::jsonb,
  context_packet jsonb not null default '{}'::jsonb,
  status text not null default 'draft',
  visibility text not null default 'admin',
  provider_used text,
  model_used text,
  generated_at timestamptz not null default now(),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.player_session_recap_drafts (
  id uuid primary key default gen_random_uuid(),
  player_id uuid references public.players(id) on delete set null,
  session_id uuid references public.sessions(id) on delete set null,
  draft jsonb not null default '{}'::jsonb,
  context_packet jsonb not null default '{}'::jsonb,
  status text not null default 'draft',
  visibility text not null default 'admin',
  provider_used text,
  model_used text,
  generated_at timestamptz not null default now(),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.standings_drafts (
  id uuid primary key default gen_random_uuid(),
  season_code text not null default 'S0',
  draft jsonb not null default '{}'::jsonb,
  context_packet jsonb not null default '{}'::jsonb,
  status text not null default 'draft',
  visibility text not null default 'admin',
  provider_used text,
  model_used text,
  generated_at timestamptz not null default now(),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.moment_blurb_drafts (
  id uuid primary key default gen_random_uuid(),
  moment_id uuid,
  draft jsonb not null default '{}'::jsonb,
  context_packet jsonb not null default '{}'::jsonb,
  status text not null default 'draft',
  visibility text not null default 'admin',
  provider_used text,
  model_used text,
  generated_at timestamptz not null default now(),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.article_drafts (
  id uuid primary key default gen_random_uuid(),
  article_request jsonb not null default '{}'::jsonb,
  draft jsonb not null default '{}'::jsonb,
  context_packet jsonb not null default '{}'::jsonb,
  status text not null default 'draft',
  visibility text not null default 'admin',
  provider_used text,
  model_used text,
  generated_at timestamptz not null default now(),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.generation_logs (
  id uuid primary key default gen_random_uuid(),
  scope text not null,
  source_id text,
  provider_used text,
  model_used text,
  fallback_trace jsonb not null default '[]'::jsonb,
  generation_error text,
  created_at timestamptz not null default now()
);

alter table public.profile_drafts enable row level security;
alter table public.player_session_recap_drafts enable row level security;
alter table public.standings_drafts enable row level security;
alter table public.moment_blurb_drafts enable row level security;
alter table public.article_drafts enable row level security;
alter table public.generation_logs enable row level security;

-- No anon policies. Admin/server routes use service-role access until an admin
-- auth layer is added.

select pg_notify('pgrst', 'reload schema');
