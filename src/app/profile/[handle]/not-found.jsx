import Link from "next/link";

export default function ProfileNotFound() {
  return <main className="eggs-page eggs-future"><p className="eggs-eyebrow">EGGS / Profiles</p><h1>Profile not found.</h1><p className="eggs-intro">EGGS profiles are not available yet.</p><Link className="eggs-text-link" href="/profile">About EGGS profiles ↗</Link></main>;
}
