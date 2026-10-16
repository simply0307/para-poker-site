import Link from "next/link";
export const dynamic="force-dynamic";
export const metadata={title:"EGGS workspace",robots:{index:false,follow:false}};
export default function HubAdminLayout({children}) {
 return <main className="eggs-page hub-workspace"><nav className="hub-workspace-nav" aria-label="EGGS editor workspace"><Link href="/eggs-admin">EGGS / Editor workspace</Link><Link href="/projects">Public directory ↗</Link><Link href="/profile">My account</Link></nav>{children}</main>;
}
