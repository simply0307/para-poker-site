"use client";
import { useSyncExternalStore } from "react";
import { themes } from "@/lib/rooms/registry.mjs";
let memoryTheme = "carton";
function readTheme() {
  try {
    const theme = localStorage.getItem("eggs-studio-theme");
    return Object.hasOwn(themes, theme) ? theme : memoryTheme;
  } catch {
    return memoryTheme;
  }
}
function subscribe(callback) {
  window.addEventListener("storage", callback);
  window.addEventListener("eggs-theme", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("eggs-theme", callback);
  };
}
export function StudioThemeFrame({ children }) {
  const theme = useSyncExternalStore(subscribe, readTheme, () => "carton");
  function choose(value) {
    memoryTheme = value;
    try {
      localStorage.setItem("eggs-studio-theme", value);
    } catch {}
    window.dispatchEvent(new Event("eggs-theme"));
  }
  return (
    <div className="personal-studio" data-theme={theme}>
      <div className="studio-topline">
        <span>EGGS / INDEPENDENT GAMES, STORIES & PEOPLE</span>
        <label>
          Studio theme{" "}
          <select
            aria-label="Studio theme"
            value={theme}
            onChange={(event) => choose(event.target.value)}
          >
            {Object.entries(themes).map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {children}
    </div>
  );
}
