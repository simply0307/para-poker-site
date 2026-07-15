import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { createDataOverride } from "@/lib/newsroom/dataOverrides";
import { getPublishedArticle } from "@/lib/newsroom/repositories/draftRepository";
import {
  ARTICLE_VIDEO_BUCKET,
  ARTICLE_VIDEO_FIELD_PATH,
  ensureArticleVideoBucket,
  getArticleVideoAttachment,
  normalizeArticleVideo,
} from "@/lib/newsroom/articleVideoAttachments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_VIDEO_BYTES = 500 * 1024 * 1024;

function text(value, fallback = "") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function safeFilename(value = "article-video") {
  return String(value || "article-video")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96) || "article-video";
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
  const normalized = normalizeArticleVideo(video);
  if (!normalized?.storage_path) return;
  await supabase.storage.from(normalized.bucket || ARTICLE_VIDEO_BUCKET).remove([normalized.storage_path]);
}

export async function POST(request, { params }) {
  try {
    const { articleId } = await params;
    const sourceId = text(articleId).trim();
    const article = await getPublishedArticle(sourceId);
    if (!sourceId || !article) {
      return NextResponse.json({ error: "Article not found." }, { status: 404 });
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
      return NextResponse.json({ error: "Video is larger than the 500 MB admin upload limit." }, { status: 413 });
    }

    await ensureArticleVideoBucket();
    const existing = await getArticleVideoAttachment(sourceId);
    const filename = safeFilename(file.name || `article-${sourceId}.${extensionFor(file)}`);
    const storagePath = `articles/${safeFilename(sourceId)}/${Date.now()}-${filename}`;

    const { error: uploadError } = await supabase.storage.from(ARTICLE_VIDEO_BUCKET).upload(storagePath, file, {
      contentType: file.type || "video/mp4",
      upsert: false,
    });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message || "Video upload failed." }, { status: 500 });
    }

    await removeStoredVideo(existing);

    const video = {
      bucket: ARTICLE_VIDEO_BUCKET,
      storage_path: storagePath,
      filename,
      content_type: file.type || "video/mp4",
      size: file.size,
      uploaded_at: new Date().toISOString(),
    };

    await createDataOverride({
      scope: "article",
      source_id: sourceId,
      field_path: ARTICLE_VIDEO_FIELD_PATH,
      value: video,
      reason: "Admin article video attachment",
      created_by: "admin",
    });

    const signedVideo = await getArticleVideoAttachment(sourceId);
    return NextResponse.json({ video: signedVideo });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Could not upload article video." }, { status: 500 });
  }
}

export async function DELETE(_request, { params }) {
  try {
    const { articleId } = await params;
    const sourceId = text(articleId).trim();
    const existing = await getArticleVideoAttachment(sourceId);
    await removeStoredVideo(existing);

    await createDataOverride({
      scope: "article",
      source_id: sourceId,
      field_path: ARTICLE_VIDEO_FIELD_PATH,
      value: null,
      reason: "Admin removed article video attachment",
      created_by: "admin",
    });

    return NextResponse.json({ video: null, removed: true });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Could not remove article video." }, { status: 500 });
  }
}
