import { NextResponse } from "next/server";
import { createDataOverride, readDataOverrides } from "@/lib/newsroom/dataOverrides";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const overrides = await readDataOverrides();
  return NextResponse.json({ overrides });
}

export async function POST(request) {
  try {
    const payload = await request.json();
    const overrides = await createDataOverride(payload);
    return NextResponse.json({ overrides });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Could not save data override." }, { status: 400 });
  }
}
