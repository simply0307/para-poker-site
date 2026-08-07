import { supabase } from "@/lib/supabase";
import { getArticleVideoAttachment, getArticleVideoAttachments } from "@/lib/newsroom/articleVideoAttachments";
import { isMissingSchemaFieldError } from "@/lib/newsroom/schemaCompatibility";
import { safeQuery } from "./sessionRepository";

function text(value, fallback = "") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

async function staleAwareQuery(queryFactory, fallback) {
  const { data, error } = await queryFactory(true);
  if (!error) return data;
  if (!isMissingSchemaFieldError(error, "is_stale")) return fallback;
  return safeQuery(queryFactory(false), fallback);
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

async function withArticleVideo(article) {
  if (!article?.id) return article;
  return {
    ...article,
    video: await getArticleVideoAttachment(article.id),
  };
}

async function withArticleVideos(articles = []) {
  const videoMap = await getArticleVideoAttachments(articles.map((article) => article.id));
  return articles.map((article) => ({
    ...article,
    video: videoMap[article.id] || null,
  }));
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

  const row = await staleAwareQuery((enforceStaleness) => {
    let query = supabase
      .from("recap_drafts")
      .select("*")
      .eq("scope", scope)
      .eq("visibility", "published");
    if (enforceStaleness) query = query.eq("is_stale", false);
    if (sourceSessionId) query = query.eq("source_session_id", sourceSessionId);
    if (sourcePlayerId) query = query.eq("source_player_id", sourcePlayerId);
    return query.order("published_at", { ascending: false }).limit(1).maybeSingle();
  }, null);
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
  if (draftRows?.length) return withArticleVideos(draftRows.map((row) => normalizedArticleDraft(row, "article_drafts")));

  const bridgeRows = await staleAwareQuery((enforceStaleness) => {
    let query = supabase
      .from("published_articles")
      .select("*")
      .is("unpublished_at", null);
    if (enforceStaleness) query = query.eq("is_stale", false);
    return query.order("published_at", { ascending: false });
  }, []);
  if (bridgeRows?.length) return withArticleVideos(bridgeRows.map((row) => normalizedArticleDraft(row, "published_articles")));

  const recapRows = await staleAwareQuery((enforceStaleness) => {
    let query = supabase
      .from("recap_drafts")
      .select("*")
      .eq("scope", "article")
      .eq("visibility", "published");
    if (enforceStaleness) query = query.eq("is_stale", false);
    return query.order("published_at", { ascending: false });
  }, []);
  return withArticleVideos((recapRows || []).map((row) => normalizedArticleDraft(row, "recap_drafts")));
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
  if (articleDraftById) return withArticleVideo(normalizedArticleDraft(articleDraftById, "article_drafts"));

  const articleDraftBySlug = await safeQuery(
    supabase
      .from("article_drafts")
      .select("*")
      .eq("article_request->>slug", key)
      .eq("visibility", "published")
      .maybeSingle(),
    null
  );
  if (articleDraftBySlug) return withArticleVideo(normalizedArticleDraft(articleDraftBySlug, "article_drafts"));

  const bridgeById = await staleAwareQuery((enforceStaleness) => {
    let query = supabase
      .from("published_articles")
      .select("*")
      .eq("id", key)
      .is("unpublished_at", null);
    if (enforceStaleness) query = query.eq("is_stale", false);
    return query.maybeSingle();
  }, null);
  if (bridgeById) return withArticleVideo(normalizedArticleDraft(bridgeById, "published_articles"));

  const bridgeBySlug = await staleAwareQuery((enforceStaleness) => {
    let query = supabase
      .from("published_articles")
      .select("*")
      .eq("slug", key)
      .is("unpublished_at", null);
    if (enforceStaleness) query = query.eq("is_stale", false);
    return query.maybeSingle();
  }, null);
  if (bridgeBySlug) return withArticleVideo(normalizedArticleDraft(bridgeBySlug, "published_articles"));

  const recapById = await staleAwareQuery((enforceStaleness) => {
    let query = supabase
      .from("recap_drafts")
      .select("*")
      .eq("id", key)
      .eq("scope", "article")
      .eq("visibility", "published");
    if (enforceStaleness) query = query.eq("is_stale", false);
    return query.maybeSingle();
  }, null);
  if (recapById) return withArticleVideo(normalizedArticleDraft(recapById, "recap_drafts"));

  const recapBySlug = await staleAwareQuery((enforceStaleness) => {
    let query = supabase
      .from("recap_drafts")
      .select("*")
      .eq("article_request->>slug", key)
      .eq("scope", "article")
      .eq("visibility", "published");
    if (enforceStaleness) query = query.eq("is_stale", false);
    return query.maybeSingle();
  }, null);
  return withArticleVideo(normalizedArticleDraft(recapBySlug, "recap_drafts"));
}
