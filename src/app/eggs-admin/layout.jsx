import Link from "next/link";
import { roomsEnabled } from "@/lib/rooms/core.mjs";
import { communityEnabled } from "@/lib/community/core.mjs";
import { loreEnabled } from "@/lib/lore/core.mjs";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "EGGS workspace",
  robots: { index: false, follow: false },
};
export default function HubAdminLayout({ children }) {
  return (
    <main className="eggs-page hub-workspace">
      <nav className="hub-workspace-nav" aria-label="EGGS editor workspace">
        <Link href="/eggs-admin">EGGS / Editor workspace</Link>
        {roomsEnabled() ? <Link href="/eggs-admin/works">Works</Link> : null}
        {loreEnabled() ? <Link href="/eggs-admin/lore">Lore dossiers</Link> : null}
        {communityEnabled() ? (
          <Link href="/eggs-admin/community">Community review</Link>
        ) : null}
        <Link href="/projects">Public directory ↗</Link>
        <Link href="/profile">My account</Link>
      </nav>
      {children}
    </main>
  );
}
