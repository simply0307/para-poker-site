import Link from "next/link";
import { StudioThemeFrame } from "./StudioThemeFrame";
import { AccountMenu } from "@/components/community/AccountMenu";
import { communityEnabled } from "@/lib/community/core.mjs";
import { loreEnabled } from "@/lib/lore/core.mjs";
export function StudioShell({ children }) {
  const community = communityEnabled();
  return (
    <StudioThemeFrame>
      <header className="studio-masthead">
        <Link href="/" aria-label="EGGS home">
          <strong>EGGS</strong>
        </Link>
        <div>
          THE PERSONAL
          <br />
          <b>INTERNET.</b>
        </div>
        <div className="studio-account">
          <AccountMenu />
        </div>
      </header>
      <nav className="studio-tabs" aria-label="Studio">
        <Link href="/">Home</Link>
        <Link href="/games">Games &amp; leagues</Link>
        <Link href="/reath-digest">Reath Digest</Link>
        {loreEnabled() ? <Link href="/lore">Lore</Link> : null}
        {community ? (
          <>
            <Link href="/community">Community</Link>
            <Link href="/people">People</Link>
          </>
        ) : null}
        <Link href="/library">Library</Link>
        <Link href="/projects">All projects</Link>
      </nav>
      {children}
      <footer className="studio-footer">
        <div>
          <b>EGGS / MADE FOR PEOPLE.</b>
          <span>Independent projects. A shared home.</span>
        </div>
        <nav aria-label="EGGS footer">
          <Link href="/reath-digest">Read Reath</Link>
          {community ? <Link href="/community">Say hello</Link> : null}
          <Link href="/eggs-admin">Editor workspace</Link>
        </nav>
      </footer>
    </StudioThemeFrame>
  );
}
