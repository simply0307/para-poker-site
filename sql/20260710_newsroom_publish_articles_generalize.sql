-- Published articles can originate from article_drafts or other newsroom draft
-- tables, so draft_id should be an identifier rather than a recap_drafts-only FK.

alter table public.published_articles
  drop constraint if exists published_articles_draft_id_fkey;

comment on column public.published_articles.draft_id is
  'Source draft id from a newsroom draft table. The source table is implied by scope/workflow.';

alter table public.published_articles
  drop constraint if exists published_articles_draft_id_key;

alter table public.published_articles
  add constraint published_articles_draft_id_key unique (draft_id);

alter table public.profile_drafts
  add column if not exists fallback_trace jsonb not null default '[]'::jsonb,
  add column if not exists generation_error text,
  add column if not exists unpublished_at timestamptz;

alter table public.player_session_recap_drafts
  add column if not exists fallback_trace jsonb not null default '[]'::jsonb,
  add column if not exists generation_error text,
  add column if not exists unpublished_at timestamptz;

alter table public.standings_drafts
  add column if not exists fallback_trace jsonb not null default '[]'::jsonb,
  add column if not exists generation_error text,
  add column if not exists unpublished_at timestamptz;

alter table public.moment_blurb_drafts
  add column if not exists fallback_trace jsonb not null default '[]'::jsonb,
  add column if not exists generation_error text,
  add column if not exists unpublished_at timestamptz;

alter table public.article_drafts
  add column if not exists fallback_trace jsonb not null default '[]'::jsonb,
  add column if not exists generation_error text,
  add column if not exists unpublished_at timestamptz;

select pg_notify('pgrst', 'reload schema');
