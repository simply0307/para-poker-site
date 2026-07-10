-- Native v2 newsroom workflow.
-- Stores AI-generated editorial output as editable drafts. Public pages should
-- read only reviewed/published content, never prompt metadata by default.

create extension if not exists pgcrypto;

create table if not exists public.recap_drafts (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('moment', 'session', 'player', 'division', 'season', 'article')),
  status text not null default 'draft' check (status in ('draft', 'approved', 'archived')),
  visibility text not null default 'admin' check (visibility in ('admin', 'public_preview', 'published')),
  source_session_id uuid references public.sessions(id) on delete set null,
  source_player_id uuid references public.players(id) on delete set null,
  article_request jsonb not null default '{}'::jsonb,
  context_packet jsonb not null default '{}'::jsonb,
  draft jsonb not null default '{}'::jsonb,
  confidence_notes text[] not null default '{}',
  missing_data_warnings text[] not null default '{}',
  provider text,
  model_used text,
  prompt_version text not null default 'para-newsroom-v1',
  source_data_version text not null default 'v1',
  generated_at timestamptz not null default now(),
  approved_by text,
  approved_at timestamptz,
  published_at timestamptz,
  unpublished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists recap_drafts_scope_status_idx
  on public.recap_drafts(scope, status, visibility);

create index if not exists recap_drafts_session_idx
  on public.recap_drafts(source_session_id, generated_at desc);

create index if not exists recap_drafts_player_idx
  on public.recap_drafts(source_player_id, generated_at desc);

create table if not exists public.published_articles (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid references public.recap_drafts(id) on delete set null,
  scope text not null check (scope in ('moment', 'session', 'player', 'division', 'season', 'article')),
  slug text unique,
  title text not null,
  body jsonb not null default '{}'::jsonb,
  published_at timestamptz not null default now(),
  unpublished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists recap_drafts_set_updated_at on public.recap_drafts;
create trigger recap_drafts_set_updated_at
before update on public.recap_drafts
for each row execute function public.set_updated_at();

drop trigger if exists published_articles_set_updated_at on public.published_articles;
create trigger published_articles_set_updated_at
before update on public.published_articles
for each row execute function public.set_updated_at();

alter table public.recap_drafts enable row level security;
alter table public.published_articles enable row level security;

-- No anon policies are created here. These tables are admin/editorial storage
-- and should be accessed by server-side service-role routes until a real admin
-- auth model is added.

select pg_notify('pgrst', 'reload schema');
