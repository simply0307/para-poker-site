import { NextResponse } from "next/server";
import { requireOperator } from "@/lib/auth/operatorAuthorization";
import { deleteImportedSession, updateImportedSession } from "@/lib/imports/rawHandImportRepository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request, { params }) {
  const authorization = await requireOperator(request);
  if (!authorization.ok) return authorization.response;
  try {
    const { sessionId } = await params;
    const body = await request.json().catch(() => ({}));
    const session = await updateImportedSession(sessionId, body);
    return NextResponse.json({ session });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Could not update imported session." }, { status: error.status || 400 });
  }
}

export async function DELETE(_request, { params }) {
  const authorization = await requireOperator(_request);
  if (!authorization.ok) return authorization.response;
  try {
    const { sessionId } = await params;
    const result = await deleteImportedSession(sessionId);
    return NextResponse.json({ result });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Could not delete imported session." }, { status: error.status || 400 });
  }
}
