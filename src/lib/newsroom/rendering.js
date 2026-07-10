export const waitingCopy =
  "No published recap yet.";

export function draftHeadline(row, fallback = "Para League") {
  const draft = row?.draft || {};
  return draft.headline || draft.title || fallback;
}

export function draftSubheadline(row) {
  const draft = row?.draft || {};
  return draft.subheadline || draft.dek || draft.short_summary || "";
}

export function draftBody(row) {
  const draft = row?.draft || {};
  return draft.recap_body || draft.profile_body || draft.article_body || draft.long_body || draft.body || "";
}

export function draftParagraphs(row) {
  return draftBody(row)
    .split(/\n{2,}/u)
    .map((item) => item.trim())
    .filter(Boolean);
}
