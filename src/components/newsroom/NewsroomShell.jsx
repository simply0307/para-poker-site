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

export function NewsroomShell({ children, eyebrow = "Para League" }) {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#090807] text-stone-100">
      <div className="absolute inset-x-0 top-0 -z-0 h-[420px] bg-[radial-gradient(circle_at_20%_10%,rgba(245,158,11,0.18),transparent_30%),linear-gradient(135deg,rgba(68,64,60,0.45),transparent_45%)]" />
      <div className="relative mx-auto w-full max-w-7xl px-4 py-5 md:px-8">
        <nav className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/10 bg-stone-950/80 px-4 py-3 shadow-2xl shadow-black/30 backdrop-blur">
          <Link href="/" className="flex items-center gap-3 font-black tracking-wide text-white">
            <span className="grid h-9 w-9 place-items-center rounded-lg border border-amber-300/40 bg-amber-300 text-stone-950">PL</span>
            <span>Para League</span>
          </Link>
          <div className="flex flex-wrap gap-3 text-sm text-stone-300 md:gap-4">
            {publicLinks.map(([href, label]) => (
              <Link key={href} href={href} className="rounded-full px-1 py-1 hover:text-white">
                {label}
              </Link>
            ))}
            {adminLinks.map(([href, label]) => (
              <Link key={href} href={href} className="rounded-full px-1 py-1 text-amber-300 hover:text-amber-100">
                {label}
              </Link>
            ))}
          </div>
        </nav>
        <p className="mt-8 text-xs font-black uppercase tracking-[0.22em] text-amber-300">{eyebrow}</p>
        <div className="pb-16">{children}</div>
      </div>
    </main>
  );
}

export function LeagueHero({ eyebrow, title, dek, children, aside }) {
  return (
    <section className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.09),rgba(255,255,255,0.03))] shadow-2xl shadow-black/30">
      <div className="grid gap-6 p-5 md:p-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div>
          {eyebrow ? <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-300">{eyebrow}</p> : null}
          <h1 className="mt-3 max-w-4xl text-4xl font-black leading-[0.98] text-white md:text-6xl">{title}</h1>
          {dek ? <p className="mt-5 max-w-3xl text-lg leading-8 text-stone-300">{dek}</p> : null}
          {children ? <div className="mt-6">{children}</div> : null}
        </div>
        {aside ? <aside className="rounded-xl border border-white/10 bg-stone-950/55 p-4">{aside}</aside> : null}
      </div>
    </section>
  );
}

export function PageHeader({ title, children }) {
  return (
    <LeagueHero title={title}>
      {children ? <div className="text-lg leading-8 text-stone-300">{children}</div> : null}
    </LeagueHero>
  );
}

export function StatStrip({ children }) {
  const items = Array.isArray(children) ? children.filter(Boolean) : children ? [children] : [];
  if (!items.length) return null;
  return <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{items}</section>;
}

export function StatCard({ label, value, detail }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.055] p-4 shadow-lg shadow-black/15">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-stone-400">{label}</p>
      <strong className="mt-2 block text-2xl font-black text-white">{value}</strong>
      {detail ? <p className="mt-2 text-sm leading-6 text-stone-400">{detail}</p> : null}
    </div>
  );
}

export function ContentRail({ main, rail, reverse = false }) {
  return (
    <section className={`mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] ${reverse ? "lg:[&>*:first-child]:order-2" : ""}`}>
      <div className="min-w-0">{main}</div>
      <aside className="min-w-0 space-y-5">{rail}</aside>
    </section>
  );
}

export function SectionHeader({ eyebrow, title, children }) {
  return (
    <header className="mb-4 flex flex-col gap-2 border-b border-white/10 pb-4 md:flex-row md:items-end md:justify-between">
      <div>
        {eyebrow ? <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-300">{eyebrow}</p> : null}
        <h2 className="text-2xl font-black text-white md:text-3xl">{title}</h2>
      </div>
      {children ? <div className="max-w-xl text-sm leading-6 text-stone-400">{children}</div> : null}
    </header>
  );
}

export function EvidencePanel({ title, eyebrow, empty, children, className = "" }) {
  const items = Array.isArray(children) ? children.filter(Boolean) : children ? [children] : [];
  return (
    <section className={`rounded-xl border border-white/10 bg-white/[0.045] p-5 shadow-lg shadow-black/15 ${className}`}>
      <SectionHeader eyebrow={eyebrow} title={title} />
      <div className="grid gap-3">{items.length ? items : <p className="leading-7 text-stone-300">{empty}</p>}</div>
    </section>
  );
}

export function DataTableShell({ title, columns = [], rows = [], empty = "No rows available.", renderRow }) {
  return (
    <EvidencePanel title={title} empty={empty}>
      {rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] border-separate border-spacing-0 text-left text-sm">
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column} className="border-b border-white/10 px-3 py-3 text-xs font-black uppercase tracking-[0.14em] text-stone-400">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>{rows.map(renderRow)}</tbody>
          </table>
        </div>
      ) : null}
    </EvidencePanel>
  );
}

export function MomentCard({ title, meta, pot, children, href }) {
  const content = (
    <article className="rounded-xl border border-white/10 bg-stone-950/45 p-4 transition hover:border-amber-300/50">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {meta ? <p className="text-xs font-bold uppercase tracking-[0.16em] text-stone-400">{meta}</p> : null}
          <h3 className="mt-1 text-xl font-black text-white">{title}</h3>
        </div>
        {pot ? <strong className="rounded-full bg-amber-300 px-3 py-1 text-sm text-stone-950">{pot}</strong> : null}
      </div>
      {children ? <div className="mt-3 text-sm leading-6 text-stone-300">{children}</div> : null}
    </article>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

export function PlayerCard({ name, meta, href, children }) {
  const initial = String(name || "P").slice(0, 1).toUpperCase();
  const content = (
    <article className="flex h-full gap-4 rounded-xl border border-white/10 bg-white/[0.045] p-4 transition hover:border-amber-300/50">
      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg border border-amber-300/30 bg-amber-300/15 text-xl font-black text-amber-200">{initial}</div>
      <div>
        {meta ? <p className="text-xs font-bold uppercase tracking-[0.14em] text-stone-400">{meta}</p> : null}
        <h2 className="text-2xl font-black text-white">{name}</h2>
        {children ? <div className="mt-2 text-sm leading-6 text-stone-300">{children}</div> : null}
      </div>
    </article>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

export function SessionCard({ title, meta, href, children }) {
  const content = (
    <article className="h-full rounded-xl border border-white/10 bg-[linear-gradient(135deg,rgba(245,158,11,0.1),rgba(255,255,255,0.035))] p-5 transition hover:border-amber-300/50">
      {meta ? <p className="text-xs font-bold uppercase tracking-[0.16em] text-stone-400">{meta}</p> : null}
      <h2 className="mt-2 text-3xl font-black text-white">{title}</h2>
      {children ? <div className="mt-4 text-sm leading-6 text-stone-300">{children}</div> : null}
    </article>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

export function CardGrid({ children }) {
  return <section className="grid gap-4 py-8 md:grid-cols-2 lg:grid-cols-3">{children}</section>;
}

export function NewsroomCard({ title, meta, href, children }) {
  return (
    <MomentCard title={title} meta={meta} href={href}>
      {children}
    </MomentCard>
  );
}

export function PublishedArticle({ title, subheadline, paragraphs, placeholder, compact = false }) {
  return (
    <article className={`rounded-xl border border-white/10 bg-stone-950/45 p-5 shadow-lg shadow-black/20 md:p-7 ${compact ? "" : "max-w-4xl"}`}>
      <h1 className={`${compact ? "text-3xl md:text-4xl" : "text-4xl md:text-6xl"} font-black leading-tight text-white`}>{title}</h1>
      {subheadline ? <p className="mt-5 text-xl leading-8 text-stone-300">{subheadline}</p> : null}
      <div className="mt-8 space-y-5 text-lg leading-9 text-stone-200">
        {paragraphs.length ? paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>) : <p>{placeholder}</p>}
      </div>
    </article>
  );
}
