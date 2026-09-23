import { NextResponse } from "next/server";
import { requireOperator } from "@/modules/para-poker/lib/auth/operatorAuthorization";
import { commitEggsSessionImport } from "@/modules/para-poker/lib/imports/eggsSessionImportRepository";
import { parseRawHandCommitBody } from "@/modules/para-poker/lib/imports/rawHandCommitContract";

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
