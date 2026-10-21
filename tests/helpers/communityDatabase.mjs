import fs from "node:fs";
import { roomsDatabase } from "./roomsDatabase.mjs";
export const communityMigration = fs.readFileSync(
  "supabase/migrations/20261021013054_eggs_community_feed.sql",
  "utf8",
);
export async function communityDatabase(t) {
  const db = await roomsDatabase(t);
  await db.admin.query(communityMigration);
  return db;
}
