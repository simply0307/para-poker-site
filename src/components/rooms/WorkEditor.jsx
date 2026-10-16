"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { accountFetch } from "@/components/eggs/accountFetch";
import { workAssets } from "@/lib/rooms/registry.mjs";
const empty = {
  title: "",
  summary: "",
  description: "",
  asset_id: "signal-grid",
  project_id: null,
};
export function WorkEditor({ work, projects }) {
  const [content, setContent] = useState(work?.content || empty),
    [slug, setSlug] = useState(work?.slug || ""),
    [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const router = useRouter();
  const update = (key, v) => {
    setContent((c) => ({ ...c, [key]: v }));
    setDirty(true);
  };
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { work: saved } = await accountFetch("/api/eggs/hub/works", {
        method: "POST",
        body: {
          id: work?.id || null,
          slug,
          content,
          version: work?.version || 0,
          action: "save",
        },
      });
      setDirty(false);
      router.replace("/eggs-admin/works/" + saved.id);
      router.refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <form className="eggs-form hub-editor-form" onSubmit={save}>
        <label>
          Work title
          <input
            required
            maxLength={80}
            value={content.title}
            onChange={(e) => update("title", e.target.value)}
          />
        </label>
        <label>
          Permanent slug
          <input
            required
            minLength={3}
            maxLength={64}
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            readOnly={Boolean(work)}
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              setDirty(true);
            }}
          />
        </label>
        <label>
          Summary
          <textarea
            required
            maxLength={240}
            value={content.summary}
            onChange={(e) => update("summary", e.target.value)}
          />
        </label>
        <label>
          Description
          <textarea
            required
            maxLength={3000}
            rows={6}
            value={content.description}
            onChange={(e) => update("description", e.target.value)}
          />
        </label>
        <label>
          Registered visual
          <select
            value={content.asset_id}
            onChange={(e) => update("asset_id", e.target.value)}
          >
            {Object.entries(workAssets).map(([id, a]) => (
              <option key={id} value={id}>
                {a.title}
              </option>
            ))}
          </select>
        </label>
        <p className="eggs-help">
          These original EGGS designs have recorded source, attribution and
          site-use permission. Publication checks the registry again.
        </p>
        <label>
          Associated project (optional)
          <select
            value={content.project_id || ""}
            onChange={(e) => update("project_id", e.target.value || null)}
          >
            <option value="">No association</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.content.title}
              </option>
            ))}
            {content.project_id &&
            !projects.some((p) => p.id === content.project_id) ? (
              <option value={content.project_id}>
                Unavailable — remove or replace before saving
              </option>
            ) : null}
          </select>
        </label>
        {error ? <p role="alert">{error}</p> : null}
        <button className="eggs-button" disabled={busy}>
          {busy ? "Saving…" : "Save work draft"}
        </button>
      </form>
      {work ? (
        <div className="hub-preview-action">
          {dirty ? (
            <p>Save before previewing.</p>
          ) : (
            <Link
              className="eggs-button"
              href={"/eggs-admin/works/" + work.id + "/preview"}
            >
              Preview saved revision {work.version} ↗
            </Link>
          )}
        </div>
      ) : null}
    </>
  );
}
export function WorkPublication({ work, action }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [done, setDone] = useState(false);
  const router = useRouter();
  async function submit() {
    setBusy(true);
    try {
      await accountFetch("/api/eggs/hub/works", {
        method: "POST",
        body: { id: work.id, slug: work.slug, version: work.version, action },
      });
      setDone(true);
      router.refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      {done ? (
        <p role="status">
          {action === "publish"
            ? "This saved work is published."
            : "This work is archived."}
        </p>
      ) : (
        <button className="eggs-button" onClick={submit} disabled={busy}>
          {busy
            ? "Updating…"
            : action === "publish"
              ? "Publish this saved work"
              : "Archive work"}
        </button>
      )}
      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}
