"use client";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { themes } from "@/lib/rooms/registry.mjs";
let memoryTheme = "carton";
function readTheme() {
  try {
    const value = localStorage.getItem("eggs-studio-theme");
    return Object.hasOwn(themes, value) ? value : memoryTheme;
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
export function StudioShell({ children }) {
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
        <span>INDEPENDENTLY OPERATED · OPEN TO CURIOSITY</span>
        <label>
          Studio theme{" "}
          <select
            aria-label="Studio theme"
            value={theme}
            onChange={(e) => choose(e.target.value)}
          >
            {Object.entries(themes).map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <header className="studio-masthead">
        <Link href="/" aria-label="EGGS home">
          <strong>EGGS</strong>
        </Link>
        <div>
          THE PERSONAL
          <br />
          <b>INTERNET.</b>
        </div>
        <span className="studio-seal" aria-hidden="true">
          SMALL WEB
          <br />
          BIG IDEAS
          <br />★
        </span>
      </header>
      <nav className="studio-tabs" aria-label="Studio">
        <Link href="/">Bulletin</Link>
        <Link href="/games">Games &amp; leagues</Link>
        <Link href="/library">Library</Link>
        <Link href="/projects">All projects</Link>
        <Link href="/profile">My page ↗</Link>
      </nav>
      {children}
      <footer className="studio-footer">
        <b>EGGS / MADE FOR PEOPLE.</b>
        <span>Take a look around. Leave a little more yourself.</span>
        <Link href="/eggs-admin">Editor workspace</Link>
      </footer>
    </div>
  );
}
