import { NextResponse } from "next/server";
import { previewRawHandImport } from "@/lib/imports/rawHandImportRepository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const preview = previewRawHandImport(body);
    return NextResponse.json({ preview });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Could not preview raw hand history." }, { status: 400 });
  }
}
