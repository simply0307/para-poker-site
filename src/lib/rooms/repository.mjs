import { ConsumerError, databaseError } from "../eggs/consumerCore.mjs";
function result({ data, error }) {
  if (error) {
    if (["40001", "PT409"].includes(error.code))
      throw new ConsumerError(
        409,
        "This revision changed in another tab. Reload before saving.",
      );
    throw databaseError(error);
  }
  return data;
}
export function roomRepository(client) {
  return {
    mine: async () => result(await client.rpc("get_my_eggs_room")),
    publicRoom: async (handle) =>
      result(await client.rpc("get_public_eggs_room", { p_handle: handle })),
    save: async (command) =>
      result(await client.rpc("save_my_eggs_room", command)),
    works: async () =>
      result(
        await client
          .from("eggs_works")
          .select("id,slug,content,provenance,version,published_at")
          .order("slug"),
      ) || [],
    drafts: async () =>
      result(
        await client
          .from("eggs_work_drafts")
          .select("id,slug,content,state,version,updated_at")
          .order("updated_at", { ascending: false })
          .limit(100),
      ) || [],
    draft: async (id) =>
      result(
        await client
          .from("eggs_work_drafts")
          .select("id,slug,content,state,version,updated_at")
          .eq("id", id)
          .maybeSingle(),
      ),
    saveWork: async (command) =>
      result(await client.rpc("save_eggs_work", command)),
    audit: async (id) =>
      result(await client.rpc("eggs_work_audit", { p_id: id })) || [],
  };
}
