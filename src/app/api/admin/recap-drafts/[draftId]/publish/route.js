import { NextResponse } from "next/server";
import { setDraftPublishState } from "@/lib/newsroom/drafts";

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

    const draft = await setDraftPublishState(draftId, {
      publish: action === "publish",
      approvedBy: typeof body.approvedBy === "string" ? body.approvedBy : "admin",
    });

    return NextResponse.json({ draft });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not change publish state.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
