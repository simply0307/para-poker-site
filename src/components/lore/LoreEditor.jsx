"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { accountFetch } from "@/components/eggs/accountFetch";
import { dossierKinds } from "@/lib/lore/presentation.mjs";
const initial = {
  title: "",
  summary: "",
  body: "",
  continuity_note:
    "Working lore reference. Publication does not change the world's governing continuity.",
  attribution: "",
  permission: "unreviewed",
  source_reviewed: false,
  public_source: "",
  internal_source: "",
  project_id: null,
};
export function LoreEditor({ entry, worlds, projects }) {
  const [content, setContent] = useState(entry?.content || initial),
    [world, setWorld] = useState(entry?.world || ""),
    [kind, setKind] = useState(entry?.kind || "world"),
    [slug, setSlug] = useState(entry?.slug || ""),
    [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false),
    [error, setError] = useState("");
  const router = useRouter();
  const update = (field, value) => {
    setContent((current) => ({ ...current, [field]: value }));
    setDirty(true);
  };
  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await accountFetch("/api/eggs/hub/lore", {
        method: "POST",
        body: {
          id: entry?.id || null,
          world,
          kind,
          slug,
          content,
          version: entry?.version || 0,
          action: "save",
        },
      });
      setDirty(false);
      router.replace("/eggs-admin/lore/" + result.entry.id);
      router.refresh();
    } catch (problem) {
      setError(problem.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <form className="eggs-form hub-editor-form" onSubmit={save}>
        <label>
          Dossier type
          <select
            value={kind}
            disabled={Boolean(entry)}
            onChange={(event) => {
              setKind(event.target.value);
              update("project_id", null);
              if (event.target.value === "world") setWorld(slug);
            }}
          >
            <option value="world">World overview</option>
            {Object.entries(dossierKinds).map(([key, info]) => (
              <option key={key} value={key}>
                {info.singular}
              </option>
            ))}
          </select>
        </label>
        <label>
          Permanent slug
          <input
            required
            minLength={3}
            maxLength={64}
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            readOnly={Boolean(entry)}
            value={slug}
            onChange={(event) => {
              setSlug(event.target.value);
              if (kind === "world") setWorld(event.target.value);
              setDirty(true);
            }}
          />
        </label>
        {kind === "world" ? (
          <p className="eggs-help">
            This world uses /lore/{slug || "your-world"}. Its slug is permanent.
          </p>
        ) : (
          <label>
            World
            <select
              required
              disabled={Boolean(entry)}
              value={world}
              onChange={(event) => {
                setWorld(event.target.value);
                setDirty(true);
              }}
            >
              <option value="">Choose a released world</option>
              {worlds.map((item) => (
                <option key={item.id} value={item.world}>
                  {item.content.title}
                </option>
              ))}
              {world && !worlds.some((item) => item.world === world) ? (
                <option value={world}>Unavailable world — {world}</option>
              ) : null}
            </select>
          </label>
        )}
        <label>
          Dossier title
          <input
            required
            maxLength={120}
            value={content.title}
            onChange={(event) => update("title", event.target.value)}
          />
        </label>
        <label>
          Summary
          <textarea
            required
            maxLength={300}
            value={content.summary}
            onChange={(event) => update("summary", event.target.value)}
          />
        </label>
        <label>
          Dossier text
          <textarea
            required
            rows={16}
            maxLength={20000}
            value={content.body}
            onChange={(event) => update("body", event.target.value)}
          />
          <span className="eggs-help">
            Plain text and paragraphs. HTML, scripts and embedded media are
            never rendered.
          </span>
        </label>
        <label>
          Continuity &amp; scope note
          <textarea
            required
            maxLength={160}
            value={content.continuity_note}
            onChange={(event) => update("continuity_note", event.target.value)}
          />
          <span className="eggs-help">
            State the world and whether this is a working reference or in-world
            fiction. Publishing a dossier does not approve or change canon.
          </span>
        </label>
        <label>
          Public creator/source credit
          <input
            required
            maxLength={300}
            value={content.attribution}
            onChange={(event) => update("attribution", event.target.value)}
          />
        </label>
        <label>
          Public source link (optional)
          <input
            type="url"
            maxLength={500}
            value={content.public_source}
            onChange={(event) => update("public_source", event.target.value)}
          />
          <span className="eggs-help">
            A public HTTPS citation. Keep internal Drive and editorial evidence
            below.
          </span>
        </label>
        <label>
          Private source/review record
          <textarea
            maxLength={2000}
            value={content.internal_source}
            onChange={(event) => update("internal_source", event.target.value)}
          />
          <span className="eggs-help">
            Visible to editors only. Excluded from every public snapshot.
          </span>
        </label>
        {kind === "world" ? (
          <label>
            Associated published project (optional)
            <select
              value={content.project_id || ""}
              onChange={(event) =>
                update("project_id", event.target.value || null)
              }
            >
              <option value="">Independent world</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.content.title}
                </option>
              ))}
              {content.project_id &&
              !projects.some((project) => project.id === content.project_id) ? (
                <option value={content.project_id}>
                  Unavailable project — remove before release
                </option>
              ) : null}
            </select>
          </label>
        ) : null}
        <label>
          Text permission
          <select
            value={content.permission}
            onChange={(event) => update("permission", event.target.value)}
          >
            <option value="unreviewed">Unreviewed / reference only</option>
            <option value="site-public">Cleared for public site use</option>
          </select>
        </label>
        <label className="eggs-checkbox">
          <input
            type="checkbox"
            checked={content.source_reviewed}
            onChange={(event) =>
              update("source_reviewed", event.target.checked)
            }
          />{" "}
          Source, creator credit and intended public use have been reviewed.
        </label>
        {error ? <p role="alert">{error}</p> : null}
        <button className="eggs-button" disabled={busy}>
          {busy ? "Saving…" : "Save dossier draft"}
        </button>
      </form>
      {entry ? (
        <div className="hub-preview-action">
          {dirty ? (
            <p>Save before previewing.</p>
          ) : (
            <Link
              className="eggs-button"
              href={"/eggs-admin/lore/" + entry.id + "/preview"}
            >
              Preview saved revision {entry.version} ↗
            </Link>
          )}
        </div>
      ) : null}
    </>
  );
}
export function LorePublication({ entry, action }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [done, setDone] = useState(false);
  const router = useRouter();
  async function submit() {
    setBusy(true);
    setError("");
    try {
      await accountFetch("/api/eggs/hub/lore", {
        method: "POST",
        body: {
          id: entry.id,
          world: entry.world,
          kind: entry.kind,
          slug: entry.slug,
          version: entry.version,
          action,
        },
      });
      setDone(true);
      router.refresh();
    } catch (problem) {
      setError(problem.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      {done ? (
        <p role="status">
          {action === "publish"
            ? "This saved dossier is published."
            : "This dossier is archived."}
        </p>
      ) : (
        <button className="eggs-button" disabled={busy} onClick={submit}>
          {busy
            ? "Updating…"
            : action === "publish"
              ? "Publish this saved dossier"
              : "Archive dossier"}
        </button>
      )}
      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}
