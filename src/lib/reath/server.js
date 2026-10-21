import "server-only";
import { publicWorks } from "../rooms/server";
import { reathPublications } from "./catalog.mjs";
import { mergeReathCatalog } from "./releases.mjs";

export async function publicReathCatalog() {
  const { works, unavailable } = await publicWorks();
  const publications = mergeReathCatalog(reathPublications(works));
  return { publications, unavailable: unavailable && publications.length === 0 };
}
