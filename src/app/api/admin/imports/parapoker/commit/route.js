import { NextResponse } from "next/server";
import { commitCompletedSessionPackage } from "@/lib/imports/parapokerPackageImporter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const result = await commitCompletedSessionPackage(body);
    return NextResponse.json({ result });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Could not commit ParaPoker package." }, { status: 400 });
  }
}
