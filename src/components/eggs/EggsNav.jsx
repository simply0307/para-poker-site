"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { AccountMenu } from "@/components/community/AccountMenu";

const links = [
  ["/", "Home"],
  ["/projects", "Discover"],
  ["/para", "Para"],
];

export function EggsNav({ personal = false }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  if (
    personal &&
    (pathname === "/" ||
      /^\/(projects|games|library|community|people|reath-digest|lore|watch)(\/|$)/u.test(
        pathname,
      ))
  )
    return null;
  return (
    <header className="eggs-header">
      <Link href="/" className="eggs-wordmark" aria-label="EGGS home">
        EGGS<span aria-hidden="true"> /</span>
      </Link>
      <button
        className="hub-menu-toggle"
        aria-expanded={open}
        aria-controls="eggs-navigation"
        onClick={() => setOpen(!open)}
      >
        {open ? "Close" : "Menu"}
      </button>
      <nav
        id="eggs-navigation"
        aria-label="EGGS"
        className={"eggs-nav" + (open ? " hub-nav-open" : "")}
      >
        {links.map(([href, label]) => (
          <Link
            key={href}
            href={href}
            onClick={() => setOpen(false)}
            aria-current={
              pathname === href ||
              (href !== "/" && pathname.startsWith(`${href}/`))
                ? "page"
                : undefined
            }
          >
            {label}
          </Link>
        ))}
      </nav>
      <div className="eggs-account">
        <AccountMenu />
      </div>
    </header>
  );
}
