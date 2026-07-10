import Link from "next/link";

const publicLinks = [
  ["/sessions", "Sessions"],
  ["/players", "Players"],
  ["/standings", "Standings"],
  ["/moments", "Moments"],
  ["/articles", "Articles"],
];

const adminLinks = [
  ["/admin", "Admin"],
  ["/admin/newsroom", "Newsroom"],
  ["/admin/articles", "Articles"],
];

export function NewsroomShell({ children, eyebrow = "Para League Newsroom" }) {
  return (
    <main className="min-h-screen bg-stone-950 text-stone-100">
      <div className="mx-auto w-full max-w-6xl px-5 py-6 md:px-8">
        <nav className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
          <Link href="/" className="font-black tracking-wide text-white">
            Para League
          </Link>
          <div className="flex flex-wrap gap-4 text-sm text-stone-300">
            {publicLinks.map(([href, label]) => (
              <Link key={href} href={href} className="hover:text-white">
                {label}
              </Link>
            ))}
            {adminLinks.map(([href, label]) => (
              <Link key={href} href={href} className="text-amber-300 hover:text-amber-100">
                {label}
              </Link>
            ))}
          </div>
        </nav>
        <p className="mt-10 text-xs font-black uppercase tracking-[0.22em] text-amber-300">{eyebrow}</p>
        {children}
      </div>
    </main>
  );
}

export function PageHeader({ title, children }) {
  return (
    <header className="max-w-3xl py-5">
      <h1 className="text-4xl font-black leading-tight text-white md:text-6xl">{title}</h1>
      {children ? <div className="mt-4 text-lg leading-8 text-stone-300">{children}</div> : null}
    </header>
  );
}

export function CardGrid({ children }) {
  return <section className="grid gap-4 py-8 md:grid-cols-2 lg:grid-cols-3">{children}</section>;
}

export function NewsroomCard({ title, meta, href, children }) {
  const content = (
    <article className="h-full rounded-lg border border-white/10 bg-white/[0.04] p-5 transition hover:border-amber-300/50">
      {meta ? <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-stone-400">{meta}</p> : null}
      <h2 className="text-2xl font-black text-white">{title}</h2>
      {children ? <div className="mt-3 text-sm leading-6 text-stone-300">{children}</div> : null}
    </article>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}

export function PublishedArticle({ title, subheadline, paragraphs, placeholder }) {
  return (
    <article className="max-w-3xl py-8">
      <h1 className="text-4xl font-black leading-tight text-white md:text-6xl">{title}</h1>
      {subheadline ? <p className="mt-5 text-xl leading-8 text-stone-300">{subheadline}</p> : null}
      <div className="mt-8 space-y-5 text-lg leading-9 text-stone-200">
        {paragraphs.length ? paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>) : <p>{placeholder}</p>}
      </div>
    </article>
  );
}
