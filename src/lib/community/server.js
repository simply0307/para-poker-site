import "server-only";
import { publicConsumerClient } from "../eggs/consumerClient";
import { communityEnabled, peopleOptions } from "./core.mjs";
import { communityRepository } from "./repository.mjs";
export async function publicFeed(options = {}) {
  const empty = { posts: [], next_cursor: null, unavailable: true };
  if (!communityEnabled()) return empty;
  const client = publicConsumerClient();
  if (!client) return empty;
  try {
    return {
      ...(await communityRepository(client).feed(options)),
      unavailable: false,
    };
  } catch {
    return empty;
  }
}
export async function publicPost(id) {
  if (!communityEnabled()) return null;
  const client = publicConsumerClient();
  if (!client) return null;
  try {
    return await communityRepository(client).post(id);
  } catch {
    return null;
  }
}
export async function publicPeople({ query = "", after = null } = {}) {
  const empty = { people: [], next_cursor: null, unavailable: true };
  if (!communityEnabled()) return empty;
  const client = publicConsumerClient();
  if (!client) return empty;
  try {
    const params = new URLSearchParams({ q: query });
    if (after) params.set("after", after);
    return {
      ...(await communityRepository(client).people(peopleOptions(params))),
      unavailable: false,
    };
  } catch {
    return empty;
  }
}
