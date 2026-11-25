import Image from "next/image";
import Link from "next/link";
import { divisions,sectionUrl } from "@/lib/suitfire/division.mjs";
import "./league.css";

export default function SuitFireFrame({section,children}) {
  return <main className="sf-league"><header className="sf-head"><div className="sf-wrap sf-top">
    <Link className="sf-brand" href="/suitfire"><Image src="/images/suitfire-crest.png" alt="" width={54} height={54}/><span>SuitFire<small>Competitive league</small></span></Link>
    <nav aria-label="League divisions"><Link href="/">Para League</Link><Link href="/poker">Poker ↗</Link></nav>
  </div></header><nav className="sf-wrap sf-nav" aria-label="SuitFire division">{divisions.map(d=><Link key={d.id} href={sectionUrl(d.id)} aria-current={section===d.id?"page":undefined}>{d.label}</Link>)}</nav>
  <div className="sf-wrap sf-content">{children}</div><footer className="sf-wrap sf-footer"><Link href="/">Para League</Link><Link href="/admin/suitfire">SuitFire operator desk</Link></footer></main>;
}
