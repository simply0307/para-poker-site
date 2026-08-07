import { NextResponse } from "next/server";
import { requireOperator } from "@/lib/auth/operatorAuthorization";
import { commitEggsSessionImport } from "@/lib/imports/eggsSessionImportRepository";
import { parseRawHandCommitBody } from "@/lib/imports/rawHandCommitContract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  const authorization = await requireOperator(request);
  if (!authorization.ok) return authorization.response;
  try {
    const body = await request.json().catch(() => ({}));
    const result = await commitEggsSessionImport(parseRawHandCommitBody(body));
    return NextResponse.json({ result });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Could not commit the EGGS package.", details: error.details || null },
      { status: error.status || (error instanceof TypeError ? 400 : 500) }
    );
  }
}
