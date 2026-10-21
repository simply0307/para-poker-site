import Link from "next/link";

export default function ProfileNotFound() {
  return <main className="eggs-page eggs-future"><p className="eggs-eyebrow">EGGS / Profiles</p><h1>Profile not found.</h1><p className="eggs-intro">This profile is private or unavailable.</p><Link className="eggs-text-link" href="/profile">Your EGGS account ↗</Link></main>;
}
