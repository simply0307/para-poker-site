import { NextResponse } from "next/server";
import { setDraftPublishStateForTable } from "@/lib/newsroom/drafts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request, { params }) {
  try {
    const { draftId } = await params;
    const body = await request.json().catch(() => ({}));
    const action = body.action === "unpublish" ? "unpublish" : "publish";

    if (!draftId) {
      return NextResponse.json({ error: "draftId is required." }, { status: 400 });
    }

    const table = typeof body.table === "string" ? body.table : "recap_drafts";
    const draft = await setDraftPublishStateForTable(table, draftId, {
      publish: action === "publish",
      approvedBy: typeof body.approvedBy === "string" ? body.approvedBy : "admin",
    });

    return NextResponse.json({ draft, warnings: draft._publish_warnings || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not change publish state.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
