import { hasRichTextMarkup, sanitizeRichText } from "@/lib/newsroom/richText";
import { stripPlayerHandlesFromText } from "@/lib/playerNames";

export const waitingCopy =
  "No published recap yet.";

export function draftHeadline(row, fallback = "Para League") {
  const draft = row?.draft || {};
  return stripPlayerHandlesFromText(draft.headline || draft.title || fallback);
}

export function draftSubheadline(row) {
  const draft = row?.draft || {};
  return stripPlayerHandlesFromText(draft.subheadline || draft.dek || draft.short_summary || "");
}

export function draftBody(row) {
  const draft = row?.draft || {};
  return stripPlayerHandlesFromText(draft.recap_body || draft.profile_body || draft.article_body || draft.long_body || draft.body || "");
}

export function draftParagraphs(row) {
  const body = draftBody(row);
  if (hasRichTextMarkup(body)) return [];
  return body
    .split(/\n{2,}/u)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function draftHtml(row) {
  const body = draftBody(row);
  return hasRichTextMarkup(body) ? sanitizeRichText(body) : "";
}
