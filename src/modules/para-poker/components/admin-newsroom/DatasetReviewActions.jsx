"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DatasetReviewActions({ exampleId, currentStatus = "undecided" }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function setStatus(captureStatus) {
    setBusy(captureStatus);
    setError("");
    const response = await fetch("/api/admin/training-examples", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ exampleId, captureStatus }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(payload.error || "Could not update review status.");
      setBusy("");
      return;
    }
    setBusy("");
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {["undecided", "included", "excluded"].map((status) => (
        <button
          key={status}
          type="button"
          onClick={() => setStatus(status)}
          disabled={Boolean(busy)}
          className={`rounded-md border px-3 py-2 text-xs font-black uppercase tracking-wide ${
            currentStatus === status
              ? "border-zinc-950 bg-zinc-950 text-white"
              : "border-zinc-300 bg-white text-zinc-700 hover:border-amber-600"
          } disabled:opacity-50`}
        >
          {busy === status ? "Saving..." : status}
        </button>
      ))}
      {error ? <p className="basis-full text-sm font-bold text-red-700">{error}</p> : null}
    </div>
  );
}

export function BulkSplitActions() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function assignSplits() {
    setBusy(true);
    setMessage("");
    setError("");
    const response = await fetch("/api/admin/training-examples", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "bulk_assign_splits_by_session" }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(payload.error || "Could not assign splits.");
      setBusy(false);
      return;
    }
    setMessage(`Assigned ${payload.updated || 0} examples across ${payload.sessions || 0} session groups.`);
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="rounded-lg border border-zinc-300 bg-white p-4 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">Advanced export prep</p>
      <h2 className="mt-1 text-xl font-black">Bulk split by source session</h2>
      <p className="mt-2 text-sm leading-6 text-zinc-600">
        Assigns train, development, and test splits only for included examples with final published output.
        All artifacts from the same source session stay in the same split.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={assignSplits}
          disabled={busy}
          className="rounded-md bg-zinc-950 px-4 py-3 text-sm font-black text-white disabled:opacity-50"
        >
          {busy ? "Assigning..." : "Assign splits by session"}
        </button>
        <a
          href="/api/admin/newsroom/dataset/export?split=train"
          className="rounded-md border border-zinc-300 px-4 py-3 text-sm font-black text-zinc-800"
        >
          Export train JSONL
        </a>
      </div>
      {message ? <p className="mt-3 text-sm font-bold text-green-700">{message}</p> : null}
      {error ? <p className="mt-3 text-sm font-bold text-red-700">{error}</p> : null}
      <p className="mt-3 text-xs leading-5 text-zinc-500">
        JSONL export requires the advanced server token <code>NEWSROOM_DATASET_EXPORT_TOKEN</code>.
        This is not needed for everyday recap publishing.
      </p>
    </div>
  );
}
