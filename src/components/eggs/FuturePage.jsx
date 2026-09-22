import Link from "next/link";

export function FuturePage({ eyebrow, title, children }) {
  return (
    <main className="eggs-page eggs-future">
      <p className="eggs-eyebrow">{eyebrow} <span>Coming later</span></p>
      <h1>{title}</h1>
      <div className="eggs-intro">{children}</div>
      <Link href="/" className="eggs-text-link">Back to EGGS <span aria-hidden="true">↗</span></Link>
    </main>
  );
}
