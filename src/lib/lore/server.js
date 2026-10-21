import "server-only";
import { publicLoreClient } from "./publicClient";
import { loreEnabled } from "./core.mjs";
import { loreRepository } from "./repository.mjs";
import { publicLore } from "./presentation.mjs";
export async function publicDossiers() {
  if (!loreEnabled()) return { entries: [], unavailable: true };
  const client = publicLoreClient();
  if (!client) return { entries: [], unavailable: true };
  try {
    return {
      entries: publicLore(await loreRepository(client).published()),
      unavailable: false,
    };
  } catch {
    return { entries: [], unavailable: true };
  }
}
