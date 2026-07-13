import { NextResponse } from "next/server";
import { DATASET_SPLITS } from "@/lib/newsroom/trainingConstants";
import { listExportableTrainingExamples, trainingMessagesForExample } from "@/lib/newsroom/trainingExamples";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorized(message = "Unauthorized.") {
  return NextResponse.json({ error: message }, { status: 401 });
}

function authorized(request) {
  const token = process.env.NEWSROOM_DATASET_EXPORT_TOKEN;
  if (!token) return { ok: false, response: NextResponse.json({ error: "NEWSROOM_DATASET_EXPORT_TOKEN is not configured." }, { status: 503 }) };
  const header = request.headers.get("authorization") || "";
  return header === `Bearer ${token}` ? { ok: true } : { ok: false, response: unauthorized() };
}

export async function GET(request) {
  const auth = authorized(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const split = searchParams.get("split") || "";
  if (split && !DATASET_SPLITS.includes(split)) {
    return NextResponse.json({ error: "split must be train, development, or test." }, { status: 400 });
  }

  const examples = await listExportableTrainingExamples({ split });
  const rows = examples.map(trainingMessagesForExample);
  const body = rows.map((row) => JSON.stringify(row)).join("\n");
  const filename = `para-poker-newsroom-${split || "all"}-${new Date().toISOString().slice(0, 10)}.jsonl`;

  return new Response(body ? `${body}\n` : "", {
    status: 200,
    headers: {
      "Content-Type": "application/jsonl; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
