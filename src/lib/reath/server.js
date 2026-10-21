import "server-only";
import { publicWorks } from "../rooms/server";
import { reathPublications } from "./catalog.mjs";

export async function publicReathCatalog() {
  const { works, unavailable } = await publicWorks();
  return { publications: reathPublications(works), unavailable };
}
