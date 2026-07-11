import { NextResponse } from "next/server";
import { deleteDataOverride } from "@/lib/newsroom/dataOverrides";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(_request, { params }) {
  const { overrideId } = await params;
  const result = await deleteDataOverride(overrideId);
  return NextResponse.json(result);
}
