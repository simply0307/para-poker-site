import { NextResponse } from "next/server";
import { requireOperator } from "@/lib/auth/operatorAuthorization";
import { commitGauntletMatch } from "@/modules/para-poker/lib/imports/gauntletMatchImportRepository";
import { parseRawHandCommitBody } from "@/modules/para-poker/lib/imports/rawHandCommitContract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  const authorization = await requireOperator(request);
  if (!authorization.ok) return authorization.response;
  try {
    const body = await request.json().catch(() => ({}));
    const result = await commitGauntletMatch(parseRawHandCommitBody(body));
    return NextResponse.json({ result });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Could not commit the Gauntlet match.", details: error.details || null },
      { status: error.status || (error instanceof TypeError ? 400 : 500) }
    );
  }
}
