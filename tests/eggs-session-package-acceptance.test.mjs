import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import {
  buildEggsSessionImportArtifact,
  computeEggsPackageChecksum,
} from "../src/lib/imports/eggsSessionPackageArtifact.js";

const migrationFiles = [
  "tests/database/raw-hand-import-core-schema.sql",
  "sql/20260710_newsroom_recap_workflow.sql",
  "sql/20260713_game_session_imports.sql",
  "sql/20260715_player_stat_aggregates.sql",
  "sql/20260715_big_blind_pot_normalization.sql",
  "sql/20260805213435_raw_hand_evidence_revisions.sql",
  "sql/20260807_eggs_completed_session_v2.sql",
];
const playerIds = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
];
const participantMappings = {
  "eggs-player-alice": playerIds[0],
  "eggs-player-bob": playerIds[1],
};
const leaguePlayers = [
  { id: playerIds[0], display_name: "League Alice" },
  { id: playerIds[1], display_name: "League Bob" },
];

async function database() {
  const db = new PGlite();
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role;
    create schema extensions;
    create function extensions.digest(value bytea, algorithm text) returns bytea
      language sql immutable as $$ select sha256(value) $$;
    create function public.digest(value bytea, algorithm text) returns bytea
      language sql immutable as $$ select sha256(value) $$;
  `);
  for (const filename of migrationFiles) {
    const migration = fs.readFileSync(filename, "utf8").replace(/^create extension if not exists pgcrypto;\s*/gmi, "");
    await db.exec(migration);
  }
  await db.query(
    `insert into public.players(id,display_name,pokernow_name,slug) values
     ($1,'League Alice','eggs-alice','league-alice'),($2,'League Bob','eggs-bob','league-bob')`,
    playerIds
  );
  return db;
}

function artifact(completedPackage, { replaceExisting = false } = {}) {
  const sourceBytes = new TextEncoder().encode(JSON.stringify(completedPackage));
  return buildEggsSessionImportArtifact({
    sourceBytes,
    source: { filename: "para-completed-session-v2.json", mediaType: "application/json" },
    metadata: { sessionCode: "S0-EGGS-ACCEPTANCE", seasonCode: "S0", replaceExisting },
    participantMappings,
    leaguePlayers,
  });
}

async function preview(db, value) {
  const { rows } = await db.query(
    `select public.create_eggs_session_import_preview($1,$2,$3,$4,$5,$6,$7,null) result`,
    [value.manifest.source.filename, value.manifest.source.mediaType, Buffer.from(value.sourceBytes).toString("base64"),
      value.canonicalMetadata, value.parserVersion, value.canonicalManifest, value.canonicalValidationReport]
  );
  return rows[0].result;
}

async function commit(db, storedPreview, { replace = false } = {}) {
  const { rows } = await db.query(
    `select public.commit_eggs_session_import($1,$2,true,$3,$4) result`,
    [storedPreview.importId, storedPreview.previewChecksum, replace, storedPreview.expectedCurrentEvidenceRevisionId]
  );
  return rows[0].result;
}

test("a durable EGGS package directly previews, explicitly commits, and materializes through the evidence revision floor", async () => {
  const db = await database();
  try {
    const completedPackage = JSON.parse(fs.readFileSync("tests/fixtures/para-completed-session-v2.json", "utf8"));
    const directArtifact = artifact(completedPackage);
    const storedPreview = await preview(db, directArtifact);
    assert.equal(storedPreview.status, "ready");
    assert.equal(storedPreview.sourceMatchPreviouslyImported, false);
    const duplicatePreview = await preview(db, directArtifact);
    assert.equal(duplicatePreview.importId, storedPreview.importId);
    assert.equal(duplicatePreview.idempotent, true);

    const committed = await commit(db, storedPreview);
    assert.equal(committed.status, "imported");
    assert.equal(committed.idempotent, false);
    assert.deepEqual(committed.insertedCounts, {
      hands: 1,
      actions: 3,
      notableHands: 1,
      playerSessionStats: 2,
      sessionResults: 2,
    });
    assert.equal((await commit(db, storedPreview)).idempotent, true);

    const evidence = await db.query(
      `select
        (select count(*)::integer from public.sessions) sessions,
        (select count(*)::integer from public.hands where session_id=$1 and evidence_revision_id=$2) hands,
        (select count(*)::integer from public.actions where session_id=$1 and evidence_revision_id=$2) actions,
        (select count(*)::integer from public.session_results where session_id=$1 and evidence_revision_id=$2 and not approved) results,
        (select count(*)::integer from public.player_session_stats where session_id=$1 and evidence_revision_id=$2) stats`,
      [committed.sessionId, committed.revisionId]
    );
    assert.deepEqual(evidence.rows[0], { sessions: 1, hands: 1, actions: 3, results: 2, stats: 2 });
    const actions = await db.query(
      `select log_order,source_event_id,source_command_id,target_contribution,raise_to
       from public.actions where session_id=$1 order by log_order`, [committed.sessionId]
    );
    assert.deepEqual(actions.rows.map((row) => Number(row.log_order)), directArtifact.manifest.actions.map((row) => row.logOrder));
    assert.deepEqual(actions.rows.map((row) => Number(row.target_contribution)), directArtifact.manifest.actions.map((row) => row.targetContribution));
    assert.equal(actions.rows.every((row) => row.source_event_id), true);

    const importedPreview = await preview(db, directArtifact);
    assert.equal(importedPreview.status, "conflict");
    assert.equal(importedPreview.sourceMatchPreviouslyImported, true);

    const changedPackage = structuredClone(completedPackage);
    changedPackage.source.buildVersion = "conflicting-authority-build";
    changedPackage.integrity.packageChecksum = computeEggsPackageChecksum(changedPackage);
    const conflictingPreview = await preview(db, artifact(changedPackage));
    assert.equal(conflictingPreview.status, "conflict");
    assert.equal(conflictingPreview.sourceMatchPreviouslyImported, true);
    assert.equal((await commit(db, conflictingPreview)).status, "conflict");

    const replacementPreview = await preview(db, artifact(changedPackage, { replaceExisting: true }));
    assert.equal(replacementPreview.status, "ready");
    await db.exec(`
      create function public.fail_eggs_action() returns trigger language plpgsql as $$
      begin
        if exists (select 1 from public.session_evidence_revisions where id=new.evidence_revision_id and parser_version='eggs-session-package-v2')
          then raise exception 'induced acceptance failure';
        end if;
        return new;
      end $$;
      create trigger fail_eggs_action before insert on public.actions for each row execute function public.fail_eggs_action();
    `);
    const beforeFailure = await db.query(
      `select current_evidence_revision_id,
        (select count(*)::integer from public.actions where session_id=sessions.id) actions,
        (select count(*)::integer from public.session_results where session_id=sessions.id) results
       from public.sessions where id=$1`, [committed.sessionId]
    );
    const failed = await commit(db, replacementPreview, { replace: true });
    assert.equal(failed.status, "failed");
    assert.equal(failed.failureStage, "actions");
    const afterFailure = await db.query(
      `select current_evidence_revision_id,
        (select count(*)::integer from public.actions where session_id=sessions.id) actions,
        (select count(*)::integer from public.session_results where session_id=sessions.id) results
       from public.sessions where id=$1`, [committed.sessionId]
    );
    assert.deepEqual(afterFailure.rows, beforeFailure.rows);

    const privileges = await db.query(`select
      has_function_privilege('service_role','public.commit_eggs_session_import(uuid,text,boolean,boolean,uuid)','execute') service,
      has_function_privilege('anon','public.commit_eggs_session_import(uuid,text,boolean,boolean,uuid)','execute') anon,
      has_function_privilege('authenticated','public.create_eggs_session_import_preview(text,text,text,text,text,text,text,uuid)','execute') authenticated`);
    assert.deepEqual(privileges.rows[0], { service: true, anon: false, authenticated: false });
  } finally {
    await db.close();
  }
});
