import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getMomentNewsroomData, text } from "@/lib/newsroom/data";
import { createDataOverride } from "@/lib/newsroom/dataOverrides";
import {
  ensureMomentVideoBucket,
  getMomentVideoAttachment,
  MOMENT_VIDEO_BUCKET,
  MOMENT_VIDEO_FIELD_PATH,
  normalizeMomentVideo,
} from "@/lib/newsroom/momentVideoAttachments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_VIDEO_BYTES = 250 * 1024 * 1024;

function safeFilename(value = "moment-video") {
  return String(value || "moment-video")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96) || "moment-video";
}

function extensionFor(file = {}) {
  const name = safeFilename(file.name || "");
  const extension = name.includes(".") ? name.split(".").pop() : "";
  if (extension) return extension;
  if (file.type === "video/webm") return "webm";
  if (file.type === "video/quicktime") return "mov";
  return "mp4";
}

async function removeStoredVideo(video) {
  const normalized = normalizeMomentVideo(video);
  if (!normalized?.storage_path) return;
  await supabase.storage.from(normalized.bucket || MOMENT_VIDEO_BUCKET).remove([normalized.storage_path]);
}

export async function POST(request, { params }) {
  try {
    const { momentId } = await params;
    const sourceId = text(momentId).trim();
    const momentData = await getMomentNewsroomData(sourceId);
    if (!sourceId || !momentData?.moment) {
      return NextResponse.json({ error: "Moment not found." }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get("video");
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "Upload a video file." }, { status: 400 });
    }
    if (!String(file.type || "").startsWith("video/")) {
      return NextResponse.json({ error: "Only video files are supported." }, { status: 400 });
    }
    if (file.size > MAX_VIDEO_BYTES) {
      return NextResponse.json({ error: "Video is larger than the 250 MB admin upload limit." }, { status: 413 });
    }

    await ensureMomentVideoBucket();
    const existing = await getMomentVideoAttachment(sourceId);
    const filename = safeFilename(file.name || `moment-${sourceId}.${extensionFor(file)}`);
    const storagePath = `moments/${safeFilename(sourceId)}/${Date.now()}-${filename}`;

    const { error: uploadError } = await supabase.storage.from(MOMENT_VIDEO_BUCKET).upload(storagePath, file, {
      contentType: file.type || "video/mp4",
      upsert: false,
    });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message || "Video upload failed." }, { status: 500 });
    }

    await removeStoredVideo(existing);

    const video = {
      bucket: MOMENT_VIDEO_BUCKET,
      storage_path: storagePath,
      filename,
      content_type: file.type || "video/mp4",
      size: file.size,
      uploaded_at: new Date().toISOString(),
    };

    await createDataOverride({
      scope: "moment",
      source_id: sourceId,
      field_path: MOMENT_VIDEO_FIELD_PATH,
      value: video,
      reason: "Admin moment video attachment",
      created_by: "admin",
    });

    const signedVideo = await getMomentVideoAttachment(sourceId);
    return NextResponse.json({ video: signedVideo });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Could not upload moment video." }, { status: 500 });
  }
}

export async function DELETE(_request, { params }) {
  try {
    const { momentId } = await params;
    const sourceId = text(momentId).trim();
    const existing = await getMomentVideoAttachment(sourceId);
    await removeStoredVideo(existing);

    await createDataOverride({
      scope: "moment",
      source_id: sourceId,
      field_path: MOMENT_VIDEO_FIELD_PATH,
      value: null,
      reason: "Admin removed moment video attachment",
      created_by: "admin",
    });

    return NextResponse.json({ video: null, removed: true });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Could not remove moment video." }, { status: 500 });
  }
}
