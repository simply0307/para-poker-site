import { NextResponse } from "next/server";
import { publicLoreClient } from "@/lib/lore/publicClient";
import { loreEnabled } from "@/lib/lore/core.mjs";
import { loreRepository } from "@/lib/lore/repository.mjs";
import {
  publicLore,
  dossierKinds,
  loreSlug,
} from "@/lib/lore/presentation.mjs";
export async function GET(request) {
  const options = { headers: { "Cache-Control": "no-store" } };
  if (!loreEnabled())
    return NextResponse.json(
      { error: "Lore is not open yet." },
      { ...options, status: 503 },
    );
  const params = new URL(request.url).searchParams;
  if (
    [...params.keys()].some(
      (key) => !["world", "kind", "slug"].includes(key),
    ) ||
    ["world", "slug"].some(
      (key) => params.has(key) && !loreSlug(params.get(key)),
    ) ||
    (params.has("kind") &&
      !["world", ...Object.keys(dossierKinds)].includes(params.get("kind")))
  )
    return NextResponse.json(
      { error: "Check the dossier filters." },
      { ...options, status: 400 },
    );
  const client = publicLoreClient();
  if (!client)
    return NextResponse.json(
      { error: "The archive is unavailable." },
      { ...options, status: 503 },
    );
  try {
    const entries = publicLore(await loreRepository(client).published()).filter(
      (row) =>
        ["world", "kind", "slug"].every(
          (key) => !params.has(key) || row[key] === params.get(key),
        ),
    );
    return NextResponse.json({ entries }, options);
  } catch {
    return NextResponse.json(
      { error: "The archive is unavailable." },
      { ...options, status: 503 },
    );
  }
}
