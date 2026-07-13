import { NextResponse } from "next/server";
import { previewCompletedSessionPackage } from "@/lib/imports/parapokerPackageImporter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const preview = await previewCompletedSessionPackage(body);
    return NextResponse.json({ preview });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Could not preview ParaPoker package." }, { status: 400 });
  }
}
