"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [["/", "Home"], ["/para", "Para"], ["/music", "Music"], ["/library", "Library"]];

export function EggsNav() {
  const pathname = usePathname();
  return (
    <header className="eggs-header">
      <Link href="/" className="eggs-wordmark" aria-label="EGGS home">EGGS<span aria-hidden="true"> /</span></Link>
      <nav aria-label="EGGS" className="eggs-nav">
        {links.map(([href, label]) => (
          <Link key={href} href={href} aria-current={pathname === href || (href !== "/" && pathname.startsWith(`${href}/`)) ? "page" : undefined}>{label}</Link>
        ))}
      </nav>
      <Link href="/profile" prefetch={false} className="eggs-account">Your EGGS account <span aria-hidden="true">↗</span></Link>
    </header>
  );
}
