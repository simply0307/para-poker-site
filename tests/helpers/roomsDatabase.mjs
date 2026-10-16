import fs from "node:fs";
import { hubDatabase } from "./hubDatabase.mjs";
export const roomMigration = fs.readFileSync(
  "supabase/migrations/20261016080147_eggs_personal_internet.sql",
  "utf8",
);
export async function roomsDatabase(t) {
  const db = await hubDatabase(t);
  await db.apply();
  await db.admin.query(roomMigration);
  return db;
}
