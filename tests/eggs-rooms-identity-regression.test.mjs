import test from "node:test";
import assert from "node:assert/strict";
import { hasPostgres } from "./helpers/localPostgres.mjs";
import { roomsDatabase } from "./helpers/roomsDatabase.mjs";
import {
  hubActor,
  beginHubActor,
  hubIds,
  rejected,
} from "./helpers/hubDatabase.mjs";
const id = (n) => "c0000000-0000-4000-8000-" + String(n).padStart(12, "0");
const tables = [
  "profiles",
  "players",
  "sessions",
  "hands",
  "actions",
  "raw_log_entries",
  "notable_hands",
  "game_session_imports",
  "session_evidence_revisions",
  "session_results",
  "player_session_stats",
  "player_season_stats",
  "player_career_stats",
  "standings",
  "recap_drafts",
  "published_articles",
  "stat_recalculation_runs",
];
async function fingerprint(db) {
  const data = {};
  for (const table of tables)
    data[table] = (
      await db.admin.query(
        "select count(*)::int count,md5(coalesce(string_agg(to_jsonb(t)::text,'' order by to_jsonb(t)::text),'')) hash from public." +
          table +
          " t",
      )
    ).rows[0];
  return data;
}
async function lockWait(db, pid) {
  for (let i = 0; i < 80; i++) {
    if (
      (
        await db.admin.query(
          "select wait_event_type from pg_stat_activity where pid=$1",
          [pid],
        )
      ).rows[0]?.wait_event_type === "Lock"
    )
      return;
    await new Promise((r) => setTimeout(r, 25));
  }
  assert.fail("No real row lock observed");
}
const create = (db, user, handle) =>
  hubActor(db, user, (c) =>
    c.query(
      "insert into public.eggs_profiles(handle,display_name) values($1,'Fixture') returning id",
      [handle],
    ),
  ).then((r) => r.rows[0].id);
const claim = (db, user, player) =>
  hubActor(db, user, (c) =>
    c.query(
      "insert into public.para_poker_player_claims(player_id,evidence_note) values($1,'Durable local evidence') returning id",
      [player],
    ),
  ).then((r) => r.rows[0].id);
const review = (c, claim) =>
  c.query(
    "select public.review_para_poker_claim($1,'approve','Local operator review') result",
    [claim],
  );
test(
  "complete additive stack preserves identity claims and Poker evidence",
  { skip: !hasPostgres, timeout: 180000 },
  async (t) => {
    const db = await roomsDatabase(t);
    for (let i = 1; i <= 3; i++)
      await db.admin.query(
        "insert into public.players(id,display_name,slug,pokernow_name) values($1,$2,$3,$4)",
        [id(i), "Player " + i, "player-" + i, "Legacy " + i],
      );
    await db.admin.query(
      "insert into public.sessions(id,session_number,session_code) values($1,1,'ROOM-001')",
      [id(10)],
    );
    await db.admin.query(
      "insert into public.hands(id,session_id,hand_no) values($1,$2,1)",
      [id(11), id(10)],
    );
    await db.admin.query(
      "insert into public.actions(session_id,hand_id,hand_no,player_id,player_name,action,amount) values($1,$2,1,$3,'Legacy 1','raise',200)",
      [id(10), id(11), id(1)],
    );
    await db.admin.query(
      "insert into public.game_session_imports(id,source_app,source_match_id,schema_version,event_schema_version,checksum,authority_type,visibility) values($1,'fixture','room-fixture','2','2','checksum','authoritative','private')",
      [id(12)],
    );
    await db.admin.query(
      "insert into public.session_evidence_revisions(session_id,import_id,revision_number,source_size_bytes,source_checksum,metadata,metadata_checksum,parser_version,parsed_manifest,manifest_checksum,validation_report,validation_report_checksum,preview_checksum) values($1,$2,1,10,'source','{}','metadata','fixture','{}','manifest','{}','validation','preview')",
      [id(10), id(12)],
    );
    const before = await fingerprint(db);
    await t.test(
      "canonical and concurrent permanent handle reservation still enforced in SQL",
      async () => {
        for (const handle of ["ABC", " abc", "abc ", "admin", "a-b"])
          await rejected(create(db, "alice", handle), "23514");
        const a = await db.connect(),
          b = await db.connect();
        await beginHubActor(a, "alice");
        await beginHubActor(b, "bob");
        try {
          await a.query(
            "insert into public.eggs_profiles(handle,display_name) values('same_handle','A')",
          );
          const pid = (await b.query("select pg_backend_pid() pid")).rows[0]
            .pid;
          const wait = b
            .query(
              "insert into public.eggs_profiles(handle,display_name) values('same_handle','B')",
            )
            .then(
              () => null,
              (e) => e.code,
            );
          await lockWait(db, pid);
          await a.query("commit");
          assert.equal(await wait, "23505");
        } finally {
          await a.query("rollback");
          await b.query("rollback");
          await a.end();
          await b.end();
        }
        await hubActor(db, "alice", (c) =>
          c.query(
            "delete from public.eggs_profiles where id=eggs_private.current_profile_id()",
          ),
        );
        await rejected(create(db, "bob", "same_handle"), "23505");
      },
    );
    let last;
    for (const [i, scenario] of [
      "same player",
      "same profile",
      "same claim",
      "rollback winner",
    ].entries())
      await t.test(
        "claim approvals contend safely after rooms migration: " + scenario,
        async () => {
          await db.admin.query("delete from public.eggs_profiles");
          const alice = await create(db, "alice", "claim_alice_" + i);
          await create(db, "bob", "claim_bob_" + i);
          const first = await claim(db, "alice", id(1)),
            second =
              scenario === "same claim"
                ? first
                : await claim(
                    db,
                    scenario === "same profile" ? "alice" : "bob",
                    scenario === "same profile" ? id(2) : id(1),
                  );
          const a = await db.connect(),
            b = await db.connect();
          await beginHubActor(a, "operator");
          await beginHubActor(b, "operator");
          try {
            await review(a, first);
            const pid = (await b.query("select pg_backend_pid() pid")).rows[0]
              .pid;
            const wait = review(b, second).then(
              (value) => ({ value }),
              (error) => ({ error }),
            );
            await lockWait(db, pid);
            await a.query(
              scenario === "rollback winner" ? "rollback" : "commit",
            );
            const result = await wait;
            if (["same player", "same profile"].includes(scenario)) {
              assert.equal(result.error?.code, "23505");
              await b.query("rollback");
              assert.equal(
                (
                  await db.admin.query(
                    "select status from public.para_poker_player_claims where id=$1",
                    [second],
                  )
                ).rows[0].status,
                "pending",
              );
            } else {
              assert.equal(result.error, undefined);
              await b.query("commit");
            }
            assert.equal(
              (
                await db.admin.query(
                  "select count(*)::int n from public.para_poker_profile_links",
                )
              ).rows[0].n,
              1,
            );
          } finally {
            await a.query("rollback");
            await b.query("rollback");
            await a.end();
            await b.end();
          }
          assert.deepEqual(await fingerprint(db), before);
          last = { alice, first };
        },
      );
    await t.test(
      "withdrawal, summary opt-in, deletion and durable reviews preserve Poker records",
      async () => {
        await hubActor(db, "alice", (c) =>
          c.query("select public.withdraw_para_poker_claim($1)", [last.first]),
        );
        const own = (
          await hubActor(db, "bob", (c) =>
            c.query("select * from public.get_my_eggs_profile()"),
          )
        ).rows[0];
        const room = (
          await hubActor(db, "bob", (c) =>
            c.query("select public.get_my_eggs_room() r"),
          )
        ).rows[0].r;
        const { editableRoom } = await import("../src/lib/rooms/core.mjs");
        const value = editableRoom(room);
        value.profile.visibility = "public";
        await hubActor(db, "bob", (c) =>
          c.query("select public.save_my_eggs_room(0,$1)", [value]),
        );
        assert.equal(
          (
            await hubActor(
              db,
              "alice",
              (c) =>
                c.query("select * from public.para_poker_public_profile_links"),
              "anon",
            )
          ).rowCount,
          0,
        );
        await hubActor(db, "bob", (c) =>
          c.query(
            "update public.para_poker_profile_links set show_on_profile=true where profile_id=$1",
            [own.id],
          ),
        );
        assert.equal(
          (
            await hubActor(
              db,
              "alice",
              (c) =>
                c.query("select * from public.para_poker_public_profile_links"),
              "anon",
            )
          ).rowCount,
          1,
        );
        await db.admin.query("delete from auth.users where id=$1", [
          hubIds.bob,
        ]);
        assert.equal(
          (
            await db.admin.query(
              "select count(*)::int n from public.para_poker_profile_links",
            )
          ).rows[0].n,
          0,
        );
        const durable = (
          await db.admin.query(
            "select evidence_note,review_note,claimant_profile_id from public.para_poker_player_claims where status='approved' and claimant_profile_id is null",
          )
        ).rows;
        assert.ok(durable.length);
        assert.ok(
          durable.every(
            (x) =>
              x.evidence_note === "Durable local evidence" &&
              x.review_note === "Local operator review",
          ),
        );
        assert.deepEqual(await fingerprint(db), before);
      },
    );
  },
);
