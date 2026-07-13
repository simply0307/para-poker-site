-- ParaPoker completed-session package imports.
-- Stores raw uploaded packages for audit and commits normalized evidence rows
-- through one transactional RPC. No anon policies are created; server-side
-- service-role routes own this workflow until admin auth is added.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.game_session_imports (
  id uuid primary key default gen_random_uuid(),
  source_app text not null,
  source_match_id text not null,
  schema_version text not null,
  event_schema_version text not null,
  checksum text not null,
  authority_type text not null,
  visibility text not null,
  status text not null default 'uploaded',
  raw_package jsonb not null default '{}'::jsonb,
  validation_report jsonb not null default '{}'::jsonb,
  participant_mapping jsonb not null default '{}'::jsonb,
  imported_session_id uuid references public.sessions(id) on delete set null,
  created_by text,
  created_at timestamptz not null default now(),
  validated_at timestamptz,
  imported_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint game_session_imports_status_check check (
    status in ('uploaded', 'validating', 'invalid', 'needs-mapping', 'ready', 'imported', 'duplicate', 'failed', 'conflict')
  )
);

create unique index if not exists game_session_imports_source_uidx
  on public.game_session_imports(source_app, source_match_id);

create index if not exists game_session_imports_status_idx
  on public.game_session_imports(status, created_at desc);

drop trigger if exists game_session_imports_set_updated_at on public.game_session_imports;
create trigger game_session_imports_set_updated_at
before update on public.game_session_imports
for each row execute function public.set_updated_at();

alter table public.game_session_imports enable row level security;

create or replace function public.commit_parapoker_session_import(
  p_import_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_import public.game_session_imports%rowtype;
  v_existing_session public.sessions%rowtype;
  v_session public.sessions%rowtype;
  v_session_payload jsonb := coalesce(p_payload->'session', '{}'::jsonb);
  v_row jsonb;
  v_hand public.hands%rowtype;
  v_hand_ids jsonb := '{}'::jsonb;
  v_inserted_hands integer := 0;
  v_inserted_actions integer := 0;
  v_inserted_results integer := 0;
  v_inserted_stats integer := 0;
  v_inserted_notables integer := 0;
begin
  select * into v_import
  from public.game_session_imports
  where id = p_import_id
  for update;

  if not found then
    raise exception 'Import record not found.';
  end if;

  if v_import.imported_session_id is not null and v_import.status = 'imported' then
    return jsonb_build_object(
      'status', 'duplicate',
      'importId', v_import.id,
      'sessionId', v_import.imported_session_id
    );
  end if;

  select * into v_existing_session
  from public.sessions
  where session_code = v_session_payload->>'session_code'
  limit 1
  for update;

  if found then
    update public.sessions
    set
      season_code = coalesce(v_session_payload->>'season_code', v_existing_session.season_code),
      session_number = nullif(v_session_payload->>'session_number', '')::integer,
      played_at = coalesce(nullif(v_session_payload->>'played_at', '')::timestamptz, v_existing_session.played_at),
      table_name = coalesce(v_session_payload->>'table_name', v_existing_session.table_name),
      format = coalesce(v_session_payload->>'format', v_existing_session.format),
      status = coalesce(v_session_payload->>'status', v_existing_session.status),
      raw_log_rows = coalesce((v_session_payload->>'raw_log_rows')::integer, v_existing_session.raw_log_rows),
      hands_count = coalesce((v_session_payload->>'hands_count')::integer, v_existing_session.hands_count),
      players_count = coalesce((v_session_payload->>'players_count')::integer, v_existing_session.players_count)
    where id = v_existing_session.id
    returning * into v_session;

    delete from public.actions where session_id = v_session.id;
    delete from public.notable_hands where session_id = v_session.id;
    delete from public.player_session_stats where session_id = v_session.id;
    delete from public.session_results where session_id = v_session.id;
    delete from public.hands where session_id = v_session.id;
  else
    insert into public.sessions (
      season_code,
      session_number,
      session_code,
      played_at,
      table_name,
      format,
      status,
      raw_log_rows,
      hands_count,
      players_count
    ) values (
      coalesce(v_session_payload->>'season_code', 'LOCAL'),
      nullif(v_session_payload->>'session_number', '')::integer,
      v_session_payload->>'session_code',
      coalesce(nullif(v_session_payload->>'played_at', '')::timestamptz, now()),
      coalesce(v_session_payload->>'table_name', 'Imported ParaPoker Table'),
      coalesce(v_session_payload->>'format', 'ParaPoker completed-session package'),
      coalesce(v_session_payload->>'status', 'archive_only'),
      coalesce((v_session_payload->>'raw_log_rows')::integer, 0),
      coalesce((v_session_payload->>'hands_count')::integer, 0),
      coalesce((v_session_payload->>'players_count')::integer, 0)
    )
    returning * into v_session;
  end if;

  for v_row in select * from jsonb_array_elements(coalesce(p_payload->'hands', '[]'::jsonb))
  loop
    insert into public.hands (
      session_id,
      hand_no,
      hand_id,
      start_time,
      board,
      winner_player_id,
      winner_name,
      pot_collected,
      winning_hand,
      showdown,
      raw_result
    ) values (
      v_session.id,
      (v_row->>'hand_no')::integer,
      v_row->>'hand_id',
      coalesce(nullif(v_row->>'start_time', '')::timestamptz, v_session.played_at),
      coalesce(v_row->>'board', ''),
      nullif(v_row->>'winner_player_id', '')::uuid,
      coalesce(v_row->>'winner_name', ''),
      coalesce((v_row->>'pot_collected')::numeric, 0),
      coalesce(v_row->>'winning_hand', ''),
      coalesce((v_row->>'showdown')::boolean, false),
      coalesce(v_row->>'raw_result', '')
    )
    returning * into v_hand;

    v_hand_ids := v_hand_ids || jsonb_build_object(v_row->>'client_hand_id', v_hand.id);
    v_inserted_hands := v_inserted_hands + 1;
  end loop;

  for v_row in select * from jsonb_array_elements(coalesce(p_payload->'actions', '[]'::jsonb))
  loop
    insert into public.actions (
      session_id,
      hand_id,
      hand_no,
      log_order,
      street,
      player_id,
      player_name,
      position,
      seat_index,
      dealer_name,
      preflop_action_order,
      action,
      amount,
      all_in,
      faced_raise,
      faced_3bet,
      is_open_raise,
      is_3bet,
      is_limp,
      is_call_vs_raise,
      raw_entry
    ) values (
      v_session.id,
      nullif(v_hand_ids->>(v_row->>'client_hand_id'), '')::uuid,
      (v_row->>'hand_no')::integer,
      (v_row->>'log_order')::integer,
      coalesce(v_row->>'street', 'action'),
      nullif(v_row->>'player_id', '')::uuid,
      coalesce(v_row->>'player_name', ''),
      coalesce(v_row->>'position', ''),
      nullif(v_row->>'seat_index', '')::integer,
      coalesce(v_row->>'dealer_name', ''),
      nullif(v_row->>'preflop_action_order', '')::integer,
      coalesce(v_row->>'action', ''),
      coalesce((v_row->>'amount')::numeric, 0),
      coalesce((v_row->>'all_in')::boolean, false),
      coalesce((v_row->>'faced_raise')::boolean, false),
      coalesce((v_row->>'faced_3bet')::boolean, false),
      coalesce((v_row->>'is_open_raise')::boolean, false),
      coalesce((v_row->>'is_3bet')::boolean, false),
      coalesce((v_row->>'is_limp')::boolean, false),
      coalesce((v_row->>'is_call_vs_raise')::boolean, false),
      coalesce(v_row->>'raw_entry', '')
    );
    v_inserted_actions := v_inserted_actions + 1;
  end loop;

  for v_row in select * from jsonb_array_elements(coalesce(p_payload->'session_results', '[]'::jsonb))
  loop
    insert into public.session_results (
      session_id,
      player_id,
      player_name,
      finish,
      league_points,
      final_stack,
      confidence,
      notes,
      approved
    ) values (
      v_session.id,
      nullif(v_row->>'player_id', '')::uuid,
      coalesce(v_row->>'player_name', ''),
      (v_row->>'finish')::integer,
      coalesce((v_row->>'league_points')::numeric, 0),
      coalesce((v_row->>'final_stack')::numeric, 0),
      coalesce(v_row->>'confidence', 'imported'),
      coalesce(v_row->>'notes', ''),
      coalesce((v_row->>'approved')::boolean, false)
    );
    v_inserted_results := v_inserted_results + 1;
  end loop;

  for v_row in select * from jsonb_array_elements(coalesce(p_payload->'player_session_stats', '[]'::jsonb))
  loop
    insert into public.player_session_stats (
      session_id,
      player_id,
      player_name,
      hands,
      hands_won,
      hand_win_pct,
      total_collected,
      biggest_pot_won,
      all_ins,
      folds,
      fold_pct,
      notable_hands,
      primary_label,
      secondary_label
    ) values (
      v_session.id,
      nullif(v_row->>'player_id', '')::uuid,
      coalesce(v_row->>'player_name', ''),
      coalesce((v_row->>'hands')::integer, 0),
      coalesce((v_row->>'hands_won')::integer, 0),
      coalesce((v_row->>'hand_win_pct')::numeric, 0),
      coalesce((v_row->>'total_collected')::numeric, 0),
      coalesce((v_row->>'biggest_pot_won')::numeric, 0),
      coalesce((v_row->>'all_ins')::integer, 0),
      coalesce((v_row->>'folds')::integer, 0),
      coalesce((v_row->>'fold_pct')::numeric, 0),
      coalesce((v_row->>'notable_hands')::integer, 0),
      coalesce(v_row->>'primary_label', ''),
      coalesce(v_row->>'secondary_label', '')
    );
    v_inserted_stats := v_inserted_stats + 1;
  end loop;

  for v_row in select * from jsonb_array_elements(coalesce(p_payload->'notable_hands', '[]'::jsonb))
  loop
    insert into public.notable_hands (
      session_id,
      hand_no,
      hand_code,
      tags,
      winner_name,
      pot_collected,
      winning_hand,
      board,
      involved_players,
      summary,
      raw_result
    ) values (
      v_session.id,
      (v_row->>'hand_no')::integer,
      coalesce(v_row->>'hand_code', ''),
      coalesce(array(select jsonb_array_elements_text(coalesce(v_row->'tags', '[]'::jsonb))), array[]::text[]),
      coalesce(v_row->>'winner_name', ''),
      coalesce((v_row->>'pot_collected')::numeric, 0),
      coalesce(v_row->>'winning_hand', ''),
      coalesce(v_row->>'board', ''),
      coalesce(array(select jsonb_array_elements_text(coalesce(v_row->'involved_players', '[]'::jsonb))), array[]::text[]),
      coalesce(v_row->>'summary', ''),
      coalesce(v_row->>'raw_result', '')
    );
    v_inserted_notables := v_inserted_notables + 1;
  end loop;

  update public.game_session_imports
  set
    status = 'imported',
    participant_mapping = coalesce(p_payload->'participant_mapping', participant_mapping),
    imported_session_id = v_session.id,
    imported_at = now(),
    validation_report = validation_report || jsonb_build_object(
      'commit', jsonb_build_object(
        'inserted_hands', v_inserted_hands,
        'inserted_actions', v_inserted_actions,
        'inserted_results', v_inserted_results,
        'inserted_player_stats', v_inserted_stats,
        'inserted_notable_hands', v_inserted_notables
      )
    )
  where id = v_import.id;

  return jsonb_build_object(
    'status', 'imported',
    'importId', v_import.id,
    'sessionId', v_session.id,
    'sessionCode', v_session.session_code,
    'insertedHands', v_inserted_hands,
    'insertedActions', v_inserted_actions,
    'insertedResults', v_inserted_results,
    'insertedPlayerStats', v_inserted_stats,
    'insertedNotableHands', v_inserted_notables
  );
exception
  when others then
    update public.game_session_imports
    set
      status = 'failed',
      validation_report = validation_report || jsonb_build_object('commit_error', SQLERRM)
    where id = p_import_id;
    return jsonb_build_object(
      'status', 'failed',
      'importId', p_import_id,
      'error', SQLERRM
    );
end;
$$;

revoke all on function public.commit_parapoker_session_import(uuid, jsonb) from public;
revoke all on function public.commit_parapoker_session_import(uuid, jsonb) from anon;
revoke all on function public.commit_parapoker_session_import(uuid, jsonb) from authenticated;
grant execute on function public.commit_parapoker_session_import(uuid, jsonb) to service_role;

select pg_notify('pgrst', 'reload schema');
