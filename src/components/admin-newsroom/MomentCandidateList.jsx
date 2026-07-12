"use client";

import Link from "next/link";
import { useState } from "react";

export function MomentCandidateList({ moments = [] }) {
  const [copied, setCopied] = useState("");

  async function copyMomentId(momentId) {
    try {
      await navigator.clipboard.writeText(momentId);
      setCopied(momentId);
    } catch {
      setCopied("");
    }
  }

  return (
    <section className="rounded-lg border border-zinc-300 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">Detected candidates</p>
          <h2 className="text-2xl font-black">Moment candidates</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
            Detected moments are candidate archive entries. Generate and publish a blurb to make one official public copy.
          </p>
        </div>
        <p className="text-sm font-bold text-zinc-500">{moments.length} detected</p>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="text-xs font-black uppercase tracking-[0.12em] text-zinc-500">
            <tr>
              <th className="border-b border-zinc-200 px-3 py-2">Moment ID</th>
              <th className="border-b border-zinc-200 px-3 py-2">Hand</th>
              <th className="border-b border-zinc-200 px-3 py-2">Winner</th>
              <th className="border-b border-zinc-200 px-3 py-2">Pot</th>
              <th className="border-b border-zinc-200 px-3 py-2">Session</th>
              <th className="border-b border-zinc-200 px-3 py-2">Why detected</th>
              <th className="border-b border-zinc-200 px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {moments.slice(0, 16).map((moment) => (
              <tr key={moment.momentId} className="border-b border-zinc-100 align-top last:border-0">
                <td className="px-3 py-3 font-mono text-xs">{moment.momentId}</td>
                <td className="px-3 py-3 font-black">{moment.hand_no ? `#${moment.hand_no}` : "-"}</td>
                <td className="px-3 py-3">{moment.playerName}</td>
                <td className="px-3 py-3">{moment.potText || "-"}</td>
                <td className="px-3 py-3">{moment.sessionCode || "-"}</td>
                <td className="px-3 py-3 text-zinc-600">{moment.detectionReason || moment.typeLabels.join(", ")}</td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => copyMomentId(moment.momentId)}
                      className="rounded-sm bg-zinc-950 px-2 py-1 text-xs font-black text-white"
                    >
                      {copied === moment.momentId ? "Copied" : "Copy ID"}
                    </button>
                    <Link href={moment.detailHref} className="rounded-sm border border-zinc-300 px-2 py-1 text-xs font-black text-zinc-700">
                      Detail
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
