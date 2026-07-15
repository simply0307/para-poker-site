import { supabase } from "@/lib/supabase";
import { readActiveDataOverrides } from "@/lib/newsroom/applyDataOverrides";

export const ARTICLE_VIDEO_FIELD_PATH = "media.video";
export const ARTICLE_VIDEO_BUCKET = process.env.SUPABASE_ARTICLE_VIDEO_BUCKET || "para-league-article-videos";

export function normalizeArticleVideo(value) {
  if (!value || typeof value !== "object") return null;
  if (!value.storage_path) return null;

  return {
    bucket: value.bucket || ARTICLE_VIDEO_BUCKET,
    storage_path: value.storage_path,
    filename: value.filename || "article-video",
    content_type: value.content_type || "video/mp4",
    size: Number(value.size || 0),
    uploaded_at: value.uploaded_at || "",
    signed_url: value.signed_url || "",
  };
}

export function findArticleVideoOverride(overrides = [], sourceId = "") {
  return (overrides || []).find(
    (override) =>
      override.scope === "article" &&
      override.source_id === sourceId &&
      override.field_path === ARTICLE_VIDEO_FIELD_PATH &&
      override.status !== "deleted"
  );
}

export async function signArticleVideo(video, expiresIn = 3600) {
  const normalized = normalizeArticleVideo(video);
  if (!normalized) return null;

  const { data, error } = await supabase.storage
    .from(normalized.bucket)
    .createSignedUrl(normalized.storage_path, expiresIn);

  return {
    ...normalized,
    signed_url: error ? "" : data?.signedUrl || "",
  };
}

export async function getArticleVideoAttachment(sourceId = "") {
  const overrides = await readActiveDataOverrides();
  const row = findArticleVideoOverride(overrides, sourceId);
  return signArticleVideo(row?.value || null);
}

export async function getArticleVideoAttachments(sourceIds = []) {
  const overrides = await readActiveDataOverrides();
  const uniqueIds = [...new Set(sourceIds.map((id) => String(id || "").trim()).filter(Boolean))];
  const entries = await Promise.all(
    uniqueIds.map(async (sourceId) => {
      const row = findArticleVideoOverride(overrides, sourceId);
      const video = await signArticleVideo(row?.value || null);
      return [sourceId, video];
    })
  );

  return Object.fromEntries(entries);
}

export async function ensureArticleVideoBucket() {
  const { data } = await supabase.storage.listBuckets();
  const exists = (data || []).some((bucket) => bucket.name === ARTICLE_VIDEO_BUCKET);
  if (exists) return;

  const { error } = await supabase.storage.createBucket(ARTICLE_VIDEO_BUCKET, {
    public: false,
  });

  if (error && !/already exists/i.test(error.message || "")) {
    throw error;
  }
}
