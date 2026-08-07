import { NextResponse } from "next/server";
import { commitRawHandImport } from "@/lib/imports/rawHandImportRepository";
import { parseRawHandCommitBody } from "@/lib/imports/rawHandCommitContract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const result = await commitRawHandImport(parseRawHandCommitBody(body));
    return NextResponse.json({ result });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Could not commit raw hand history.", details: error.details || null },
      { status: error.status || (error instanceof TypeError ? 400 : 500) }
    );
  }
}
