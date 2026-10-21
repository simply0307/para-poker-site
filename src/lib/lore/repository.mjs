import { ConsumerError, databaseError } from "../eggs/consumerCore.mjs";
function result({ data, error }) {
  if (error) {
    if (["40001", "PT409", "23505"].includes(error.code))
      throw new ConsumerError(
        409,
        "This dossier changed. Reload its saved revision before continuing.",
      );
    if (error.code === "PT404")
      throw new ConsumerError(404, "This dossier or world is unavailable.");
    throw databaseError(error);
  }
  return data;
}
export function loreRepository(client) {
  return {
    published: async () =>
      result(
        await client
          .from("eggs_lore")
          .select("id,world,kind,slug,content,version,published_at")
          .order("world")
          .order("kind")
          .order("slug"),
      ) || [],
    drafts: async () =>
      result(
        await client
          .from("eggs_lore_drafts")
          .select("id,world,kind,slug,content,state,version,updated_at")
          .order("updated_at", { ascending: false })
          .limit(200),
      ) || [],
    draft: async (id) =>
      result(
        await client
          .from("eggs_lore_drafts")
          .select("id,world,kind,slug,content,state,version,updated_at")
          .eq("id", id)
          .maybeSingle(),
      ),
    save: async (command) =>
      result(await client.rpc("save_eggs_lore", command)),
    audit: async (id) =>
      result(await client.rpc("eggs_lore_audit", { p_id: id })) || [],
  };
}
