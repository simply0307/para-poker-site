"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { accountFetch } from "@/components/eggs/accountFetch";

const faces = { egg: "◒", orbit: "◎", flower: "✿", spark: "✦" };
const date = (value) =>
  new Date(value).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/New_York",
  });
function CommunityAvatar({ author }) {
  return (
    <Link
      className="community-avatar"
      data-theme={author.theme}
      href={"/profile/" + author.handle}
      aria-label={"Visit @" + author.handle}
    >
      {faces[author.avatar] || faces.egg}
    </Link>
  );
}
export function PostCard({
  post,
  session,
  onWrite,
  detail = false,
  threadId = null,
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [editing, setEditing] = useState(false),
    [body, setBody] = useState(post.body),
    [editRevision, setEditRevision] = useState(post.revision),
    [deleting, setDeleting] = useState(false),
    [reason, setReason] = useState("");
  const own = session?.profile?.id === post.author.id;
  const liked = session?.liked_post_ids?.includes(post.id);
  const canReact = session?.profile?.visibility === "public";
  const permalink =
    "/community/" +
    (threadId || post.id) +
    (threadId ? "#post-" + post.id : "");
  async function write(command) {
    setBusy(true);
    setError("");
    try {
      await onWrite({ id: post.id, ...command });
      if (command.action === "edit") setEditing(false);
      if (command.action === "delete") setDeleting(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <article
      id={"post-" + post.id}
      className="community-post"
      aria-label={"Post by @" + post.author.handle}
    >
      <header>
        <CommunityAvatar author={post.author} />
        <div>
          <Link
            className="community-author"
            href={"/profile/" + post.author.handle}
          >
            {post.author.display_name}
          </Link>
          <div>
            <Link href={"/profile/" + post.author.handle}>
              @{post.author.handle}
            </Link>
            <span aria-hidden="true"> · </span>
            {post.hidden ? (
              <time dateTime={post.created_at}>{date(post.created_at)}</time>
            ) : (
              <Link href={permalink}>
                <time dateTime={post.created_at}>{date(post.created_at)}</time>
              </Link>
            )}
            {post.revision > 1 ? (
              <span className="community-edited"> · edited</span>
            ) : null}
          </div>
        </div>
      </header>
      {editing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void write({ action: "edit", body, revision: editRevision });
          }}
        >
          <label htmlFor={"edit-" + post.id}>Edit your post</label>
          <textarea
            id={"edit-" + post.id}
            maxLength={1000}
            required
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <div className="community-actions">
            <button disabled={busy}>Save edit</button>
            <button type="button" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <p className="community-body">{post.body}</p>
      )}
      <div className="community-actions">
        {canReact ? (
          <button
            type="button"
            className="community-like"
            aria-pressed={Boolean(liked)}
            aria-label={
              (liked ? "Unlike" : "Like") + " post by @" + post.author.handle
            }
            disabled={busy}
            onClick={() => void write({ action: liked ? "unlike" : "like" })}
          >
            <span aria-hidden="true">{liked ? "♥" : "♡"}</span>{" "}
            {post.like_count}{" "}
            <span className="community-action-label">
              {Number(post.like_count) === 1 ? "like" : "likes"}
            </span>
          </button>
        ) : (
          <span className="community-count">
            ♡ {post.like_count}{" "}
            {Number(post.like_count) === 1 ? "like" : "likes"}
          </span>
        )}
        {!detail ? (
          <Link href={"/community/" + post.id}>
            {post.reply_count}{" "}
            {Number(post.reply_count) === 1 ? "reply" : "replies"} ↗
          </Link>
        ) : null}
        {own && !post.hidden ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setBody(post.body);
              setEditRevision(post.revision);
              setEditing(true);
            }}
          >
            Edit
          </button>
        ) : null}
        {own ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => setDeleting((v) => !v)}
          >
            Delete
          </button>
        ) : null}
      </div>
      {deleting ? (
        <div className="community-confirm">
          <p>
            Remove this post
            {Number(post.reply_count) > 0 ? " and its replies" : ""}?
          </p>
          <button
            disabled={busy}
            onClick={() => void write({ action: "delete" })}
          >
            Remove post
          </button>
          <button disabled={busy} onClick={() => setDeleting(false)}>
            Keep it
          </button>
        </div>
      ) : null}
      {session?.publisher ? (
        <details className="community-moderate">
          <summary>Publisher controls</summary>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void write({
                action: post.hidden ? "restore" : "hide",
                body: reason,
              });
            }}
          >
            <label htmlFor={"reason-" + post.id}>Decision reason</label>
            <input
              id={"reason-" + post.id}
              required
              maxLength={240}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <button disabled={busy}>
              {post.hidden ? "Restore post" : "Hide post"}
            </button>
          </form>
        </details>
      ) : null}
      {error ? (
        <p role="alert" className="community-error">
          {error}
        </p>
      ) : null}
    </article>
  );
}
export function CommunityFeed({
  initial,
  initialThread = null,
  moderation = false,
  author = null,
}) {
  const [data, setData] = useState(initialThread || initial),
    [session, setSession] = useState(null),
    [body, setBody] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [accountChange, setAccountChange] = useState(0);
  const authEpoch = useRef(0),
    identity = useRef(undefined);
  const applySession = useCallback((value) => {
    const id = value?.profile?.id || null;
    if (identity.current !== id) {
      identity.current = id;
      setBody("");
      setMessage("");
      setError("");
      setAccountChange((v) => v + 1);
    }
    setSession(value);
  }, []);
  const cardIdentity =
    (session?.profile?.id || "visitor") + ":" + accountChange;
  const threadId = initialThread?.post?.id;
  async function refreshSession() {
    const epoch = authEpoch.current;
    const response = await fetch("/api/eggs/community/session", {
      cache: "no-store",
    });
    const value = response.ok ? (await response.json()).session : null;
    if (epoch === authEpoch.current) applySession(value);
  }
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const sessionEpoch = authEpoch;
    const refresh = async () => {
      const request = ++authEpoch.current;
      if (moderation) setData({ posts: [] });
      try {
        const response = await fetch("/api/eggs/community/session", {
          cache: "no-store",
          signal: controller.signal,
        });
        const value = response.ok ? (await response.json()).session : null;
        if (!active || request !== authEpoch.current) return;
        applySession(value);
        if (moderation && !value?.publisher) return;
        const endpoint = moderation
          ? "/api/eggs/community/moderation"
          : threadId
            ? "/api/eggs/community/posts/" + threadId
            : "/api/eggs/community" +
              (author ? "?author=" + encodeURIComponent(author) : "");
        const updated = await fetch(endpoint, {
          cache: "no-store",
          signal: controller.signal,
        });
        const publicData = updated.ok
          ? await updated.json()
          : threadId
            ? null
            : { posts: [], unavailable: !moderation };
        if (active && request === authEpoch.current) setData(publicData);
      } catch {
        if (active && request === authEpoch.current) {
          applySession(null);
          if (moderation) setData({ posts: [] });
        }
      }
    };
    const visible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const changed = () => {
      setBody("");
      setMessage("");
      setError("");
      setAccountChange((v) => v + 1);
      void refresh();
    };
    void refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener("eggs-auth", changed);
    document.addEventListener("visibilitychange", visible);
    return () => {
      active = false;
      sessionEpoch.current++;
      controller.abort();
      window.removeEventListener("focus", refresh);
      window.removeEventListener("eggs-auth", changed);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [moderation, threadId, author, applySession]);
  async function refresh() {
    const epoch = authEpoch.current;
    if (moderation) {
      const response = await fetch("/api/eggs/community/moderation", {
        cache: "no-store",
      });
      if (!response.ok) {
        if (epoch === authEpoch.current) setData({ posts: [] });
        throw new Error(
          "The review queue is unavailable. Sign in again if your session ended.",
        );
      }
      const next = await response.json();
      if (epoch === authEpoch.current) setData(next);
      return;
    }
    const response = await fetch(
      threadId
        ? "/api/eggs/community/posts/" + threadId
        : "/api/eggs/community" +
            (author ? "?author=" + encodeURIComponent(author) : ""),
      { cache: "no-store" },
    );
    if (response.status === 404 && threadId) {
      if (epoch === authEpoch.current) setData(null);
      return;
    }
    if (!response.ok)
      throw new Error(
        "The conversation is temporarily unavailable. Try again.",
      );
    const next = await response.json();
    if (epoch === authEpoch.current) setData(next);
  }
  async function write(command) {
    await accountFetch("/api/eggs/community/post", {
      method: "POST",
      body: command,
    });
    await Promise.all([refresh(), refreshSession()]);
  }
  async function create(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const epoch = authEpoch.current;
    try {
      await write({
        action: "create",
        body,
        ...(threadId ? { parent: threadId } : {}),
      });
      if (epoch === authEpoch.current) {
        setBody("");
        setMessage(threadId ? "Your reply is up." : "Your post is up.");
      }
    } catch (e) {
      if (epoch === authEpoch.current) setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function more() {
    setBusy(true);
    setError("");
    const epoch = authEpoch.current;
    try {
      const params = new URLSearchParams(data.next_cursor);
      if (author) params.set("author", author);
      const response = await fetch("/api/eggs/community?" + params, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Couldn't load more posts. Try again.");
      const next = await response.json();
      if (epoch === authEpoch.current)
        setData((previous) => ({
          ...next,
          posts: [
            ...previous.posts,
            ...next.posts.filter(
              (p) => !previous.posts.some((x) => x.id === p.id),
            ),
          ],
        }));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const canPost = session?.profile?.visibility === "public";
  if (moderation && !session?.publisher)
    return (
      <section className="community-empty" role="status">
        <h2>Publisher sign-in required.</h2>
        <p>
          Hidden posts are only available during an authorized publisher
          session.
        </p>
        <Link href="/login">Sign in ↗</Link>
      </section>
    );
  return (
    <div className="community-grid">
      <section
        className="community-stream"
        aria-label={moderation ? "Hidden posts" : "Community conversation"}
      >
        {!moderation && data ? (
          <section className="community-composer">
            {canPost ? (
              <form onSubmit={create}>
                <div className="community-composer-title">
                  <span className="community-live-dot" aria-hidden="true" />
                  <h2>
                    {threadId
                      ? "Join the conversation."
                      : "What’s happening in your corner?"}
                  </h2>
                </div>
                <label
                  className="community-visually-hidden"
                  htmlFor="community-body"
                >
                  {threadId ? "Your reply" : "Your post"}
                </label>
                <textarea
                  id="community-body"
                  placeholder={
                    threadId
                      ? "Leave a thoughtful reply…"
                      : "A thought, a question, something you made…"
                  }
                  required
                  maxLength={1000}
                  rows={4}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
                <footer>
                  <p>
                    Public, as @{session.profile.handle}{" "}
                    <span>{body.length}/1000</span>
                  </p>
                  <button disabled={busy || !body.trim()}>
                    {busy
                      ? "Posting…"
                      : threadId
                        ? "Post reply ↗"
                        : "Post to EGGS ↗"}
                  </button>
                </footer>
              </form>
            ) : session?.profile ? (
              <>
                <h2>Your corner can join in.</h2>
                <p>
                  Community posts are public. Make your profile public before
                  posting or liking.
                </p>
                <Link href="/profile/edit">
                  Review your profile visibility ↗
                </Link>
              </>
            ) : (
              <>
                <h2>A place for our people.</h2>
                <p>
                  Share what you’re making, find a game, or start a
                  conversation.
                </p>
                <Link href={session ? "/profile" : "/login"}>
                  {session ? "Create your EGGS profile" : "Sign in to join in"}{" "}
                  ↗
                </Link>
              </>
            )}
          </section>
        ) : null}
        {message ? (
          <p className="community-notice" role="status">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="community-error" role="alert">
            {error}
          </p>
        ) : null}
        {data?.unavailable ? (
          <div className="community-empty" role="status">
            <h2>The conversation is taking a breather.</h2>
            <p>We couldn’t load the feed. Please try again.</p>
          </div>
        ) : threadId ? (
          data?.post ? (
            <>
              <PostCard
                key={data.post.id + cardIdentity}
                post={data.post}
                session={session}
                onWrite={write}
                detail
              />
              <div className="community-section-line">
                <h2>Replies</h2>
                <span>{data.replies.length}</span>
              </div>
              {data.replies.length ? (
                data.replies.map((p) => (
                  <PostCard
                    key={p.id + cardIdentity}
                    post={p}
                    session={session}
                    onWrite={write}
                    detail
                    threadId={threadId}
                  />
                ))
              ) : (
                <p className="community-empty">Be the first to reply.</p>
              )}
            </>
          ) : (
            <div className="community-empty">
              <h2>This conversation is no longer available.</h2>
              <Link href="/community">Back to the community ↗</Link>
            </div>
          )
        ) : data?.posts?.length ? (
          data.posts.map((p) => (
            <PostCard
              key={p.id + cardIdentity}
              post={p}
              session={session}
              onWrite={write}
            />
          ))
        ) : (
          <div className="community-empty">
            <span aria-hidden="true">✳</span>
            <h2>
              {moderation
                ? "The review queue is clear."
                : "Room for a first hello."}
            </h2>
            <p>
              {moderation
                ? "Hidden posts appear here for publishers while their authors remain public."
                : "When someone shares a thought, it’ll appear here. This space belongs to the people who show up."}
            </p>
          </div>
        )}
        {data?.next_cursor ? (
          <button
            className="community-load"
            disabled={busy}
            onClick={() => void more()}
          >
            {busy ? "Loading…" : "A little more conversation ↓"}
          </button>
        ) : null}
      </section>
      <aside className="community-sidebar">
        <section className="community-side-card">
          <p className="studio-kicker">EGGS / OPEN HOUSE</p>
          <h2>
            A small web.
            <br />A familiar face.
          </h2>
          <p>Games bring us here. The people make us stay.</p>
          <Link href="/people">Meet the community ↗</Link>
          <Link href="/profile/edit">Make your page yours ↗</Link>
        </section>
        <section className="community-side-card community-side-yellow">
          <h2>Keep it a good place.</h2>
          <p>
            Be curious. Give credit. Keep private information private. Make room
            for each other.
          </p>
          <p>
            Your profile visibility controls whether your posts appear here.
          </p>
          {session?.publisher ? (
            <Link href="/eggs-admin/community">Review hidden posts ↗</Link>
          ) : null}
        </section>
        <nav className="community-side-links" aria-label="Around EGGS">
          <Link href="/games">Find a game ↗</Link>
          <Link href="/reath-digest">Read Reath Digest ↗</Link>
          <Link href="/library">Something from the library ↗</Link>
        </nav>
      </aside>
    </div>
  );
}
