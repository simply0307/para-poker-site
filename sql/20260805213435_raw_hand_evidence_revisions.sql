-- PR 1: immutable raw-hand previews and transactional evidence revisions.
--
-- This file is the authoritative migration. Disposable integration tests execute
-- this exact file; no mirrored Supabase migration is maintained.

create extension if not exists pgcrypto;

do $preflight$
declare
  v_table text;
  v_column text;
  v_required_tables text[] := array[
    'game_session_imports', 'sessions', 'players', 'hands', 'actions',
    'notable_hands', 'player_session_stats', 'session_results',
    'player_season_stats', 'player_career_stats', 'standings',
    'recap_drafts', 'published_articles'
  ];
  v_required_columns jsonb := jsonb_build_object(
    'game_session_imports', array['id','source_app','source_match_id','schema_version','event_schema_version','checksum','authority_type','visibility','status','raw_package','validation_report','participant_mapping','imported_session_id','created_at','validated_at','imported_at','updated_at'],
    'sessions', array['id','season_code','session_number','session_code','played_at','table_name','format','status','raw_log_rows','hands_count','players_count'],
    'players', array['id','display_name','pokernow_name','slug'],
    'hands', array['id','session_id','hand_no','hand_id','start_time','board','winner_player_id','winner_name','pot_collected','winning_hand','showdown','raw_result'],
    'actions', array['session_id','hand_id','hand_no','log_order','street','player_id','player_name','position','seat_index','dealer_name','preflop_action_order','action','amount','all_in','faced_raise','faced_3bet','is_open_raise','is_3bet','is_limp','is_call_vs_raise','raw_entry'],
    'notable_hands', array['session_id','hand_no','hand_code','tags','winner_name','pot_collected','winning_hand','board','involved_players','summary','raw_result'],
    'player_session_stats', array['session_id','player_id','player_name','hands','hands_won','hand_win_pct','total_collected','biggest_pot_won','all_ins','folds','fold_pct','notable_hands'],
    'session_results', array['session_id','approved'],
    'player_season_stats', array['id','season_code'],
    'player_career_stats', array['id'],
    'standings', array['season_code'],
    'recap_drafts', array['id','scope','source_session_id','visibility','unpublished_at','generated_at'],
    'published_articles', array['draft_id','unpublished_at','published_at']
  );
begin
  foreach v_table in array v_required_tables loop
    if to_regclass(format('public.%I', v_table)) is null then
      raise exception using
        errcode = '42P01',
        message = format('PR 1 migration requires existing table public.%I; apply the repository core schema first.', v_table);
    end if;
  end loop;

  for v_table, v_column in
    select entry.key, column_name.value
    from jsonb_each(v_required_columns) entry
    cross join lateral jsonb_array_elements_text(entry.value) column_name(value)
  loop
    if not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = v_table
        and column_name = v_column
    ) then
      raise exception using
        errcode = '42703',
        message = format('PR 1 migration requires existing column public.%I.%I; verify the deployed schema before applying.', v_table, v_column);
    end if;
  end loop;
end
$preflight$;

alter table public.game_session_imports
  add column if not exists import_kind text,
  add column if not exists source_filename text,
  add column if not exists source_media_type text,
  add column if not exists source_size_bytes bigint,
  add column if not exists source_bytes bytea,
  add column if not exists source_checksum text,
  add column if not exists canonical_metadata text,
  add column if not exists metadata jsonb,
  add column if not exists metadata_checksum text,
  add column if not exists parser_version text,
  add column if not exists canonical_manifest text,
  add column if not exists parsed_manifest jsonb,
  add column if not exists manifest_checksum text,
  add column if not exists canonical_validation_report text,
  add column if not exists validation_report_checksum text,
  add column if not exists preview_checksum text,
  add column if not exists replace_existing boolean not null default false,
  add column if not exists target_session_id uuid references public.sessions(id) on delete set null,
  add column if not exists expected_current_evidence_revision_id uuid,
  add column if not exists committed_revision_id uuid,
  add column if not exists commit_attempt_count integer not null default 0,
  add column if not exists commit_report jsonb not null default '{}'::jsonb,
  add column if not exists created_by_user_id uuid;

create index if not exists game_session_imports_preview_checksum_idx
  on public.game_session_imports(preview_checksum);

create index if not exists game_session_imports_target_session_idx
  on public.game_session_imports(target_session_id, created_at desc);

create unique index if not exists game_session_imports_imported_source_uidx
  on public.game_session_imports(source_checksum)
  where import_kind = 'raw_hand_history'
    and status = 'imported'
    and source_checksum is not null;

create or replace function public.protect_raw_hand_import_artifact()
returns trigger
language plpgsql
set search_path = pg_catalog
as $function$
begin
  if old.import_kind = 'raw_hand_history' and (
    new.source_app is distinct from old.source_app
    or new.source_match_id is distinct from old.source_match_id
    or new.import_kind is distinct from old.import_kind
    or new.source_filename is distinct from old.source_filename
    or new.source_media_type is distinct from old.source_media_type
    or new.source_size_bytes is distinct from old.source_size_bytes
    or new.source_bytes is distinct from old.source_bytes
    or new.source_checksum is distinct from old.source_checksum
    or new.canonical_metadata is distinct from old.canonical_metadata
    or new.metadata is distinct from old.metadata
    or new.metadata_checksum is distinct from old.metadata_checksum
    or new.parser_version is distinct from old.parser_version
    or new.canonical_manifest is distinct from old.canonical_manifest
    or new.parsed_manifest is distinct from old.parsed_manifest
    or new.manifest_checksum is distinct from old.manifest_checksum
    or new.canonical_validation_report is distinct from old.canonical_validation_report
    or new.validation_report_checksum is distinct from old.validation_report_checksum
    or new.preview_checksum is distinct from old.preview_checksum
    or new.replace_existing is distinct from old.replace_existing
    or new.target_session_id is distinct from old.target_session_id
    or new.expected_current_evidence_revision_id is distinct from old.expected_current_evidence_revision_id
    or new.created_by_user_id is distinct from old.created_by_user_id
  ) then
    raise exception using errcode = '55000', message = 'Raw-hand preview artifacts are immutable; create a new preview instead.';
  end if;
  return new;
end
$function$;

drop trigger if exists game_session_imports_protect_raw_hand_artifact on public.game_session_imports;
create trigger game_session_imports_protect_raw_hand_artifact
before update on public.game_session_imports
for each row execute function public.protect_raw_hand_import_artifact();

create table public.session_evidence_revisions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  import_id uuid not null references public.game_session_imports(id) on delete restrict,
  revision_number integer not null check (revision_number > 0),
  status text not null default 'pending' check (status in ('pending', 'current', 'superseded')),
  supersedes_revision_id uuid references public.session_evidence_revisions(id) on delete set null,
  source_filename text,
  source_media_type text,
  source_size_bytes bigint not null,
  source_checksum text not null,
  metadata jsonb not null,
  metadata_checksum text not null,
  parser_version text not null,
  parsed_manifest jsonb not null,
  manifest_checksum text not null,
  validation_report jsonb not null,
  validation_report_checksum text not null,
  preview_checksum text not null,
  committed_by_user_id uuid,
  committed_at timestamptz not null default now(),
  superseded_at timestamptz,
  commit_report jsonb not null default '{}'::jsonb,
  unique (session_id, revision_number),
  unique (import_id)
);

create unique index session_evidence_revisions_one_current_uidx
  on public.session_evidence_revisions(session_id)
  where status = 'current';

create index session_evidence_revisions_session_idx
  on public.session_evidence_revisions(session_id, revision_number desc);

create or replace function public.protect_session_evidence_revision_artifact()
returns trigger
language plpgsql
set search_path = pg_catalog
as $function$
begin
  if new.session_id is distinct from old.session_id
    or new.import_id is distinct from old.import_id
    or new.revision_number is distinct from old.revision_number
    or new.supersedes_revision_id is distinct from old.supersedes_revision_id
    or new.source_filename is distinct from old.source_filename
    or new.source_media_type is distinct from old.source_media_type
    or new.source_size_bytes is distinct from old.source_size_bytes
    or new.source_checksum is distinct from old.source_checksum
    or new.metadata is distinct from old.metadata
    or new.metadata_checksum is distinct from old.metadata_checksum
    or new.parser_version is distinct from old.parser_version
    or new.parsed_manifest is distinct from old.parsed_manifest
    or new.manifest_checksum is distinct from old.manifest_checksum
    or new.validation_report is distinct from old.validation_report
    or new.validation_report_checksum is distinct from old.validation_report_checksum
    or new.preview_checksum is distinct from old.preview_checksum
    or new.committed_by_user_id is distinct from old.committed_by_user_id
    or new.committed_at is distinct from old.committed_at
  then
    raise exception using errcode = '55000', message = 'Committed evidence revision artifacts are immutable.';
  end if;
  return new;
end
$function$;

create trigger session_evidence_revisions_protect_artifact
before update on public.session_evidence_revisions
for each row execute function public.protect_session_evidence_revision_artifact();

alter table public.session_evidence_revisions enable row level security;

alter table public.sessions
  add column if not exists current_evidence_revision_id uuid,
  add column if not exists result_review_status text not null default 'legacy_unversioned';

alter table public.sessions
  drop constraint if exists sessions_result_review_status_check;
alter table public.sessions
  add constraint sessions_result_review_status_check
  check (result_review_status in ('legacy_unversioned', 'awaiting_result_review', 'approved'));

alter table public.sessions
  drop constraint if exists sessions_current_evidence_revision_id_fkey;
alter table public.sessions
  add constraint sessions_current_evidence_revision_id_fkey
  foreign key (current_evidence_revision_id)
  references public.session_evidence_revisions(id)
  on delete restrict
  deferrable initially deferred;

alter table public.game_session_imports
  drop constraint if exists game_session_imports_expected_current_evidence_revision_id_fkey;
alter table public.game_session_imports
  add constraint game_session_imports_expected_current_evidence_revision_id_fkey
  foreign key (expected_current_evidence_revision_id)
  references public.session_evidence_revisions(id)
  on delete set null;

alter table public.game_session_imports
  drop constraint if exists game_session_imports_committed_revision_id_fkey;
alter table public.game_session_imports
  add constraint game_session_imports_committed_revision_id_fkey
  foreign key (committed_revision_id)
  references public.session_evidence_revisions(id)
  on delete set null;

alter table public.hands
  add column if not exists small_blind numeric,
  add column if not exists big_blind numeric,
  add column if not exists pot_bb numeric,
  add column if not exists evidence_revision_id uuid references public.session_evidence_revisions(id) on delete restrict;

alter table public.actions
  add column if not exists evidence_revision_id uuid references public.session_evidence_revisions(id) on delete restrict;

alter table public.notable_hands
  add column if not exists small_blind numeric,
  add column if not exists big_blind numeric,
  add column if not exists pot_bb numeric,
  add column if not exists evidence_revision_id uuid references public.session_evidence_revisions(id) on delete restrict;

alter table public.player_session_stats
  add column if not exists total_collected_bb numeric,
  add column if not exists biggest_pot_won_bb numeric,
  add column if not exists vpip_pct numeric,
  add column if not exists pfr_pct numeric,
  add column if not exists vpip_pfr_gap numeric,
  add column if not exists three_bet_pct numeric,
  add column if not exists open_raise_pct numeric,
  add column if not exists limp_pct numeric,
  add column if not exists call_pf_raise_pct numeric,
  add column if not exists preflop_all_ins integer not null default 0,
  add column if not exists evidence_revision_id uuid references public.session_evidence_revisions(id) on delete restrict;

create index if not exists hands_session_evidence_revision_idx on public.hands(session_id, evidence_revision_id);
create index if not exists actions_session_evidence_revision_idx on public.actions(session_id, evidence_revision_id);
create index if not exists notable_hands_session_evidence_revision_idx on public.notable_hands(session_id, evidence_revision_id);
create index if not exists player_session_stats_session_evidence_revision_idx on public.player_session_stats(session_id, evidence_revision_id);

alter table public.recap_drafts
  add column if not exists is_stale boolean not null default false,
  add column if not exists stale_at timestamptz,
  add column if not exists stale_reason text;

alter table public.published_articles
  add column if not exists is_stale boolean not null default false,
  add column if not exists stale_at timestamptz,
  add column if not exists stale_reason text;

create index if not exists recap_drafts_session_stale_idx
  on public.recap_drafts(source_session_id, is_stale, generated_at desc);
create index if not exists published_articles_stale_idx
  on public.published_articles(is_stale, published_at desc);

create or replace function public.create_raw_hand_import_preview(
  p_source_filename text,
  p_source_media_type text,
  p_source_base64 text,
  p_canonical_metadata text,
  p_parser_version text,
  p_canonical_manifest text,
  p_canonical_validation_report text,
  p_created_by_user_id uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, extensions, public
as $function$
declare
  v_source_bytes bytea;
  v_metadata jsonb;
  v_manifest jsonb;
  v_validation jsonb;
  v_source_checksum text;
  v_metadata_checksum text;
  v_manifest_checksum text;
  v_validation_checksum text;
  v_preview_checksum text;
  v_session_code text;
  v_replace_existing boolean;
  v_target_session public.sessions%rowtype;
  v_expected_revision_id uuid;
  v_replacement_context text;
  v_status text;
  v_row public.game_session_imports%rowtype;
  v_inserted boolean := false;
begin
  if p_source_base64 is null or p_canonical_metadata is null or p_canonical_manifest is null or p_canonical_validation_report is null then
    raise exception using errcode = '22004', message = 'Preview source and canonical artifacts are required.';
  end if;

  begin
    v_source_bytes := decode(p_source_base64, 'base64');
    v_metadata := p_canonical_metadata::jsonb;
    v_manifest := p_canonical_manifest::jsonb;
    v_validation := p_canonical_validation_report::jsonb;
  exception when others then
    raise exception using errcode = '22023', message = format('Preview artifact is malformed: %s', sqlerrm);
  end;

  if octet_length(v_source_bytes) = 0 then
    raise exception using errcode = '22023', message = 'Preview source bytes may not be empty.';
  end if;
  if coalesce(p_parser_version, '') = '' or v_manifest->>'parserVersion' is distinct from p_parser_version then
    raise exception using errcode = '22023', message = 'Manifest parserVersion does not match the preview parser version.';
  end if;
  if v_manifest->>'schemaVersion' is distinct from 'raw-hand-manifest-v1' then
    raise exception using errcode = '22023', message = 'Unsupported raw-hand manifest schema version.';
  end if;
  if coalesce((v_manifest->'source'->>'sizeBytes')::bigint, -1) <> octet_length(v_source_bytes)
     or v_manifest->'source'->>'filename' is distinct from p_source_filename
     or v_manifest->'source'->>'mediaType' is distinct from coalesce(nullif(p_source_media_type, ''), 'application/octet-stream') then
    raise exception using errcode = '22023', message = 'Manifest source metadata does not match the persisted source bytes.';
  end if;

  v_session_code := nullif(btrim(v_metadata->>'sessionCode'), '');
  v_replace_existing := coalesce((v_metadata->>'replaceExisting')::boolean, false);
  if v_session_code is null then
    raise exception using errcode = '22023', message = 'Canonical metadata must contain sessionCode.';
  end if;

  select * into v_target_session
  from public.sessions
  where lower(session_code) = lower(v_session_code)
  limit 1;

  if found then
    v_expected_revision_id := v_target_session.current_evidence_revision_id;
  end if;
  v_replacement_context := coalesce(v_target_session.id::text, '') || ':' || coalesce(v_expected_revision_id::text, '');

  v_source_checksum := encode(digest(v_source_bytes, 'sha256'), 'hex');
  v_metadata_checksum := encode(digest(convert_to(p_canonical_metadata, 'utf8'), 'sha256'), 'hex');
  v_manifest_checksum := encode(digest(convert_to(p_canonical_manifest, 'utf8'), 'sha256'), 'hex');
  v_validation_checksum := encode(digest(convert_to(p_canonical_validation_report, 'utf8'), 'sha256'), 'hex');
  v_preview_checksum := encode(digest(convert_to(
    'raw-hand-preview-v1' || chr(10) ||
    v_source_checksum || chr(10) ||
    v_metadata_checksum || chr(10) ||
    p_parser_version || chr(10) ||
    v_manifest_checksum || chr(10) ||
    v_validation_checksum || chr(10) ||
    v_replacement_context,
    'utf8'
  ), 'sha256'), 'hex');

  if coalesce(jsonb_array_length(coalesce(v_validation->'errors', '[]'::jsonb)), 0) > 0
     or not coalesce((v_validation->>'valid')::boolean, false) then
    v_status := 'invalid';
  elsif v_target_session.id is not null and not v_replace_existing then
    v_status := 'conflict';
  elsif v_target_session.id is null and v_replace_existing then
    v_status := 'conflict';
  else
    v_status := 'ready';
  end if;

  insert into public.game_session_imports (
    source_app, source_match_id, schema_version, event_schema_version, checksum,
    authority_type, visibility, status, raw_package, validation_report,
    import_kind, source_filename, source_media_type, source_size_bytes, source_bytes,
    source_checksum, canonical_metadata, metadata, metadata_checksum, parser_version,
    canonical_manifest, parsed_manifest, manifest_checksum,
    canonical_validation_report, validation_report_checksum, preview_checksum,
    replace_existing, target_session_id, expected_current_evidence_revision_id,
    created_by_user_id, validated_at
  ) values (
    'para-poker-raw-hand', v_preview_checksum, 'raw-hand-preview-v1', p_parser_version,
    v_preview_checksum, 'raw_evidence', 'admin', v_status,
    jsonb_build_object('sourceFilename', p_source_filename, 'sourceMediaType', p_source_media_type),
    v_validation,
    'raw_hand_history', nullif(p_source_filename, ''), coalesce(nullif(p_source_media_type, ''), 'application/octet-stream'),
    octet_length(v_source_bytes), v_source_bytes, v_source_checksum,
    p_canonical_metadata, v_metadata, v_metadata_checksum, p_parser_version,
    p_canonical_manifest, v_manifest, v_manifest_checksum,
    p_canonical_validation_report, v_validation_checksum, v_preview_checksum,
    v_replace_existing, v_target_session.id, v_expected_revision_id,
    p_created_by_user_id, now()
  )
  on conflict (source_app, source_match_id) do nothing
  returning * into v_row;

  v_inserted := v_row.id is not null;

  if v_row.id is null then
    select * into strict v_row
    from public.game_session_imports
    where source_app = 'para-poker-raw-hand'
      and source_match_id = v_preview_checksum;

    if v_row.source_checksum is distinct from v_source_checksum
       or v_row.metadata_checksum is distinct from v_metadata_checksum
       or v_row.manifest_checksum is distinct from v_manifest_checksum
       or v_row.validation_report_checksum is distinct from v_validation_checksum then
      raise exception using errcode = 'XX001', message = 'Preview checksum collision detected.';
    end if;
  end if;

  return jsonb_build_object(
    'status', v_row.status,
    'importId', v_row.id,
    'idempotent', not v_inserted,
    'sourceFilename', v_row.source_filename,
    'sourceMediaType', v_row.source_media_type,
    'sourceSizeBytes', v_row.source_size_bytes,
    'sourceChecksum', v_row.source_checksum,
    'metadataChecksum', v_row.metadata_checksum,
    'manifestChecksum', v_row.manifest_checksum,
    'validationReportChecksum', v_row.validation_report_checksum,
    'previewChecksum', v_row.preview_checksum,
    'parserVersion', v_row.parser_version,
    'validation', v_row.validation_report,
    'replaceExisting', v_row.replace_existing,
    'targetSessionId', v_row.target_session_id,
    'expectedCurrentEvidenceRevisionId', v_row.expected_current_evidence_revision_id,
    'currentRevisionNumber', (
      select revision_number from public.session_evidence_revisions
      where id = v_row.expected_current_evidence_revision_id
    ),
    'totals', v_row.parsed_manifest->'totals',
    'representativeRows', jsonb_build_object(
      'players', jsonb_path_query_array(coalesce(v_row.parsed_manifest->'players', '[]'::jsonb), '$[0 to 4]'),
      'hands', jsonb_path_query_array(coalesce(v_row.parsed_manifest->'hands', '[]'::jsonb), '$[0 to 11]'),
      'actions', jsonb_path_query_array(coalesce(v_row.parsed_manifest->'actions', '[]'::jsonb), '$[0 to 29]'),
      'notableHands', jsonb_path_query_array(coalesce(v_row.parsed_manifest->'notableHands', '[]'::jsonb), '$[0 to 11]')
    )
  );
end
$function$;

create or replace function public.commit_raw_hand_session_import(
  p_import_id uuid,
  p_preview_checksum text,
  p_confirm boolean,
  p_confirm_replace boolean default false,
  p_expected_current_evidence_revision_id uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, extensions, public
as $function$
declare
  v_import public.game_session_imports%rowtype;
  v_existing_import public.game_session_imports%rowtype;
  v_existing_session public.sessions%rowtype;
  v_session public.sessions%rowtype;
  v_revision public.session_evidence_revisions%rowtype;
  v_previous_revision_id uuid;
  v_revision_number integer;
  v_session_number integer;
  v_manifest jsonb;
  v_session_manifest jsonb;
  v_row jsonb;
  v_hand public.hands%rowtype;
  v_player public.players%rowtype;
  v_hand_ids jsonb := '{}'::jsonb;
  v_player_ids jsonb := '{}'::jsonb;
  v_slug text;
  v_inserted_hands integer := 0;
  v_inserted_actions integer := 0;
  v_inserted_notables integer := 0;
  v_inserted_stats integer := 0;
  v_expected_hands integer;
  v_expected_actions integer;
  v_expected_notables integer;
  v_expected_stats integer;
  v_recomputed_source_checksum text;
  v_recomputed_metadata_checksum text;
  v_recomputed_manifest_checksum text;
  v_recomputed_validation_checksum text;
  v_recomputed_preview_checksum text;
  v_replacement_context text;
  v_failure_stage text := 'precondition';
  v_error_state text;
  v_error_message text;
  v_commit_report jsonb;
begin
  select * into v_import
  from public.game_session_imports
  where id = p_import_id
  for update;

  if not found then
    return jsonb_build_object('status', 'not_found', 'importId', p_import_id, 'error', 'Import record not found.');
  end if;

  if v_import.import_kind is distinct from 'raw_hand_history' then
    return jsonb_build_object('status', 'conflict', 'importId', v_import.id, 'error', 'Import is not a raw-hand preview.');
  end if;

  if not coalesce(p_confirm, false) then
    return jsonb_build_object('status', 'conflict', 'importId', v_import.id, 'error', 'Explicit commit confirmation is required.');
  end if;
  if p_preview_checksum is distinct from v_import.preview_checksum then
    return jsonb_build_object('status', 'conflict', 'importId', v_import.id, 'error', 'Preview checksum does not match the stored import.');
  end if;
  if v_import.replace_existing then
    if not coalesce(p_confirm_replace, false) then
      return jsonb_build_object('status', 'conflict', 'importId', v_import.id, 'error', 'Replacement requires a second explicit confirmation.');
    end if;
    if p_expected_current_evidence_revision_id is distinct from v_import.expected_current_evidence_revision_id then
      return jsonb_build_object('status', 'conflict', 'importId', v_import.id, 'error', 'Expected evidence revision does not match the stored replacement preview.');
    end if;
  elsif p_confirm_replace or p_expected_current_evidence_revision_id is not null then
    return jsonb_build_object('status', 'conflict', 'importId', v_import.id, 'error', 'Replacement confirmation is not valid for a new session.');
  end if;

  if v_import.status = 'imported' and v_import.committed_revision_id is not null then
    return coalesce(v_import.commit_report, '{}'::jsonb) || jsonb_build_object('status', 'imported', 'idempotent', true);
  end if;

  if v_import.status not in ('ready', 'failed') then
    return jsonb_build_object('status', 'conflict', 'importId', v_import.id, 'error', format('Import status %s cannot be committed.', v_import.status));
  end if;

  v_recomputed_source_checksum := encode(digest(v_import.source_bytes, 'sha256'), 'hex');
  v_recomputed_metadata_checksum := encode(digest(convert_to(v_import.canonical_metadata, 'utf8'), 'sha256'), 'hex');
  v_recomputed_manifest_checksum := encode(digest(convert_to(v_import.canonical_manifest, 'utf8'), 'sha256'), 'hex');
  v_recomputed_validation_checksum := encode(digest(convert_to(v_import.canonical_validation_report, 'utf8'), 'sha256'), 'hex');
  v_replacement_context := coalesce(v_import.target_session_id::text, '') || ':' || coalesce(v_import.expected_current_evidence_revision_id::text, '');
  v_recomputed_preview_checksum := encode(digest(convert_to(
    'raw-hand-preview-v1' || chr(10) ||
    v_recomputed_source_checksum || chr(10) ||
    v_recomputed_metadata_checksum || chr(10) ||
    v_import.parser_version || chr(10) ||
    v_recomputed_manifest_checksum || chr(10) ||
    v_recomputed_validation_checksum || chr(10) ||
    v_replacement_context,
    'utf8'
  ), 'sha256'), 'hex');

  if v_recomputed_source_checksum is distinct from v_import.source_checksum
     or v_recomputed_metadata_checksum is distinct from v_import.metadata_checksum
     or v_recomputed_manifest_checksum is distinct from v_import.manifest_checksum
     or v_recomputed_validation_checksum is distinct from v_import.validation_report_checksum
     or v_recomputed_preview_checksum is distinct from v_import.preview_checksum
     or v_import.canonical_metadata::jsonb is distinct from v_import.metadata
     or v_import.canonical_manifest::jsonb is distinct from v_import.parsed_manifest
     or v_import.canonical_validation_report::jsonb is distinct from v_import.validation_report then
    return jsonb_build_object('status', 'conflict', 'importId', v_import.id, 'error', 'Stored preview artifact failed checksum verification.');
  end if;

  v_manifest := v_import.parsed_manifest;
  v_session_manifest := coalesce(v_manifest->'session', '{}'::jsonb);
  v_expected_hands := jsonb_array_length(coalesce(v_manifest->'hands', '[]'::jsonb));
  v_expected_actions := jsonb_array_length(coalesce(v_manifest->'actions', '[]'::jsonb));
  v_expected_notables := jsonb_array_length(coalesce(v_manifest->'notableHands', '[]'::jsonb));
  v_expected_stats := jsonb_array_length(coalesce(v_manifest->'playerSessionStats', '[]'::jsonb));

  if coalesce((v_manifest->'totals'->>'hands')::integer, -1) <> v_expected_hands
     or coalesce((v_manifest->'totals'->>'actions')::integer, -1) <> v_expected_actions
     or coalesce((v_manifest->'totals'->>'notableHands')::integer, -1) <> v_expected_notables
     or coalesce((v_manifest->'totals'->>'playerSessionStats')::integer, -1) <> v_expected_stats then
    return jsonb_build_object('status', 'conflict', 'importId', v_import.id, 'error', 'Stored manifest totals do not match its evidence arrays.');
  end if;

  perform pg_advisory_xact_lock(hashtextextended('raw-hand-session:' || lower(v_session_manifest->>'sessionCode'), 0));

  select * into v_existing_session
  from public.sessions
  where lower(session_code) = lower(v_session_manifest->>'sessionCode')
  limit 1
  for update;

  if v_import.replace_existing then
    if not found or v_existing_session.id is distinct from v_import.target_session_id then
      return jsonb_build_object('status', 'conflict', 'importId', v_import.id, 'error', 'Replacement target no longer matches the stored preview.');
    end if;
    if v_existing_session.current_evidence_revision_id is distinct from v_import.expected_current_evidence_revision_id then
      update public.game_session_imports
      set status = 'conflict', commit_report = jsonb_build_object(
        'status', 'conflict',
        'stage', 'optimistic_concurrency',
        'expectedCurrentEvidenceRevisionId', v_import.expected_current_evidence_revision_id,
        'actualCurrentEvidenceRevisionId', v_existing_session.current_evidence_revision_id,
        'recordedAt', now()
      )
      where id = v_import.id;
      return jsonb_build_object('status', 'conflict', 'importId', v_import.id, 'error', 'The session evidence revision changed after preview. Preview the replacement again.');
    end if;
  else
    if found then
      return jsonb_build_object('status', 'conflict', 'importId', v_import.id, 'error', 'Session code already exists and replacement was not previewed.');
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('raw-hand-source:' || v_import.source_checksum, 0));

  select * into v_existing_import
  from public.game_session_imports
  where import_kind = 'raw_hand_history'
    and status = 'imported'
    and source_checksum = v_import.source_checksum
    and id <> v_import.id
  limit 1;

  if found then
    update public.game_session_imports
    set status = 'duplicate', commit_report = jsonb_build_object(
      'status', 'duplicate',
      'duplicateOfImportId', v_existing_import.id,
      'sessionId', v_existing_import.imported_session_id,
      'revisionId', v_existing_import.committed_revision_id,
      'recordedAt', now()
    )
    where id = v_import.id;
    return jsonb_build_object(
      'status', 'duplicate',
      'importId', v_import.id,
      'duplicateOfImportId', v_existing_import.id,
      'sessionId', v_existing_import.imported_session_id,
      'revisionId', v_existing_import.committed_revision_id
    );
  end if;

  update public.game_session_imports
  set commit_attempt_count = commit_attempt_count + 1
  where id = v_import.id
  returning * into v_import;

  begin
    v_failure_stage := 'session';
    if v_import.replace_existing then
      v_session_number := coalesce(
        nullif(v_session_manifest->>'sessionNumber', '')::integer,
        v_existing_session.session_number
      );
      update public.sessions
      set
        season_code = v_session_manifest->>'seasonCode',
        session_number = v_session_number,
        played_at = (v_session_manifest->>'playedAt')::timestamptz,
        table_name = v_session_manifest->>'tableName',
        format = v_session_manifest->>'format',
        status = 'processed',
        result_review_status = 'awaiting_result_review',
        raw_log_rows = coalesce((v_manifest->'totals'->>'sourceRows')::integer, 0),
        hands_count = v_expected_hands,
        players_count = coalesce((v_manifest->'totals'->>'players')::integer, 0)
      where id = v_existing_session.id
      returning * into v_session;
      v_previous_revision_id := v_existing_session.current_evidence_revision_id;
    else
      perform pg_advisory_xact_lock(hashtextextended('raw-hand-season-number:' || lower(v_session_manifest->>'seasonCode'), 0));
      v_session_number := nullif(v_session_manifest->>'sessionNumber', '')::integer;
      if v_session_number is null then
        select coalesce(max(session_number), 0) + 1 into v_session_number
        from public.sessions
        where lower(season_code) = lower(v_session_manifest->>'seasonCode');
      end if;
      insert into public.sessions (
        season_code, session_number, session_code, played_at, table_name, format,
        status, result_review_status, raw_log_rows, hands_count, players_count
      ) values (
        v_session_manifest->>'seasonCode', v_session_number, v_session_manifest->>'sessionCode',
        (v_session_manifest->>'playedAt')::timestamptz, v_session_manifest->>'tableName',
        v_session_manifest->>'format', 'processed', 'awaiting_result_review',
        coalesce((v_manifest->'totals'->>'sourceRows')::integer, 0), v_expected_hands,
        coalesce((v_manifest->'totals'->>'players')::integer, 0)
      ) returning * into v_session;
      v_previous_revision_id := null;
    end if;

    v_failure_stage := 'revision';
    select coalesce(max(revision_number), 0) + 1 into v_revision_number
    from public.session_evidence_revisions
    where session_id = v_session.id;

    insert into public.session_evidence_revisions (
      session_id, import_id, revision_number, status, supersedes_revision_id,
      source_filename, source_media_type, source_size_bytes, source_checksum,
      metadata, metadata_checksum, parser_version, parsed_manifest, manifest_checksum,
      validation_report, validation_report_checksum, preview_checksum,
      committed_by_user_id
    ) values (
      v_session.id, v_import.id, v_revision_number, 'pending', v_previous_revision_id,
      v_import.source_filename, v_import.source_media_type, v_import.source_size_bytes, v_import.source_checksum,
      v_import.metadata, v_import.metadata_checksum, v_import.parser_version, v_import.parsed_manifest, v_import.manifest_checksum,
      v_import.validation_report, v_import.validation_report_checksum, v_import.preview_checksum,
      v_import.created_by_user_id
    ) returning * into v_revision;

    v_failure_stage := 'players';
    for v_row in select * from jsonb_array_elements(coalesce(v_manifest->'players', '[]'::jsonb)) loop
      perform pg_advisory_xact_lock(hashtextextended('raw-hand-player:' || lower(v_row->>'rawName'), 0));
      select * into v_player
      from public.players
      where lower(pokernow_name) = lower(v_row->>'rawName')
         or lower(display_name) = lower(v_row->>'displayName')
      order by case when lower(pokernow_name) = lower(v_row->>'rawName') then 0 else 1 end
      limit 1;

      if not found then
        v_slug := nullif(btrim(regexp_replace(lower(v_row->>'displayName'), '[^a-z0-9]+', '-', 'g'), '-'), '');
        v_slug := coalesce(v_slug, 'player');
        if exists (select 1 from public.players where slug = v_slug) then
          v_slug := left(v_slug, 67) || '-' || left(encode(digest(convert_to(v_row->>'rawName', 'utf8'), 'sha256'), 'hex'), 12);
        end if;
        insert into public.players(display_name, pokernow_name, slug)
        values (v_row->>'displayName', v_row->>'rawName', v_slug)
        returning * into v_player;
      end if;
      v_player_ids := v_player_ids || jsonb_build_object(v_row->>'rawName', v_player.id::text);
    end loop;

    if v_import.replace_existing then
      v_failure_stage := 'invalidate_editorial';
      update public.recap_drafts
      set is_stale = true,
          stale_at = now(),
          stale_reason = format('Session evidence replaced by revision %s.', v_revision_number),
          visibility = 'admin',
          unpublished_at = coalesce(unpublished_at, now())
      where scope = 'session'
        and source_session_id = v_session.id
        and not is_stale;

      update public.published_articles article
      set is_stale = true,
          stale_at = now(),
          stale_reason = format('Session evidence replaced by revision %s.', v_revision_number),
          unpublished_at = coalesce(article.unpublished_at, now())
      where article.draft_id in (
        select draft.id from public.recap_drafts draft
        where draft.scope = 'session' and draft.source_session_id = v_session.id
      )
        and not article.is_stale;

      v_failure_stage := 'invalidate_results';
      delete from public.session_results where session_id = v_session.id;
      delete from public.standings
      where season_code in (v_session.season_code, v_existing_session.season_code);
      delete from public.player_season_stats
      where season_code in (v_session.season_code, v_existing_session.season_code);
      delete from public.player_career_stats where id is not null;

      v_failure_stage := 'clear_prior_evidence';
      delete from public.actions where session_id = v_session.id;
      delete from public.notable_hands where session_id = v_session.id;
      delete from public.player_session_stats where session_id = v_session.id;
      delete from public.hands where session_id = v_session.id;
    end if;

    v_failure_stage := 'hands';
    for v_row in select * from jsonb_array_elements(coalesce(v_manifest->'hands', '[]'::jsonb)) loop
      insert into public.hands (
        session_id, evidence_revision_id, hand_no, hand_id, start_time, board,
        winner_player_id, winner_name, pot_collected, pot_bb, big_blind, small_blind,
        winning_hand, showdown, raw_result
      ) values (
        v_session.id, v_revision.id, (v_row->>'handNo')::integer, v_row->>'handCode',
        v_session.played_at, coalesce(v_row->>'board', ''),
        nullif(v_player_ids->>(v_row->>'winnerName'), '')::uuid, coalesce(v_row->>'winnerName', ''),
        coalesce((v_row->>'potCollected')::numeric, 0), nullif(v_row->>'potBb', '')::numeric,
        nullif(v_row->>'bigBlind', '')::numeric, nullif(v_row->>'smallBlind', '')::numeric,
        coalesce(v_row->>'winningHand', ''), coalesce((v_row->>'showdown')::boolean, false),
        coalesce(v_row->>'rawResult', '')
      ) returning * into v_hand;
      v_hand_ids := v_hand_ids || jsonb_build_object(v_row->>'clientHandId', v_hand.id::text);
      v_inserted_hands := v_inserted_hands + 1;
    end loop;

    v_failure_stage := 'actions';
    for v_row in select * from jsonb_array_elements(coalesce(v_manifest->'actions', '[]'::jsonb)) loop
      insert into public.actions (
        session_id, evidence_revision_id, hand_id, hand_no, log_order, street,
        player_id, player_name, position, seat_index, dealer_name, preflop_action_order,
        action, amount, all_in, faced_raise, faced_3bet, is_open_raise, is_3bet,
        is_limp, is_call_vs_raise, raw_entry
      ) values (
        v_session.id, v_revision.id, nullif(v_hand_ids->>(v_row->>'clientHandId'), '')::uuid,
        (v_row->>'handNo')::integer, (v_row->>'logOrder')::integer, coalesce(v_row->>'street', 'action'),
        nullif(v_player_ids->>(v_row->>'playerName'), '')::uuid, coalesce(v_row->>'playerName', ''),
        coalesce(v_row->>'position', ''), nullif(v_row->>'seatIndex', '')::integer,
        coalesce(v_row->>'dealerName', ''), nullif(v_row->>'preflopActionOrder', '')::integer,
        coalesce(v_row->>'action', ''), coalesce((v_row->>'amount')::numeric, 0),
        coalesce((v_row->>'allIn')::boolean, false), coalesce((v_row->>'facedRaise')::boolean, false),
        coalesce((v_row->>'faced3bet')::boolean, false), coalesce((v_row->>'isOpenRaise')::boolean, false),
        coalesce((v_row->>'is3bet')::boolean, false), coalesce((v_row->>'isLimp')::boolean, false),
        coalesce((v_row->>'isCallVsRaise')::boolean, false), coalesce(v_row->>'rawEntry', '')
      );
      v_inserted_actions := v_inserted_actions + 1;
    end loop;

    v_failure_stage := 'notable_hands';
    for v_row in select * from jsonb_array_elements(coalesce(v_manifest->'notableHands', '[]'::jsonb)) loop
      insert into public.notable_hands (
        session_id, evidence_revision_id, hand_no, hand_code, tags, winner_name,
        pot_collected, pot_bb, big_blind, small_blind, winning_hand, board,
        involved_players, summary, raw_result
      ) values (
        v_session.id, v_revision.id, (v_row->>'handNo')::integer, coalesce(v_row->>'handCode', ''),
        coalesce(array(select jsonb_array_elements_text(coalesce(v_row->'tags', '[]'::jsonb))), array[]::text[]),
        coalesce(v_row->>'winnerName', ''), coalesce((v_row->>'potCollected')::numeric, 0),
        nullif(v_row->>'potBb', '')::numeric, nullif(v_row->>'bigBlind', '')::numeric,
        nullif(v_row->>'smallBlind', '')::numeric, coalesce(v_row->>'winningHand', ''),
        coalesce(v_row->>'board', ''),
        coalesce(array(select jsonb_array_elements_text(coalesce(v_row->'involvedPlayers', '[]'::jsonb))), array[]::text[]),
        coalesce(v_row->>'summary', ''), coalesce(v_row->>'rawResult', '')
      );
      v_inserted_notables := v_inserted_notables + 1;
    end loop;

    v_failure_stage := 'player_session_stats';
    for v_row in select * from jsonb_array_elements(coalesce(v_manifest->'playerSessionStats', '[]'::jsonb)) loop
      insert into public.player_session_stats (
        session_id, evidence_revision_id, player_id, player_name, hands, hands_won,
        hand_win_pct, total_collected, total_collected_bb, biggest_pot_won,
        biggest_pot_won_bb, all_ins, folds, fold_pct, notable_hands,
        vpip_pct, pfr_pct, vpip_pfr_gap, three_bet_pct, open_raise_pct,
        limp_pct, call_pf_raise_pct, preflop_all_ins
      ) values (
        v_session.id, v_revision.id, nullif(v_player_ids->>(v_row->>'playerName'), '')::uuid,
        v_row->>'playerName', coalesce((v_row->>'hands')::integer, 0),
        coalesce((v_row->>'handsWon')::integer, 0), coalesce((v_row->>'handWinPct')::numeric, 0),
        coalesce((v_row->>'totalCollected')::numeric, 0), nullif(v_row->>'totalCollectedBb', '')::numeric,
        coalesce((v_row->>'biggestPotWon')::numeric, 0), nullif(v_row->>'biggestPotWonBb', '')::numeric,
        coalesce((v_row->>'allIns')::integer, 0), coalesce((v_row->>'folds')::integer, 0),
        coalesce((v_row->>'foldPct')::numeric, 0), coalesce((v_row->>'notableHands')::integer, 0),
        nullif(v_row->>'vpipPct', '')::numeric, nullif(v_row->>'pfrPct', '')::numeric,
        nullif(v_row->>'vpipPfrGap', '')::numeric, nullif(v_row->>'threeBetPct', '')::numeric,
        nullif(v_row->>'openRaisePct', '')::numeric, nullif(v_row->>'limpPct', '')::numeric,
        nullif(v_row->>'callPfRaisePct', '')::numeric, coalesce((v_row->>'preflopAllIns')::integer, 0)
      );
      v_inserted_stats := v_inserted_stats + 1;
    end loop;

    v_failure_stage := 'count_verification';
    if v_inserted_hands <> v_expected_hands
       or v_inserted_actions <> v_expected_actions
       or v_inserted_notables <> v_expected_notables
       or v_inserted_stats <> v_expected_stats then
      raise exception using errcode = 'P0001', message = 'Inserted evidence counts do not match the persisted manifest.';
    end if;

    v_failure_stage := 'advance_revision';
    if v_previous_revision_id is not null then
      update public.session_evidence_revisions
      set status = 'superseded', superseded_at = now()
      where id = v_previous_revision_id and status = 'current';
    end if;

    v_commit_report := jsonb_build_object(
      'status', 'imported',
      'importId', v_import.id,
      'sessionId', v_session.id,
      'sessionCode', v_session.session_code,
      'revisionId', v_revision.id,
      'revisionNumber', v_revision_number,
      'supersedesRevisionId', v_previous_revision_id,
      'sourceChecksum', v_import.source_checksum,
      'metadataChecksum', v_import.metadata_checksum,
      'manifestChecksum', v_import.manifest_checksum,
      'validationReportChecksum', v_import.validation_report_checksum,
      'previewChecksum', v_import.preview_checksum,
      'insertedCounts', jsonb_build_object(
        'hands', v_inserted_hands,
        'actions', v_inserted_actions,
        'notableHands', v_inserted_notables,
        'playerSessionStats', v_inserted_stats
      ),
      'resultReviewStatus', 'awaiting_result_review',
      'aggregateBehavior', case when v_import.replace_existing
        then 'affected_aggregates_removed_pending_result_review'
        else 'not_applicable'
      end,
      'committedAt', now()
    );

    update public.session_evidence_revisions
    set status = 'current', commit_report = v_commit_report
    where id = v_revision.id;

    update public.sessions
    set current_evidence_revision_id = v_revision.id,
        result_review_status = 'awaiting_result_review'
    where id = v_session.id;
  exception when others then
    get stacked diagnostics v_error_state = returned_sqlstate, v_error_message = message_text;
    update public.game_session_imports
    set status = 'failed',
        commit_report = jsonb_build_object(
          'status', 'failed',
          'importId', v_import.id,
          'attemptNumber', v_import.commit_attempt_count,
          'failureStage', v_failure_stage,
          'sqlstate', v_error_state,
          'message', v_error_message,
          'unchangedSessionId', v_existing_session.id,
          'unchangedEvidenceRevisionId', v_existing_session.current_evidence_revision_id,
          'recordedAt', now()
        )
    where id = v_import.id;
    return jsonb_build_object(
      'status', 'failed',
      'importId', v_import.id,
      'failureStage', v_failure_stage,
      'sqlstate', v_error_state,
      'error', v_error_message
    );
  end;

  update public.game_session_imports
  set status = 'imported',
      imported_session_id = v_session.id,
      committed_revision_id = v_revision.id,
      imported_at = now(),
      commit_report = v_commit_report
  where id = v_import.id;

  return v_commit_report || jsonb_build_object('idempotent', false);
end
$function$;

-- The RPCs are security invoker, so make their server-only table and sequence
-- privileges explicit instead of relying on project-level default privileges.
alter function public.set_updated_at() set search_path = pg_catalog;

revoke all on table public.game_session_imports from public, anon, authenticated;
grant select, insert, update on table public.game_session_imports to service_role;

revoke all on table public.session_evidence_revisions from public, anon, authenticated;
grant select, insert, update on table public.session_evidence_revisions to service_role;

grant select, insert, update on table public.sessions to service_role;
grant select, insert on table public.players to service_role;
grant select, insert, delete on table public.hands, public.actions, public.notable_hands, public.player_session_stats to service_role;
grant select, delete on table public.session_results, public.player_season_stats, public.player_career_stats, public.standings to service_role;
grant select, update on table public.recap_drafts, public.published_articles to service_role;

do $service_role_sequences$
declare
  v_table text;
  v_sequence text;
begin
  foreach v_table in array array['sessions','players','hands','actions','notable_hands','player_session_stats'] loop
    v_sequence := pg_get_serial_sequence(format('public.%I', v_table), 'id');
    if v_sequence is not null then
      execute format('grant usage, select on sequence %s to service_role', v_sequence);
    end if;
  end loop;
end
$service_role_sequences$;

revoke all on function public.create_raw_hand_import_preview(text, text, text, text, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.create_raw_hand_import_preview(text, text, text, text, text, text, text, uuid) to service_role;

revoke all on function public.commit_raw_hand_session_import(uuid, text, boolean, boolean, uuid) from public, anon, authenticated;
grant execute on function public.commit_raw_hand_session_import(uuid, text, boolean, boolean, uuid) to service_role;

comment on table public.session_evidence_revisions is
  'Immutable audit records for committed raw-hand evidence. Legacy session evidence has no revision row.';
comment on column public.sessions.current_evidence_revision_id is
  'Current committed evidence revision; null identifies a legacy unversioned session.';
comment on column public.sessions.result_review_status is
  'Official-result state. Evidence replacement sets awaiting_result_review and excludes the session from official aggregates.';
comment on function public.create_raw_hand_import_preview(text, text, text, text, text, text, text, uuid) is
  'Persists exact source bytes plus canonical preview artifacts and recomputes every checksum server-side.';
comment on function public.commit_raw_hand_session_import(uuid, text, boolean, boolean, uuid) is
  'Atomically commits only the stored manifest, with replacement concurrency and durable failed-attempt reporting.';

select pg_notify('pgrst', 'reload schema');
