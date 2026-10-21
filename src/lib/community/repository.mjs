import { ConsumerError, databaseError } from "../eggs/consumerCore.mjs";
function result({ data, error }) {
  if (error?.code === "PT404")
    throw new ConsumerError(404, "This conversation is no longer available.");
  if (error?.code === "PT409" || error?.code === "40001")
    throw new ConsumerError(
      409,
      "This post changed. Reload before editing again.",
    );
  if (error?.code === "PT429")
    throw new ConsumerError(
      429,
      "You've posted quite a bit. Give the conversation a little time and try again.",
    );
  if (error) throw databaseError(error);
  return data;
}
export const communityRepository = (client) => ({
  feed: async (options = {}) =>
    result(await client.rpc("get_eggs_community", options)),
  post: async (id) =>
    result(await client.rpc("get_eggs_community_post", { p_id: id })),
  session: async () => result(await client.rpc("get_my_eggs_community")),
  write: async (command) =>
    result(await client.rpc("write_eggs_community", command)),
  people: async (options = {}) =>
    result(await client.rpc("list_eggs_people", options)),
});
