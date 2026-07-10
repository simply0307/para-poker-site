-- Adds provider/model fallback observability for newsroom AI drafts.

alter table public.recap_drafts
  add column if not exists provider_used text,
  add column if not exists generation_error text,
  add column if not exists fallback_trace jsonb not null default '[]'::jsonb;

update public.recap_drafts
set provider_used = coalesce(provider_used, provider)
where provider_used is null;

comment on column public.recap_drafts.provider_used is
  'AI provider that produced the saved draft. Kept separate from public UI.';

comment on column public.recap_drafts.model_used is
  'Exact model that produced the saved draft after fallback resolution.';

comment on column public.recap_drafts.fallback_trace is
  'Admin-only trace of model fallback attempts. Must not be shown in public UI.';

comment on column public.recap_drafts.generation_error is
  'Admin-only final generation error when persisted by editorial tooling.';

select pg_notify('pgrst', 'reload schema');
