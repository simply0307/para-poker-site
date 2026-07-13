-- Converts the newsroom capture table to passive review mode if an earlier
-- training-capture schema was already applied.

alter table if exists public.recap_training_examples
  add column if not exists capture_status text not null default 'captured';

alter table if exists public.recap_training_examples
  alter column training_eligible drop not null,
  alter column training_eligible drop default,
  alter column dataset_split drop not null,
  alter column dataset_split drop default;

update public.recap_training_examples
set dataset_split = 'development'
where dataset_split = 'validation';

alter table if exists public.recap_training_examples
  drop constraint if exists recap_training_examples_dataset_split_check;

alter table if exists public.recap_training_examples
  add constraint recap_training_examples_dataset_split_check
  check (dataset_split is null or dataset_split in ('train', 'development', 'test'));

alter table if exists public.recap_training_examples
  drop constraint if exists recap_training_examples_capture_status_check;

alter table if exists public.recap_training_examples
  add constraint recap_training_examples_capture_status_check
  check (capture_status in ('captured', 'ready_for_review', 'included', 'excluded', 'undecided'));

create index if not exists recap_training_examples_review_idx
  on public.recap_training_examples (capture_status, training_eligible, dataset_split, approved_at desc);

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

select pg_notify('pgrst', 'reload schema');
