import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { buildGauntletMatchImportArtifact } from "../src/lib/imports/gauntletMatchArtifact.js";

const migrations = [
  "tests/database/raw-hand-import-core-schema.sql",
  "sql/20260710_newsroom_recap_workflow.sql",
  "sql/20260713_game_session_imports.sql",
  "sql/20260715_player_stat_aggregates.sql",
  "sql/20260715_big_blind_pot_normalization.sql",
  "sql/20260805213435_raw_hand_evidence_revisions.sql",
  "sql/20260807_eggs_completed_session_v2.sql",
];
const playerIds = ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"];
const participantMappings = {
  "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa:p1": playerIds[0],
  "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa:p2": playerIds[1],
};
const leaguePlayers = playerIds.map((id, index) => ({ id, display_name: index ? "League Beta" : "League Alpha" }));

async function database() {
  const db = new PGlite();
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role;
    create schema extensions;
    create function extensions.digest(value bytea, algorithm text) returns bytea language sql immutable as $$ select sha256(value) $$;
    create function public.digest(value bytea, algorithm text) returns bytea language sql immutable as $$ select sha256(value) $$;
  `);
  for (const filename of migrations) {
    await db.exec(fs.readFileSync(filename, "utf8").replace(/^create extension if not exists pgcrypto;\s*/gmi, ""));
  }
  await db.query(
    `insert into public.players(id,display_name,pokernow_name,slug) values ($1,'League Alpha','alpha','league-alpha'),($2,'League Beta','beta','league-beta')`,
    playerIds
  );
  return db;
}

function artifact() {
  const sourceBytes = fs.readFileSync("tests/fixtures/gauntlet-para-match-v2.json");
  return buildGauntletMatchImportArtifact({
    sourceBytes: new Uint8Array(sourceBytes),
    source: { filename: "gauntlet-para-match-v2.json", mediaType: "application/json" },
    metadata: { sessionCode: "S0-GAUNTLET-ACCEPTANCE", seasonCode: "S0" },
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

async function commit(db, stored) {
  const { rows } = await db.query(
    `select public.commit_eggs_session_import($1,$2,true,false,$3) result`,
    [stored.importId, stored.previewChecksum, stored.expectedCurrentEvidenceRevisionId]
  );
  return rows[0].result;
}

test("Gauntlet v2 previews, explicitly commits, materializes, and retries idempotently through the existing Para floor", async () => {
  const db = await database();
  try {
    const direct = artifact();
    const stored = await preview(db, direct);
    assert.equal(stored.status, "ready");
    assert.equal(stored.sourceIdentity.application, "gauntlet-online");
    assert.equal(stored.sourceIdentity.matchId, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    assert.equal(stored.sourceMatchPreviouslyImported, false);

    const imported = await commit(db, stored);
    assert.equal(imported.status, "imported");
    assert.equal(imported.idempotent, false);
    assert.deepEqual(imported.insertedCounts, { hands: 1, actions: 9, notableHands: 1, playerSessionStats: 0, sessionResults: 2 });
    assert.equal((await commit(db, stored)).idempotent, true);

    const rows = await db.query(
      `select
        (select count(*)::integer from public.sessions where id=$1) sessions,
        (select count(*)::integer from public.hands where session_id=$1 and evidence_revision_id=$2) hands,
        (select count(*)::integer from public.actions where session_id=$1 and evidence_revision_id=$2) actions,
        (select count(*)::integer from public.session_results where session_id=$1 and evidence_revision_id=$2) results,
        (select count(*)::integer from public.notable_hands where session_id=$1 and evidence_revision_id=$2) recap_evidence`,
      [imported.sessionId, imported.revisionId]
    );
    assert.deepEqual(rows.rows[0], { sessions: 1, hands: 1, actions: 9, results: 2, recap_evidence: 1 });

    const actions = await db.query(
      `select log_order,action,source_event_id,source_command_id,raw_entry from public.actions where session_id=$1 order by log_order`,
      [imported.sessionId]
    );
    assert.deepEqual(actions.rows.map((row) => Number(row.log_order)), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
    assert.equal(actions.rows[2].action, "attack.declared");
    assert.equal(actions.rows.every((row) => row.source_event_id), true);
    assert.ok(actions.rows.some((row) => row.source_command_id));

    const provenance = await db.query(
      `select source_identity_app,source_identity_match_id,source_package_checksum,schema_version,event_schema_version,
        parsed_manifest->'sourceContract' source_contract,
        parsed_manifest->'authorityConsequences'->'recapEvidence' recap
       from public.game_session_imports where id=$1`, [stored.importId]
    );
    assert.equal(provenance.rows[0].source_identity_app, "gauntlet-online");
    assert.equal(provenance.rows[0].source_identity_match_id, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    assert.equal(provenance.rows[0].source_contract.schemaVersion, "gauntlet.para-match.v2");
    assert.equal(provenance.rows[0].source_contract.evidenceSchemaVersion, "gauntlet.league-evidence.v1");
    assert.equal(provenance.rows[0].recap.damageDealt, 21);

    const repeatedPreview = await preview(db, direct);
    assert.notEqual(repeatedPreview.importId, stored.importId);
    assert.equal(repeatedPreview.status, "conflict");
    assert.equal(repeatedPreview.sourceMatchPreviouslyImported, true);
    assert.equal(repeatedPreview.previousImport.importId, stored.importId);
  } finally {
    await db.close();
  }
});
