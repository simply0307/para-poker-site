"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
export function OwnerRoomLink({ handle }) {
  const [owner, setOwner] = useState(false);
  useEffect(() => {
    let active = true;
    fetch("/api/eggs/profile", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (active) setOwner(data?.profile?.handle === handle);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [handle]);
  return owner ? (
    <Link className="room-edit-link" href="/profile/edit">
      Edit My Page ↗
    </Link>
  ) : null;
}
