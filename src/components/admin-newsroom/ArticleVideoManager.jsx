"use client";

import { useMemo, useState } from "react";

function bytesLabel(value) {
  const size = Number(value || 0);
  if (!Number.isFinite(size) || size <= 0) return "";
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

export function ArticleVideoManager({ articles = [] }) {
  const firstId = articles.find((article) => article.id)?.id || "";
  const [selectedId, setSelectedId] = useState(firstId);
  const [videos, setVideos] = useState(() => Object.fromEntries(articles.map((article) => [article.id, article.video || null])));
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const selectedArticle = useMemo(() => articles.find((article) => article.id === selectedId) || articles[0] || null, [articles, selectedId]);
  const selectedVideo = videos[selectedId] || null;
  const selectedVideoSize = bytesLabel(selectedVideo?.size);

  async function uploadVideo() {
    if (!selectedId || !file) {
      setError("Choose an article and a video file first.");
      return;
    }

    const formData = new FormData();
    formData.append("video", file);
    setBusy("upload");
    setMessage("");
    setError("");

    const response = await fetch(`/api/admin/articles/${encodeURIComponent(selectedId)}/video`, {
      method: "POST",
      body: formData,
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(result.error || "Video upload failed.");
      setBusy("");
      return;
    }

    setVideos((current) => ({ ...current, [selectedId]: result.video || null }));
    setFile(null);
    setMessage("Video attached to article.");
    setBusy("");
  }

  async function removeVideo() {
    if (!selectedId) return;
    const confirmed = window.confirm("Remove this article video? The stored video file will be deleted.");
    if (!confirmed) return;

    setBusy("remove");
    setMessage("");
    setError("");

    const response = await fetch(`/api/admin/articles/${encodeURIComponent(selectedId)}/video`, {
      method: "DELETE",
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(result.error || "Video removal failed.");
      setBusy("");
      return;
    }

    setVideos((current) => ({ ...current, [selectedId]: null }));
    setMessage("Video removed from article.");
    setBusy("");
  }

  if (!articles.length) return null;

  return (
    <section className="rounded-lg border border-zinc-300 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">Article video</p>
          <h2 className="text-2xl font-black">Attach video to live coverage</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
            Upload, replace, or remove video attached to a published article. Public article pages can surface the video; only admin can change it.
          </p>
        </div>
        <p className="text-sm font-bold text-zinc-500">{articles.filter((article) => videos[article.id]).length} attached</p>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-3">
          <label className="grid gap-2">
            <span className="text-sm font-black">Article</span>
            <select
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-bold"
              value={selectedId}
              onChange={(event) => {
                setSelectedId(event.target.value);
                setFile(null);
                setMessage("");
                setError("");
              }}
            >
              {articles.map((article) => (
                <option key={article.id} value={article.id}>
                  {article.label}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-black">Video file</span>
            <input
              type="file"
              accept="video/*"
              className="rounded-md border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
            />
          </label>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={uploadVideo}
              disabled={Boolean(busy) || !file || !selectedId}
              className="rounded-md bg-zinc-950 px-4 py-3 font-black text-white disabled:opacity-50"
            >
              {busy === "upload" ? "Uploading..." : selectedVideo ? "Replace Video" : "Upload Video"}
            </button>
            <button
              type="button"
              onClick={removeVideo}
              disabled={Boolean(busy) || !selectedVideo}
              className="rounded-md border border-red-300 px-4 py-3 font-black text-red-700 disabled:opacity-50"
            >
              {busy === "remove" ? "Removing..." : "Remove Video"}
            </button>
          </div>

          {selectedArticle ? (
            <div className="rounded-md bg-zinc-100 p-3 text-sm leading-6 text-zinc-700">
              <strong className="text-zinc-950">{selectedArticle.label}</strong>
              {selectedArticle.description ? <p>{selectedArticle.description}</p> : null}
              {selectedVideo ? (
                <p className="mt-2 font-bold">
                  Attached: {selectedVideo.filename}
                  {selectedVideoSize ? ` / ${selectedVideoSize}` : ""}
                </p>
              ) : (
                <p className="mt-2 font-bold">No video attached yet.</p>
              )}
            </div>
          ) : null}
        </div>

        <div className="rounded-md border border-zinc-200 bg-zinc-950 p-3 text-white">
          {selectedVideo?.signed_url ? (
            <video key={selectedVideo.signed_url} controls playsInline className="aspect-video w-full rounded-sm bg-black" src={selectedVideo.signed_url} />
          ) : (
            <div className="grid aspect-video place-items-center rounded-sm border border-white/10 bg-black text-center text-sm font-bold text-zinc-400">
              No video preview
            </div>
          )}
        </div>
      </div>

      {message ? <p className="mt-4 rounded-md bg-green-100 p-3 font-bold text-green-800">{message}</p> : null}
      {error ? <p className="mt-4 rounded-md bg-red-100 p-3 font-bold text-red-800">{error}</p> : null}
    </section>
  );
}
