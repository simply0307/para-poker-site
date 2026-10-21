import fs from "node:fs";
import path from "node:path";
import { loreHttpFixture } from "../tests/helpers/loreHttpFixture.mjs";
import { seedCommunityPreview } from "../tests/helpers/communityPreviewSeed.mjs";
import { seedLorePreview } from "../tests/helpers/lorePreviewSeed.mjs";
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
  const fixture = await loreHttpFixture({ after: (fn) => cleanup.push(fn) });
  await seedCommunityPreview(fixture.db);
  const privateReviewFile = path.resolve(".reference/lore-source-review.json");
  const source = await seedLorePreview(fixture.db, {
    ...(fs.existsSync(privateReviewFile) ? { privateReviewFile } : {}),
  });
  const app = await startConsumerApp(
    {
      ...fixture.env,
      EGGS_LOCAL_PREVIEW_AUTH: "true",
      EGGS_LOCAL_PREVIEW_AUTH_INBOX_URL: fixture.previewInboxUrl,
    },
    3114,
  );
  cleanup.push(() => stopConsumerApp(app));
  console.log("EGGS local preview: " + app.base);
  console.log(
    "Synthetic Auth + disposable PG17/PostgREST. Public Carrd/YouTube reading copies retain their real sources.",
  );
  console.log("Sample login: alice@fixture.invalid / fixture-password");
  console.log("Publisher review: publisher@fixture.invalid / fixture-password");
  console.log("Local signup confirmation inbox: " + fixture.previewInboxUrl);
  console.log(JSON.stringify(source));
  console.log("No hosted changes. Type stop to close this disposable preview.");
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (value) => {
    if (value.trim() === "stop") void stop().finally(() => process.exit(0));
  });
  process.stdin.resume();
} catch (error) {
  await stop();
  throw error;
}
