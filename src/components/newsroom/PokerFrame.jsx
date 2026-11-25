"use client";
import Image from "next/image";
import Link from "next/link";
import {usePathname} from "next/navigation";

const pages=[["/poker","Clubhouse"],["/sessions","Sessions"],["/standings","Standings"],["/players","Player dossiers"],["/moments","Notable hands"],["/articles","Articles"],["/newsroom?division=poker","Reath desk"]];
export default function PokerFrame({children,leagueHeader,footer,division}) {
  const path=usePathname();
  const poker=division==="poker" || pages.slice(0,-1).some(([url])=>path===url || path.startsWith(url+"/"));
  if(!poker) return <main className="min-h-screen bg-[#070c11] text-stone-100"><div className="[&>div]:min-h-0">{leagueHeader}</div><div className="relative mx-auto max-w-7xl px-4 pb-12 md:px-8">{children}{footer}</div></main>;
  return <main className="min-h-screen bg-[#061c19] text-stone-100"><header className="border-b-2 border-[#c9a868] bg-[#0b2823]"><div className="relative isolate mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-5 px-5 py-4">
    <Image src="/images/para-poker-profile-hero.webp" alt="" fill sizes="100vw" className="-z-10 object-cover object-center opacity-20"/>
    <Link href="/poker" className="flex items-center gap-3"><Image src="/images/para-league-logo.png" width={58} height={58} alt="Para League"/><span className="font-serif text-3xl font-bold">Para Poker<small className="block font-sans text-xs uppercase tracking-widest text-amber-200">League clubhouse</small></span></Link><nav className="flex gap-5 text-sm"><Link href="/">Para League</Link><Link href="/suitfire">SuitFire ↗</Link></nav></div></header>
    <div className="mx-auto max-w-7xl px-4 md:px-8"><nav aria-label="Poker division" className="flex flex-wrap gap-x-5 gap-y-2 border-b border-amber-200/30 py-4">{pages.map(([url,label])=><Link key={url} className="text-sm font-bold text-amber-100 aria-[current=page]:underline" aria-current={path===url || path.startsWith(url+"/") || (path==="/newsroom" && url.startsWith("/newsroom"))?"page":undefined} href={url}>{label}</Link>)}</nav>{children}<footer className="mt-8 flex flex-wrap justify-between gap-4 border-t border-amber-200/30 py-6"><Link href="/">Para League</Link><Link href="/admin/newsroom?division=poker">Poker operator desk</Link></footer></div></main>;
}
