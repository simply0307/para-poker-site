import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { buildRawHandImportArtifact } from "../src/lib/imports/rawHandImportArtifact.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requiredEnvironment = [
  "SUPABASE_TEST_URL",
  "SUPABASE_TEST_SERVICE_ROLE_KEY",
  "SUPABASE_TEST_DATABASE_URL",
  "SUPABASE_TEST_PROJECT_REF",
];
const missingEnvironment = requiredEnvironment.filter((name) => !process.env[name]);
const integrationEnabled = !missingEnvironment.length && process.env.ALLOW_DESTRUCTIVE_IMPORT_INTEGRATION_TESTS === "true";

function localEnvironment() {
  const file = path.join(root, ".env.local");
  if (!fs.existsSync(file)) return {};
  return Object.fromEntries(
    fs.readFileSync(file, "utf8")
      .split(/\r?\n/u)
      .map((line) => line.match(/^([A-Z0-9_]+)=(.*)$/u))
      .filter(Boolean)
      .map((match) => [match[1], match[2].replace(/^['"]|['"]$/gu, "")])
  );
}

function assertDisposableTarget() {
  if (!integrationEnabled) return;
  const configured = localEnvironment();
  const testUrl = process.env.SUPABASE_TEST_URL;
  const testRef = process.env.SUPABASE_TEST_PROJECT_REF;
  assert.ok(testUrl.includes(testRef), "SUPABASE_TEST_URL must contain SUPABASE_TEST_PROJECT_REF.");
  assert.notEqual(testUrl, configured.SUPABASE_URL, "Integration tests refuse to target the configured application Supabase URL.");
  if (configured.SUPABASE_URL) assert.ok(!configured.SUPABASE_URL.includes(testRef), "Integration test project ref matches the configured application project.");
  assert.ok(testRef.toLowerCase().includes("test") || process.env.SUPABASE_TEST_CONFIRMED_DISPOSABLE === "true", "Project ref must identify a test project or set SUPABASE_TEST_CONFIRMED_DISPOSABLE=true.");
}

function sql(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function rawArtifact(sourceBytes, { sessionCode = "S0-INTEGRATION-1", replaceExisting = false } = {}) {
  return buildRawHandImportArtifact({
    sourceBytes: new Uint8Array(sourceBytes),
    source: { filename: "integration-hands.csv", mediaType: "text/csv" },
    metadata: {
      sessionCode,
      seasonCode: "S0",
      sessionNumber: null,
      tableName: "Integration Table",
      playedAt: "2026-08-01T20:00:00.000Z",
      format: "Imported hand history",
      replaceExisting,
      sourceKind: "csv_file",
      inputMode: "csv",
    },
  });
}

async function createPreview(client, artifact) {
  const { rows } = await client.query(
    `select public.create_raw_hand_import_preview($1,$2,$3,$4,$5,$6,$7,$8) as result`,
    [
      artifact.manifest.source.filename,
      artifact.manifest.source.mediaType,
      Buffer.from(artifact.sourceBytes).toString("base64"),
      artifact.canonicalMetadata,
      artifact.parserVersion,
      artifact.canonicalManifest,
      artifact.canonicalValidationReport,
      null,
    ]
  );
  return rows[0].result;
}

async function commitPreview(client, preview, { confirmReplace = false } = {}) {
  const { rows } = await client.query(
    `select public.commit_raw_hand_session_import($1,$2,$3,$4,$5) as result`,
    [preview.importId, preview.previewChecksum, true, confirmReplace, preview.expectedCurrentEvidenceRevisionId]
  );
  return rows[0].result;
}

test("raw-hand preview and commit database behavior", { skip: integrationEnabled ? false : `Set the disposable Supabase test environment (${missingEnvironment.join(", ") || "destructive flag missing"}).` }, async () => {
  assertDisposableTarget();
  const client = new pg.Client({ connectionString: process.env.SUPABASE_TEST_DATABASE_URL, ssl: { rejectUnauthorized: false } });
  let failureTriggerInstalled = false;
  await client.connect();
  try {
    await client.query("drop schema public cascade; create schema public; grant usage on schema public to public;");
    for (const migration of [
      "tests/database/raw-hand-import-core-schema.sql",
      "sql/20260710_newsroom_recap_workflow.sql",
      "sql/20260713_game_session_imports.sql",
      "sql/20260715_big_blind_pot_normalization.sql",
      "sql/20260715_player_stat_aggregates.sql",
      "sql/20260805213435_raw_hand_evidence_revisions.sql",
    ]) {
      await client.query(sql(migration));
    }

    const privileges = await client.query(`select
      has_function_privilege('service_role', 'public.create_raw_hand_import_preview(text,text,text,text,text,text,text,uuid)', 'execute') as service_preview,
      has_function_privilege('service_role', 'public.commit_raw_hand_session_import(uuid,text,boolean,boolean,uuid)', 'execute') as service_commit,
      has_function_privilege('anon', 'public.create_raw_hand_import_preview(text,text,text,text,text,text,text,uuid)', 'execute') as anon_preview,
      has_function_privilege('authenticated', 'public.commit_raw_hand_session_import(uuid,text,boolean,boolean,uuid)', 'execute') as authenticated_commit,
      has_table_privilege('service_role', 'public.game_session_imports', 'select,insert,update') as service_ledger,
      has_table_privilege('anon', 'public.game_session_imports', 'select') as anon_ledger`);
    assert.deepEqual(privileges.rows[0], {
      service_preview: true,
      service_commit: true,
      anon_preview: false,
      authenticated_commit: false,
      service_ledger: true,
      anon_ledger: false,
    });

    const fixture = fs.readFileSync(path.join(root, "tests/fixtures/parapoker-local-match-entry-order-hand-history.csv"));
    const firstArtifact = rawArtifact(fixture);
    const firstPreview = await createPreview(client, firstArtifact);
    assert.equal(firstPreview.status, "ready");
    const storedBytes = await client.query("select source_bytes from public.game_session_imports where id = $1", [firstPreview.importId]);
    assert.deepEqual(storedBytes.rows[0].source_bytes, fixture);

    const duplicatePreview = await createPreview(client, firstArtifact);
    assert.equal(duplicatePreview.importId, firstPreview.importId);
    assert.equal(duplicatePreview.idempotent, true);

    const wrongChecksumBeforeCommit = await client.query(
      `select public.commit_raw_hand_session_import($1,$2,true,false,null) as result`,
      [firstPreview.importId, "0".repeat(64)]
    );
    assert.equal(wrongChecksumBeforeCommit.rows[0].result.status, "conflict");
    const sessionsBeforeCommit = await client.query("select count(*)::integer as count from public.sessions");
    assert.equal(sessionsBeforeCommit.rows[0].count, 0);

    const firstCommit = await commitPreview(client, firstPreview);
    assert.equal(firstCommit.status, "imported");
    assert.equal(firstCommit.revisionNumber, 1);
    assert.deepEqual(firstCommit.insertedCounts, {
      hands: firstArtifact.manifest.totals.hands,
      actions: firstArtifact.manifest.totals.actions,
      notableHands: firstArtifact.manifest.totals.notableHands,
      playerSessionStats: firstArtifact.manifest.totals.playerSessionStats,
    });
    const duplicateCommit = await commitPreview(client, firstPreview);
    assert.equal(duplicateCommit.status, "imported");
    assert.equal(duplicateCommit.idempotent, true);
    const wrongChecksumAfterCommit = await client.query(
      `select public.commit_raw_hand_session_import($1,$2,true,false,null) as result`,
      [firstPreview.importId, "f".repeat(64)]
    );
    assert.equal(wrongChecksumAfterCommit.rows[0].result.status, "conflict");

    const duplicateSourcePreview = await createPreview(client, rawArtifact(fixture, { sessionCode: "S0-INTEGRATION-DUPLICATE-SOURCE" }));
    assert.equal(duplicateSourcePreview.status, "ready");
    const duplicateSourceCommit = await commitPreview(client, duplicateSourcePreview);
    assert.equal(duplicateSourceCommit.status, "duplicate");
    assert.equal(duplicateSourceCommit.duplicateOfImportId, firstPreview.importId);

    for (const table of ["hands", "actions", "notable_hands", "player_session_stats"]) {
      const { rows } = await client.query(`select count(*)::integer as count,
        count(*) filter (where evidence_revision_id = $2)::integer as stamped,
        count(distinct evidence_revision_id)::integer as revisions
        from public.${table} where session_id = $1`, [firstCommit.sessionId, firstCommit.revisionId]);
      assert.equal(rows[0].count, firstArtifact.manifest.totals[table === "notable_hands" ? "notableHands" : table === "player_session_stats" ? "playerSessionStats" : table]);
      assert.equal(rows[0].stamped, rows[0].count);
      assert.equal(rows[0].revisions, 1);
    }

    const conflictArtifact = rawArtifact(Buffer.concat([fixture, Buffer.from("\n\n", "utf8")]));
    const conflictPreview = await createPreview(client, conflictArtifact);
    assert.equal(conflictPreview.status, "conflict");
    const conflictCommit = await commitPreview(client, conflictPreview);
    assert.equal(conflictCommit.status, "conflict");

    const player = await client.query("select player_id, player_name from public.player_session_stats where session_id = $1 limit 1", [firstCommit.sessionId]);
    const draft = await client.query(
      `insert into public.recap_drafts(scope,status,visibility,source_session_id,draft,published_at)
       values ('session','approved','published',$1,'{"headline":"Old recap"}'::jsonb,now()) returning id`,
      [firstCommit.sessionId]
    );
    await client.query("insert into public.published_articles(draft_id,scope,slug,title,body) values ($1,'session','old-session-recap','Old recap','{}')", [draft.rows[0].id]);
    await client.query("insert into public.session_results(session_id,player_id,player_name,finish,league_points,approved) values ($1,$2,$3,1,10,true)", [firstCommit.sessionId, player.rows[0].player_id, player.rows[0].player_name]);
    await client.query("insert into public.player_season_stats(season_code,player_id,player_name,total_points) values ('S0',$1,$2,10)", [player.rows[0].player_id, player.rows[0].player_name]);
    await client.query("insert into public.player_career_stats(player_id,player_name,total_points) values ($1,$2,10)", [player.rows[0].player_id, player.rows[0].player_name]);
    await client.query("insert into public.standings(season_code,player_id,player_name,total_points,rank) values ('S0',$1,$2,10,1)", [player.rows[0].player_id, player.rows[0].player_name]);

    const replacementArtifact = rawArtifact(Buffer.concat([fixture, Buffer.from("\n", "utf8")]), { replaceExisting: true });
    const replacementPreview = await createPreview(client, replacementArtifact);
    assert.equal(replacementPreview.status, "ready");
    assert.equal(replacementPreview.targetSessionId, firstCommit.sessionId);
    assert.equal(replacementPreview.currentRevisionNumber, 1);
    const replacementCommit = await commitPreview(client, replacementPreview, { confirmReplace: true });
    assert.equal(replacementCommit.status, "imported");
    assert.equal(replacementCommit.sessionId, firstCommit.sessionId);
    assert.equal(replacementCommit.revisionNumber, 2);
    assert.equal(replacementCommit.resultReviewStatus, "awaiting_result_review");

    const invalidated = await client.query(
      `select
        (select count(*) from public.session_results where session_id = $1)::integer as results,
        (select count(*) from public.player_season_stats where season_code = 'S0')::integer as seasons,
        (select count(*) from public.player_career_stats)::integer as careers,
        (select count(*) from public.standings where season_code = 'S0')::integer as standings,
        (select count(*) from public.recap_drafts where source_session_id = $1 and is_stale and visibility = 'admin' and unpublished_at is not null)::integer as stale_drafts,
        (select count(*) from public.published_articles where draft_id = $2 and is_stale and unpublished_at is not null)::integer as stale_articles`,
      [firstCommit.sessionId, draft.rows[0].id]
    );
    assert.deepEqual(invalidated.rows[0], { results: 0, seasons: 0, careers: 0, standings: 0, stale_drafts: 1, stale_articles: 1 });

    const concurrentA = await createPreview(client, rawArtifact(Buffer.concat([fixture, Buffer.from("\n\n\n", "utf8")]), { replaceExisting: true }));
    const concurrentB = await createPreview(client, rawArtifact(Buffer.concat([fixture, Buffer.from("\n\n\n\n", "utf8")]), { replaceExisting: true }));
    assert.equal(concurrentA.expectedCurrentEvidenceRevisionId, concurrentB.expectedCurrentEvidenceRevisionId);
    const concurrentCommit = await commitPreview(client, concurrentA, { confirmReplace: true });
    assert.equal(concurrentCommit.revisionNumber, 3);
    const staleConcurrentCommit = await commitPreview(client, concurrentB, { confirmReplace: true });
    assert.equal(staleConcurrentCommit.status, "conflict");

    await client.query(`
      create or replace function public.fail_marked_import_action() returns trigger language plpgsql as $$
      begin
        if new.raw_entry like '%[FAIL_TEST]%' then raise exception 'induced evidence write failure'; end if;
        return new;
      end $$;
      create trigger fail_marked_import_action before insert on public.actions
      for each row execute function public.fail_marked_import_action();
    `);
    failureTriggerInstalled = true;
    const failingSource = Buffer.from(fixture.toString("utf8").replace("raises to 31 and goes all in", "raises to 31 and goes all in [FAIL_TEST]"), "utf8");
    const failingPreview = await createPreview(client, rawArtifact(failingSource, { replaceExisting: true }));
    const beforeFailure = await client.query("select current_evidence_revision_id from public.sessions where id = $1", [firstCommit.sessionId]);
    const evidenceBeforeFailure = await client.query("select count(*)::integer as count from public.actions where session_id = $1", [firstCommit.sessionId]);
    const failedCommit = await commitPreview(client, failingPreview, { confirmReplace: true });
    assert.equal(failedCommit.status, "failed");
    assert.equal(failedCommit.failureStage, "actions");
    const afterFailure = await client.query("select current_evidence_revision_id from public.sessions where id = $1", [firstCommit.sessionId]);
    const evidenceAfterFailure = await client.query("select count(*)::integer as count from public.actions where session_id = $1", [firstCommit.sessionId]);
    assert.deepEqual(afterFailure.rows, beforeFailure.rows);
    assert.deepEqual(evidenceAfterFailure.rows, evidenceBeforeFailure.rows);
    const failedLedger = await client.query("select status, commit_report from public.game_session_imports where id = $1", [failingPreview.importId]);
    assert.equal(failedLedger.rows[0].status, "failed");
    assert.equal(failedLedger.rows[0].commit_report.failureStage, "actions");
    const legacy = await client.query(
      `insert into public.sessions(season_code,session_number,session_code,played_at,table_name,format,status)
       values ('S0',99,'S0-LEGACY','2026-01-01','Legacy','Legacy','processed')
       returning current_evidence_revision_id,result_review_status`
    );
    assert.equal(legacy.rows[0].current_evidence_revision_id, null);
    assert.equal(legacy.rows[0].result_review_status, "legacy_unversioned");
  } finally {
    if (failureTriggerInstalled) {
      await client.query("drop trigger if exists fail_marked_import_action on public.actions; drop function if exists public.fail_marked_import_action();");
    }
    await client.end();
  }
});
