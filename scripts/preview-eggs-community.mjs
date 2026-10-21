// Disposable loopback preview: native PostgreSQL/PostgREST and simulated Auth.
import { communityHttpFixture } from "../tests/helpers/communityHttpFixture.mjs";
import { seedCommunityPreview } from "../tests/helpers/communityPreviewSeed.mjs";
import {
  startConsumerApp,
  stopConsumerApp,
} from "../tests/helpers/consumerHttpFixture.mjs";

const cleanup = [];
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  for (const fn of cleanup.reverse()) await fn();
}
process.on("SIGINT", () => void stop().finally(() => process.exit(0)));
process.on("SIGTERM", () => void stop().finally(() => process.exit(0)));
try {
  const fixture = await communityHttpFixture({
    after: (fn) => cleanup.push(fn),
  });
  await seedCommunityPreview(fixture.db);
  const app = await startConsumerApp({ ...fixture.env, EGGS_LOCAL_PREVIEW_AUTH: "true", EGGS_LOCAL_PREVIEW_AUTH_INBOX_URL: fixture.previewInboxUrl }, 3114);
  cleanup.push(() => stopConsumerApp(app));
  console.log("EGGS local community preview: " + app.base);
  console.log(
    "Real disposable PostgreSQL 17 and PostgREST; simulated authentication.",
  );
  console.log("Synthetic login: alice@fixture.invalid / fixture-password");
  console.log("Local confirmation inbox: " + fixture.previewInboxUrl);
  console.log(
    "Publisher/editor/Bob use the same fixture password. No community posts are seeded.",
  );
  console.log(
    "No hosted data or services are used. Type stop to clean up and close.",
  );
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (value) => {
    if (value.trim() === "stop") void stop().finally(() => process.exit(0));
  });
  process.stdin.resume();
} catch (error) {
  await stop();
  throw error;
}
