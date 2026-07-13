-- Passive training-data capture for the Para Poker newsroom.
-- Stores immutable original model outputs and final published outputs in the
-- background. Public pages and normal editorial forms do not read this table.

create table if not exists public.recap_training_examples (
  id uuid primary key default gen_random_uuid(),
  draft_table text not null default 'recap_drafts',
  draft_id text not null,
  scope text not null,
  source_session_id text,
  source_player_id text,
  season_code text,
  moment_id text,
  source_hash text not null unique,
  context_packet jsonb not null,
  original_output jsonb not null,
  approved_output jsonb,
  provider_used text,
  model_used text,
  prompt_version text,
  source_data_version text,
  capture_status text not null default 'captured'
    check (capture_status in ('captured', 'ready_for_review', 'included', 'excluded', 'undecided')),
  training_eligible boolean,
  dataset_split text
    check (dataset_split in ('train', 'development', 'test')),
  edit_tags text[] not null default array[]::text[],
  editor_notes text not null default '',
  approved_by text,
  generated_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists recap_training_examples_draft_idx
  on public.recap_training_examples (draft_table, draft_id);

do $$
begin
  if not exists (
    select 1
    from public.recap_training_examples
    group by draft_table, draft_id
    having count(*) > 1
  ) then
    create unique index if not exists recap_training_examples_draft_unique_idx
      on public.recap_training_examples (draft_table, draft_id);
  else
    raise notice 'Skipped recap_training_examples_draft_unique_idx because duplicate draft captures already exist.';
  end if;
end $$;

create index if not exists recap_training_examples_export_idx
  on public.recap_training_examples (capture_status, training_eligible, dataset_split, approved_at desc);

create or replace function public.prevent_training_original_mutation()
returns trigger
language plpgsql
as $$
begin
  if old.context_packet is distinct from new.context_packet then
    raise exception 'context_packet is immutable for recap_training_examples';
  end if;
  if old.original_output is distinct from new.original_output then
    raise exception 'original_output is immutable for recap_training_examples';
  end if;
  if old.source_hash is distinct from new.source_hash then
    raise exception 'source_hash is immutable for recap_training_examples';
  end if;
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists recap_training_examples_immutable_original
  on public.recap_training_examples;

create trigger recap_training_examples_immutable_original
before update on public.recap_training_examples
for each row execute function public.prevent_training_original_mutation();

alter table public.recap_training_examples enable row level security;

select pg_notify('pgrst', 'reload schema');
