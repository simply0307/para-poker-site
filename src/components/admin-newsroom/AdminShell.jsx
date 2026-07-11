"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navGroups = [
  {
    label: "League Ops",
    links: [
      ["/admin", "Dashboard"],
      ["/admin/sessions", "Sessions"],
      ["/admin/players", "Players"],
      ["/admin/standings", "Standings"],
      ["/admin/moments", "Moments"],
    ],
  },
  {
    label: "Newsroom",
    links: [
      ["/admin/articles", "Articles"],
      ["/admin/drafts", "Drafts"],
      ["/admin/prompt-studio", "Prompt Studio"],
      ["/admin/newsroom", "Prompt Library"],
      ["/admin/player-session-recaps", "Player Sessions"],
      ["/admin/social-captions", "Social Captions"],
    ],
  },
  {
    label: "Pipeline",
    links: [
      ["/admin/imports", "Imports"],
      ["/admin/overrides", "Overrides"],
      ["/admin/settings", "Settings"],
      ["/", "Public Site"],
    ],
  },
];

function isActive(pathname, href) {
  if (href === "/admin") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminShell({ children, title, description, eyebrow = "Admin newsroom", actions }) {
  const pathname = usePathname();

  return (
    <main className="min-h-screen bg-[#f4f0e8] text-zinc-950">
      <div className="border-b border-zinc-300 bg-[#0b1017] text-white shadow-xl shadow-black/15">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-5 md:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link href="/admin" className="flex items-center gap-3">
              <span className="grid h-14 w-14 place-items-center overflow-hidden rounded-sm border border-amber-200/45 bg-black">
                <Image src="/images/para-league-logo.png" alt="Para League" width={62} height={62} className="h-16 w-16 object-cover" priority />
              </span>
              <span>
                <span className="block text-xs font-black uppercase tracking-[0.24em] text-amber-200">Para-Poker</span>
                <span className="block text-2xl font-black leading-none">Admin</span>
              </span>
            </Link>
            <div className="flex flex-wrap gap-2 text-xs font-black uppercase tracking-[0.14em]">
              <Link href="/" className="rounded-sm border border-white/15 px-3 py-2 text-zinc-300 hover:border-amber-200/60 hover:text-white">
                Public Site
              </Link>
              <Link href="/sessions/S0-001" className="rounded-sm border border-amber-200/35 px-3 py-2 text-amber-100 hover:bg-amber-200 hover:text-zinc-950">
                S0-001
              </Link>
            </div>
          </div>

          <nav className="grid gap-3 lg:grid-cols-3">
            {navGroups.map((group) => (
              <section key={group.label} className="rounded-md border border-white/10 bg-white/[0.04] p-3">
                <p className="mb-2 text-[0.65rem] font-black uppercase tracking-[0.2em] text-amber-200/80">{group.label}</p>
                <div className="flex flex-wrap gap-2">
                  {group.links.map(([href, label]) => {
                    const active = isActive(pathname, href);
                    return (
                      <Link
                        key={href}
                        href={href}
                        className={`rounded-sm border px-2.5 py-1.5 text-xs font-black uppercase tracking-[0.1em] transition ${
                          active
                            ? "border-amber-200 bg-amber-200 text-zinc-950"
                            : "border-white/10 bg-black/20 text-zinc-300 hover:border-amber-200/60 hover:text-white"
                        }`}
                      >
                        {label}
                      </Link>
                    );
                  })}
                </div>
              </section>
            ))}
          </nav>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-5 py-8 md:px-8">
        <header className="mb-8 flex flex-col gap-4 border-b border-zinc-300 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-700">{eyebrow}</p>
            <h1 className="mt-3 text-4xl font-black tracking-tight md:text-6xl">{title}</h1>
            {description ? <p className="mt-4 max-w-3xl leading-7 text-zinc-600">{description}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
        </header>
        {children}
      </div>
    </main>
  );
}

export function AdminCard({ href, title, children, meta }) {
  const content = (
    <article className="h-full rounded-lg border border-zinc-300 bg-white p-5 shadow-sm transition hover:border-amber-500 hover:shadow-md">
      {meta ? <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">{meta}</p> : null}
      <h2 className="text-2xl font-black">{title}</h2>
      {children ? <div className="mt-2 text-sm leading-6 text-zinc-600">{children}</div> : null}
    </article>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}

export function AdminStat({ label, value }) {
  return (
    <div className="rounded-lg border border-zinc-300 bg-white p-4 shadow-sm">
      <span className="block text-xs font-black uppercase tracking-wide text-zinc-500">{label}</span>
      <strong className="mt-2 block text-2xl">{value}</strong>
    </div>
  );
}

export function AdminPlaceholder({ title, children }) {
  return (
    <section className="rounded-lg border border-dashed border-zinc-400 bg-white/70 p-6">
      <h2 className="text-2xl font-black">{title}</h2>
      <div className="mt-3 max-w-3xl leading-7 text-zinc-600">{children}</div>
    </section>
  );
}
