import { NextResponse } from "next/server";
import { deleteImportedSession, updateImportedSession } from "@/lib/imports/rawHandImportRepository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request, { params }) {
  try {
    const { sessionId } = await params;
    const body = await request.json().catch(() => ({}));
    const session = await updateImportedSession(sessionId, body);
    return NextResponse.json({ session });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Could not update imported session." }, { status: 400 });
  }
}

export async function DELETE(_request, { params }) {
  try {
    const { sessionId } = await params;
    const result = await deleteImportedSession(sessionId);
    return NextResponse.json({ result });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Could not delete imported session." }, { status: 400 });
  }
}
