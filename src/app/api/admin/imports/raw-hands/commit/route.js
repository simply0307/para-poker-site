import { NextResponse } from "next/server";
import { commitRawHandImport } from "@/lib/imports/rawHandImportRepository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const result = await commitRawHandImport(body);
    return NextResponse.json({ result });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Could not commit raw hand history." }, { status: 400 });
  }
}
