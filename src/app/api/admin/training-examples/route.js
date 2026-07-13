import { NextResponse } from "next/server";
import {
  bulkAssignDatasetSplitsBySession,
  getTrainingExampleForDraft,
  updateTrainingExampleForDraft,
  updateTrainingExampleReview,
} from "@/lib/newsroom/trainingExamples";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const draftTable = searchParams.get("draftTable") || "recap_drafts";
  const draftId = searchParams.get("draftId") || "";
  if (!draftId) return NextResponse.json({ example: null });
  const example = await getTrainingExampleForDraft(draftTable, draftId);
  return NextResponse.json({ example });
}

export async function PATCH(request) {
  try {
    const body = await request.json().catch(() => ({}));
    if (body.exampleId) {
      const example = await updateTrainingExampleReview({
        id: body.exampleId,
        captureStatus: body.captureStatus,
      });
      return NextResponse.json({ example });
    }
    if (!body.draftId) return NextResponse.json({ error: "draftId is required." }, { status: 400 });
    const example = await updateTrainingExampleForDraft(body.draftTable || "recap_drafts", body.draftId, body.training || body);
    return NextResponse.json({ example });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Could not update training example." }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    if (body.action !== "bulk_assign_splits_by_session") {
      return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
    }
    const result = await bulkAssignDatasetSplitsBySession();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error.message || "Could not update dataset splits." }, { status: 500 });
  }
}
