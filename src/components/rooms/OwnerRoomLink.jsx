"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
export function OwnerRoomLink({ handle }) {
  const [owner, setOwner] = useState(false);
  useEffect(() => {
    let active = true, sequence = 0;
    const controller = new AbortController();
    async function refresh() {
      const request = ++sequence;
      setOwner(false);
      try {
        const response = await fetch("/api/eggs/profile", {
          cache: "no-store", credentials: "same-origin", signal: controller.signal,
        });
        const data = response.ok ? await response.json() : null;
        if (active && request === sequence)
          setOwner(data?.profile?.handle === handle);
      } catch {
        if (active && request === sequence) setOwner(false);
      }
    }
    const visible = () => { if (document.visibilityState === "visible") void refresh(); };
    void refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener("eggs-auth", refresh);
    document.addEventListener("visibilitychange", visible);
    return () => {
      active = false;
      controller.abort();
      window.removeEventListener("focus", refresh);
      window.removeEventListener("eggs-auth", refresh);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [handle]);
  return owner ? (
    <Link className="room-edit-link" href="/profile/edit">
      Edit My Page ↗
    </Link>
  ) : null;
}
