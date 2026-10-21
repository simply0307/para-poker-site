import { communityHttpFixture } from "./communityHttpFixture.mjs";
import { loreDatabase } from "./loreDatabase.mjs";
export async function loreHttpFixture(t) {
  const fixture = await communityHttpFixture(t, { database: loreDatabase });
  return { ...fixture, env: { ...fixture.env, EGGS_LORE_ENABLED: "true" } };
}
