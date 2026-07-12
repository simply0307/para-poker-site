import { supabase } from "@/lib/supabase";
import { safeQuery } from "./sessionRepository";

function text(value, fallback = "") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function normalizedArticleDraft(row, source = "article_drafts") {
  if (!row) return null;
  const body = row.body || row.draft || {};
  const request = row.article_request || {};
  const publishedAt = row.published_at || request.displayDate || request.display_date || row.generated_at || row.created_at || null;
  return {
    ...row,
    _published_source: source,
    body,
    title: row.title || body.headline || body.title || "Published Para League article",
    slug: row.slug || request.slug || row.id,
    scope: row.scope || "article",
    author: body.author || body.byline || request.authorName || request.author_name || "Para League Desk",
    display_date: request.displayDate || request.display_date || publishedAt,
    published_at: publishedAt,
  };
}

export async function getPublishedDraft({ scope, sourceSessionId, sourcePlayerId }) {
  if (scope === "player" && sourcePlayerId) {
    const row = await safeQuery(
      supabase
        .from("profile_drafts")
        .select("*")
        .eq("player_id", sourcePlayerId)
        .eq("visibility", "published")
        .order("published_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      null
    );
    if (row) return { ...row, _draft_table: "profile_drafts" };
  }

  if (scope === "season") {
    const row = await safeQuery(
      supabase
        .from("standings_drafts")
        .select("*")
        .eq("visibility", "published")
        .order("published_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      null
    );
    if (row) return { ...row, _draft_table: "standings_drafts" };
  }

  if (scope === "moment") {
    const row = await safeQuery(
      supabase
        .from("moment_blurb_drafts")
        .select("*")
        .eq("visibility", "published")
        .order("published_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      null
    );
    if (row) return { ...row, _draft_table: "moment_blurb_drafts" };
  }

  let query = supabase
    .from("recap_drafts")
    .select("*")
    .eq("scope", scope)
    .eq("visibility", "published")
    .order("published_at", { ascending: false })
    .limit(1);

  if (sourceSessionId) query = query.eq("source_session_id", sourceSessionId);
  if (sourcePlayerId) query = query.eq("source_player_id", sourcePlayerId);

  const row = await safeQuery(query.maybeSingle(), null);
  return row ? { ...row, _draft_table: "recap_drafts" } : null;
}

export async function getPublishedArticlesIndex() {
  const draftRows = await safeQuery(
    supabase
      .from("article_drafts")
      .select("*")
      .eq("visibility", "published")
      .order("published_at", { ascending: false }),
    []
  );
  if (draftRows?.length) return draftRows.map((row) => normalizedArticleDraft(row, "article_drafts"));

  const bridgeRows = await safeQuery(
    supabase
      .from("published_articles")
      .select("*")
      .is("unpublished_at", null)
      .order("published_at", { ascending: false }),
    []
  );
  if (bridgeRows?.length) return bridgeRows.map((row) => normalizedArticleDraft(row, "published_articles"));

  const recapRows = await safeQuery(
    supabase
      .from("recap_drafts")
      .select("*")
      .eq("scope", "article")
      .eq("visibility", "published")
      .order("published_at", { ascending: false }),
    []
  );
  return (recapRows || []).map((row) => normalizedArticleDraft(row, "recap_drafts"));
}

export async function getPublishedArticle(articleIdOrSlug) {
  const key = text(articleIdOrSlug).trim();
  if (!key) return null;

  const articleDraftById = await safeQuery(
    supabase
      .from("article_drafts")
      .select("*")
      .eq("id", key)
      .eq("visibility", "published")
      .maybeSingle(),
    null
  );
  if (articleDraftById) return normalizedArticleDraft(articleDraftById, "article_drafts");

  const articleDraftBySlug = await safeQuery(
    supabase
      .from("article_drafts")
      .select("*")
      .eq("article_request->>slug", key)
      .eq("visibility", "published")
      .maybeSingle(),
    null
  );
  if (articleDraftBySlug) return normalizedArticleDraft(articleDraftBySlug, "article_drafts");

  const bridgeById = await safeQuery(
    supabase
      .from("published_articles")
      .select("*")
      .eq("id", key)
      .is("unpublished_at", null)
      .maybeSingle(),
    null
  );
  if (bridgeById) return normalizedArticleDraft(bridgeById, "published_articles");

  const bridgeBySlug = await safeQuery(
    supabase
      .from("published_articles")
      .select("*")
      .eq("slug", key)
      .is("unpublished_at", null)
      .maybeSingle(),
    null
  );
  if (bridgeBySlug) return normalizedArticleDraft(bridgeBySlug, "published_articles");

  const recapById = await safeQuery(
    supabase
      .from("recap_drafts")
      .select("*")
      .eq("id", key)
      .eq("scope", "article")
      .eq("visibility", "published")
      .maybeSingle(),
    null
  );
  if (recapById) return normalizedArticleDraft(recapById, "recap_drafts");

  const recapBySlug = await safeQuery(
    supabase
      .from("recap_drafts")
      .select("*")
      .eq("article_request->>slug", key)
      .eq("scope", "article")
      .eq("visibility", "published")
      .maybeSingle(),
    null
  );
  return normalizedArticleDraft(recapBySlug, "recap_drafts");
}
