import fs from "node:fs";
import { communityDatabase } from "./communityDatabase.mjs";
export const loreMigrationPath = "supabase/migrations/20261021025603_eggs_lore_dossiers.sql";
export const loreMigration = fs.readFileSync(loreMigrationPath, "utf8");
export async function loreDatabase(t) {
  const db = await communityDatabase(t);
  await db.admin.query(loreMigration);
  return db;
}
