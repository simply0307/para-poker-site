"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ADMIN_ROUTE_GROUPS } from "@/lib/newsroom/adminRoutes";
import { OperatorSignOut } from "@/components/admin-newsroom/OperatorSignOut";

function isActive(pathname, href) {
  if (href === "/admin") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminShell({ children, title, description, eyebrow = "Admin newsroom", actions, division, view }) {
  const pathname = usePathname();

  if (division === "SuitFire") {
    const destinations = [
      ["duels","Duel intake","/admin/suitfire"],
      ["reports","Report queue","/admin/suitfire?view=reports"],
      ["imports","Result review","/admin/imports?division=suitfire"],
      ["records","Season ledger","/admin/suitfire?view=records"]
    ];
    return <main className="min-h-screen bg-stone-100 text-stone-950">
      <div className="border-b-4 border-orange-500 bg-[#241615] text-white"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4">
        <Link href="/admin" className="text-sm font-bold">← Para League / Division selector</Link>
        <div className="flex items-center gap-4 text-sm"><Link className="underline" href="/admin/newsroom?division=poker">Switch to Poker</Link><OperatorSignOut/></div>
      </div></div>
      <div className="mx-auto grid max-w-7xl lg:grid-cols-[245px_minmax(0,1fr)]">
        <aside className="bg-[#36201d] p-5 text-white lg:min-h-screen lg:p-7">
          <p className="text-xs font-bold uppercase tracking-widest text-orange-200">Competitive operations</p>
          <p className="mb-6 mt-1 text-4xl font-black tracking-tight">SuitFire</p>
          <nav aria-label="SuitFire operations" className="grid grid-cols-2 gap-2 lg:grid-cols-1">{destinations.map(([key,label,href])=><Link key={key} href={href} aria-current={key===view?"page":undefined} className={key===view?"rounded bg-orange-100 px-3 py-3 font-bold text-stone-950":"rounded border border-orange-100/35 px-3 py-3 hover:bg-white/10"}>{label}</Link>)}</nav>
          <Link href="/suitfire" className="mt-6 inline-block text-sm text-orange-100 underline">Player-facing league ↗</Link>
        </aside>
        <section className="min-w-0 px-5 py-8 md:p-9"><header className="mb-6 border-b border-stone-300 pb-5"><p className="text-xs font-bold uppercase tracking-widest text-orange-800">SuitFire / League operations</p><h1 className="mt-2 text-4xl font-black tracking-tight">{title}</h1><p className="mt-3 max-w-2xl text-stone-700">{description}</p></header>{children}</section>
      </div></main>;
  }
  return (
    <main className="min-h-screen bg-[#f4f0e8] text-zinc-950">
      <div className="border-b border-zinc-300 bg-[#112c29] text-white shadow-xl shadow-black/15">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-5 md:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link href="/admin" className="flex items-center gap-3">
              <span className="grid h-14 w-14 place-items-center overflow-hidden rounded-sm border border-amber-200/45 bg-black">
                <Image src="/images/para-league-logo.png" alt="Para League" width={62} height={62} className="h-16 w-16 object-cover" priority />
              </span>
              <span>
                <span className="block text-xs font-black uppercase tracking-[0.24em] text-amber-200">Para League</span>
                <span className="block text-2xl font-black leading-none">{division==="League"?"Operator desks":"Poker operations"}</span>
              </span>
            </Link>
            <div className="flex flex-wrap gap-2 text-xs font-black uppercase tracking-[0.14em]">
              <Link href="/" className="rounded-sm border border-white/15 px-3 py-2 text-zinc-300 hover:border-amber-200/60 hover:text-white">
                Public Site
              </Link>
              <Link className="rounded border border-amber-200/40 px-3 py-2" href="/admin/suitfire">SuitFire desk</Link>
              <Link className="rounded border border-amber-200/40 px-3 py-2" href="/admin/newsroom?division=poker">Poker desk</Link>
              <OperatorSignOut />
            </div>
          </div>

          {division !== "League" && <details><summary className="cursor-pointer text-sm font-semibold">Poker and league tools</summary><nav className="mt-3 grid gap-3 lg:grid-cols-4">
            {ADMIN_ROUTE_GROUPS.map((group) => (
              <section key={group.label} className="rounded-md border border-white/10 bg-white/[0.04] p-3">
                <p className="mb-2 text-[0.65rem] font-black uppercase tracking-[0.2em] text-amber-200/80">{group.label}</p>
                <div className="flex flex-wrap gap-2">
                  {group.links.map(({ href, label }) => {
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
          </nav></details>}
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
