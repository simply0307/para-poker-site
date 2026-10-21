"use client";
import Link from "next/link";
import { useState } from "react";
import { accountFetch } from "@/components/eggs/accountFetch";
import { editableRoom } from "@/lib/rooms/core.mjs";
import {
  themes,
  wallpapers,
  covers,
  avatars,
  stamps,
  modules,
  defaultAppearance,
} from "@/lib/rooms/registry.mjs";
import { accents, affiliations } from "@/lib/hub/catalog.mjs";
import { RoomPresentation, previewRoom } from "./RoomPresentation";
function Choice({ label, value, choices, onChange }) {
  return (
    <label>
      {label}
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {Object.entries(choices).map(([id, name]) => (
          <option value={id} key={id}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
}
export function RoomEditor({ initialRoom, projects, works }) {
  const [saved, setSaved] = useState(initialRoom),
    [value, setValue] = useState(() => editableRoom(initialRoom)),
    [width, setWidth] = useState("desktop"),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const dirty = JSON.stringify(value) !== JSON.stringify(editableRoom(saved));
  const change = (group, key, next) => {
    setValue((v) => ({ ...v, [group]: { ...v[group], [key]: next } }));
    setMessage("");
  };
  const selectItems = [
    ...projects.map((p) => ({ type: "project", ...p })),
    ...works.map((w) => ({ type: "work", ...w })),
  ];
  const selected = value.showcase.map((x) => x.type + ":" + x.id);
  function slot(index, key) {
    setValue((v) => {
      const next = [...v.showcase];
      if (!key) next.splice(index, 1);
      else {
        const [type, id] = key.split(":");
        next[index] = { type, id };
      }
      return { ...v, showcase: next };
    });
  }
  function move(key, delta) {
    setValue((v) => {
      const order = [...v.module_order],
        index = order.indexOf(key);
      [order[index], order[index + delta]] = [
        order[index + delta],
        order[index],
      ];
      return { ...v, module_order: order };
    });
  }
  function moveSlot(index, delta) {
    setValue((v) => {
      const showcase = [...v.showcase];
      [showcase[index], showcase[index + delta]] = [
        showcase[index + delta],
        showcase[index],
      ];
      return { ...v, showcase };
    });
  }
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { room } = await accountFetch("/api/eggs/room", {
        method: "PUT",
        body: { revision: saved.revision, value },
      });
      setSaved(room);
      setValue(editableRoom(room));
      setMessage("Saved. Your page is up to date.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  async function reload() {
    setBusy(true);
    try {
      const { room } = await accountFetch("/api/eggs/room");
      setSaved(room);
      setValue(editableRoom(room));
      setError("");
      setMessage("Loaded the latest saved revision.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="room-editor-page">
      <header className="room-editor-heading">
        <div>
          <p className="eggs-eyebrow">YOUR OWN SMALL INTERNET</p>
          <h1>Edit My Page</h1>
          <p>Make a change. See it here. Save when it feels like you.</p>
        </div>
        <Link href="/profile">Account &amp; Poker connection ↗</Link>
      </header>
      <div className="room-editor-layout">
        <form className="room-controls" onSubmit={save}>
          <section>
            <h2>Your identity</h2>
            <p className="eggs-help">
              @{saved.profile.handle} · permanent handle
            </p>
            <label>
              Display name
              <input
                aria-label="Display name"
                required
                maxLength={80}
                value={value.profile.display_name}
                onChange={(e) =>
                  change("profile", "display_name", e.target.value)
                }
              />
            </label>
            <label>
              Bio
              <textarea
                aria-label="Bio"
                maxLength={500}
                rows={4}
                value={value.profile.bio}
                onChange={(e) => change("profile", "bio", e.target.value)}
              />
            </label>
            <Choice
              label="Profile visibility"
              value={value.profile.visibility}
              choices={{
                private: "Private — only you",
                public: "Public — listed on EGGS",
              }}
              onChange={(v) => change("profile", "visibility", v)}
            />
            <p className="eggs-help">Public pages appear in People and can join the community. Private pages stay out of public discovery; your editor preview remains available to you.</p>
          </section>
          <section>
            <h2>Room appearance</h2>
            {[
              ["theme", "Room theme", themes],
              ["wallpaper", "Wallpaper", wallpapers],
              ["cover", "Cover", covers],
              ["avatar", "Avatar", avatars],
              ["accent", "Accent", accents],
            ].map(([key, label, choices]) => (
              <Choice
                key={key}
                label={label}
                value={value.appearance[key]}
                choices={choices}
                onChange={(v) => change("appearance", key, v)}
              />
            ))}
            <fieldset>
              <legend>Decorative stamps</legend>
              <div className="stamp-choices">
                {Object.entries(stamps).map(([id, name]) => (
                  <label key={id}>
                    <input
                      type="checkbox"
                      checked={value.appearance.stamps.includes(id)}
                      onChange={(e) =>
                        change(
                          "appearance",
                          "stamps",
                          e.target.checked
                            ? [...value.appearance.stamps, id]
                            : value.appearance.stamps.filter((x) => x !== id),
                        )
                      }
                    />
                    <span className="room-stamp">{name}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <button
              type="button"
              className="room-secondary"
              onClick={() =>
                setValue((v) => ({
                  ...v,
                  appearance: structuredClone(defaultAppearance),
                }))
              }
            >
              Reset Appearance
            </button>
            <p className="eggs-help">
              Only visual choices reset. Your identity, selections, visibility
              and Poker consent stay as they are.
            </p>
          </section>
          <section>
            <h2>Your interests</h2>
            <Choice
              label="Affiliation"
              value={value.expression.affiliation}
              choices={affiliations}
              onChange={(v) => change("expression", "affiliation", v)}
            />
            <fieldset>
              <legend>Five favorite games</legend>
              {projects
                .filter(
                  (p) =>
                    ["game", "league"].includes(p.content.category) ||
                    value.expression.favorite_project_ids.includes(p.id),
                )
                .map((p) => (
                  <label className="room-check" key={p.id}>
                    <input
                      type="checkbox"
                      checked={value.expression.favorite_project_ids.includes(
                        p.id,
                      )}
                      disabled={
                        !value.expression.favorite_project_ids.includes(p.id) &&
                        value.expression.favorite_project_ids.length >= 5
                      }
                      onChange={(e) =>
                        change(
                          "expression",
                          "favorite_project_ids",
                          e.target.checked
                            ? [...value.expression.favorite_project_ids, p.id]
                            : value.expression.favorite_project_ids.filter(
                                (x) => x !== p.id,
                              ),
                        )
                      }
                    />
                    {p.content.title}
                  </label>
                ))}
              {value.expression.favorite_project_ids
                .filter((id) => !projects.some((p) => p.id === id))
                .map((id) => (
                  <label className="room-check" key={id}>
                    <input
                      type="checkbox"
                      checked
                      onChange={() =>
                        change(
                          "expression",
                          "favorite_project_ids",
                          value.expression.favorite_project_ids.filter(
                            (x) => x !== id,
                          ),
                        )
                      }
                    />
                    Unavailable favorite — uncheck to remove
                  </label>
                ))}
            </fieldset>
            <label>
              Pinned project
              <select
                aria-label="Pinned project"
                value={value.expression.pinned_project_id || ""}
                onChange={(e) =>
                  change(
                    "expression",
                    "pinned_project_id",
                    e.target.value || null,
                  )
                }
              >
                <option value="">None</option>
                {projects.map((p) => (
                  <option value={p.id} key={p.id}>
                    {p.content.title}
                  </option>
                ))}
                {value.expression.pinned_project_id &&
                !projects.some(
                  (p) => p.id === value.expression.pinned_project_id,
                ) ? (
                  <option value={value.expression.pinned_project_id}>
                    Unavailable — choose a replacement
                  </option>
                ) : null}
              </select>
            </label>
            <label>
              Featured note
              <textarea
                aria-label="Featured note"
                maxLength={160}
                rows={3}
                value={value.expression.featured_note}
                onChange={(e) =>
                  change("expression", "featured_note", e.target.value)
                }
              />
            </label>
          </section>
          <section>
            <h2>Featured Eight</h2>
            <p className="eggs-help">
              Your own ordered shelf of projects and works. Separate from your
              five favorites.
            </p>
            {Array.from({ length: 8 }, (_, index) => {
              const current = selected[index] || "",
                unavailable =
                  current &&
                  !selectItems.some((x) => x.type + ":" + x.id === current);
              return (
                <div className="featured-slot-control" key={index}>
                  <label>
                    Slot {index + 1}
                    <select
                      aria-label={"Featured slot " + (index + 1)}
                      value={current}
                      disabled={index > value.showcase.length}
                      onChange={(e) => slot(index, e.target.value)}
                    >
                      <option value="">Empty</option>
                      {unavailable ? (
                        <option value={current}>
                          Unavailable — kept privately
                        </option>
                      ) : null}
                      {selectItems
                        .filter(
                          (x) =>
                            !selected.includes(x.type + ":" + x.id) ||
                            current === x.type + ":" + x.id,
                        )
                        .map((x) => (
                          <option
                            key={x.type + x.id}
                            value={x.type + ":" + x.id}
                          >
                            {x.type === "work" ? "Work" : "Project"} ·{" "}
                            {x.content.title}
                          </option>
                        ))}
                    </select>
                  </label>
                  <div className="featured-slot-actions">
                    <button
                      type="button"
                      className="room-secondary"
                      aria-label={"Move featured slot " + (index + 1) + " up"}
                      disabled={index === 0 || index >= value.showcase.length}
                      onClick={() => moveSlot(index, -1)}
                    >
                      ↑ Move up
                    </button>
                    <button
                      type="button"
                      className="room-secondary"
                      aria-label={"Move featured slot " + (index + 1) + " down"}
                      disabled={index >= value.showcase.length - 1}
                      onClick={() => moveSlot(index, 1)}
                    >
                      ↓ Move down
                    </button>
                  </div>
                </div>
              );
            })}
          </section>
          <section>
            <h2>Modules &amp; privacy</h2>
            <p className="eggs-help">
              Hidden modules are omitted from your public page and its data.
            </p>
            {value.module_order.map((key, index) => (
              <div className="module-control" key={key}>
                <label className="room-check">
                  <input
                    type="checkbox"
                    checked={value.module_visibility[key]}
                    onChange={(e) =>
                      change("module_visibility", key, e.target.checked)
                    }
                  />
                  {modules[key]}
                </label>
                <div>
                  <button
                    type="button"
                    aria-label={"Move " + modules[key] + " up"}
                    disabled={index === 0}
                    onClick={() => move(key, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label={"Move " + modules[key] + " down"}
                    disabled={index === value.module_order.length - 1}
                    onClick={() => move(key, 1)}
                  >
                    ↓
                  </button>
                </div>
              </div>
            ))}
          </section>
          <div className="room-save-bar">
            <p>
              {dirty ? "Unsaved changes" : "All changes saved"} · revision{" "}
              {saved.revision}
            </p>
            <button className="eggs-button" disabled={busy || !dirty}>
              {busy ? "Saving…" : "Save My Page"}
            </button>
            <button
              type="button"
              className="room-secondary"
              disabled={busy || !dirty}
              onClick={() => {
                setValue(editableRoom(saved));
                setError("");
                setMessage("Changes discarded. Nothing was sent.");
              }}
            >
              Discard
            </button>
            {message ? <p role="status">{message}</p> : null}
            {error ? (
              <div role="alert">
                <p>{error}</p>
                <button
                  type="button"
                  className="room-secondary"
                  disabled={busy}
                  onClick={reload}
                >
                  Reload saved page
                </button>
              </div>
            ) : null}
          </div>
        </form>
        <section className="room-preview">
          <div className="room-preview-toolbar">
            <h2>Live preview</h2>
            <div role="group" aria-label="Preview width">
              <button
                aria-pressed={width === "desktop"}
                onClick={() => setWidth("desktop")}
              >
                Desktop
              </button>
              <button
                aria-pressed={width === "mobile"}
                onClick={() => setWidth("mobile")}
              >
                Mobile
              </button>
            </div>
            <span>
              {value.profile.visibility === "private"
                ? "Private — visible only to you"
                : "Public appearance"}
            </span>
          </div>
          <div className={"room-preview-canvas preview-" + width}>
            <RoomPresentation
              room={previewRoom(saved.profile, value, projects, works)}
            />
          </div>
        </section>
      </div>
    </main>
  );
}
