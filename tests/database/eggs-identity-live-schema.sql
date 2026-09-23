-- Schema-only fixture from the read-only live audit, 2026-09-22, PostgreSQL 17.6.
-- Project: uzderzjbitmghfvrllvz. No live rows or credentials are included.
-- These 17 legacy tables, indexes and triggers match the audited Poker/operator
-- boundary. Auth below is a minimal fixture of the exact five columns exercised.
create role anon;
create role authenticated;
create role service_role bypassrls;
create schema auth;
create table auth.users (
  id uuid primary key,
  email varchar(255),
  email_confirmed_at timestamptz,
  deleted_at timestamptz,
  is_anonymous boolean not null default false
);
alter table auth.users enable row level security;
-- Exact session columns used for revocation checks, verified read-only on live.
create table auth.sessions (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  not_after timestamptz
);
alter table auth.sessions enable row level security;
grant usage on schema auth to anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION auth.jwt()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
AS $function$
  select
    coalesce(
        nullif(current_setting('request.jwt.claim', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')
    )::jsonb
$function$
;
CREATE OR REPLACE FUNCTION auth.uid()
 RETURNS uuid
 LANGUAGE sql
 STABLE
AS $function$
  select
  coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$function$
;
grant execute on function auth.uid(),auth.jwt() to anon,authenticated,service_role;
grant usage on schema public to anon,authenticated,service_role;
alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
alter default privileges in schema public grant all on sequences to anon,authenticated,service_role;
alter default privileges in schema public grant execute on functions to anon,authenticated,service_role;

create sequence public."actions_id_seq";
create sequence public."notable_hands_id_seq";
create sequence public."player_season_stats_id_seq";
create sequence public."player_session_stats_id_seq";
create sequence public."raw_log_entries_id_seq";
create sequence public."session_results_id_seq";
create sequence public."standings_id_seq";

create table public."profiles" (
  "id" uuid default gen_random_uuid() not null,
  "email" text not null,
  "display_name" text,
  "role" text default 'viewer'::text not null,
  "identity_provider" text default 'netlify_identity'::text not null,
  "identity_user_id" text not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "auth_user_id" uuid
);

create table public."players" (
  "id" uuid default gen_random_uuid() not null,
  "display_name" text not null,
  "pokernow_name" text,
  "slug" text not null,
  "avatar_url" text,
  "bio" text,
  "primary_label" text,
  "secondary_label" text,
  "created_at" timestamp with time zone default now()
);

create table public."sessions" (
  "id" uuid default gen_random_uuid() not null,
  "season_code" text default 'S0'::text not null,
  "session_number" integer not null,
  "session_code" text not null,
  "played_at" timestamp with time zone,
  "table_name" text,
  "format" text default '9-Max SNG'::text,
  "status" text default 'processed'::text,
  "raw_log_rows" integer default 0,
  "hands_count" integer default 0,
  "players_count" integer default 0,
  "created_at" timestamp with time zone default now(),
  "current_evidence_revision_id" uuid,
  "result_review_status" text default 'legacy_unversioned'::text not null
);

create table public."hands" (
  "id" uuid default gen_random_uuid() not null,
  "session_id" uuid,
  "hand_no" integer,
  "hand_id" text,
  "start_time" timestamp with time zone,
  "board" text,
  "winner_player_id" uuid,
  "winner_name" text,
  "pot_collected" integer default 0,
  "winning_hand" text,
  "showdown" boolean default false,
  "raw_result" text,
  "small_blind" numeric,
  "big_blind" numeric,
  "pot_bb" numeric,
  "evidence_revision_id" uuid
);

create table public."actions" (
  "id" bigint default nextval('actions_id_seq'::regclass) not null,
  "session_id" uuid,
  "hand_id" uuid,
  "hand_no" integer,
  "log_order" bigint,
  "street" text,
  "player_id" uuid,
  "player_name" text,
  "position" text,
  "seat_index" integer,
  "dealer_name" text,
  "preflop_action_order" integer,
  "action" text,
  "amount" integer,
  "all_in" boolean default false,
  "faced_raise" boolean default false,
  "faced_3bet" boolean default false,
  "is_open_raise" boolean default false,
  "is_3bet" boolean default false,
  "is_limp" boolean default false,
  "is_call_vs_raise" boolean default false,
  "raw_entry" text,
  "evidence_revision_id" uuid,
  "source_event_id" text,
  "source_command_id" text,
  "target_contribution" numeric,
  "raise_to" numeric
);

create table public."raw_log_entries" (
  "id" bigint default nextval('raw_log_entries_id_seq'::regclass) not null,
  "session_id" uuid,
  "entry" text not null,
  "at" timestamp with time zone,
  "log_order" bigint
);

create table public."notable_hands" (
  "id" bigint default nextval('notable_hands_id_seq'::regclass) not null,
  "session_id" uuid,
  "hand_no" integer,
  "hand_code" text,
  "tags" text[],
  "winner_name" text,
  "pot_collected" integer,
  "winning_hand" text,
  "board" text,
  "involved_players" text[],
  "summary" text,
  "raw_result" text,
  "small_blind" numeric,
  "big_blind" numeric,
  "pot_bb" numeric,
  "evidence_revision_id" uuid
);

create table public."game_session_imports" (
  "id" uuid default gen_random_uuid() not null,
  "source_app" text not null,
  "source_match_id" text not null,
  "schema_version" text not null,
  "event_schema_version" text not null,
  "checksum" text not null,
  "authority_type" text not null,
  "visibility" text not null,
  "status" text default 'uploaded'::text not null,
  "raw_package" jsonb default '{}'::jsonb not null,
  "validation_report" jsonb default '{}'::jsonb not null,
  "participant_mapping" jsonb default '{}'::jsonb not null,
  "imported_session_id" uuid,
  "created_by" text,
  "created_at" timestamp with time zone default now() not null,
  "validated_at" timestamp with time zone,
  "imported_at" timestamp with time zone,
  "updated_at" timestamp with time zone default now() not null,
  "import_kind" text,
  "source_filename" text,
  "source_media_type" text,
  "source_size_bytes" bigint,
  "source_bytes" bytea,
  "source_checksum" text,
  "canonical_metadata" text,
  "metadata" jsonb,
  "metadata_checksum" text,
  "parser_version" text,
  "canonical_manifest" text,
  "parsed_manifest" jsonb,
  "manifest_checksum" text,
  "canonical_validation_report" text,
  "validation_report_checksum" text,
  "preview_checksum" text,
  "replace_existing" boolean default false not null,
  "target_session_id" uuid,
  "expected_current_evidence_revision_id" uuid,
  "committed_revision_id" uuid,
  "commit_attempt_count" integer default 0 not null,
  "commit_report" jsonb default '{}'::jsonb not null,
  "created_by_user_id" uuid,
  "source_identity_app" text,
  "source_identity_match_id" text,
  "source_package_checksum" text
);

create table public."session_evidence_revisions" (
  "id" uuid default gen_random_uuid() not null,
  "session_id" uuid not null,
  "import_id" uuid not null,
  "revision_number" integer not null,
  "status" text default 'pending'::text not null,
  "supersedes_revision_id" uuid,
  "source_filename" text,
  "source_media_type" text,
  "source_size_bytes" bigint not null,
  "source_checksum" text not null,
  "metadata" jsonb not null,
  "metadata_checksum" text not null,
  "parser_version" text not null,
  "parsed_manifest" jsonb not null,
  "manifest_checksum" text not null,
  "validation_report" jsonb not null,
  "validation_report_checksum" text not null,
  "preview_checksum" text not null,
  "committed_by_user_id" uuid,
  "committed_at" timestamp with time zone default now() not null,
  "superseded_at" timestamp with time zone,
  "commit_report" jsonb default '{}'::jsonb not null
);

create table public."session_results" (
  "id" bigint default nextval('session_results_id_seq'::regclass) not null,
  "session_id" uuid,
  "player_id" uuid,
  "player_name" text,
  "finish" integer,
  "league_points" integer,
  "final_stack" integer,
  "confidence" text,
  "notes" text,
  "approved" boolean default false,
  "evidence_revision_id" uuid
);

create table public."player_session_stats" (
  "id" bigint default nextval('player_session_stats_id_seq'::regclass) not null,
  "session_id" uuid,
  "player_id" uuid,
  "player_name" text,
  "hands" integer default 0,
  "vpip_pct" numeric,
  "pfr_pct" numeric,
  "vpip_pfr_gap" numeric,
  "three_bet_pct" numeric,
  "open_raise_pct" numeric,
  "limp_pct" numeric,
  "call_pf_raise_pct" numeric,
  "preflop_all_ins" integer default 0,
  "btn_vpip" numeric,
  "btn_pfr" numeric,
  "co_vpip" numeric,
  "co_pfr" numeric,
  "hj_vpip" numeric,
  "hj_pfr" numeric,
  "lj_vpip" numeric,
  "lj_pfr" numeric,
  "utg_vpip" numeric,
  "utg_pfr" numeric,
  "sb_vpip" numeric,
  "sb_pfr" numeric,
  "bb_vpip" numeric,
  "bb_pfr" numeric,
  "agg_factor" numeric,
  "agg_freq" numeric,
  "wtsd_pct" numeric,
  "wsd_pct" numeric,
  "wwsf_pct" numeric,
  "hands_won" integer default 0,
  "hand_win_pct" numeric,
  "total_collected" integer default 0,
  "biggest_pot_won" integer default 0,
  "all_ins" integer default 0,
  "folds" integer default 0,
  "fold_pct" numeric,
  "notable_hands" integer default 0,
  "primary_label" text,
  "secondary_label" text,
  "total_collected_bb" numeric,
  "biggest_pot_won_bb" numeric,
  "evidence_revision_id" uuid
);

create table public."player_season_stats" (
  "id" bigint default nextval('player_season_stats_id_seq'::regclass) not null,
  "season_code" text default 'S0'::text,
  "player_id" uuid,
  "player_name" text,
  "sessions_played" integer default 0,
  "hands" integer default 0,
  "vpip_pct" numeric,
  "pfr_pct" numeric,
  "vpip_pfr_gap" numeric,
  "three_bet_pct" numeric,
  "open_raise_pct" numeric,
  "limp_pct" numeric,
  "call_pf_raise_pct" numeric,
  "preflop_all_ins" integer default 0,
  "btn_vpip" numeric,
  "btn_pfr" numeric,
  "co_vpip" numeric,
  "co_pfr" numeric,
  "hj_vpip" numeric,
  "hj_pfr" numeric,
  "lj_vpip" numeric,
  "lj_pfr" numeric,
  "utg_vpip" numeric,
  "utg_pfr" numeric,
  "sb_vpip" numeric,
  "sb_pfr" numeric,
  "bb_vpip" numeric,
  "bb_pfr" numeric,
  "agg_factor" numeric,
  "agg_freq" numeric,
  "wtsd_pct" numeric,
  "wsd_pct" numeric,
  "wwsf_pct" numeric,
  "hands_won" integer default 0,
  "hand_win_pct" numeric,
  "total_collected" integer default 0,
  "biggest_pot_won" integer default 0,
  "all_ins" integer default 0,
  "folds" integer default 0,
  "fold_pct" numeric,
  "notable_hands" integer default 0,
  "primary_label" text,
  "secondary_label" text,
  "wins" integer default 0 not null,
  "top_3s" integer default 0 not null,
  "top_4s" integer default 0 not null,
  "best_finish" integer,
  "avg_finish" numeric,
  "total_points" numeric default 0 not null,
  "latest_session_id" uuid,
  "latest_session_code" text,
  "updated_at" timestamp with time zone default now() not null
);

create table public."player_career_stats" (
  "id" uuid default gen_random_uuid() not null,
  "player_id" uuid,
  "player_name" text not null,
  "seasons_played" integer default 0 not null,
  "sessions_played" integer default 0 not null,
  "hands" integer default 0 not null,
  "hands_won" integer default 0 not null,
  "hand_win_pct" numeric default 0 not null,
  "total_collected" numeric default 0 not null,
  "biggest_pot_won" numeric default 0 not null,
  "all_ins" integer default 0 not null,
  "folds" integer default 0 not null,
  "fold_pct" numeric default 0 not null,
  "vpip_pct" numeric,
  "pfr_pct" numeric,
  "vpip_pfr_gap" numeric,
  "wins" integer default 0 not null,
  "top_3s" integer default 0 not null,
  "top_4s" integer default 0 not null,
  "best_finish" integer,
  "avg_finish" numeric,
  "total_points" numeric default 0 not null,
  "updated_at" timestamp with time zone default now() not null
);

create table public."standings" (
  "id" bigint default nextval('standings_id_seq'::regclass) not null,
  "season_code" text default 'S0'::text,
  "rank" integer,
  "player_id" uuid,
  "player_name" text,
  "sessions_played" integer default 0,
  "total_points" integer default 0,
  "wins" integer default 0,
  "top_3s" integer default 0,
  "top_4s" integer default 0,
  "best_finish" integer,
  "avg_finish" numeric,
  "latest_session_code" text,
  "updated_at" timestamp with time zone default now()
);

create table public."recap_drafts" (
  "id" uuid default gen_random_uuid() not null,
  "scope" text not null,
  "status" text default 'draft'::text not null,
  "visibility" text default 'admin'::text not null,
  "source_session_id" uuid,
  "source_player_id" uuid,
  "article_request" jsonb default '{}'::jsonb not null,
  "context_packet" jsonb default '{}'::jsonb not null,
  "draft" jsonb default '{}'::jsonb not null,
  "confidence_notes" text[] default '{}'::text[] not null,
  "missing_data_warnings" text[] default '{}'::text[] not null,
  "provider" text,
  "model_used" text,
  "prompt_version" text default 'para-newsroom-v1'::text not null,
  "source_data_version" text default 'v1'::text not null,
  "generated_at" timestamp with time zone default now() not null,
  "approved_by" text,
  "approved_at" timestamp with time zone,
  "published_at" timestamp with time zone,
  "unpublished_at" timestamp with time zone,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "provider_used" text,
  "generation_error" text,
  "fallback_trace" jsonb default '[]'::jsonb not null,
  "is_stale" boolean default false not null,
  "stale_at" timestamp with time zone,
  "stale_reason" text
);

create table public."published_articles" (
  "id" uuid default gen_random_uuid() not null,
  "draft_id" uuid,
  "scope" text not null,
  "slug" text,
  "title" text not null,
  "body" jsonb default '{}'::jsonb not null,
  "published_at" timestamp with time zone default now() not null,
  "unpublished_at" timestamp with time zone,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "is_stale" boolean default false not null,
  "stale_at" timestamp with time zone,
  "stale_reason" text
);

create table public."stat_recalculation_runs" (
  "id" uuid default gen_random_uuid() not null,
  "scope" text not null,
  "season_code" text,
  "session_id" uuid,
  "source" text default 'admin'::text not null,
  "status" text default 'completed'::text not null,
  "summary" jsonb default '{}'::jsonb not null,
  "created_at" timestamp with time zone default now() not null
);
alter table public."actions" add constraint "actions_pkey" PRIMARY KEY (id);
alter table public."game_session_imports" add constraint "game_session_imports_pkey" PRIMARY KEY (id);
alter table public."game_session_imports" add constraint "game_session_imports_status_check" CHECK ((status = ANY (ARRAY['uploaded'::text, 'validating'::text, 'invalid'::text, 'needs-mapping'::text, 'ready'::text, 'imported'::text, 'duplicate'::text, 'failed'::text, 'conflict'::text])));
alter table public."hands" add constraint "hands_pkey" PRIMARY KEY (id);
alter table public."hands" add constraint "hands_session_id_hand_no_key" UNIQUE (session_id, hand_no);
alter table public."notable_hands" add constraint "notable_hands_pkey" PRIMARY KEY (id);
alter table public."player_career_stats" add constraint "player_career_stats_pkey" PRIMARY KEY (id);
alter table public."player_career_stats" add constraint "player_career_stats_player_id_key" UNIQUE (player_id);
alter table public."player_season_stats" add constraint "player_season_stats_pkey" PRIMARY KEY (id);
alter table public."player_season_stats" add constraint "player_season_stats_season_code_player_name_key" UNIQUE (season_code, player_name);
alter table public."player_session_stats" add constraint "player_session_stats_pkey" PRIMARY KEY (id);
alter table public."player_session_stats" add constraint "player_session_stats_session_id_player_name_key" UNIQUE (session_id, player_name);
alter table public."players" add constraint "players_pkey" PRIMARY KEY (id);
alter table public."players" add constraint "players_pokernow_name_key" UNIQUE (pokernow_name);
alter table public."players" add constraint "players_slug_key" UNIQUE (slug);
alter table public."profiles" add constraint "profiles_identity_user_id_key" UNIQUE (identity_user_id);
alter table public."profiles" add constraint "profiles_pkey" PRIMARY KEY (id);
alter table public."profiles" add constraint "profiles_role_check" CHECK ((role = ANY (ARRAY['viewer'::text, 'contributor'::text, 'editor'::text, 'admin'::text, 'owner'::text])));
alter table public."published_articles" add constraint "published_articles_pkey" PRIMARY KEY (id);
alter table public."published_articles" add constraint "published_articles_scope_check" CHECK ((scope = ANY (ARRAY['moment'::text, 'session'::text, 'player'::text, 'division'::text, 'season'::text, 'article'::text])));
alter table public."published_articles" add constraint "published_articles_slug_key" UNIQUE (slug);
alter table public."raw_log_entries" add constraint "raw_log_entries_pkey" PRIMARY KEY (id);
alter table public."raw_log_entries" add constraint "raw_log_entries_session_id_log_order_key" UNIQUE (session_id, log_order);
alter table public."recap_drafts" add constraint "recap_drafts_pkey" PRIMARY KEY (id);
alter table public."recap_drafts" add constraint "recap_drafts_scope_check" CHECK ((scope = ANY (ARRAY['moment'::text, 'session'::text, 'player'::text, 'division'::text, 'season'::text, 'article'::text])));
alter table public."recap_drafts" add constraint "recap_drafts_status_check" CHECK ((status = ANY (ARRAY['draft'::text, 'approved'::text, 'archived'::text])));
alter table public."recap_drafts" add constraint "recap_drafts_visibility_check" CHECK ((visibility = ANY (ARRAY['admin'::text, 'public_preview'::text, 'published'::text])));
alter table public."session_evidence_revisions" add constraint "session_evidence_revisions_import_id_key" UNIQUE (import_id);
alter table public."session_evidence_revisions" add constraint "session_evidence_revisions_pkey" PRIMARY KEY (id);
alter table public."session_evidence_revisions" add constraint "session_evidence_revisions_revision_number_check" CHECK ((revision_number > 0));
alter table public."session_evidence_revisions" add constraint "session_evidence_revisions_session_id_revision_number_key" UNIQUE (session_id, revision_number);
alter table public."session_evidence_revisions" add constraint "session_evidence_revisions_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'current'::text, 'superseded'::text])));
alter table public."session_results" add constraint "session_results_pkey" PRIMARY KEY (id);
alter table public."session_results" add constraint "session_results_session_id_player_name_key" UNIQUE (session_id, player_name);
alter table public."sessions" add constraint "sessions_pkey" PRIMARY KEY (id);
alter table public."sessions" add constraint "sessions_result_review_status_check" CHECK ((result_review_status = ANY (ARRAY['legacy_unversioned'::text, 'awaiting_result_review'::text, 'approved'::text])));
alter table public."sessions" add constraint "sessions_session_code_key" UNIQUE (session_code);
alter table public."standings" add constraint "standings_pkey" PRIMARY KEY (id);
alter table public."standings" add constraint "standings_season_code_player_name_key" UNIQUE (season_code, player_name);
alter table public."stat_recalculation_runs" add constraint "stat_recalculation_runs_pkey" PRIMARY KEY (id);
alter table public."actions" add constraint "actions_evidence_revision_id_fkey" FOREIGN KEY (evidence_revision_id) REFERENCES session_evidence_revisions(id) ON DELETE RESTRICT;
alter table public."actions" add constraint "actions_hand_id_fkey" FOREIGN KEY (hand_id) REFERENCES hands(id) ON DELETE CASCADE;
alter table public."actions" add constraint "actions_player_id_fkey" FOREIGN KEY (player_id) REFERENCES players(id);
alter table public."actions" add constraint "actions_session_id_fkey" FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE;
alter table public."game_session_imports" add constraint "game_session_imports_committed_revision_id_fkey" FOREIGN KEY (committed_revision_id) REFERENCES session_evidence_revisions(id) ON DELETE SET NULL;
alter table public."game_session_imports" add constraint "game_session_imports_expected_current_evidence_revision_id_fkey" FOREIGN KEY (expected_current_evidence_revision_id) REFERENCES session_evidence_revisions(id) ON DELETE SET NULL;
alter table public."game_session_imports" add constraint "game_session_imports_imported_session_id_fkey" FOREIGN KEY (imported_session_id) REFERENCES sessions(id) ON DELETE SET NULL;
alter table public."game_session_imports" add constraint "game_session_imports_target_session_id_fkey" FOREIGN KEY (target_session_id) REFERENCES sessions(id) ON DELETE SET NULL;
alter table public."hands" add constraint "hands_evidence_revision_id_fkey" FOREIGN KEY (evidence_revision_id) REFERENCES session_evidence_revisions(id) ON DELETE RESTRICT;
alter table public."hands" add constraint "hands_session_id_fkey" FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE;
alter table public."hands" add constraint "hands_winner_player_id_fkey" FOREIGN KEY (winner_player_id) REFERENCES players(id);
alter table public."notable_hands" add constraint "notable_hands_evidence_revision_id_fkey" FOREIGN KEY (evidence_revision_id) REFERENCES session_evidence_revisions(id) ON DELETE RESTRICT;
alter table public."notable_hands" add constraint "notable_hands_session_id_fkey" FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE;
alter table public."player_career_stats" add constraint "player_career_stats_player_id_fkey" FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE SET NULL;
alter table public."player_season_stats" add constraint "player_season_stats_latest_session_id_fkey" FOREIGN KEY (latest_session_id) REFERENCES sessions(id) ON DELETE SET NULL;
alter table public."player_season_stats" add constraint "player_season_stats_player_id_fkey" FOREIGN KEY (player_id) REFERENCES players(id);
alter table public."player_session_stats" add constraint "player_session_stats_evidence_revision_id_fkey" FOREIGN KEY (evidence_revision_id) REFERENCES session_evidence_revisions(id) ON DELETE RESTRICT;
alter table public."player_session_stats" add constraint "player_session_stats_player_id_fkey" FOREIGN KEY (player_id) REFERENCES players(id);
alter table public."player_session_stats" add constraint "player_session_stats_session_id_fkey" FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE;
alter table public."profiles" add constraint "profiles_auth_user_id_fkey" FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public."published_articles" add constraint "published_articles_draft_id_fkey" FOREIGN KEY (draft_id) REFERENCES recap_drafts(id) ON DELETE SET NULL;
alter table public."raw_log_entries" add constraint "raw_log_entries_session_id_fkey" FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE;
alter table public."recap_drafts" add constraint "recap_drafts_source_player_id_fkey" FOREIGN KEY (source_player_id) REFERENCES players(id) ON DELETE SET NULL;
alter table public."recap_drafts" add constraint "recap_drafts_source_session_id_fkey" FOREIGN KEY (source_session_id) REFERENCES sessions(id) ON DELETE SET NULL;
alter table public."session_evidence_revisions" add constraint "session_evidence_revisions_import_id_fkey" FOREIGN KEY (import_id) REFERENCES game_session_imports(id) ON DELETE RESTRICT;
alter table public."session_evidence_revisions" add constraint "session_evidence_revisions_session_id_fkey" FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE;
alter table public."session_evidence_revisions" add constraint "session_evidence_revisions_supersedes_revision_id_fkey" FOREIGN KEY (supersedes_revision_id) REFERENCES session_evidence_revisions(id) ON DELETE SET NULL;
alter table public."session_results" add constraint "session_results_evidence_revision_id_fkey" FOREIGN KEY (evidence_revision_id) REFERENCES session_evidence_revisions(id) ON DELETE RESTRICT;
alter table public."session_results" add constraint "session_results_player_id_fkey" FOREIGN KEY (player_id) REFERENCES players(id);
alter table public."session_results" add constraint "session_results_session_id_fkey" FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE;
alter table public."sessions" add constraint "sessions_current_evidence_revision_id_fkey" FOREIGN KEY (current_evidence_revision_id) REFERENCES session_evidence_revisions(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;
alter table public."standings" add constraint "standings_player_id_fkey" FOREIGN KEY (player_id) REFERENCES players(id);
alter table public."stat_recalculation_runs" add constraint "stat_recalculation_runs_session_id_fkey" FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL;

CREATE INDEX actions_session_evidence_revision_idx ON public.actions USING btree (session_id, evidence_revision_id);
CREATE UNIQUE INDEX game_session_imports_imported_source_uidx ON public.game_session_imports USING btree (source_checksum) WHERE ((import_kind = 'raw_hand_history'::text) AND (status = 'imported'::text) AND (source_checksum IS NOT NULL));
CREATE INDEX game_session_imports_preview_checksum_idx ON public.game_session_imports USING btree (preview_checksum);
CREATE INDEX game_session_imports_source_identity_idx ON public.game_session_imports USING btree (source_identity_app, source_identity_match_id, created_at DESC) WHERE ((source_identity_app IS NOT NULL) AND (source_identity_match_id IS NOT NULL));
CREATE UNIQUE INDEX game_session_imports_source_uidx ON public.game_session_imports USING btree (source_app, source_match_id);
CREATE INDEX game_session_imports_status_idx ON public.game_session_imports USING btree (status, created_at DESC);
CREATE INDEX game_session_imports_target_session_idx ON public.game_session_imports USING btree (target_session_id, created_at DESC);
CREATE INDEX hands_session_evidence_revision_idx ON public.hands USING btree (session_id, evidence_revision_id);
CREATE INDEX notable_hands_session_evidence_revision_idx ON public.notable_hands USING btree (session_id, evidence_revision_id);
CREATE UNIQUE INDEX player_career_stats_player_uidx ON public.player_career_stats USING btree (player_id);
CREATE INDEX player_season_stats_season_idx ON public.player_season_stats USING btree (season_code, total_points DESC, wins DESC, best_finish);
CREATE UNIQUE INDEX player_season_stats_season_player_uidx ON public.player_season_stats USING btree (season_code, player_id);
CREATE INDEX player_session_stats_session_evidence_revision_idx ON public.player_session_stats USING btree (session_id, evidence_revision_id);
CREATE UNIQUE INDEX profiles_auth_user_id_key ON public.profiles USING btree (auth_user_id) WHERE (auth_user_id IS NOT NULL);
CREATE UNIQUE INDEX profiles_email_provider_idx ON public.profiles USING btree (lower(email), identity_provider);
CREATE INDEX published_articles_stale_idx ON public.published_articles USING btree (is_stale, published_at DESC);
CREATE INDEX recap_drafts_player_idx ON public.recap_drafts USING btree (source_player_id, generated_at DESC);
CREATE INDEX recap_drafts_scope_status_idx ON public.recap_drafts USING btree (scope, status, visibility);
CREATE INDEX recap_drafts_session_idx ON public.recap_drafts USING btree (source_session_id, generated_at DESC);
CREATE INDEX recap_drafts_session_stale_idx ON public.recap_drafts USING btree (source_session_id, is_stale, generated_at DESC);
CREATE UNIQUE INDEX session_evidence_revisions_one_current_uidx ON public.session_evidence_revisions USING btree (session_id) WHERE (status = 'current'::text);
CREATE INDEX session_evidence_revisions_session_idx ON public.session_evidence_revisions USING btree (session_id, revision_number DESC);
CREATE INDEX session_results_session_evidence_revision_idx ON public.session_results USING btree (session_id, evidence_revision_id);

CREATE OR REPLACE FUNCTION public.protect_raw_hand_import_artifact()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
begin
  if old.import_kind in ('raw_hand_history', 'eggs_session_package') and (
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
    or new.source_identity_app is distinct from old.source_identity_app
    or new.source_identity_match_id is distinct from old.source_identity_match_id
    or new.source_package_checksum is distinct from old.source_package_checksum
  ) then
    raise exception using errcode = '55000', message = 'Evidence preview artifacts are immutable; create a new preview instead.';
  end if;
  return new;
end
$function$
;

CREATE OR REPLACE FUNCTION public.protect_session_evidence_revision_artifact()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;
CREATE TRIGGER game_session_imports_protect_raw_hand_artifact BEFORE UPDATE ON public.game_session_imports FOR EACH ROW EXECUTE FUNCTION protect_raw_hand_import_artifact();
CREATE TRIGGER game_session_imports_set_updated_at BEFORE UPDATE ON public.game_session_imports FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER published_articles_set_updated_at BEFORE UPDATE ON public.published_articles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER recap_drafts_set_updated_at BEFORE UPDATE ON public.recap_drafts FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER session_evidence_revisions_protect_artifact BEFORE UPDATE ON public.session_evidence_revisions FOR EACH ROW EXECUTE FUNCTION protect_session_evidence_revision_artifact();
alter table public."profiles" enable row level security;
alter table public."players" enable row level security;
alter table public."sessions" enable row level security;
alter table public."hands" enable row level security;
alter table public."actions" enable row level security;
alter table public."raw_log_entries" enable row level security;
alter table public."notable_hands" enable row level security;
alter table public."game_session_imports" enable row level security;
alter table public."session_evidence_revisions" enable row level security;
alter table public."session_results" enable row level security;
alter table public."player_session_stats" enable row level security;
alter table public."player_season_stats" enable row level security;
alter table public."player_career_stats" enable row level security;
alter table public."standings" enable row level security;
alter table public."recap_drafts" enable row level security;
alter table public."published_articles" enable row level security;
alter table public."stat_recalculation_runs" enable row level security;
