"use client";

import { Children, useMemo, useState } from "react";

function uniqueOptions(items = [], getter) {
  return [...new Set(items.flatMap((item) => {
    const value = getter(item);
    return Array.isArray(value) ? value : [value];
  }).map((value) => String(value || "").trim()).filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function includesText(item = {}, query = "") {
  if (!query) return true;
  return String(item.searchText || "").includes(query.toLowerCase());
}

function sortedItems(items = [], sortMode = "pot_desc") {
  return [...items].sort((left, right) => {
    if (sortMode === "pot_asc") return Number(left.potSort || 0) - Number(right.potSort || 0) || Number(left.handNo || 0) - Number(right.handNo || 0);
    if (sortMode === "hand_asc") return Number(left.handNo || 0) - Number(right.handNo || 0);
    if (sortMode === "hand_desc") return Number(right.handNo || 0) - Number(left.handNo || 0);
    if (sortMode === "session_asc") return String(left.session || "").localeCompare(String(right.session || "")) || Number(left.handNo || 0) - Number(right.handNo || 0);
    if (sortMode === "session_desc") return String(right.session || "").localeCompare(String(left.session || "")) || Number(left.handNo || 0) - Number(right.handNo || 0);
    return Number(right.potSort || 0) - Number(left.potSort || 0) || Number(left.handNo || 0) - Number(right.handNo || 0);
  });
}

export function FilterableEvidenceArchive({
  children,
  items = [],
  label = "items",
  maxHeightClass = "max-h-[42rem]",
  defaultSort = "pot_desc",
}) {
  const childArray = Children.toArray(children);
  const [query, setQuery] = useState("");
  const [session, setSession] = useState("");
  const [position, setPosition] = useState("");
  const [winner, setWinner] = useState("");
  const [handType, setHandType] = useState("");
  const [sortMode, setSortMode] = useState(defaultSort);
  const sessions = useMemo(() => uniqueOptions(items, (item) => item.session), [items]);
  const positions = useMemo(() => uniqueOptions(items, (item) => item.positions || []), [items]);
  const winners = useMemo(() => uniqueOptions(items, (item) => item.winner), [items]);
  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return sortedItems(
      items.filter((item) => {
        if (!includesText(item, normalizedQuery)) return false;
        if (session && item.session !== session) return false;
        if (position && !(item.positions || []).includes(position)) return false;
        if (winner && item.winner !== winner) return false;
        if (handType === "showdown" && !item.showdown) return false;
        if (handType === "action" && !item.hasAction) return false;
        return true;
      }),
      sortMode
    );
  }, [handType, items, position, query, session, sortMode, winner]);

  function resetFilters() {
    setQuery("");
    setSession("");
    setPosition("");
    setWinner("");
    setHandType("");
    setSortMode(defaultSort);
  }

  return (
    <div className="rounded-md border border-white/10 bg-black/20">
      <div className="border-b border-white/10 p-3">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-black uppercase tracking-[0.14em] text-stone-500">
          <span>Filterable archive</span>
          <span>{filteredItems.length} of {items.length} {label}</span>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-5">
          <label className="xl:col-span-2">
            <span className="sr-only">Search hands</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search hand, player, board, action..."
              className="w-full rounded-md border border-white/10 bg-stone-950/80 px-3 py-2 text-sm text-stone-100 placeholder:text-stone-500"
            />
          </label>
          <Select label="Sort" value={sortMode} onChange={setSortMode} options={[
            ["pot_desc", "Pot size high-low"],
            ["pot_asc", "Pot size low-high"],
            ["hand_asc", "Hand number low-high"],
            ["hand_desc", "Hand number high-low"],
            ["session_desc", "Session newest"],
            ["session_asc", "Session oldest"],
          ]} />
          {sessions.length > 1 ? <Select label="Session" value={session} onChange={setSession} options={sessions.map((value) => [value, value])} includeAll="All sessions" /> : null}
          {positions.length ? <Select label="Position" value={position} onChange={setPosition} options={positions.map((value) => [value, value])} includeAll="All positions" /> : null}
          {winners.length > 1 ? <Select label="Winner" value={winner} onChange={setWinner} options={winners.map((value) => [value, value])} includeAll="All winners" /> : null}
          <Select label="Type" value={handType} onChange={setHandType} options={[
            ["showdown", "Showdown"],
            ["action", "Full action"],
          ]} includeAll="All hands" />
        </div>
        {(query || session || position || winner || handType || sortMode !== defaultSort) ? (
          <button type="button" onClick={resetFilters} className="mt-3 rounded-sm border border-white/10 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-amber-200 hover:border-amber-300/50">
            Reset filters
          </button>
        ) : null}
      </div>
      <div className={`${maxHeightClass} overflow-y-auto overscroll-contain p-3 pr-2`}>
        {filteredItems.length ? (
          <div className="grid gap-4">
            {filteredItems.map((item) => childArray[item.index]).filter(Boolean)}
          </div>
        ) : (
          <p className="rounded-md border border-white/10 bg-white/[0.03] p-4 text-sm font-bold text-stone-400">
            No hands match those filters.
          </p>
        )}
      </div>
    </div>
  );
}

function Select({ label, value, onChange, options = [], includeAll = "" }) {
  return (
    <label>
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border border-white/10 bg-stone-950/80 px-3 py-2 text-sm text-stone-100"
        title={label}
      >
        {includeAll ? <option value="">{includeAll}</option> : null}
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}
