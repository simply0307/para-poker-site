import { NextResponse } from "next/server";
import { updateDraft } from "@/lib/newsroom/drafts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request, { params }) {
  try {
    const { draftId } = await params;
    const body = await request.json().catch(() => ({}));

    if (!draftId) {
      return NextResponse.json({ error: "draftId is required." }, { status: 400 });
    }

    if (!body.draft || typeof body.draft !== "object") {
      return NextResponse.json({ error: "draft object is required." }, { status: 400 });
    }

    const table = typeof body.table === "string" ? body.table : "recap_drafts";
    const draft = await updateDraft(table, draftId, {
      draft: body.draft,
      status: body.status,
      visibility: body.visibility,
    });

    return NextResponse.json({ draft });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update draft.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
