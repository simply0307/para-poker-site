import Link from "next/link";
import Image from "next/image";
import { PublicNav } from "@/components/newsroom/PublicNav";

export function NewsroomShell({ children }) {
  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#05080b] text-stone-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(211,185,126,0.20),transparent_34%),radial-gradient(circle_at_12%_18%,rgba(124,31,31,0.18),transparent_24%),linear-gradient(180deg,rgba(11,20,28,0.96),rgba(4,5,7,1)_58%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.18] [background-image:linear-gradient(rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] [background-size:44px_44px]" />
      <div className="pointer-events-none absolute left-1/2 top-20 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(211,185,126,0.12),transparent_62%)] blur-2xl" />
      <div className="relative mx-auto w-full max-w-7xl px-4 py-5 md:px-8">
        <nav className="flex items-center justify-between gap-3 rounded-md border border-[#d8c087]/25 bg-[#061019]/88 px-3 py-2.5 shadow-2xl shadow-black/45 backdrop-blur md:px-4 md:py-3">
          <Link href="/" className="flex min-w-0 shrink-0 items-center gap-2.5 tracking-wide text-white md:gap-4">
            <span className="grid h-11 w-11 place-items-center overflow-hidden rounded-sm border border-[#d8c087]/55 bg-black shadow-[0_0_22px_rgba(216,192,135,0.22)] md:h-16 md:w-16">
              <Image src="/images/para-league-logo.png" alt="Para League" width={78} height={78} className="h-14 w-14 object-cover md:h-[4.75rem] md:w-[4.75rem]" priority />
            </span>
            <span>
              <span className="block text-[0.64rem] font-bold uppercase tracking-[0.2em] text-[#d8c087] md:text-sm md:tracking-[0.26em]">Para-Poker</span>
              <span className="block text-base font-black leading-none md:text-xl">League</span>
            </span>
          </Link>
          <PublicNav />
        </nav>
        <div className="pb-16">{children}</div>
      </div>
    </main>
  );
}

export function LeagueHero({ eyebrow, title, dek, children, aside }) {
  return (
    <section className="relative mt-5 overflow-hidden rounded-md border border-[#d8c087]/20 bg-[linear-gradient(135deg,rgba(15,29,39,0.96),rgba(5,8,11,0.98)_62%,rgba(35,9,10,0.72))] shadow-2xl shadow-black/40">
      <div className="pointer-events-none absolute -right-14 -top-20 h-80 w-80 opacity-[0.10] md:h-[440px] md:w-[440px]">
        <Image src="/images/para-league-logo.png" alt="" width={440} height={440} className="h-full w-full object-cover" />
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#d8c087] to-transparent" />
      <div className="relative grid gap-6 p-5 md:p-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div>
          {eyebrow ? <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#d8c087]">{eyebrow}</p> : null}
          <h1 className="mt-3 max-w-4xl text-4xl font-black leading-[0.98] text-white drop-shadow-[0_2px_22px_rgba(0,0,0,0.65)] md:text-6xl">{title}</h1>
          {dek ? <p className="mt-5 max-w-3xl text-lg leading-8 text-stone-300">{dek}</p> : null}
          {children ? <div className="mt-6">{children}</div> : null}
        </div>
        {aside ? <aside className="rounded-md border border-[#d8c087]/20 bg-black/35 p-4 shadow-inner shadow-black/45">{aside}</aside> : null}
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
    <div className="rounded-md border border-[#d8c087]/16 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.025))] p-4 shadow-lg shadow-black/25">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-stone-400">{label}</p>
      <strong className="mt-2 block text-2xl font-black text-[#fff1bf]">{value}</strong>
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
        {eyebrow ? <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-300">{eyebrow}</p> : null}
        <h2 className="text-2xl font-bold text-white md:text-3xl">{title}</h2>
      </div>
      {children ? <div className="max-w-xl text-sm leading-6 text-stone-400">{children}</div> : null}
    </header>
  );
}

export function EvidencePanel({ title, eyebrow, empty, children, className = "" }) {
  const items = Array.isArray(children) ? children.filter(Boolean) : children ? [children] : [];
  return (
    <section className={`rounded-md border border-[#d8c087]/16 bg-[#08111a]/78 p-5 shadow-lg shadow-black/25 ${className}`}>
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
                  <th key={column} className="border-b border-white/10 px-3 py-3 text-xs font-bold uppercase tracking-[0.14em] text-stone-400">
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
    <article className="rounded-md border border-[#d8c087]/15 bg-black/35 p-4 transition hover:border-[#d8c087]/55 hover:bg-[#0c1822]/70">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {meta ? <p className="text-xs font-bold uppercase tracking-[0.16em] text-stone-400">{meta}</p> : null}
          <h3 className="mt-1 text-xl font-bold text-white">{title}</h3>
        </div>
        {pot ? <strong className="rounded-sm bg-[#d8c087] px-3 py-1 text-sm text-[#061019]">{pot}</strong> : null}
      </div>
      {children ? <div className="mt-3 text-sm leading-6 text-stone-300">{children}</div> : null}
    </article>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

export function PlayerCard({ name, meta, href, children }) {
  const initial = String(name || "P").slice(0, 1).toUpperCase();
  const content = (
    <article className="flex h-full gap-4 rounded-md border border-[#d8c087]/15 bg-[#08111a]/78 p-4 transition hover:border-[#d8c087]/55">
      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-sm border border-[#d8c087]/35 bg-[#d8c087]/10 text-xl font-black text-[#fff1bf]">{initial}</div>
      <div>
        {meta ? <p className="text-xs font-bold uppercase tracking-[0.14em] text-stone-400">{meta}</p> : null}
        <h2 className="text-2xl font-bold text-white">{name}</h2>
        {children ? <div className="mt-2 text-sm leading-6 text-stone-300">{children}</div> : null}
      </div>
    </article>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

export function SessionCard({ title, meta, href, children }) {
  const content = (
    <article className="h-full rounded-md border border-[#d8c087]/16 bg-[linear-gradient(135deg,rgba(216,192,135,0.12),rgba(255,255,255,0.035)_45%,rgba(94,22,22,0.14))] p-5 transition hover:border-[#d8c087]/55">
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

export function PublishedArticle({ title, subheadline, paragraphs, html = "", placeholder, compact = false }) {
  return (
    <article className={`rounded-md border border-[#d8c087]/16 bg-[#061019]/82 p-5 shadow-lg shadow-black/25 md:p-7 ${compact ? "" : "max-w-4xl"}`}>
      <h1 className={`${compact ? "text-3xl md:text-4xl" : "text-4xl md:text-6xl"} font-black leading-tight text-white`}>{title}</h1>
      {subheadline ? <p className="mt-5 text-xl leading-8 text-stone-300">{subheadline}</p> : null}
      {html ? (
        <div className="richTextBody mt-8 text-lg leading-9 text-stone-200" dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <div className="mt-8 space-y-5 text-lg leading-9 text-stone-200">
          {paragraphs.length ? paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>) : <p>{placeholder}</p>}
        </div>
      )}
    </article>
  );
}
