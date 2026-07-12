"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_ARTICLE_CONTEXT_SELECTION,
  normalizeArticleContextSelection,
} from "@/lib/newsroom/articleContextSelection";

function toggleValue(values = [], value) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function splitRefs(value) {
  return String(value || "")
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function optionId(option = {}) {
  return String(option.id || option.sessionId || option.playerId || option.momentId || "").trim();
}

function CheckboxRow({ checked, onChange, title, meta }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-md border border-zinc-200 bg-zinc-50 p-3">
      <input type="checkbox" className="mt-1" checked={checked} onChange={onChange} />
      <span>
        <span className="block font-black text-zinc-950">{title}</span>
        {meta ? <span className="mt-1 block text-xs leading-5 text-zinc-600">{meta}</span> : null}
      </span>
    </label>
  );
}

export function ArticleContextSelector({ options = {}, initialValue = {}, onChange }) {
  const initialSelection = useMemo(
    () => normalizeArticleContextSelection(initialValue.contextSelection || initialValue.context_selection || initialValue),
    [initialValue]
  );
  const [topic, setTopic] = useState(initialValue.topic || "");
  const [authorName, setAuthorName] = useState(initialValue.authorName || initialValue.author_name || "Para League Desk");
  const [displayDate, setDisplayDate] = useState(initialValue.displayDate || initialValue.display_date || new Date().toISOString().slice(0, 10));
  const [selection, setSelection] = useState(initialSelection);
  const [handRefsText, setHandRefsText] = useState(initialSelection.handRefs.join("\n"));
  const sessions = options.sessions || [];
  const players = options.players || [];
  const moments = options.moments || [];

  useEffect(() => {
    onChange?.({ topic, authorName, displayDate, contextSelection: selection });
  }, [topic, authorName, displayDate, selection, onChange]);

  function patchSelection(patch) {
    setSelection((current) => normalizeArticleContextSelection({ ...current, ...patch }));
  }

  return (
    <section className="rounded-lg border border-zinc-300 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">Article context</p>
          <h2 className="text-2xl font-black">Choose the evidence basket</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
            Select the sessions, players, moments, and notes the article should draw from. The model can choose the strongest angle, but it stays inside this evidence.
          </p>
        </div>
        <select
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-bold"
          value={selection.evidenceMode}
          onChange={(event) => patchSelection({ evidenceMode: event.target.value })}
        >
          <option value="selected">Selected only</option>
          <option value="selected_plus_recent">Selected + recent context</option>
          <option value="broad">Broad league context</option>
        </select>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <label className="grid gap-2">
          <span className="text-sm font-black">Topic</span>
          <input
            className="rounded-md border border-zinc-300 px-3 py-2"
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            placeholder="Example: S0-001 opener, current board, player race..."
          />
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-black">Angle</span>
          <input
            className="rounded-md border border-zinc-300 px-3 py-2"
            value={selection.angle}
            onChange={(event) => patchSelection({ angle: event.target.value })}
            placeholder="Example: the first chase line is forming"
          />
        </label>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <label className="grid gap-2">
          <span className="text-sm font-black">Author</span>
          <input
            className="rounded-md border border-zinc-300 px-3 py-2"
            value={authorName}
            onChange={(event) => setAuthorName(event.target.value)}
            placeholder="Para League Desk"
          />
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-black">Article date</span>
          <input
            type="date"
            className="rounded-md border border-zinc-300 px-3 py-2"
            value={displayDate}
            onChange={(event) => setDisplayDate(event.target.value)}
          />
        </label>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <label className="flex items-center gap-2 rounded-md bg-zinc-100 p-3 text-sm font-bold">
          <input
            type="checkbox"
            checked={selection.includeStandings}
            onChange={(event) => patchSelection({ includeStandings: event.target.checked })}
          />
          Include current standings
        </label>
        <label className="flex items-center gap-2 rounded-md bg-zinc-100 p-3 text-sm font-bold">
          <input
            type="checkbox"
            checked={selection.includeRecentSessions}
            onChange={(event) => patchSelection({ includeRecentSessions: event.target.checked })}
          />
          Add recent sessions
        </label>
        <label className="flex items-center gap-2 rounded-md bg-zinc-100 p-3 text-sm font-bold">
          <input
            type="checkbox"
            checked={selection.includeTopMoments}
            onChange={(event) => patchSelection({ includeTopMoments: event.target.checked })}
          />
          Add top moments
        </label>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        <div>
          <h3 className="font-black">Sessions</h3>
          <div className="mt-2 grid max-h-72 gap-2 overflow-auto pr-1">
            {sessions.length ? sessions.map((session) => {
              const id = optionId(session);
              return (
                <CheckboxRow
                  key={id}
                  checked={selection.sessionIds.includes(id)}
                  onChange={() => patchSelection({ sessionIds: toggleValue(selection.sessionIds, id) })}
                  title={session.label || id}
                  meta={[session.date, session.handsText, session.status].filter(Boolean).join(" / ")}
                />
              );
            }) : <p className="text-sm text-zinc-500">No sessions found.</p>}
          </div>
        </div>
        <div>
          <h3 className="font-black">Players</h3>
          <div className="mt-2 grid max-h-72 gap-2 overflow-auto pr-1">
            {players.length ? players.map((player) => {
              const id = optionId(player);
              return (
                <CheckboxRow
                  key={id}
                  checked={selection.playerIds.includes(id)}
                  onChange={() => patchSelection({ playerIds: toggleValue(selection.playerIds, id) })}
                  title={player.label || id}
                  meta={[player.rankText, player.pointsText].filter(Boolean).join(" / ")}
                />
              );
            }) : <p className="text-sm text-zinc-500">No players found.</p>}
          </div>
        </div>
        <div>
          <h3 className="font-black">Moment candidates</h3>
          <div className="mt-2 grid max-h-72 gap-2 overflow-auto pr-1">
            {moments.length ? moments.map((moment) => {
              const id = optionId(moment);
              return (
                <CheckboxRow
                  key={id}
                  checked={selection.momentIds.includes(id)}
                  onChange={() => patchSelection({ momentIds: toggleValue(selection.momentIds, id) })}
                  title={moment.label || id}
                  meta={[moment.sessionCode, moment.potText, moment.reason].filter(Boolean).join(" / ")}
                />
              );
            }) : <p className="text-sm text-zinc-500">No moment candidates found.</p>}
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <label className="grid gap-2">
          <span className="text-sm font-black">Specific hand refs</span>
          <textarea
            className="min-h-28 rounded-md border border-zinc-300 p-3 font-mono text-sm"
            value={handRefsText}
            onChange={(event) => {
              setHandRefsText(event.target.value);
              patchSelection({ handRefs: splitRefs(event.target.value) });
            }}
            placeholder="S0-001#6&#10;S0-001#47"
          />
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-black">Editor notes</span>
          <textarea
            className="min-h-28 rounded-md border border-zinc-300 p-3 text-sm"
            value={selection.editorNotes}
            onChange={(event) => patchSelection({ editorNotes: event.target.value })}
            placeholder={DEFAULT_ARTICLE_CONTEXT_SELECTION.editorNotes || "Tell the writer what to emphasize or avoid for this article."}
          />
        </label>
      </div>
    </section>
  );
}
