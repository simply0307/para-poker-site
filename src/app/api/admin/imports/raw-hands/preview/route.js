import { NextResponse } from "next/server";
import { persistRawHandImportPreview } from "@/lib/imports/rawHandImportRepository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const form = await request.formData();
    const uploaded = form.get("file");
    const pastedText = String(form.get("pastedText") || "");
    const hasFile = Boolean(uploaded && typeof uploaded.arrayBuffer === "function" && uploaded.size > 0);
    if (!hasFile && !pastedText) {
      return NextResponse.json({ error: "Choose a raw-hand CSV file or provide pasted fallback text." }, { status: 400 });
    }
    const sourceBytes = hasFile
      ? new Uint8Array(await uploaded.arrayBuffer())
      : new TextEncoder().encode(pastedText);
    const preview = await persistRawHandImportPreview({
      sourceBytes,
      source: {
        filename: hasFile ? uploaded.name : "pasted-hand-history.txt",
        mediaType: hasFile ? uploaded.type || "text/csv" : "text/plain",
      },
      metadata: {
        sessionCode: form.get("sessionCode"),
        seasonCode: form.get("seasonCode"),
        sessionNumber: form.get("sessionNumber"),
        tableName: form.get("tableName"),
        playedAt: form.get("playedAt"),
        format: form.get("format"),
        replaceExisting: form.get("replaceExisting") === "true",
        sourceKind: hasFile ? "csv_file" : "pasted_text",
        inputMode: hasFile ? "csv" : "raw_text",
      },
    });
    return NextResponse.json({ preview });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Could not preview raw hand history." }, { status: error.status || 400 });
  }
}
